import {areaPlan,rows,broadcast} from '../planting/area-fixtures.mjs';
import {bed} from '../planting/fixtures.mjs';
import {straw} from '../mulch/fixtures.mjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
const model=await loadModule('tests/history/work-modules.ts','work-model');after(cleanupModules);
const task=(values={})=>({id:'task',gardenId:'garden',bedId:'bed',bedName:'Herbs',activityType:'care',plannedDate:'2026-11-24',title:'Water herbs',notes:'Plan',status:'planned',version:1,order:1,...values});
const event=(values={})=>({id:'event',gardenId:'garden',date:'2026-11-25',title:'Watered',notes:'Done',bedId:'bed',bedName:'Recorded herbs',kind:'bed',status:'completed',deleted:false,...values});
const filters=(values={})=>({gardenIds:['garden'],bed:'',status:'',activity:'',month:'2026-11',day:'',allDates:false,...values});

test('work calendar derives overdue status without changing task status or automatically completing anything',()=>{
  const source=[task(),task({id:'cancelled',status:'cancelled'})],before=structuredClone(source);
  assert.equal(model.combineWork(source,[],'2026-11-24')[0].status,'cancelled');
  const rows=model.combineWork(source,[],'2026-11-25');assert.equal(rows.find(r=>r.id==='task:task').status,'overdue');assert.deepEqual(source,before);
  assert.equal(model.combineWork([task()],[],'2026-11-24')[0].status,'planned');
});
test('linked task completion appears once and uses corrected frozen history metadata, preserving planned date',()=>{
  const completed=task({status:'completed',completedDate:'2026-11-25',completedNotes:'Old completion',completionEventId:'event'});
  const entries=model.combineWork([completed],[event({date:'2026-11-26',title:'Corrected',notes:'Corrected notes'}),event({id:'independent'})]);
  assert.equal(entries.length,2);const row=entries.find(r=>r.task);assert.equal(row.date,'2026-11-26');assert.equal(row.title,'Corrected');assert.equal(row.notes,'Corrected notes');assert.equal(row.plannedDate,'2026-11-24');assert.equal(row.bedName,'Recorded herbs');
  assert.equal(entries.filter(r=>r.event?.id==='event').length,1);
});
test('removed completed records leave completed task metadata without a history link; unlinked deleted records remain absent',()=>{
  const done=task({status:'completed',completedDate:'2026-11-25',completionEventId:'event'});
  const entries=model.combineWork([done],[event({deleted:true}),event({id:'removed',deleted:true})]);assert.equal(entries.length,1);assert.equal(entries[0].status,'completed');assert.equal(entries[0].historyRemoved,true);assert.equal(entries[0].event,undefined);
});
test('garden, bed, status, activity and date filters compose, including empty scope and overdue across months',()=>{
  const entries=model.combineWork([task({plannedDate:'2026-10-01'}),task({id:'future',plannedDate:'2026-12-01'}),task({id:'other',gardenId:'other',activityType:'harvest'}),task({id:'cancelled',status:'cancelled'})],[event()],'2026-11-24');
  assert.equal(model.filterWork(entries,filters()).length,1);
  assert.equal(model.filterWork(entries,filters({status:'overdue',allDates:true}))[0].task.id,'task');
  assert.equal(model.filterWork(entries,filters({gardenIds:['other'],activity:'harvest'})).length,1);
  assert.equal(model.filterWork(entries,filters({bed:'garden:bed',status:'completed',day:'2026-11-25'})).length,1);
  assert.equal(model.filterWork(entries,filters({gardenIds:[]})).length,0);
  assert.equal(model.filterWork(entries,filters({status:'cancelled'})).length,1);
});
test('task validation accepts date-only leap days and bounded titles; rejects impossible dates and unknown activity types',()=>{
  assert.equal(model.validateTask(task({plannedDate:'2028-02-29'})),null);
  for(const changes of [{plannedDate:'2027-02-29'},{plannedDate:'2026-04-31'},{plannedDate:'2026-11-24T00:00:00Z'},{plannedDate:'0000-01-01'},{title:' '},{title:'x'.repeat(121)},{notes:'x'.repeat(2001)},{activityType:'unknown'},{gardenId:''}])assert.ok(model.validateTask(task(changes)));
});


test('generated planting work describes saved row and broadcast quantities without mutating the garden',()=>{
  const current={id:'garden',name:'Garden',version:1,dimensions:{widthCm:500,lengthCm:500},beds:[{...bed,name:'Herbs',areaPlan:areaPlan(rows())}]},before=structuredClone(current);
  const result=model.generateTaskWork(current,bed.id,'planting');assert.match(result.workRecap,/Herbs.*100 × 200 cm/);assert.match(result.workItems[0].text,/Plant 12 Type A plants/);assert.equal(result.workItems[0].done,false);assert.deepEqual(current,before);
  current.beds[0].areaPlan=areaPlan(broadcast());const sow=model.generateTaskWork(current,'','planting');assert.match(sow.workItems[0].text,/Sow 25 g of Green manure mix/);
});
test('generated mulch preserves layer order and care/harvest ask for review rather than inventing treatment or readiness',()=>{
  const garden={id:'g',name:'Garden',version:1,dimensions:{widthCm:500,lengthCm:500},beds:[{...bed,areaPlan:areaPlan(rows({mulch:[{id:'layer',material:straw},{id:'layer2',material:{...straw,name:'Compost'}}]}))}]};
  assert.match(model.generateTaskWork(garden,bed.id,'mulch').workItems[0].text,/Straw → Compost.*bottom to top/);
  assert.match(model.generateTaskWork(garden,bed.id,'care').workItems[0].text,/Check.*care needed/);assert.match(model.generateTaskWork(garden,bed.id,'harvest').workItems[0].text,/harvest readiness/);
  garden.beds[0].areaPlan=areaPlan(broadcast());assert.doesNotMatch(model.generateTaskWork(garden,'','harvest').workItems[0].text,/harvest.*Green manure/);
  assert.equal(model.generateTaskWork(garden,'missing','care').workItems.length,0);
});
test('work validation enforces lengths and unique checklist identities while empty legacy checklists remain valid',()=>{
  const item={id:'item',text:'Water if needed',done:false};assert.equal(model.validateWork('',[]),null);assert.equal(model.validateWork('Recap',[item]),null);
  for(const entries of [[item,item],[{...item,text:' '}],[{...item,done:1}],[{...item,text:'x'.repeat(501)}],[{...item,layout:{}}],Array.from({length:101},(_,i)=>({...item,id:String(i)}))])assert.ok(model.validateWork('Recap',entries));
  assert.ok(model.validateTask(task({workRecap:'x'.repeat(4001),workItems:[]})));
});
test('completed task work and unchecked progress survive history correction and removal',()=>{
  const done=task({status:'completed',completedDate:'2026-11-25',completionEventId:'event',workRecap:'Original scope',workItems:[{id:'a',text:'Plant tomatoes',done:false}]});
  const result=model.combineWork([done],[event({title:'Corrected',deleted:true})])[0];assert.equal(result.status,'completed');assert.equal(result.task.workRecap,'Original scope');assert.equal(result.task.workItems[0].done,false);
});
