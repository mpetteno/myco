import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {bed,planV5} from '../planting/fixtures.mjs';
import {mulchPlan} from '../mulch/fixtures.mjs';

const db=new PGlite(),owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const workId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let gardenId;
const other={...bed,id:'other',name:'Other bed',xCm:150};
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','outsider@example.test',now());`);
  for(const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')&&name<'202611160016').sort()){
    const sql=await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8');
    await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,'')}\nend; $migration$;`);
  }
  await asUser(owner);
  gardenId=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',[owner,'Garden',JSON.stringify([bed,other])])).rows[0].id;
  await db.query('select public.share_garden($1,$2)',[gardenId,'editor@example.test']);
});
after(()=>db.close());
async function asUser(id){await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const create=(id,version=null,gardenVersion=1,title='Open task')=>db.query('select * from public.save_bed_activity($1,$2,$3,$4,$5,$6,null,$7,$8,null)',[gardenId,id,version,gardenVersion,bed.id,'planting',title,'Notes']);
const update=(id,version,next)=>db.query('select * from public.update_open_work_bed($1,$2,$3,$4::jsonb)',[gardenId,id,version,JSON.stringify(next)]);
const complete=(id,version,gardenVersion)=>db.query("select * from public.complete_planned_bed_activity($1,$2,$3,$4,'2026-03-10','Done')",[gardenId,id,version,gardenVersion]);

test('undated work survives reloads and owns an editable bed without changing the current garden or history',async()=>{
  const created=(await create(workId)).rows[0];assert.equal(created.planned_date,null);
  const next={...bed,plantingPlan:planV5(),mulchPlan:mulchPlan()};
  await asUser(editor);
  const changed=(await update(workId,1,next)).rows[0];assert.equal(changed.version,2);
  const reloaded=(await db.query('select * from public.bed_activities where id=$1',[workId])).rows[0];
  assert.deepEqual(reloaded.planned_snapshot.beds[0],next);
  const current=(await db.query('select beds,version from public.gardens where id=$1',[gardenId])).rows[0];
  assert.deepEqual(current.beds,[bed,other]);assert.equal(current.version,1);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,0);
  await assert.rejects(update(workId,1,next),error=>error.code==='40001');
  await asUser(owner);
  const metadata=(await create(workId,2,1,'Renamed work')).rows[0];
  assert.deepEqual(metadata.planned_snapshot.beds[0],next,'editing title/date must preserve the independently edited bed');
  assert.equal(metadata.version,3);
});

test('completion atomically applies only the edited bed and records it once',async()=>{
  const result=(await complete(workId,3,1)).rows[0];assert.equal(result.status,'completed');
  const current=(await db.query('select beds,version from public.gardens where id=$1',[gardenId])).rows[0];
  assert.equal(current.version,2);assert.deepEqual(current.beds[1],other);
  assert.deepEqual(current.beds[0].plantingPlan,planV5());
  const event=(await db.query('select * from public.garden_layout_events where activity_id=$1',[workId])).rows[0];
  assert.equal(event.planned_date,null);assert.deepEqual(event.snapshot.beds,current.beds);
  await complete(workId,3,1);
  assert.equal((await db.query('select version from public.gardens where id=$1',[gardenId])).rows[0].version,2);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,1);
  await assert.rejects(update(workId,4,bed),error=>error.code==='22023');
});

test('work validation rejects changed identities and invalid geometry, and completion rolls back when the current layout conflicts',async()=>{
  const id=crypto.randomUUID();await create(id,null,2);
  await assert.rejects(update(id,1,{...bed,id:'forged'}),error=>error.code==='22023');
  await assert.rejects(update(id,1,{...bed,widthCm:200}),error=>error.code==='23514');
  await update(id,1,{...bed,widthCm:140});
  const current=(await db.query('select beds from public.gardens where id=$1',[gardenId])).rows[0].beds;
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify([current[0],{...other,xCm:125}]),gardenId]);
  await assert.rejects(complete(id,2,3),error=>error.code==='23514');
  assert.equal((await db.query('select status from public.bed_activities where id=$1',[id])).rows[0].status,'planned');
  assert.equal((await db.query('select version from public.gardens where id=$1',[gardenId])).rows[0].version,3);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count,1);
});

test('outsiders and revoked editors cannot edit or complete open work',async()=>{
  await asUser(outsider);
  await assert.rejects(update(workId,4,bed),error=>error.code==='42501');
  await assert.rejects(complete(workId,4,3),error=>error.code==='42501');
  await asUser(owner);await db.query('select public.unshare_garden($1,$2)',[gardenId,editor]);
  await asUser(editor);await assert.rejects(update(workId,4,bed),error=>error.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(update(workId,4,bed),error=>error.code==='42501');
});

test('completing planting work preserves a bed position changed after the work was started',async()=>{
  await asUser(owner);const id=crypto.randomUUID();await create(id,null,3);
  const current=(await db.query('select beds from public.gardens where id=$1',[gardenId])).rows[0].beds;
  current[0].xCm=5;
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(current),gardenId]);
  await complete(id,1,4);
  const saved=(await db.query('select beds from public.gardens where id=$1',[gardenId])).rows[0].beds;
  assert.equal(saved[0].xCm,5);assert.deepEqual(saved[1],current[1]);
});

test('open work and completed history retain the chosen plant border distance independently',async()=>{
  await asUser(owner);
  const current=(await db.query('select beds,version from public.gardens where id=$1',[gardenId])).rows[0];
  const count=Number((await db.query('select count(*) from public.garden_layout_events')).rows[0].count);
  const id=crypto.randomUUID();await create(id,null,current.version);
  const plantingPlan=planV5();plantingPlan.areas[0].plant.borderDistanceCm=25;
  await update(id,1,{...current.beds[0],plantingPlan});
  assert.equal(Number((await db.query('select count(*) from public.garden_layout_events')).rows[0].count),count);
  assert.equal((await db.query('select beds from public.gardens where id=$1',[gardenId])).rows[0].beds[0].plantingPlan.areas[0].plant.borderDistanceCm,undefined);
  await complete(id,2,current.version);
  const recorded=(await db.query('select snapshot from public.garden_layout_events where activity_id=$1',[id])).rows[0].snapshot;
  assert.equal(recorded.beds[0].plantingPlan.areas[0].plant.borderDistanceCm,25);
  const latest=structuredClone(recorded.beds);latest[0].plantingPlan.areas[0].plant.borderDistanceCm=5;
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(latest),gardenId]);
  assert.equal((await db.query('select snapshot from public.garden_layout_events where activity_id=$1',[id])).rows[0].snapshot.beds[0].plantingPlan.areas[0].plant.borderDistanceCm,25);
});
