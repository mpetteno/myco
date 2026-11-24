import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite(), owner='11111111-1111-4111-8111-111111111111', editor='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
const bed={id:'bed-a',name:'Herbs',xCm:0,yCm:0,widthCm:100,lengthCm:100};
let garden, other, legacyTask, legacyGarden;
async function user(id) { await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); }
const save=(id,version=null,values={})=>db.query('select * from public.save_garden_task($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[garden,id,version,values.request??crypto.randomUUID(),values.bed??null,values.type??'care',values.date??'2026-11-24',values.title??'Water herbs',values.notes??'',values.cancel??false]);
const complete=(task,values={})=>db.query('select * from public.complete_garden_task($1,$2,$3,$4,$5,$6,$7,$8)',[garden,task.id,values.taskVersion??task.version,values.gardenVersion??1,values.request??crypto.randomUUID(),values.date??'2026-11-25',values.notes??'Done',values.confirmed??true]);
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','other@example.test',now());`);
  for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&!f.includes('035_')).sort()){
    const sql=await readFile('supabase/migrations/'+file,'utf8');
    await db.exec(file.includes('021_')?`do $migration$ begin\n${sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'')}\nend; $migration$;`:sql);
  }
  await user(owner);
  garden=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,500,$3,$4) returning id',[owner,'Garden',[bed],{countryCode:'IT',regionCode:'IT-25',displayName:'Lombardia'}])).rows[0].id;
  await user(outsider);
  other=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,500,$3,$4) returning id',[outsider,'Other',[bed],{countryCode:'IT',regionCode:'IT-25',displayName:'Lombardia'}])).rows[0].id;
  await user(owner);
  await db.query('select public.share_garden($1,$2)',[garden,'editor@example.test']);
  legacyTask=(await save(crypto.randomUUID())).rows[0];legacyGarden=(await db.query('select * from public.gardens where id=$1',[garden])).rows[0];
  await db.exec('reset role');await db.exec(await readFile('supabase/migrations/202611240035_task_work_checklists.sql','utf8'));await user(owner);
});
after(()=>db.close());

test('migration 035 adds empty checklists without changing existing task metadata, gardens or history',async()=>{
  const row=(await db.query('select * from public.garden_tasks where id=$1',[legacyTask.id])).rows[0];
  const {work_items,work_recap,...original}=row;assert.deepEqual(original,legacyTask);assert.deepEqual(work_items,[]);assert.equal(work_recap,'');
  assert.deepEqual((await db.query('select * from public.gardens where id=$1',[garden])).rows[0],legacyGarden);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count,0);
});

test('planning creates metadata only; updates, retries and cancellation preserve garden geometry and completed history',async()=>{
  await user(owner);const id=crypto.randomUUID(),request=crypto.randomUUID();
  const task=(await save(id,null,{request,bed:'bed-a'})).rows[0];assert.equal(task.version,1);assert.equal(task.bed_name,'Herbs');
  assert.deepEqual((await save(id,null,{request,bed:'bed-a'})).rows[0],task);
  await assert.rejects(save(id,null,{request,title:'Different payload'}),e=>e.code==='22023');
  await user(editor);const changed=(await save(id,1,{bed:'bed-a',date:'2026-11-28'})).rows[0];assert.equal(changed.version,2);
  await assert.rejects(save(id,1),e=>e.code==='40001');
  const cancelled=(await save(id,2,{cancel:true,bed:'bed-a'})).rows[0];assert.equal(cancelled.status,'cancelled');
  await assert.rejects(complete(cancelled),e=>e.code==='40001');
  const live=(await db.query('select beds,version from public.gardens where id=$1',[garden])).rows[0];assert.deepEqual(live.beds,[bed]);assert.equal(live.version,1);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count,0);
});

test('RLS isolates tasks and calendar metadata; direct writes and retired planning endpoints stay denied',async()=>{
  await user(owner);const task=(await save(crypto.randomUUID())).rows[0];
  await assert.rejects(db.query('delete from public.garden_tasks where id=$1',[task.id]),e=>e.code==='42501');
  await assert.rejects(db.query('update public.garden_tasks set title=$1 where id=$2',['Bad',task.id]),e=>e.code==='42501');
  await user(outsider);assert.equal((await db.query('select count(*) from public.garden_tasks where garden_id=$1',[garden])).rows[0].count,0);
  await assert.rejects(save(crypto.randomUUID()),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.garden_tasks'),e=>e.code==='42501');await assert.rejects(save(crypto.randomUUID()),e=>e.code==='42501');
  await user(owner);assert.equal((await db.query("select has_function_privilege('authenticated','public.save_bed_activity(uuid,uuid,bigint,bigint,text,text,date,text,text,date)','EXECUTE') as allowed")).rows[0].allowed,false);
});

test('completion needs explicit confirmation and current task/garden versions; it captures one bed without applying a proposal',async()=>{
  await user(owner);const task=(await save(crypto.randomUUID(),null,{bed:'bed-a'})).rows[0];
  await assert.rejects(complete(task,{confirmed:false}),e=>e.code==='22023');await assert.rejects(complete(task,{gardenVersion:2}),e=>e.code==='40001');
  const request=crypto.randomUUID(),done=(await complete(task,{request})).rows[0];assert.equal(done.status,'completed');assert.ok(done.completion_event_id);
  assert.deepEqual((await complete(task,{request})).rows[0],done);await assert.rejects(complete(task),e=>e.code==='40001');
  const event=(await db.query('select * from public.garden_layout_events where id=$1',[done.completion_event_id])).rows[0];assert.equal(event.event_kind,'bed');assert.equal(event.bed_id,'bed-a');assert.equal(event.event_date.toISOString().slice(0,10),'2026-11-25');assert.deepEqual(event.snapshot.beds,[bed]);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where id=$1',[done.completion_event_id])).rows[0].count,1);
  assert.deepEqual((await db.query('select beds from public.gardens where id=$1',[garden])).rows[0].beds,[bed]);
  await user(outsider);assert.equal((await db.query('select count(*) from public.garden_work_events where garden_id=$1',[garden])).rows[0].count,0);
  await user(editor);assert.equal((await db.query('select bed_name from public.garden_work_events where id=$1',[done.completion_event_id])).rows[0].bed_name,'Herbs');
});

test('work recap and checklist save atomically with task revisions, retries, shared editing and legacy compatibility',async()=>{
  await user(owner);const id=crypto.randomUUID(),request=crypto.randomUUID(),items=[{id:'instruction',text:'Plant 6 tomatoes',done:false}];
  const write=(version,work,req=crypto.randomUUID())=>db.query('select * from public.save_garden_task_work($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[garden,id,version,req,'bed-a','planting','2026-11-24','Plant tomatoes','',false,'Bed recap',work]);
  const count=(await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count;
  const task=(await write(null,items,request)).rows[0];assert.deepEqual(task.work_items,items);assert.equal(task.work_recap,'Bed recap');
  assert.deepEqual((await write(null,items,request)).rows[0],task);
  await assert.rejects(write(1,[{...items[0],done:true}],request),e=>e.code==='22023');
  await user(editor);const progress=(await write(1,[{...items[0],done:true}])).rows[0];assert.equal(progress.version,2);assert.equal(progress.status,'planned');assert.equal(progress.completion_event_id,null);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count,count);
  await assert.rejects(write(1,items),e=>e.code==='40001');
  const legacy=(await save(id,2,{bed:'bed-a',type:'planting',title:'Legacy edit'})).rows[0];assert.equal(legacy.version,3);assert.deepEqual(legacy.work_items,progress.work_items);assert.equal(legacy.work_recap,'Bed recap');
  const completed=(await complete(legacy)).rows[0];assert.equal(completed.status,'completed');assert.deepEqual(completed.work_items,progress.work_items);assert.equal(completed.work_recap,'Bed recap');
  assert.deepEqual((await db.query('select beds,version from public.gardens where id=$1',[garden])).rows[0],{beds:[bed],version:1});
  await user(outsider);await assert.rejects(write(4,items),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(write(4,items),e=>e.code==='42501');await user(owner);
});

test('work checklist validation rejects malformed, duplicate and oversized items without partial tasks',async()=>{
  await user(owner);const id=crypto.randomUUID();
  const write=(items,recap='Recap')=>db.query('select * from public.save_garden_task_work($1,$2,null,$3,null,$4,$5,$6,$7,false,$8,$9)',[garden,id,crypto.randomUUID(),'care','2026-11-24','Work','',recap,items]);
  const valid={id:'item',text:'Water if needed',done:false};
  for(const items of [null,{},[{}],[{...valid,done:1}],[{...valid,text:' '}],[{...valid,extra:'layout'}],[valid,valid],Array.from({length:101},(_,i)=>({...valid,id:String(i)}))])await assert.rejects(write(items),e=>e.code==='22023');
  await assert.rejects(write([valid],'x'.repeat(4001)),e=>e.code==='22023');assert.equal((await db.query('select count(*) from public.garden_tasks where id=$1',[id])).rows[0].count,0);
  const task=(await write([valid])).rows[0];const cancelled=(await save(id,1,{cancel:true})).rows[0];assert.equal(cancelled.status,'cancelled');assert.deepEqual(cancelled.work_items,task.work_items);
});

test('garden-scoped completion uses the existing garden recorder and missing beds cannot complete',async()=>{
  await user(editor);const task=(await save(crypto.randomUUID())).rows[0],done=(await complete(task)).rows[0];
  assert.equal((await db.query('select event_kind from public.garden_layout_events where id=$1',[done.completion_event_id])).rows[0].event_kind,'layout');
  const missing=(await save(crypto.randomUUID(),null,{bed:'bed-a'})).rows[0];
  await db.query('update public.gardens set beds=$1 where id=$2',[[],garden]);
  const countBefore=(await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count;
  await assert.rejects(complete(missing,{gardenVersion:2}),e=>e.code==='22023');
  const unchanged=(await db.query('select * from public.garden_tasks where id=$1',[missing.id])).rows[0];assert.equal(unchanged.status,'planned');assert.equal(unchanged.version,missing.version);assert.equal(unchanged.completion_event_id,null);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count,countBefore);
  const cancelled=(await save(missing.id,missing.version,{bed:'bed-a',cancel:true})).rows[0];assert.equal(cancelled.status,'cancelled');
  await assert.rejects(save(crypto.randomUUID(),null,{bed:'bed-a'}),e=>e.code==='22023');
});

test('invalid metadata is rejected and garden deletion cascades the new task table',async()=>{
  await user(owner);
  for(const values of [{title:' '},{type:'unknown'},{notes:'x'.repeat(2001)},{date:'0000-01-01'}])await assert.rejects(save(crypto.randomUUID(),null,values));
  const task=(await save(crypto.randomUUID())).rows[0];
  await db.query('select public.unshare_garden($1,$2)',[garden,editor]);await user(editor);
  await assert.rejects(save(crypto.randomUUID()),e=>e.code==='42501');await assert.rejects(complete(task,{gardenVersion:2}),e=>e.code==='42501');
  assert.equal((await db.query('select count(*) from public.garden_tasks where garden_id=$1',[garden])).rows[0].count,0);
  assert.equal((await db.query('select count(*) from public.garden_work_events where garden_id=$1',[garden])).rows[0].count,0);await user(owner);
  await db.query('select public.delete_garden($1,2)',[garden]);
  assert.equal((await db.query('select count(*) from public.garden_tasks where id=$1',[task.id])).rows[0].count,0);
  await user(outsider);assert.equal((await db.query('select count(*) from public.gardens where id=$1',[other])).rows[0].count,1);
});
