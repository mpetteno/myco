import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const reader = '22222222-2222-4222-8222-222222222222';
let familyA, familyB, plantA, plantB, ruleId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values ('${admin}'), ('${reader}');`);
  for (const file of ['202611160001_saved_gardens.sql', '202611160002_garden_sharing.sql', '202611160003_plant_catalogues.sql','202611160014_plant_border_distance.sql']) {
    const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
    await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;`);
  }
  await db.query('insert into public.catalogue_administrators(user_id) values ($1)', [admin]);
  await asUser(admin);
  familyA = (await db.query("insert into public.plant_families(name,plant_spacing_cm,row_spacing_cm) values ('Family A',30,40) returning id")).rows[0].id;
  familyB = (await db.query("insert into public.plant_families(name) values ('Family B') returning id")).rows[0].id;
  plantA = (await db.query("insert into public.plant_types(name,family_id,plant_spacing_cm) values ('Type A',$1,12.5) returning id", [familyA])).rows[0].id;
  plantB = (await db.query("insert into public.plant_types(name,family_id) values ('Type B',$1) returning id", [familyB])).rows[0].id;
  ruleId = (await insertRule(['plant', plantA], ['family', familyB])).rows[0].id;
});
after(() => db.close());
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function insertRule(first, second, relationship = 'companion') {
  const [a, b] = [`${first[0]}:${first[1]}`, `${second[0]}:${second[1]}`].sort();
  const parts = [a.split(':'), b.split(':')];
  return db.query('insert into public.companion_rules(family_a_id,plant_a_id,family_b_id,plant_b_id,relationship) values($1,$2,$3,$4,$5) returning id',
    [parts[0][0] === 'family' ? parts[0][1] : null, parts[0][0] === 'plant' ? parts[0][1] : null,
      parts[1][0] === 'family' ? parts[1][1] : null, parts[1][0] === 'plant' ? parts[1][1] : null, relationship]);
}
const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');

test('all signed-in users can read the global catalogue but cannot promote themselves or change it', async () => {
  await asUser(reader);
  assert.equal((await db.query('select id from public.plant_families')).rows.length, 2);
  assert.equal((await db.query('select id from public.plant_types')).rows.length, 2);
  assert.equal((await db.query('select id from public.companion_rules')).rows.length, 1);
  assert.equal((await db.query('select user_id from public.catalogue_administrators')).rows.length, 0);
  await denied(db.query('insert into public.catalogue_administrators(user_id) values ($1)', [reader]));
  await denied(db.query('delete from public.catalogue_administrators where user_id=$1', [admin]));
  await denied(db.query("insert into public.plant_families(name) values ('Unauthorised')"));
  await denied(db.query("insert into public.plant_types(name,family_id) values ('Unauthorised',$1)", [familyA]));
  await denied(insertRule(['family', familyA], ['family', familyB]));
  for (const [table, id] of [['plant_families', familyA], ['plant_types', plantA], ['companion_rules', ruleId]]) {
    assert.equal((await db.query(`update public.${table} set notes='Unauthorised' where id=$1 returning id`, [id])).rows.length, 0);
    await denied(db.query(`delete from public.${table} where id=$1`, [id]));
  }
});

test('administrators can edit with revision checks but cannot set identity, timestamps, revisions or roles', async () => {
  await asUser(admin);
  assert.deepEqual((await db.query('select user_id from public.catalogue_administrators')).rows, [{ user_id: admin }]);
  for (const [table, id] of [['plant_families', familyA], ['plant_types', plantA], ['companion_rules', ruleId]]) {
    assert.equal((await db.query(`update public.${table} set notes='Revised' where id=$1 and version=1 returning version`, [id])).rows[0].version, 2);
    assert.equal((await db.query(`update public.${table} set notes='Stale' where id=$1 and version=1 returning id`, [id])).rows.length, 0);
    for (const assignment of ['version=99', 'id=gen_random_uuid()', 'updated_at=now()'])
      await denied(db.query(`update public.${table} set ${assignment} where id=$1`, [id]));
  }
  await denied(db.query('insert into public.catalogue_administrators(user_id) values ($1)', [reader]));
});

test('checks references, positive spacing, names, canonical pairs and case-insensitive duplicates', async () => {
  await asUser(admin);
  assert.equal(Number((await db.query('select plant_spacing_cm from public.plant_types where id=$1', [plantA])).rows[0].plant_spacing_cm), 12.5);
  for (const distance of ['0', '-5', 'NaN', 'Infinity', '9007199254740992'])
    await assert.rejects(db.query('update public.plant_families set plant_spacing_cm=$1 where id=$2', [distance, familyA]), (error) => error.code === '23514');
  await assert.rejects(db.query("insert into public.plant_families(name) values (' family a ')"), (error) => error.code === '23505');
  await assert.rejects(db.query("insert into public.plant_families(name) values ('  ')"), (error) => error.code === '23514');
  await assert.rejects(db.query("insert into public.plant_types(name,family_id) values ('Missing',gen_random_uuid())"), (error) => error.code === '23503');
  await assert.rejects(db.query("insert into public.plant_types(name,family_id) values ('TYPE A',$1)", [familyA]), (error) => error.code === '23505');
  await assert.rejects(insertRule(['family', familyB], ['plant', plantA]), (error) => error.code === '23505');
  await assert.rejects(db.query("insert into public.companion_rules(plant_a_id,family_b_id,relationship) values ($1,$2,'caution')", [plantB, familyA]), (error) => error.code === '23514');
  await assert.rejects(db.query("insert into public.companion_rules(relationship) values ('companion')"), (error) => error.code === '23514');
  await assert.rejects(insertRule(['family', familyA], ['family', familyB], 'blocked'), (error) => error.code === '23514');
  await insertRule(['family', familyA], ['family', familyB], 'caution');
  await insertRule(['plant', plantA], ['plant', plantB]);
  await insertRule(['family', familyA], ['family', familyA]);
});

test('anonymous access is denied and adding/removing additional administrators takes effect immediately', async () => {
  await db.exec('reset role; set role anon;');
  for (const table of ['catalogue_administrators', 'plant_families', 'plant_types', 'companion_rules'])
    await denied(db.query(`select * from public.${table}`));
  await db.exec('reset role;');
  await db.query('insert into public.catalogue_administrators(user_id) values ($1)', [reader]);
  await asUser(reader);
  assert.equal((await db.query("update public.plant_families set notes='Additional admin' where id=$1 returning id", [familyA])).rows.length, 1);
  await db.exec('reset role;');
  await db.query('delete from public.catalogue_administrators where user_id=$1', [reader]);
  await asUser(reader);
  assert.equal((await db.query("update public.plant_families set notes='Revoked' where id=$1 returning id", [familyA])).rows.length, 0);
  assert.equal((await db.query('select id from public.plant_families')).rows.length, 2);
});

test('plant border defaults are readable by everyone, writable only by admins and validated on the grid',async()=>{
  await asUser(admin);
  assert.equal(Number((await db.query('select border_distance_cm from public.plant_types where id=$1',[plantA])).rows[0].border_distance_cm),15);
  for(const value of [0,-5,12,12.5,'NaN','Infinity','9007199254740995'])
    await assert.rejects(db.query('update public.plant_types set border_distance_cm=$1 where id=$2',[value,plantA]),error=>error.code==='23514');
  await assert.rejects(db.query('update public.plant_types set border_distance_cm=null where id=$1',[plantA]),error=>error.code==='23502');
  const before=(await db.query('select version from public.plant_types where id=$1',[plantA])).rows[0].version;
  const saved=(await db.query('update public.plant_types set border_distance_cm=25 where id=$1 returning border_distance_cm,version',[plantA])).rows[0];
  assert.equal(Number(saved.border_distance_cm),25);assert.equal(Number(saved.version),Number(before)+1);
  await asUser(reader);
  assert.equal((await db.query('update public.plant_types set border_distance_cm=5 where id=$1 returning id',[plantA])).rows.length,0);
  assert.equal(Number((await db.query('select border_distance_cm from public.plant_types where id=$1',[plantA])).rows[0].border_distance_cm),25);
  await db.exec('reset role; set role anon;');
  await denied(db.query('select border_distance_cm from public.plant_types'));
});
