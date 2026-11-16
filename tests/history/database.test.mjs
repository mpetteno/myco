import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bed, planV5 } from '../planting/fixtures.mjs';
import { mulchPlan } from '../mulch/fixtures.mjs';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111', editor = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const backdatedId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const planted = { ...bed, plantingPlan: planV5(), mulchPlan: mulchPlan() };
let gardenId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}','owner@example.test',now()), ('${editor}','editor@example.test',now()), ('${outsider}','outsider@example.test',now());`);
  const path = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(path)).filter((file) => file.endsWith('.sql') && file < '202611160011').sort()) await migrate(file);
  await asUser(owner);
  gardenId = (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',
    [owner, 'Existing garden', JSON.stringify([planted])])).rows[0].id;
  await db.query('select public.share_garden($1,$2)', [gardenId, 'editor@example.test']);
  await db.exec('reset role;'); await migrate('202611160011_garden_layout_history.sql');
});
after(() => db.close());
async function migrate(file) {
  const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
  await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;`);
}
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const record = (id, version = 1, date = '2026-02-10', title = 'Layout update', notes = '') => db.query(
  'select * from public.record_garden_layout_event($1,$2,$3,$4,$5,$6)', [gardenId, version, id, date, title, notes]);
const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');

test('history starts empty, explicitly records the complete saved layout and leaves the working garden unchanged', async () => {
  await asUser(owner);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count, 0);
  const event = (await record(firstId, 1, '2026-02-10', ' Prepared beds ', ' First layout ')).rows[0];
  assert.equal(event.title, 'Prepared beds'); assert.equal(event.notes, 'First layout');
  assert.equal(event.actor_id, owner); assert.equal(event.source_version, 1);
  assert.deepEqual(event.snapshot, { name: 'Existing garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [planted] });
  assert.equal((await db.query('select version from public.gardens where id=$1', [gardenId])).rows[0].version, 1);
});

test('shared editors save multiple same-day events and backdated snapshots without rewriting earlier or later states', async () => {
  await asUser(editor);
  await db.query('update public.gardens set beds=$1 where id=$2 and version=1', [JSON.stringify([{ ...planted, xCm: 20 }]), gardenId]);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count, 1, 'autosaves do not create events');
  const second = (await record(secondId, 2, '2026-02-10', 'Moved bed')).rows[0];
  const backdated = (await record(backdatedId, 2, '2026-02-09', 'Earlier layout entry')).rows[0];
  assert.equal(second.actor_id, editor); assert.equal(second.snapshot.beds[0].xCm, 20);
  assert.ok(backdated.event_order > second.event_order);
  const ordered = (await db.query('select id from public.garden_layout_events order by event_date,event_order')).rows.map((row) => row.id);
  assert.deepEqual(ordered, [backdatedId, firstId, secondId]);
  const original = (await db.query('select snapshot from public.garden_layout_events where id=$1', [firstId])).rows[0].snapshot;
  assert.equal(original.beds[0].xCm, 0);
  assert.equal((await db.query('select version from public.gardens where id=$1', [gardenId])).rows[0].version, 2);
});

test('events cannot be forged, edited or deleted through the browser and stale snapshots are rejected', async () => {
  await asUser(owner);
  await denied(db.query("insert into public.garden_layout_events(id,garden_id,event_date,title,source_version,snapshot) values(gen_random_uuid(),$1,current_date,'Forged',1,'{}')", [gardenId]));
  await denied(db.query("update public.garden_layout_events set title='Changed' where id=$1", [firstId]));
  await denied(db.query('delete from public.garden_layout_events where id=$1', [firstId]));
  await assert.rejects(record(crypto.randomUUID(), 1), (error) => error.code === '40001');
  for (const [date, title, notes] of [[null, 'Entry', ''], ['infinity', 'Entry', ''], ['2026-02-10', ' ', ''], ['2026-02-10', 'x'.repeat(121), ''], ['2026-02-10', 'Entry', 'x'.repeat(2001)]])
    await assert.rejects(record(crypto.randomUUID(), 2, date, title, notes), (error) => error.code === '22023');
});

test('retrying a committed request returns the original event without duplicates, even after later saves', async () => {
  await asUser(owner);
  const replay = (await record(firstId, 2, '2026-02-10', 'Prepared beds', 'First layout')).rows[0];
  assert.equal(replay.source_version, 1); assert.equal(replay.snapshot.beds[0].xCm, 0);
  assert.equal((await db.query('select count(*) from public.garden_layout_events')).rows[0].count, 3);
  await assert.rejects(record(firstId, 2, '2026-02-10', 'Different request'), (error) => error.code === '22023');
});

test('outsiders, anonymous users and revoked members cannot read or append garden history', async () => {
  await asUser(outsider);
  assert.equal((await db.query('select id from public.garden_layout_events')).rows.length, 0);
  await denied(record(crypto.randomUUID(), 2));
  await asUser(owner); await db.query('select public.unshare_garden($1,$2)', [gardenId, editor]);
  await asUser(editor);
  assert.equal((await db.query('select id from public.garden_layout_events')).rows.length, 0);
  await denied(record(crypto.randomUUID(), 2));
  await db.exec('reset role; set role anon;');
  await denied(db.query('select id from public.garden_layout_events'));
  await denied(record(crypto.randomUUID(), 2));
});
