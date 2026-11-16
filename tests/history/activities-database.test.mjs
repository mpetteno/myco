import { after,before,test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bed,planV5 } from '../planting/fixtures.mjs';
import { mulchPlan } from '../mulch/fixtures.mjs';

const db = new PGlite(),owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const activityId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',mulchId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let gardenId;
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','outsider@example.test',now());`);
  for (const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter((name)=>name.endsWith('.sql') && name<'202611160012').sort()) await migrate(file);
  await asUser(owner);
  gardenId=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',[owner,'Garden',JSON.stringify([bed])])).rows[0].id;
  await db.query('select * from public.record_garden_layout_event($1,1,$2,$3,$4,$5)',[gardenId,crypto.randomUUID(),'2027-03-01','Bare beds','']);
  await db.query('select public.share_garden($1,$2)',[gardenId,'editor@example.test']);
  await db.exec('reset role;'); await migrate('202611160012_bed_activities.sql');
});
after(()=>db.close());
async function migrate(file) { const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'); await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'')}\nend; $migration$;`); }
async function asUser(id) { await db.exec('reset role; set role authenticated;'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); }
const save=(id,version=null,gardenVersion=2,kind='planting',date='2027-03-10',completed=null)=>db.query('select * from public.save_bed_activity($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[gardenId,id,version,gardenVersion,bed.id,kind,date,'Work on bed','Notes',completed]);
const complete=(id,version=1,gardenVersion=3,date='2027-03-12',notes='Physical result')=>db.query('select * from public.complete_bed_activity($1,$2,$3,$4,$5,$6)',[gardenId,id,version,gardenVersion,date,notes]);

test('planning captures an intention without adding actual history, while completion captures the modified physical result',async()=>{
  await asUser(owner);
  const planned={...bed,plantingPlan:planV5(),mulchPlan:mulchPlan()};
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify([planned]),gardenId]);
  const intention=(await save(activityId)).rows[0];
  assert.equal(intention.status,'planned'); assert.equal(intention.version,1);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,1);
  planned.plantingPlan.areas[0].plantSpacingCm=20;
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify([planned]),gardenId]);
  await asUser(editor);
  const finished=(await complete(activityId)).rows[0];
  assert.equal(finished.status,'completed'); assert.equal(finished.version,2);
  assert.equal(finished.planned_snapshot.beds[0].plantingPlan.areas[0].plantSpacingCm,30);
  const event=(await db.query('select * from public.garden_layout_events where activity_id=$1',[activityId])).rows[0];
  assert.equal(event.event_kind,'planting'); assert.equal(event.bed_id,bed.id); assert.equal(event.actor_id,editor);
  assert.equal(event.planned_date.toISOString().slice(0,10),'2027-03-10');
  assert.equal(event.snapshot.beds[0].plantingPlan.areas[0].plantSpacingCm,20);
  assert.equal((await db.query('select version from public.gardens where id=$1',[gardenId])).rows[0].version,3);
  await complete(activityId); assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,2);
});
test('planned work supports revision-checked changes and cancellation; stale completions create no history',async()=>{
  await asUser(owner); await save(mulchId,null,3,'mulch');
  await assert.rejects(complete(mulchId,1,2),error=>error.code==='40001');
  const revised=(await save(mulchId,1,3,'mulch','2027-03-15')).rows[0]; assert.equal(revised.version,2);
  await assert.rejects(save(mulchId,1,3,'mulch'),error=>error.code==='40001');
  await db.query('select public.cancel_bed_activity($1,$2,2)',[gardenId,mulchId]);
  assert.equal((await db.query('select status from public.bed_activities where id=$1',[mulchId])).rows[0].status,'cancelled');
  await assert.rejects(complete(mulchId,3,3),error=>error.code==='22023');
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,2);
});
test('completed work without a prior plan records atomically, remains fixed and is idempotent',async()=>{
  const id=crypto.randomUUID(); await asUser(owner);
  const result=(await save(id,null,3,'mulch','2027-03-16','2027-03-16')).rows[0];
  assert.equal(result.status,'completed'); assert.equal(result.was_planned,false);
  await save(id,null,3,'mulch','2027-03-16','2027-03-16');
  assert.equal((await db.query('select count(*) from public.garden_layout_events where activity_id=$1',[id])).rows[0].count,1);
  await assert.rejects(save(id,2,3,'mulch'),error=>error.code==='22023');
});
test('only current garden editors can read or write activities; direct mutation and helper execution are denied',async()=>{
  await asUser(outsider); assert.equal((await db.query('select id from public.bed_activities')).rows.length,0);
  await assert.rejects(save(crypto.randomUUID(),null,3),error=>error.code==='42501');
  await asUser(editor);
  await assert.rejects(db.query("update public.bed_activities set status='completed'"),error=>error.code==='42501');
  await assert.rejects(db.query('select public.myco_activity_garden($1)',[gardenId]),error=>error.code==='42501');
  await asUser(owner); await db.query('select public.unshare_garden($1,$2)',[gardenId,editor]);
  await asUser(editor); assert.equal((await db.query('select id from public.bed_activities')).rows.length,0);
  await assert.rejects(save(crypto.randomUUID(),null,3),error=>error.code==='42501');
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select id from public.bed_activities'),error=>error.code==='42501');
});
