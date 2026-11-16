import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { areaV2, bed, planV5, planV4, snapshot } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'catalogue-border');
after(cleanupModules);

test('plant-type border distance is captured with the reference and remains independent of later catalogue edits', () => {
  const catalogue={families:[{id:'family-a',name:'Family A',version:1,plantSpacingCm:30,rowSpacingCm:40}],
    plants:[{id:'type-a',familyId:'family-a',name:'Type A',version:1,plantSpacingCm:null,rowSpacingCm:null,borderDistanceCm:35}]};
  const plant=model.snapshotPlant(catalogue.plants[0],catalogue);
  const area=areaV2({rowCount:2,plant}),plan=planV5({areas:[area]});
  const before=model.previewPlanting(plan,bed);
  assert.deepEqual(before.rowGuides.map(row=>row.x1Cm),[35,65]);
  assert.deepEqual(model.planAreaMargins(plan,area),{alongCm:35,acrossCm:35});
  catalogue.plants[0].borderDistanceCm=5;
  assert.deepEqual(model.previewPlanting(plan,bed),before);
  assert.equal(model.snapshotPlant(catalogue.plants[0],catalogue).borderDistanceCm,5);
  assert.equal(model.canResizePlantingArea(plan,area,{...area,widthCm:70},bed),false);
  assert.equal(model.areaRowLayout(planV4({areas:[area]}),area,bed).rowPosition(0),20,'older formats retain their original margins');
});

test('neighbour shrinking stops at the neighbour plant type’s own minimum and preserves chosen rows', () => {
  const first=areaV2({rowCount:2,widthCm:100}),neighbour=areaV2({id:'neighbour',xCm:100,widthCm:100,rowCount:2,plant:{...snapshot,borderDistanceCm:5}});
  const plan=planV5({areas:[first,neighbour]}),size={widthCm:200,lengthCm:200};
  const next=model.resizePlantingAreas(plan,first.id,{...first,widthCm:185},size);
  assert.equal(next[1].widthCm,15);assert.equal(next[1].rowCount,2);
  assert.equal(model.resizePlantingAreas(plan,first.id,{...first,widthCm:190},size),null);
});
