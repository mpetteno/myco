import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules,loadModule } from '../auth/helpers.mjs';
import { bed } from '../planting/fixtures.mjs';

const repository=await loadModule('tests/history/modules.ts','activity-http');
after(cleanupModules);
const body={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed,{...bed,id:'other',xCm:150}]};
function fixture(handler){
  const requests=[];
  globalThis.__mycoAuthClient=createClient('https://activity-test.supabase.co','sb_publishable_fixture',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
      const request={url:new URL(input),method:init.method,body:init.body?JSON.parse(init.body):null};requests.push(request);
      const {data,status=200}=handler(request);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    }}});return requests;
}
test('completed-only RPC sends actual dates and saved revisions, never a separate plan',async()=>{
  const requests=fixture(()=>({data:null}));
  await repository.recordCompletedActivity('garden',4,{bedId:bed.id,date:'2027-01-10',title:' Plant rows ',notes:''},'activity');
  assert.equal(requests[0].url.pathname,'/rest/v1/rpc/record_bed_changes');
  assert.equal(requests[0].body.p_event_date,'2027-01-10');assert.equal(requests[0].body.p_title,'Plant rows');
  assert.equal(requests[0].body.p_expected_version,4);
  assert.equal(requests[0].body.p_bed_id,bed.id);assert.ok(!('p_kind' in requests[0].body));
  assert.ok(!('p_document' in requests[0].body));assert.ok(!('p_planned_date' in requests[0].body));
  await assert.rejects(repository.recordCompletedActivity('garden',4,{bedId:bed.id,date:'',title:'Undated',notes:''},'id'));
  assert.equal(requests.length,1);
});
test('completed checkpoints reconstruct only confirmed beds without unrelated proposals',async()=>{
  const base={id:'base',garden_id:'garden',event_order:1,event_date:'2027-01-01',title:'Layout',notes:'',source_version:1,recorded_at:'2027-01-01T12:00:00Z',actor_id:null,event_kind:'layout',snapshot:structuredClone(body)};
  const done={...base,id:'done',event_order:3,event_date:'2027-01-12',event_kind:'planting',bed_id:bed.id,activity_id:'work',planned_date:'2027-01-10',snapshot:structuredClone(body)};
  done.snapshot.beds[0].name='Physical bed';done.snapshot.beds[1].name='Other unfinished plan';
  fixture(({url})=>({data:url.searchParams.has('id')?[done]:[base,done]}));
  const actual=await repository.loadGardenEvent('garden','done');
  assert.equal(actual.document.beds.find(item=>item.id==='other').name,bed.name);
  assert.equal(actual.document.beds.find(item=>item.id===bed.id).name,'Physical bed');
});
