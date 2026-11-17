import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
const repo = await loadModule('tests/catalogue/reference-modules.ts','reference-repository');
after(cleanupModules);
function fixture(handler) {
  const requests=[];
  globalThis.__mycoAuthClient=createClient('https://reference-test.supabase.co','fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const request={url:new URL(input),method:init.method,body:init.body?JSON.parse(init.body):null};requests.push(request);
    const {data,status=200}=handler(request);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  }}});return requests;
}
test('reference reads remain available to non-admins and role checks are scoped to the signed-in user',async()=>{
  const requests=fixture(()=>({data:[]}));
  const data=await repo.loadReferenceData('reader');
  assert.equal(data.isAdmin,false);assert.deepEqual(data.plant_cultivars,[]);
  assert.equal(requests.find((r)=>r.url.pathname.endsWith('catalogue_administrators')).url.searchParams.get('user_id'),'eq.reader');
});
test('ordinary entry edits condition on revision and calendar edits send all windows atomically',async()=>{
  const requests=fixture(()=>({data:{id:'saved'}}));
  await repo.saveReference('plant_cultivars',{name:'Crimson Sweet'},{id:'cultivar',version:3});
  assert.equal(requests[0].method,'PATCH');assert.equal(requests[0].url.searchParams.get('version'),'eq.3');assert.deepEqual(requests[0].body,{name:'Crimson Sweet'});
  const windows=[{start_month:2,end_month:3},{start_month:10,end_month:1}];
  await repo.saveReference('plant_calendar_entries',{activity:'harvest'},{id:'entry',version:4},windows);
  assert.equal(requests[1].url.pathname,'/rest/v1/rpc/myco_save_calendar_entry');
  assert.deepEqual(requests[1].body,{entry_id:'entry',expected_version:4,details:{activity:'harvest'},windows});
  fixture(()=>({data:[]}));await assert.rejects(repo.saveReference('plant_guidance',{monthly_feed:false},{id:'entry',version:4}),/changed|access/);
  fixture(()=>({data:{code:'42501'},status:403}));await assert.rejects(repo.saveReference('plant_depths',{}),/Only catalogue administrators/);
  fixture(()=>({data:{code:'40001'},status:409}));await assert.rejects(repo.saveReference('plant_calendar_entries',{}),/changed/);
});
test('cultivar removal passes the selected ID and revision and explains dependency and permission errors',async()=>{
  const requests=fixture(()=>({data:null}));
  await repo.removeCultivar({id:'datterini',version:4});
  assert.equal(requests[0].url.pathname,'/rest/v1/rpc/myco_remove_cultivar');
  assert.deepEqual(requests[0].body,{entry_id:'datterini',expected_version:4});
  for(const [code,message] of [['23503',/living mulch type/],['42501',/Only catalogue administrators/],['40001',/changed or was already removed/]]){
    fixture(()=>({data:{code},status:400}));await assert.rejects(repo.removeCultivar({id:'datterini',version:4}),message);
  }
});
