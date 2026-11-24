import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
const api=await loadModule('tests/history/work-modules.ts','work-repository');after(cleanupModules);
const row={id:'task',garden_id:'garden',task_order:1,bed_id:'bed',bed_name:'Herbs',activity_type:'care',planned_date:'2026-11-24',title:'Water',notes:'',status:'planned',version:2};
function fixture(handler){const requests=[];globalThis.__mycoAuthClient=createClient('https://fixture.supabase.co','sb_publishable_fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init={})=>{const request={url:new URL(input),body:init.body?JSON.parse(init.body):null,accept:new Headers(init.headers).get('Accept')};requests.push(request);const {data,status=200}=handler(request);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}}});return requests;}
test('work reads are permission-checked and paginated independently, retaining deleted event metadata for linked tasks',async()=>{
  const requests=fixture(({url})=>({data:url.pathname.endsWith('gardens')?[{id:'garden'}]:url.pathname.endsWith('garden_tasks')?(url.searchParams.get('task_order')==='gt.0'?Array.from({length:200},(_,i)=>({...row,id:`task-${i}`,task_order:i+1})):[{...row,task_order:201}]):[{id:'event',garden_id:'garden',event_order:1,event_date:'2026-11-25',title:'Removed',notes:'',deleted_at:'2026-11-26'}]}));
  const result=await api.loadWork(['garden']);assert.equal(result.tasks.length,201);assert.equal(result.events[0].deleted,true);
  assert.ok(requests.some(r=>r.url.searchParams.get('task_order')==='gt.200'));
  assert.ok(requests.filter(r=>!r.url.pathname.endsWith('gardens')).every(r=>r.url.searchParams.get('garden_id')==='in.(garden)'));
  assert.equal(requests.find(r=>r.url.pathname.endsWith('garden_work_events')).url.searchParams.get('deleted_at'),null);
});
test('empty scopes make no requests and lost access fails without reading private task/event rows',async()=>{
  const requests=fixture(()=>({data:[]}));assert.deepEqual(await api.loadWork([]),{tasks:[],events:[]});assert.equal(requests.length,0);
  await assert.rejects(api.loadWork(['garden']),/no longer available/);assert.equal(requests.length,1);
});
test('task requests contain metadata and revision/retry keys only; completion explicitly supplies the reviewed saved version',async()=>{
  const requests=fixture(()=>({data:row}));const details={gardenId:'garden',bedId:'bed',activityType:'care',plannedDate:'2026-11-24',title:' Water ',notes:' Notes '};
  const saved=await api.saveTask(details,undefined,'task','request');assert.equal(saved.version,2);assert.equal(requests[0].accept,'application/vnd.pgrst.object+json');assert.equal(requests[0].body.p_expected_version,null);assert.equal(requests[0].body.p_title,'Water');assert.equal(requests[0].body.p_notes,'Notes');assert.equal(requests[0].body.p_request_id,'request');
  assert.ok(!JSON.stringify(requests[0].body).includes('snapshot'));
  await api.completeTask(saved,{version:7},'2026-11-25',' Done ',true,'complete-request');assert.equal(requests[1].accept,'application/vnd.pgrst.object+json');assert.equal(requests[1].body.p_expected_version,2);assert.equal(requests[1].body.p_garden_version,7);assert.equal(requests[1].body.p_confirmed,true);assert.equal(requests[1].body.p_request_id,'complete-request');
});
test('storage errors preserve conflicts, permission failures and unavailable migration messages',async()=>{
  fixture(()=>({data:{code:'40001'},status:409}));await assert.rejects(api.saveTask({gardenId:'garden',bedId:'',activityType:'other',plannedDate:'2026-11-24',title:'Task',notes:''},undefined,'task','req'),e=>e.conflict&&/Reload/.test(e.message));
  assert.match(api.taskError(new Error('This task is no longer planned.')).message,/no longer planned/);assert.match(api.taskError(new TypeError('Failed to fetch')).message,/task storage/);
  assert.match(api.taskError({code:'PGRST202'}).message,/not available yet/);assert.match(api.taskError({code:'42501'}).message,/access|permission/i);
});


test('before migration 034, completed history remains available through paginated source metadata and planning is disabled',async()=>{
  const requests=fixture(({url})=>{
    if(url.pathname.endsWith('gardens'))return {data:[{id:'garden'}]};
    if(url.pathname.endsWith('garden_tasks')||url.pathname.endsWith('garden_work_events'))return {data:{code:'PGRST205'},status:404};
    return {data:url.searchParams.get('event_order')==='gt.0'?Array.from({length:200},(_,i)=>({id:`event-${i}`,garden_id:'garden',event_order:i+1,event_date:'2026-11-24',title:'Recorded',notes:''})):[{id:'removed',garden_id:'garden',event_order:201,event_date:'2026-11-25',title:'Removed',notes:'',deleted_at:'2026-11-26'}]};
  });
  const data=await api.loadWork(['garden']);assert.equal(data.planningAvailable,false);assert.equal(data.tasks.length,0);assert.equal(data.events.length,201);assert.equal(data.events.at(-1).deleted,true);
  const reads=requests.filter(r=>r.url.pathname.endsWith('garden_layout_events'));assert.equal(reads.length,2);assert.ok(reads.every(r=>!r.url.searchParams.get('select').includes('snapshot')));
  assert.ok(reads.every(r=>r.url.searchParams.get('garden_id')==='in.(garden)'));
});

test('access and connection failures never become a misleading completed-only fallback',async()=>{
  const requests=fixture(({url})=>url.pathname.endsWith('gardens')?{data:[{id:'garden'}]}:{data:{code:'42501'},status:403});
  await assert.rejects(api.loadWork(['garden']),/access was removed/);assert.equal(requests.some(r=>r.url.pathname.endsWith('garden_layout_events')),false);
});


test('checklist saves include reviewed instructions and progress, and completion retains the existing explicit RPC',async()=>{
  const items=[{id:'item',text:'Plant 6 tomatoes',done:true}],requests=fixture(()=>({data:{...row,work_recap:'Bed recap',work_items:items}}));
  const details={gardenId:'garden',bedId:'bed',activityType:'planting',plannedDate:'2026-11-24',title:'Plant',notes:'',workRecap:' Bed recap ',workItems:items};
  const result=await api.saveTask(details,{version:2},'task','request');assert.match(requests[0].url.pathname,/save_garden_task_work$/);assert.equal(requests[0].body.p_work_recap,'Bed recap');assert.deepEqual(requests[0].body.p_work_items,items);assert.deepEqual(result.workItems,items);
  await api.completeTask(result,{version:1},'2026-11-25','',true,'complete');assert.match(requests[1].url.pathname,/complete_garden_task$/);assert.equal(requests[1].body.p_confirmed,true);
});
test('before migration 035, dated planning and history remain available through legacy task columns',async()=>{
  const requests=fixture(({url})=>{
    if(url.pathname.endsWith('gardens'))return {data:[{id:'garden'}]};
    if(url.pathname.endsWith('garden_tasks'))return url.searchParams.get('select').includes('work_items')?{data:{code:'42703'},status:400}:{data:[row]};
    return {data:[]};
  });
  const result=await api.loadWork(['garden']);assert.equal(result.planningAvailable,true);assert.equal(result.checklistAvailable,false);assert.equal(result.tasks[0].workItems,undefined);
  assert.equal(requests.filter(r=>r.url.pathname.endsWith('garden_tasks')).length,2);
  fixture(({url})=>url.searchParams.get('select')?.includes('work_items')?{data:{code:'42703'},status:400}:{data:row});assert.equal((await api.loadTask('task')).title,'Water');
});
