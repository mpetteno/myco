import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { areaV2, planV5 } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'resize-neighbours');
after(cleanupModules);
const bounds = (xCm, yCm, widthCm, lengthCm) => ({ xCm, yCm, widthCm, lengthCm });
const area = (id, rectangle) => areaV2({ id, ...rectangle, rowCount: 2 });

test('all edge and corner expansions shrink touched neighbours on the 5 cm grid without mutating the source', () => {
  const areas = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) areas.push(area(`${x}:${y}`, bounds(x * 100, y * 100, 100, 100)));
  const plan = planV5({ areas }), original = structuredClone(plan);
  for (const [x, y, w, h] of [[90,100,110,100],[100,100,110,100],[100,90,100,110],[100,100,100,110],
    [90,90,110,110],[100,90,110,110],[90,100,110,110],[100,100,110,110]]) {
    const next = model.resizePlantingAreas(plan,'1:1',bounds(x,y,w,h),{widthCm:300,lengthCm:300});
    assert.ok(next);
    assert.equal(model.validateGarden({name:'Garden',dimensions:{widthCm:300,lengthCm:300},beds:next.map(item=>({...item,name:item.id}))}),null);
    for (const neighbour of next.filter(item=>item.id!=='1:1')) {
      const before=areas.find(item=>item.id===neighbour.id);
      assert.equal(neighbour.rowCount,2);
      assert.ok(neighbour.xCm>=before.xCm&&neighbour.yCm>=before.yCm);
      assert.ok(neighbour.xCm+neighbour.widthCm<=before.xCm+100&&neighbour.yCm+neighbour.lengthCm<=before.yCm+100);
    }
    assert.equal(model.previewPlanting({...plan,areas:next},{widthCm:300,lengthCm:300}).error,null);
  }
  assert.deepEqual(plan,original);
});

test('horizontal and vertical shrinking preserves opposite borders, row counts and minimum clearances', () => {
  for (const vertical of [false,true]) {
    const first=area('first',bounds(0,0,100,100));
    const neighbour=area('next',vertical?bounds(0,100,100,100):bounds(100,0,100,100));
    neighbour.rowDirection=vertical?'width':'length';
    const plan=planV5({areas:[first,neighbour]});
    const size=vertical?{widthCm:100,lengthCm:200}:{widthCm:200,lengthCm:100};
    const proposal=vertical?bounds(0,0,100,165):bounds(0,0,165,100);
    const next=model.resizePlantingAreas(plan,'first',proposal,size);
    assert.ok(next);assert.equal(next[1].rowCount,2);
    const layout=model.areaRowLayout({...plan,areas:next},next[1],size);
    assert.equal(layout.rows,2);assert.equal(layout.rowStep,5);
    assert.ok(model.getAreaMeasurements({...plan,areas:next},next[1],size).filter(item=>item.kind==='border').every(item=>item.distanceCm>=15));
    assert.equal(model.resizePlantingAreas(plan,'first',vertical?bounds(0,0,100,170):bounds(0,0,170,100),size),null);
  }
});

test('one expansion can shrink several neighbours atomically, while moves, off-grid and overflow remain rejected', () => {
  const areas=[area('first',bounds(0,0,100,100)),area('top',bounds(100,0,100,50)),area('bottom',bounds(100,50,100,50))];
  const size={widthCm:200,lengthCm:100},plan=planV5({areas});
  const next=model.resizePlantingAreas(plan,'first',bounds(0,0,120,100),size);
  assert.deepEqual(next.slice(1).map(item=>[item.xCm,item.widthCm]),[[120,80],[120,80]]);
  assert.equal(model.resizePlantingAreas(plan,'first',bounds(5,0,100,100),size),null,'moving does not shrink others');
  assert.equal(model.resizePlantingAreas(plan,'first',bounds(0,0,121,100),size),null);
  assert.equal(model.resizePlantingAreas(plan,'first',bounds(0,0,205,100),size),null);
  assert.equal(model.resizePlantingAreas(plan,'first',bounds(0,0,200,100),size),null,'neighbours cannot disappear');
});

test('mulch areas retain layer ordering and stop at a 5 cm rectangle, independently of planting', () => {
  const areas=[{id:'first',...bounds(0,0,50,100),layers:[{id:'straw'},{id:'chips'}]},
    {id:'next',...bounds(50,0,50,100),layers:[{id:'leaves'}]}];
  const next=model.resizeAreas(areas,'first',bounds(0,0,95,100),{widthCm:100,lengthCm:100});
  assert.equal(next[1].widthCm,5);assert.equal(next[1].xCm,95);
  assert.deepEqual(next.map(item=>item.layers),areas.map(item=>item.layers));
  assert.equal(model.resizeAreas(areas,'first',bounds(0,0,100,100),{widthCm:100,lengthCm:100}),null);
});
