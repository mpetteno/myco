import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const owner='11111111-1111-4111-8111-111111111111', editor='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
let garden, other, activity, event;
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','other@example.test',now());`);
  const directory=new URL('../../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')&&f<'202611160016').sort()) await db.exec(await readFile(new URL(file,directory),'utf8'));
  const snapshot=JSON.stringify({name:'Delete target',dimensions:{widthCm:500,lengthCm:500},beds:[{id:'bed-a',name:'Herbs',xCm:0,yCm:0,widthCm:100,lengthCm:100}]});
  const migration=await readFile(new URL('202611240032_delete_garden.sql',directory),'utf8');
  await db.exec(migration);
  garden=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm) values($1,$2,500,500) returning id',[owner,'Delete target'])).rows[0].id;
  other=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm) values($1,$2,500,500) returning id',[owner,'Keep this garden'])).rows[0].id;
  await db.query('insert into public.garden_members(garden_id,user_id) values($1,$2)',[garden,editor]);
  activity=crypto.randomUUID();event=crypto.randomUUID();
  await db.query(`insert into public.bed_activities(id,garden_id,bed_id,kind,planned_date,title,planned_snapshot,source_version) values($1,$2,'bed-a','planting','2026-11-24','Planned',$3,1)`,[activity,garden,snapshot]);
  await db.query(`insert into public.garden_layout_events(id,garden_id,event_date,title,source_version,snapshot,activity_id) values($1,$2,'2026-11-24','Completed',1,$4,$3)`,[event,garden,activity,snapshot]);
  await db.query('update public.bed_activities set completion_event_id=$1 where id=$2',[event,activity]);
  await db.query(`insert into public.garden_layout_event_revisions(event_id,garden_id,version,previous_record) values($1,$2,1,'{}')`,[event,garden]);
});
after(()=>db.close());
async function asUser(id){await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
const remove=(version=1)=>db.query('select public.delete_garden($1,$2)',[garden,version]);

test('only the owner can delete; direct writes and anonymous calls remain blocked',async()=>{
  for(const user of [editor,outsider]){await asUser(user);await assert.rejects(remove(),e=>e.code==='42501');}
  await asUser(owner);await assert.rejects(db.query('delete from public.gardens where id=$1',[garden]),e=>e.code==='42501');
  await db.exec('reset role;set role anon;');await assert.rejects(remove(),e=>e.code==='42501');
  await asUser('');await assert.rejects(remove(),e=>e.code==='42501');
});
test('stale revisions preserve all garden data and invalid revision inputs are rejected',async()=>{
  await asUser(owner);await db.query('update public.gardens set name=$1 where id=$2',['Latest name',garden]);
  await assert.rejects(remove(1),e=>e.code==='40001');await assert.rejects(remove(null),e=>e.code==='22023');
  assert.equal((await db.query('select count(*) from public.gardens where id=$1',[garden])).rows[0].count,1);
  assert.equal((await db.query('select count(*) from public.garden_layout_events where garden_id=$1',[garden])).rows[0].count,1);
});
test('confirmed owner deletion cascades history, activities, revisions and sharing, preserving other gardens and allowing retries',async()=>{
  await asUser(owner);await remove(2);await remove(2);
  await db.exec('reset role;');
  for(const table of ['garden_members','garden_layout_events','bed_activities','garden_layout_event_revisions']) assert.equal((await db.query(`select count(*) from public.${table} where garden_id=$1`,[garden])).rows[0].count,0,table);
  assert.equal((await db.query('select count(*) from public.gardens where id=$1',[garden])).rows[0].count,0);
  assert.equal((await db.query('select name from public.gardens where id=$1',[other])).rows[0].name,'Keep this garden');
});
