import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
let gardenId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}'), ('${other}');`);
  await db.exec(await readFile(new URL('../../supabase/migrations/202611160001_saved_gardens.sql', import.meta.url), 'utf8'));
});
after(() => db.close());
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const bed = { id: 'bed-1', name: 'Herbs', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 100 };
async function insert(id, name = 'Kitchen garden', beds = []) {
  return db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values ($1,$2,500,300,$3) returning *', [id, name, JSON.stringify(beds)]);
}

test('applies the migration and supports multiple independent named gardens per owner', async () => {
  await asUser(owner);
  const first = (await insert(owner, 'Kitchen garden', [bed])).rows[0]; gardenId = first.id;
  await insert(owner, 'Front garden');
  assert.equal(first.version, 1);
  assert.deepEqual(first.beds, [bed]);
  assert.equal((await db.query('select id from public.gardens')).rows.length, 2);
  await asUser(other);
  assert.equal((await db.query('select id from public.gardens')).rows.length, 0);
  await insert(other, 'Other garden');
  assert.equal((await db.query('select id from public.gardens')).rows.length, 1);
});

test('RLS prevents reading, updating or creating a garden for a different owner', async () => {
  await asUser(other);
  assert.equal((await db.query('select id from public.gardens where id=$1', [gardenId])).rows.length, 0);
  assert.equal((await db.query("update public.gardens set name='Stolen' where id=$1 returning id", [gardenId])).rows.length, 0);
  await assert.rejects(insert(owner), (error) => error.code === '42501');
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select id from public.gardens'), (error) => error.code === '42501');
});

test('database revision increments atomically and stale saves cannot overwrite newer changes', async () => {
  await asUser(owner);
  const updated = await db.query("update public.gardens set name='Renamed' where id=$1 and version=1 returning *", [gardenId]);
  assert.equal(updated.rows[0].version, 2);
  assert.equal(updated.rows[0].name, 'Renamed');
  assert.deepEqual(updated.rows[0].beds, [bed]);
  assert.equal((await db.query("update public.gardens set name='Stale' where id=$1 and version=1 returning id", [gardenId])).rows.length, 0);
  for (const assignment of ["owner_id='22222222-2222-4222-8222-222222222222'", 'version=100', 'updated_at=now()', "id=gen_random_uuid()"])
    await assert.rejects(db.query(`update public.gardens set ${assignment} where id=$1`, [gardenId]), (error) => error.code === '42501');
  await assert.rejects(db.query('delete from public.gardens where id=$1', [gardenId]), (error) => error.code === '42501');
});

test('rejects invalid dimensions, layouts and overlapping beds at the database boundary', async () => {
  await asUser(owner);
  for (const beds of [null, {}, [null], [{ ...bed, widthCm: 0 }], [{ ...bed, xCm: -5 }],
    [{ ...bed, xCm: 1 }], [{ ...bed, xCm: 450 }], [{ ...bed, name: '' }],
    [{ ...bed, widthCm: '100' }], [bed, { ...bed }], [bed, { ...bed, id: 'bed-2', xCm: 50 }]]) {
    await assert.rejects(insert(owner, 'Invalid', beds), (error) => error.code === '23514');
  }
  await assert.rejects(insert(owner, '   '), (error) => error.code === '23514');
  for (const width of [0, 12, 9007199254741000])
    await assert.rejects(db.query('update public.gardens set width_cm=$1 where id=$2', [width, gardenId]), (error) => error.code === '23514');
  const touching = await insert(owner, 'Touching is valid', [bed, { ...bed, id: 'bed-2', xCm: 100 }]);
  assert.equal(touching.rows[0].beds.length, 2);
});
