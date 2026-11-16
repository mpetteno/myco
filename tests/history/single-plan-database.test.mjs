import { after,before,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { mulchPlan } from '../mulch/fixtures.mjs';
import { bed,planV5 } from '../planting/fixtures.mjs';

const db=new PGlite(),owner=crypto.randomUUID(),editor=crypto.randomUUID(),outsider=crypto.randomUUID();
const first=crypto.randomUUID(),later=crypto.randomUUID(),legacy=crypto.randomUUID(),activity=crypto.randomUUID();
let gardenId,initialPlan,laterBefore,doneId,deletionRequest;
async function migrate(file){const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'')}\nend; $migration$;`);}
async function asUser(id){await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const row=id=>db.query('select * from public.garden_layout_events where id=$1',[id]).then(result=>result.rows[0]);
const plan=()=>db.query('select * from public.gardens where id=$1',[gardenId]).then(result=>result.rows[0]);
const remove=(id,version,request=crypto.randomUUID())=>db.query('select public.delete_garden_history_event($1,$2,$3,$4)',[gardenId,id,version,request]);
const record=(id=activity,date='2026-02-01',version=2)=>db.query("select * from public.record_completed_bed_activity($1,$2,$3,'bed-a','planting',$4,'Planted','Notes')",[gardenId,version,id,date]);
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','outsider@example.test',now());`);
  const files=(await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
  for(const file of files.filter(name=>name<'202611170016'))await migrate(file);
  await asUser(owner);
  gardenId=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',[owner,'Garden',JSON.stringify([bed,{...bed,id:'old-other',xCm:200}])])).rows[0].id;
  await db.query('select public.share_garden($1,$2)',[gardenId,'editor@example.test']);
  await db.query("select public.record_garden_layout_event($1,1,$2,'2026-01-01','First','')",[gardenId,first]);
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify([bed]),gardenId]);
  await db.query("select public.record_garden_layout_event($1,2,$2,'2026-03-01','Later','')",[gardenId,later]);
  await db.query("select public.save_bed_activity($1,$2,null,2,'bed-a','planting',null,'Legacy work','',null)",[gardenId,legacy]);
  initialPlan=await plan();laterBefore=await row(later);
  await db.exec('reset role;');await migrate(files.find(name=>name.startsWith('202611170016')));await migrate(files.find(name=>name.startsWith('202611170017')));await asUser(owner);
});
after(()=>db.close());

test('migration preserves the single current plan and existing pending copies without exposing old work APIs',async()=>{
  assert.deepEqual(await plan(),initialPlan);
  for(const signature of ['save_bed_activity(uuid,uuid,bigint,bigint,text,text,date,text,text,date)','complete_bed_activity(uuid,uuid,bigint,bigint,date,text)',
    'cancel_bed_activity(uuid,uuid,bigint)','update_open_work_bed(uuid,uuid,bigint,jsonb)','complete_planned_bed_activity(uuid,uuid,bigint,bigint,date,text)']){
    assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') as allowed",[`public.${signature}`])).rows[0].allowed,false);
  }
  await assert.rejects(db.query('select * from public.bed_activities'),error=>error.code==='42501');
  await db.exec('reset role;');assert.equal((await db.query('select status from public.bed_activities where id=$1',[legacy])).rows[0].status,'planned');await asUser(owner);
});

test('completion records the saved bed explicitly, retries safely and never applies a different plan',async()=>{
  const done=(await record()).rows[0];doneId=done.completion_event_id;
  assert.equal(done.status,'completed');assert.equal(done.planned_date,null);assert.equal(done.was_planned,false);
  assert.equal((await record()).rows[0].completion_event_id,doneId);
  assert.deepEqual(await plan(),initialPlan);assert.deepEqual((await row(later)).display_snapshot,laterBefore.display_snapshot);
  await assert.rejects(record(crypto.randomUUID(),null),error=>error.code==='22023');
  await assert.rejects(record(crypto.randomUUID(),'2026-02-01',99),error=>error.code==='40001');
  await assert.rejects(record(legacy),error=>error.code==='22023');
});

test('deletion checks the viewed revision and keeps a recovery copy without altering later history or the plan',async()=>{
  await assert.rejects(remove(first,99),error=>error.code==='40001');
  const before=(await db.query('select to_jsonb(e) as body from public.garden_layout_events e where id=$1',[first])).rows[0].body;deletionRequest=crypto.randomUUID();await remove(first,1,deletionRequest);await remove(first,1,deletionRequest);
  const deleted=await row(first);assert.ok(deleted.deleted_at);assert.equal(deleted.deleted_by,owner);assert.equal(deleted.version,2);
  const audits=(await db.query('select * from public.garden_layout_event_revisions where event_id=$1',[first])).rows;
  assert.equal(audits.length,1);assert.equal(audits[0].action,'deletion');assert.deepEqual(audits[0].previous_record,before);
  assert.deepEqual((await row(later)).display_snapshot,laterBefore.display_snapshot);assert.deepEqual(await plan(),initialPlan);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1 and deleted_at is null',[gardenId])).rows[0].count,2);
  await assert.rejects(remove(first,2),error=>error.code==='P0002');
});

test('deleted records cannot be edited or resurrected by completion or recording retries',async()=>{
  await assert.rejects(db.query("select public.record_garden_layout_event($1,1,$2,'2026-01-01','First','')",[gardenId,first]),error=>error.code==='P0002');
  await assert.rejects(db.query("select public.save_garden_history_event($1,$2,2,$3,'2026-01-01','First','',$4,'layout',null)",[gardenId,first,crypto.randomUUID(),JSON.stringify(laterBefore.display_snapshot)]),error=>error.code==='P0002');
  await remove(doneId,1);await assert.rejects(record(),error=>error.code==='P0002');
  await db.exec('reset role;');assert.equal((await db.query('select status from public.bed_activities where id=$1',[activity])).rows[0].status,'completed');await asUser(owner);
  assert.deepEqual(await plan(),initialPlan);
});

test('new bed records exclude deleted predecessors while later frozen snapshots remain unchanged',async()=>{
  const id=crypto.randomUUID(),document={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed]};
  const saved=(await db.query("select * from public.save_garden_history_event($1,$2,null,$3,'2026-01-20','Bed','',$4,'bed','bed-a')",[gardenId,id,crypto.randomUUID(),JSON.stringify(document)])).rows[0];
  assert.deepEqual(saved.display_snapshot,document);assert.deepEqual((await row(later)).display_snapshot,laterBefore.display_snapshot);
});

test('shared editors can delete, while outsiders, revoked users, anonymous and direct browser writes cannot',async()=>{
  await asUser(outsider);await assert.rejects(remove(later,1),error=>error.code==='42501');await assert.rejects(record(crypto.randomUUID()),error=>error.code==='42501');
  await asUser(editor);await remove(later,1);await assert.rejects(db.query('update public.garden_layout_events set deleted_at=null where id=$1',[later]),error=>error.code==='42501');
  await db.exec('reset role;');await db.query('delete from public.garden_members where garden_id=$1 and user_id=$2',[gardenId,editor]);
  await asUser(editor);await assert.rejects(remove(first,1,deletionRequest),error=>error.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(remove(first,1,deletionRequest),error=>error.code==='42501');await assert.rejects(record(crypto.randomUUID()),error=>error.code==='42501');
});


test('bed changes capture planting and mulch together without confirming other beds, and retries preserve the plan',async()=>{
  await asUser(owner);
  const target={...bed,plantingPlan:planV5(),mulchPlan:mulchPlan()},other={...bed,id:'future-bed',xCm:200};
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify([target,other]),gardenId]);
  const before=await plan(),id=crypto.randomUUID();
  const args=[gardenId,before.version,id,bed.id,'2026-04-01','Bed changes','Both planting and mulch'];
  const sql='select * from public.record_bed_changes($1,$2,$3,$4,$5,$6,$7)';
  const saved=(await db.query(sql,args)).rows[0];
  assert.equal(saved.event_kind,'bed');assert.equal(saved.activity_id,null);
  assert.deepEqual(saved.display_snapshot.beds,[target]);assert.deepEqual(await plan(),before);
  assert.equal((await db.query(sql,args)).rows[0].id,id);
  await assert.rejects(db.query(sql,[gardenId,999,crypto.randomUUID(),...args.slice(3)]),error=>error.code==='40001');
  await assert.rejects(db.query(sql,[...args.slice(0,5),'Different title',args[6]]),error=>error.code==='22023');
  await remove(id,1);await assert.rejects(db.query(sql,args),error=>error.code==='P0002');
});

test('bed change recording authorizes owners/editors and rejects invalid scope and anonymous access',async()=>{
  await asUser(owner);
  const sql='select * from public.record_bed_changes($1,$2,$3,$4,$5,$6,$7)';
  const args=[gardenId,(await plan()).version,crypto.randomUUID(),bed.id,'2026-04-01','Bed changes',''];
  await asUser(outsider);await assert.rejects(db.query(sql,args),error=>error.code==='42501');
  await asUser(owner);
  await assert.rejects(db.query(sql,[...args.slice(0,3),'missing',...args.slice(4)]),error=>error.code==='22023');
  await db.query('select public.share_garden($1,$2)',[gardenId,'editor@example.test']);
  await asUser(editor);const saved=(await db.query(sql,args)).rows[0];assert.equal(saved.event_kind,'bed');
  await remove(saved.id,1);
  await db.exec('reset role;set role anon;');await assert.rejects(db.query(sql,args),error=>error.code==='42501');
});
