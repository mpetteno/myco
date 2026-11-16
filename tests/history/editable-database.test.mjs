import { after,before,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bed,planV5 } from '../planting/fixtures.mjs';

const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const firstId=crypto.randomUUID(),laterId=crypto.randomUUID(),activityId=crypto.randomUUID(),newId=crypto.randomUUID(),newRequest=crypto.randomUUID(),correctionRequest=crypto.randomUUID();
const other={...bed,id:'bed-b',name:'Bed B',xCm:200};
const original={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed,other]};
let gardenId,activityEvent,laterBefore,activityBefore;
async function migrate(file){const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'')}\nend; $migration$;`);}
async function asUser(id){await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const event=id=>db.query('select * from public.garden_layout_events where id=$1',[id]).then(result=>result.rows[0]);
const current=()=>db.query('select beds,version from public.gardens where id=$1',[gardenId]).then(result=>result.rows[0]);
const save=(id,version,request,date,document,title='Past edit',kind='layout',bedId=null)=>db.query('select * from public.save_garden_history_event($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)',[gardenId,id,version,request,date,title,'Notes',JSON.stringify(document),kind,bedId]);
const corrected={...original,beds:[{...bed,name:'Corrected first bed'},other]};
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','outsider@example.test',now());`);
  for(const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')&&name<'202611160015').sort())await migrate(file);
  await asUser(owner);
  gardenId=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',[owner,'Garden',JSON.stringify(original.beds)])).rows[0].id;
  await db.query('select public.share_garden($1,$2)',[gardenId,'editor@example.test']);
  await db.query("select public.record_garden_layout_event($1,1,$2,'2026-01-01','First','')",[gardenId,firstId]);
  const proposal=[{...bed,name:'Planted A'},{...other,name:'Future B proposal'}];
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(proposal),gardenId]);
  await db.query("select public.save_bed_activity($1,$2,null,2,'bed-a','planting',null,'Plant A','','2026-02-01')",[gardenId,activityId]);
  activityEvent=(await db.query('select id from public.garden_layout_events where activity_id=$1',[activityId])).rows[0].id;
  await db.query("select public.record_garden_layout_event($1,2,$2,'2026-03-01','Later','')",[gardenId,laterId]);
  await db.exec('reset role;');await migrate('202611160015_editable_history.sql');await asUser(owner);
  laterBefore=await event(laterId);activityBefore=await event(activityEvent);
});
after(()=>db.close());

test('migration freezes the previously displayed bed history without including unrelated proposals',async()=>{
  assert.equal(activityBefore.snapshot.beds[1].name,'Future B proposal');
  assert.equal(activityBefore.display_snapshot.beds.find(item=>item.id==='bed-b').name,'Bed B');
  assert.equal(activityBefore.display_snapshot.beds.find(item=>item.id==='bed-a').name,'Planted A');
  assert.deepEqual(laterBefore.display_snapshot,laterBefore.snapshot);
});

test('inserting a past record and retrying it changes neither later states nor the current plan',async()=>{
  const before=await current();
  await save(newId,null,newRequest,'2026-01-15',corrected);
  await save(newId,null,newRequest,'2026-01-15',corrected);
  assert.deepEqual(await event(activityEvent),activityBefore);assert.deepEqual(await event(laterId),laterBefore);
  assert.deepEqual(await current(),before);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where id=$1',[newId])).rows[0].count,1);
});

test('a new past bed record merges only its target into the recorded state on its chosen date',async()=>{
  const before=await current(),id=crypto.randomUUID(),request=crypto.randomUUID();
  const proposal={...original,beds:[{...bed,name:'Past target bed'},{...other,name:'Unrecorded other proposal'}]};
  const saved=(await save(id,null,request,'2026-01-20',proposal,'Past bed','bed',bed.id)).rows[0];
  assert.equal(saved.display_snapshot.beds.find(item=>item.id===other.id).name,'Bed B');
  assert.equal(saved.display_snapshot.beds.find(item=>item.id===bed.id).name,'Past target bed');
  await save(id,null,request,'2026-01-20',proposal,'Past bed','bed',bed.id);
  assert.deepEqual(await current(),before);assert.deepEqual(await event(activityEvent),activityBefore);assert.deepEqual(await event(laterId),laterBefore);
});

test('record corrections save a revision copy, preserve later snapshots and keep the working garden untouched',async()=>{
  const before=await current(),old=await event(firstId);
  const saved=(await save(firstId,1,correctionRequest,'2026-01-02',corrected,'Corrected entry')).rows[0];
  assert.equal(saved.version,2);assert.equal(saved.source_version,old.source_version);
  const audit=(await db.query('select * from public.garden_layout_event_revisions where event_id=$1',[firstId])).rows[0];
  assert.equal(audit.previous_record.title,'First');assert.deepEqual(audit.previous_record.display_snapshot,original);
  assert.deepEqual(await event(activityEvent),activityBefore);assert.deepEqual(await event(laterId),laterBefore);assert.deepEqual(await current(),before);
});

test('stale edits and reused request IDs cannot overwrite a correction, and retries do not add revisions',async()=>{
  await assert.rejects(save(firstId,1,crypto.randomUUID(),'2026-01-02',original),error=>error.code==='40001');
  assert.equal((await save(firstId,1,correctionRequest,'2026-01-02',corrected,'Corrected entry')).rows[0].version,2);
  await assert.rejects(save(firstId,2,correctionRequest,'2026-01-02',original),error=>error.code==='22023');
  assert.equal((await db.query('select count(*) from public.garden_layout_event_revisions where event_id=$1',[firstId])).rows[0].count,1);
});

test('completed bed corrections synchronize completion details without applying the edited bed to the current plan',async()=>{
  const before=await current(),document=structuredClone(activityBefore.display_snapshot);
  document.beds.find(item=>item.id===bed.id).plantingPlan=planV5();
  await save(activityEvent,1,crypto.randomUUID(),'2026-02-03',document,'Correct planting','planting',bed.id);
  const activity=(await db.query('select * from public.bed_activities where id=$1',[activityId])).rows[0];
  assert.equal(activity.title,'Correct planting');assert.equal(activity.completed_date.toISOString().slice(0,10),'2026-02-03');assert.equal(activity.completed_notes,'Notes');
  assert.deepEqual(await current(),before);assert.deepEqual(await event(laterId),laterBefore);
});

test('invalid geometry, planting, dates and changes of event scope roll back atomically',async()=>{
  const before=await event(firstId);
  for(const document of [{...original,dimensions:{widthCm:0,lengthCm:500}}, {...original,beds:[bed,{...other,xCm:5}]},
    {...original,beds:[{...bed,plantingPlan:planV5({areas:[]})}]}]){
    await assert.rejects(save(firstId,2,crypto.randomUUID(),'2026-01-02',document),error=>error.code==='22023');
  }
  await assert.rejects(save(firstId,2,crypto.randomUUID(),'2026-01-02',corrected,'Invalid scope','bed',bed.id),error=>error.code==='22023');
  assert.deepEqual(await event(firstId),before);
});

test('shared editors can correct history, while outsiders, revoked editors, anonymous access and direct writes are denied',async()=>{
  await asUser(editor);await save(laterId,1,crypto.randomUUID(),'2026-03-01',laterBefore.display_snapshot,'Editor correction');
  await assert.rejects(db.query("update public.garden_layout_events set title='Direct' where id=$1",[firstId]),error=>error.code==='42501');
  await assert.rejects(db.query('delete from public.garden_layout_event_revisions'),error=>error.code==='42501');
  await asUser(outsider);assert.equal((await db.query('select * from public.garden_layout_event_revisions')).rows.length,0);
  await assert.rejects(save(firstId,2,crypto.randomUUID(),'2026-01-02',corrected),error=>error.code==='42501');
  await asUser(owner);await db.query('select public.unshare_garden($1,$2)',[gardenId,editor]);await asUser(editor);
  await assert.rejects(save(firstId,2,crypto.randomUUID(),'2026-01-02',corrected),error=>error.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(save(firstId,2,crypto.randomUUID(),'2026-01-02',corrected),error=>error.code==='42501');
});

test('future bed completions cannot create an overlapping displayed history state',async()=>{
  await asUser(owner);
  const id=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',[owner,'Other garden',JSON.stringify(original.beds)])).rows[0].id;
  await db.query("select public.record_garden_layout_event($1,1,$2,'2026-01-01','Before','')",[id,crypto.randomUUID()]);
  const moved=[{...bed,xCm:200},{...other,xCm:0}];
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(moved),id]);
  const task=crypto.randomUUID();
  await assert.rejects(db.query("select public.save_bed_activity($1,$2,null,2,'bed-a','planting',null,'Planting','','2026-02-01')",[id,task]),error=>error.code==='P0001');
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[id])).rows[0].count,1);
  assert.equal((await db.query('select count(*) from public.bed_activities where id=$1',[task])).rows[0].count,0);
  assert.deepEqual((await db.query('select beds from public.gardens where id=$1',[id])).rows[0].beds,moved);
});
