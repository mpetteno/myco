import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const reader = '22222222-2222-4222-8222-222222222222';
let mulchId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${admin}'), ('${reader}');`);
  for (const file of ['202611160003_plant_catalogues.sql', '202611160009_mulch_catalogue.sql']) {
    const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
    await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;`);
  }
  assert.equal((await db.query('select count(*) from public.mulch_types')).rows[0].count, 0);
  await db.query('insert into public.catalogue_administrators(user_id) values ($1)', [admin]);
  await asUser(admin);
  mulchId = (await db.query("insert into public.mulch_types(name,notes) values ('Straw','Dry material') returning id")).rows[0].id;
});
after(() => db.close());
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');

test('signed-in readers can browse mulch types but cannot create, edit, delete or promote themselves', async () => {
  await asUser(reader);
  assert.equal((await db.query('select name from public.mulch_types')).rows[0].name, 'Straw');
  await denied(db.query("insert into public.mulch_types(name) values ('Unauthorised')"));
  assert.equal((await db.query("update public.mulch_types set notes='Unauthorised' returning id")).rows.length, 0);
  await denied(db.query('delete from public.mulch_types where id=$1', [mulchId]));
  await denied(db.query('insert into public.catalogue_administrators(user_id) values ($1)', [reader]));
});

test('administrators can create and revise mulch types with stale-save protection and immutable metadata', async () => {
  await asUser(admin);
  assert.equal((await db.query("update public.mulch_types set notes='Revised' where id=$1 and version=1 returning version", [mulchId])).rows[0].version, 2);
  assert.equal((await db.query("update public.mulch_types set name='Stale' where id=$1 and version=1 returning id", [mulchId])).rows.length, 0);
  for (const assignment of ['version=99', 'id=gen_random_uuid()', 'created_at=now()', 'updated_at=now()'])
    await denied(db.query(`update public.mulch_types set ${assignment} where id=$1`, [mulchId]));
  await denied(db.query("insert into public.mulch_types(name,version) values ('Forged',99)"));
  await denied(db.query('delete from public.mulch_types where id=$1', [mulchId]));
  const row = (await db.query("insert into public.mulch_types(name) values ('Wood chips') returning notes,version")).rows[0];
  assert.deepEqual(row, { notes: '', version: 1 });
});

test('mulch catalogue rejects blank, oversized and case-insensitive duplicate names', async () => {
  await asUser(admin);
  for (const name of ['', '   ', 'x'.repeat(101)])
    await assert.rejects(db.query('insert into public.mulch_types(name) values ($1)', [name]), (error) => error.code === '23514');
  await assert.rejects(db.query("insert into public.mulch_types(name) values (' straw ')"), (error) => error.code === '23505');
  await assert.rejects(db.query('update public.mulch_types set notes=$1 where id=$2', ['x'.repeat(2001), mulchId]), (error) => error.code === '23514');
});

test('anonymous users are denied and the existing administrator role can be granted and revoked for mulch', async () => {
  await db.exec('reset role; set role anon;');
  await denied(db.query('select * from public.mulch_types'));
  await denied(db.query("insert into public.mulch_types(name) values ('Anonymous')"));
  await db.exec('reset role;');
  await db.query('insert into public.catalogue_administrators(user_id) values ($1)', [reader]);
  await asUser(reader);
  assert.equal((await db.query("update public.mulch_types set notes='Additional admin' where id=$1 returning id", [mulchId])).rows.length, 1);
  await db.exec('reset role;');
  await db.query('delete from public.catalogue_administrators where user_id=$1', [reader]);
  await asUser(reader);
  assert.equal((await db.query("update public.mulch_types set notes='Revoked' where id=$1 returning id", [mulchId])).rows.length, 0);
  assert.equal((await db.query('select count(*) from public.mulch_types')).rows[0].count, 2);
});
