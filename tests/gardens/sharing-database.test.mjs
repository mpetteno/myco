import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const editor = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const unconfirmed = '44444444-4444-4444-8444-444444444444';
let gardenId, privateId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values
      ('${owner}', 'owner@example.test', now()), ('${editor}', 'Editor@example.test', now()),
      ('${outsider}', 'outsider@example.test', now()), ('${unconfirmed}', 'unconfirmed@example.test', null);`);
  for (const file of ['202611160001_saved_gardens.sql', '202611160002_garden_sharing.sql']) {
    const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
    // The IDE applies each migration as one atomic DO statement.
    await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;`);
  }
  await asUser(owner);
  gardenId = (await db.query("insert into public.gardens(owner_id,name,width_cm,length_cm) values ($1,'Shared garden',500,300) returning id", [owner])).rows[0].id;
  privateId = (await db.query("insert into public.gardens(owner_id,name,width_cm,length_cm) values ($1,'Private garden',500,300) returning id", [owner])).rows[0].id;
});
after(() => db.close());
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const share = (id, email) => db.query('select public.share_garden($1,$2)', [id, email]);
const unshare = (id, userId) => db.query('select public.unshare_garden($1,$2)', [id, userId]);
const members = (id) => db.query('select * from public.list_garden_members($1)', [id]);
const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');

test('owner shares by exact, case-insensitive confirmed email and duplicate sharing is harmless', async () => {
  await asUser(owner);
  assert.deepEqual((await members(gardenId)).rows, []);
  await share(gardenId, '  editor@EXAMPLE.test  ');
  await share(gardenId, 'Editor@example.test');
  assert.deepEqual((await members(gardenId)).rows, [{ user_id: editor, email: 'Editor@example.test' }]);
  assert.equal((await db.query('select version from public.gardens where id=$1', [gardenId])).rows[0].version, 1);
  await assert.rejects(share(gardenId, 'missing@example.test'), (error) => error.code === 'P0002');
  await assert.rejects(share(gardenId, 'unconfirmed@example.test'), (error) => error.code === 'P0002');
  await assert.rejects(share(gardenId, 'owner@example.test'), (error) => error.code === '22023');
  await assert.rejects(share(gardenId, null), (error) => error.code === '22023');
});

test('editor sees the shared garden and can change its name, dimensions and beds with version protection', async () => {
  await asUser(editor);
  assert.deepEqual((await db.query('select id from public.gardens')).rows, [{ id: gardenId }]);
  assert.deepEqual((await db.query('select user_id from public.garden_members')).rows, [{ user_id: editor }]);
  const bed = { id: 'herbs', name: 'Herbs', xCm: 5, yCm: 10, widthCm: 100, lengthCm: 50 };
  const saved = await db.query("update public.gardens set name='Edited', width_cm=600, beds=$1 where id=$2 and version=1 returning name,width_cm,beds,version", [JSON.stringify([bed]), gardenId]);
  assert.equal(saved.rows[0].name, 'Edited');
  assert.equal(Number(saved.rows[0].width_cm), 600);
  assert.deepEqual(saved.rows[0].beds, [bed]);
  assert.equal(saved.rows[0].version, 2);
  await assert.rejects(db.query('update public.gardens set width_cm=12 where id=$1', [gardenId]), (error) => error.code === '23514');
  await asUser(owner);
  assert.equal((await db.query("update public.gardens set name='Stale owner edit' where id=$1 and version=1 returning id", [gardenId])).rows.length, 0);
});

test('editors cannot manage sharing, enumerate users, transfer ownership or change revisions', async () => {
  await asUser(editor);
  await denied(share(gardenId, 'outsider@example.test'));
  await denied(unshare(gardenId, editor));
  await denied(members(gardenId));
  await denied(db.query('select email from auth.users'));
  await denied(db.query('insert into public.garden_members(garden_id,user_id) values ($1,$2)', [gardenId, outsider]));
  await denied(db.query('delete from public.garden_members where garden_id=$1', [gardenId]));
  await denied(db.query('update public.garden_members set user_id=$1 where garden_id=$2', [outsider, gardenId]));
  await denied(db.query('update public.gardens set owner_id=$1 where id=$2', [editor, gardenId]));
  await denied(db.query('update public.gardens set version=100 where id=$1', [gardenId]));
  await denied(db.query('delete from public.gardens where id=$1', [gardenId]));
});

test('outsiders and anonymous clients cannot view or edit shared gardens or use sharing RPCs', async () => {
  await asUser(outsider);
  assert.equal((await db.query('select id from public.gardens')).rows.length, 0);
  assert.equal((await db.query('select user_id from public.garden_members')).rows.length, 0);
  assert.equal((await db.query("update public.gardens set name='Stolen' where id=$1 returning id", [gardenId])).rows.length, 0);
  await denied(share(privateId, 'editor@example.test'));
  await denied(share(gardenId, 'missing@example.test'));
  await denied(unshare(gardenId, editor));
  await denied(members(gardenId));
  await db.exec('reset role; set role anon;');
  await denied(share(gardenId, 'outsider@example.test'));
  await denied(members(gardenId));
  await denied(unshare(gardenId, editor));
  await denied(db.query('select * from public.garden_members'));
});

test('owner can revoke access immediately and later share again while retaining ownership', async () => {
  await asUser(owner);
  await unshare(gardenId, editor); await unshare(gardenId, editor);
  assert.deepEqual((await members(gardenId)).rows, []);
  await asUser(editor);
  assert.equal((await db.query('select id from public.gardens where id=$1', [gardenId])).rows.length, 0);
  assert.equal((await db.query("update public.gardens set name='Revoked edit' where id=$1 and version=2 returning id", [gardenId])).rows.length, 0);
  assert.equal((await db.query('select user_id from public.garden_members')).rows.length, 0);
  await asUser(owner);
  assert.equal((await db.query('select owner_id from public.gardens where id=$1', [gardenId])).rows[0].owner_id, owner);
  await share(gardenId, 'editor@example.test');
  await asUser(editor);
  assert.equal((await db.query('select id from public.gardens where id=$1', [gardenId])).rows.length, 1);
});
