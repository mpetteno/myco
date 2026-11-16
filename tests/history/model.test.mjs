import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const model = await loadModule('tests/history/modules.ts', 'history-model');
after(cleanupModules);
const events = [{ id: 'a', date: '2026-02-10', order: 1 }, { id: 'b', date: '2026-02-10', order: 2 }, { id: 'c', date: '2026-02-20', order: 3 }];
test('day selection uses the final event on or before the chosen day without inventing earlier layouts', () => {
  assert.equal(model.eventOnDate(events, '2026-02-09'), null);
  assert.equal(model.eventOnDate(events, '2026-02-10').id, 'b');
  assert.equal(model.eventOnDate(events, '2026-02-15').id, 'b');
  assert.equal(model.eventOnDate(events, '2026-03-01').id, 'c');
});
test('event navigation preserves same-day order and steps from intervening dates to their nearest event', () => {
  assert.equal(model.eventNeighbours(events, 'a', '2026-02-10', false).previous, null);
  assert.equal(model.eventNeighbours(events, 'a', '2026-02-10', false).next.id, 'b');
  assert.equal(model.eventNeighbours(events, 'b', '2026-02-15', false).previous.id, 'b');
  assert.equal(model.eventNeighbours(events, 'b', '2026-02-15', false).next.id, 'c');
  assert.equal(model.eventNeighbours(events, null, '2026-02-01', false).next.id, 'a');
  assert.equal(model.eventNeighbours(events, null, '2026-02-01', true).previous.id, 'c');
  assert.equal(model.eventNeighbours([], null, '2026-02-01', true).previous, null);
});
test('date handling rejects impossible dates and uses the local calendar day instead of UTC truncation', () => {
  assert.equal(model.parseDay('2026-02-29'), null);
  assert.ok(model.parseDay('2024-02-29')); assert.ok(model.parseDay('0001-01-01'));
  assert.equal(model.parseDay('2026-2-1'), null);
  const value = { getFullYear: () => 2026, getMonth: () => 0, getDate: () => 2 };
  assert.equal(model.dayKey(value), '2026-01-02');
  assert.ok(model.validateEventDetails({ date: '2026-02-30', title: 'Entry', notes: '' }));
  assert.ok(model.validateEventDetails({ date: '2026-02-10', title: '  ', notes: '' }));
});

test('planned work stays outside day-based actual history and completed checkpoints affect only their bed',()=>{
  const base={id:'base',date:'2026-03-01',order:1,kind:'layout',status:'completed',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[{id:'a',name:'A',xCm:0,yCm:0,widthCm:100,lengthCm:200},{id:'b',name:'B',xCm:150,yCm:0,widthCm:100,lengthCm:200}]}};
  const planned={...base,id:'planned:work',date:'2026-03-02',order:2,kind:'planting',status:'planned',bedId:'a'};
  const done={...planned,id:'done',date:'2026-03-03',order:3,status:'completed',document:structuredClone(base.document)};
  done.document.beds[0].name='Physical result'; done.document.beds[1].name='Unfinished proposal';
  assert.equal(model.eventOnDate([base,planned],'2026-03-02').id,'base');
  const actual=model.actualHistory([base,planned,done],done);
  assert.equal(actual.beds.find(bed=>bed.id==='a').name,'Physical result');
  assert.equal(actual.beds.find(bed=>bed.id==='b').name,'B');
  const first=model.actualHistory([done],done);
  assert.equal(first.beds.length,1,'no unconfirmed beds are invented without a layout baseline');
});

test('a focused area fills the viewport without changing its bed-relative coordinates in either orientation',()=>{
  const area={xCm:150,yCm:50,widthCm:40,lengthCm:80};
  for(const size of [{width:900,height:500},{width:360,height:740}]){
    const view=model.getAreaViewport(area,size),scale=view.pixelsPerCm;
    for(const [x,y] of [[150,50],[190,50],[150,130],[190,130]]){
      const px=view.xPx+(view.rotationDeg===90?-y:x)*scale;
      const py=view.yPx+(view.rotationDeg===90?x:y)*scale;
      assert.ok(px>=18-1e-6 && px<=size.width-18+1e-6);
      assert.ok(py>=18-1e-6 && py<=size.height-18+1e-6);
    }
  }
  assert.deepEqual(area,{xCm:150,yCm:50,widthCm:40,lengthCm:80});
});

test('completed work always requires an actual date',()=>{
  assert.ok(model.validateActivity({bedId:'a',date:'',title:'Done',notes:''}));
  assert.equal(model.validateActivity({bedId:'a',date:'2026-01-01',title:'Done',notes:''}),null);
});
