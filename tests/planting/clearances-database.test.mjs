import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
import { rows, broadcast, areaPlan, bed } from './area-fixtures.mjs';
import { planV3, planV5, areaV2 } from './fixtures.mjs';
const model = await loadModule('tests/planting/area-modules.ts', 'clearances-db');
const db = new PGlite(), owner = '11111111-1111-4111-8111-111111111111', editor = '22222222-2222-4222-8222-222222222222', outsider = '33333333-3333-4333-8333-333333333333';
let garden, original, history;
const directory = new URL('../../supabase/migrations/', import.meta.url);
async function migrate(file) {
  const sql = await readFile(new URL(file, directory), 'utf8');
  await db.exec(file.includes('021_') ? `do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;` : sql);
}
async function asUser(id) { await db.exec('reset role;set role authenticated;'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); }
before(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}','owner@example.test',now()),('${editor}','editor@example.test',now()),('${outsider}','other@example.test',now());`);
  for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql') && f < '202611240033').sort()) await migrate(file);
  await asUser(owner);
  original = [{ ...bed, areaPlan: areaPlan(rows()) }, { ...bed, id: 'legacy', xCm: 150, plantingPlan: planV3() }];
  garden = (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,500,$3,$4) returning id', [owner, 'Clearance test', original, { countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' }])).rows[0].id;
  await db.query('select public.share_garden($1,$2)', [garden, 'editor@example.test']);
  history = (await db.query('select * from public.record_garden_layout_event($1,1,$2,$3,$4,$5)', [garden, crypto.randomUUID(), '2026-11-24', 'Before clearance overrides', ''])).rows[0].snapshot;
  await db.exec('reset role;'); await migrate('202611240033_area_minimum_clearances.sql'); await asUser(owner);
});
after(async () => { await db.close(); cleanupModules(); });
const serverValid = async (document) => (await db.query('select public.myco_valid_planting_plans($1) as valid', [[document]])).rows[0].valid;

test('clearance migration preserves saved gardens, revisions and recorded historical geometry', async () => {
  const saved = (await db.query('select beds,version from public.gardens where id=$1', [garden])).rows[0];
  assert.deepEqual(saved.beds, original); assert.equal(saved.version, 1);
  assert.deepEqual((await db.query('select snapshot from public.garden_layout_events where garden_id=$1', [garden])).rows[0].snapshot, history);
});

test('client and database agree on asymmetric minima, capacity and row directions for unified and legacy row documents', async () => {
  for (const rowDirection of ['width', 'length']) for (const rowCount of [null, 1, 2, 4]) for (const widthCm of [30, 65, 100, 200]) for (const lengthCm of [30, 90, 200]) {
    const area = rows({ widthCm, lengthCm, rowDirection, rowCount, clearancesCm: { top: 30, left: 50, bottom: 20 } });
    const document = { ...bed, widthCm, lengthCm, areaPlan: areaPlan(area) };
    const valid = !model.validateAreaPlan(document.areaPlan, document);
    assert.equal(await serverValid(document), valid, JSON.stringify({ rowDirection, rowCount, widthCm, lengthCm }));
    const legacy = { ...document, areaPlan: undefined, plantingPlan: planV5({ respectAreaSpacing: false, areas: [area] }) }; delete legacy.areaPlan;
    assert.equal(await serverValid(legacy), valid);
  }
  const size = { widthCm: 10000, lengthCm: 10000 };
  const tight = rows({ ...size, rowCount: null, plantSpacingCm: 5, rowSpacingCm: 5, clearancesCm: { top: 4950, right: 4950, bottom: 4950, left: 4950 } });
  const document = { ...bed, ...size, areaPlan: areaPlan(tight) };
  assert.equal(model.validateAreaPlan(document.areaPlan, document), null); assert.equal(await serverValid(document), true);
});

test('database rejects malformed overrides, crop-minimum violations, unsupported area kinds and legacy formats', async () => {
  for (const clearancesCm of [null, [], '20', { left: null }, { left: '20' }, { top: 10 }, { right: -5 }, { bottom: 17.5 }, { left: 16 }, { left: 9007199254740995 }, { unexpected: 20 }]) {
    const area = rows({ clearancesCm }); const document = { ...bed, areaPlan: areaPlan(area) };
    assert.ok(model.validateAreaPlan(document.areaPlan, document)); assert.equal(await serverValid(document), false, JSON.stringify(clearancesCm));
  }
  for (const document of [
    { ...bed, areaPlan: areaPlan(broadcast({ clearancesCm: { top: 20 } })) },
    { ...bed, areaPlan: { ...areaPlan(rows({ clearancesCm: {} })), version: 4 } },
    { ...bed, plantingPlan: planV3({ areas: [areaV2({ clearancesCm: {} })] }) },
    { ...bed, widthCm: 200, areaPlan: areaPlan(rows({ widthCm: 60, rowCount: null, clearancesCm: { left: 50 } }), rows({ id: 'other', xCm: 60, widthCm: 140 })) },
  ]) assert.equal(await serverValid(document), false);
});

test('owners and shared editors round-trip clearances; invalid saves roll back and unrelated users cannot change the garden', async () => {
  const document = [{ ...bed, areaPlan: areaPlan(rows({ clearancesCm: { left: 50, top: 30 } })) }];
  const save = (beds, version) => db.query('update public.gardens set beds=$1 where id=$2 and version=$3 returning beds,version', [beds, garden, version]);
  const saved = (await save(document, 1)).rows[0]; assert.equal(saved.version, 2); assert.deepEqual(saved.beds, document);
  const invalid = structuredClone(document); invalid[0].areaPlan.areas[0].clearancesCm.left = 10;
  await assert.rejects(save(invalid, 2), e => e.code === '23514');
  assert.equal((await db.query('select version from public.gardens where id=$1', [garden])).rows[0].version, 2);
  await asUser(editor); const next = structuredClone(document); next[0].areaPlan.areas[0].clearancesCm.left = 45;
  assert.deepEqual((await save(next, 2)).rows[0].beds, next);
  assert.equal((await save(document, 2)).rows.length, 0, 'stale versions cannot overwrite');
  await asUser(outsider); assert.equal((await save(document, 3)).rows.length, 0);
  await asUser(owner); assert.deepEqual((await db.query('select beds from public.gardens where id=$1', [garden])).rows[0].beds, next);
  const recorded = (await db.query('select * from public.record_garden_layout_event($1,3,$2,$3,$4,$5)', [garden, crypto.randomUUID(), '2026-11-24', 'With minimum clearances', ''])).rows[0];
  assert.deepEqual(recorded.snapshot.beds, next);
  assert.deepEqual((await db.query('select snapshot from public.garden_layout_events where garden_id=$1 and title=$2', [garden, 'Before clearance overrides'])).rows[0].snapshot, history);
});
