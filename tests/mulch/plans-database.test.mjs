import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { bed, planV5 } from '../planting/fixtures.mjs';
import { chips, mulchArea, mulchPlan } from './fixtures.mjs';

const model = await loadModule('tests/mulch/modules.ts', 'mulch-plans-db');
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const editor = '22222222-2222-4222-8222-222222222222';
let gardenId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}','owner@example.test',now()), ('${editor}','editor@example.test',now());`);
  for (const file of ['202611160001_saved_gardens.sql', '202611160002_garden_sharing.sql', '202611160003_plant_catalogues.sql',
    '202611160004_bed_planting_plans.sql', '202611160005_area_rows.sql', '202611160006_spacing_margins.sql',
    '202611160007_fixed_area_margins.sql', '202611160008_balanced_area_rows.sql', '202611160009_mulch_catalogue.sql']) await migrate(file);
  await asUser(owner);
  gardenId = (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id',
    [owner, 'Existing garden', JSON.stringify([bed])])).rows[0].id;
  await db.query('select public.share_garden($1,$2)', [gardenId, 'editor@example.test']);
  await db.exec('reset role;'); await migrate('202611160010_bed_mulch_plans.sql');
});
after(async () => { await db.close(); cleanupModules(); });
async function migrate(file) {
  const sql = await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8');
  await db.exec(`do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;`);
}
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const save = (beds, version) => db.query('update public.gardens set beds=$1 where id=$2 and version=$3 returning beds,version', [JSON.stringify(beds), gardenId, version]);

test('migration keeps existing gardens and owners/shared editors atomically save planting and ordered mulch layers', async () => {
  await asUser(owner);
  const before = (await db.query('select beds,version from public.gardens where id=$1', [gardenId])).rows[0];
  assert.deepEqual(before, { beds: [bed], version: 1 });
  const planted = { ...bed, plantingPlan: planV5(), mulchPlan: mulchPlan() };
  assert.equal((await save([planted], 1)).rows[0].version, 2);
  await asUser(editor);
  const changed = { ...planted, mulchPlan: mulchPlan({ areas: [mulchArea({ layers: [...mulchArea().layers].reverse() })] }) };
  const result = (await save([changed], 2)).rows[0];
  assert.equal(result.version, 3); assert.deepEqual(result.beds[0], changed);
  assert.equal((await save([bed], 2)).rows.length, 0, 'a stale save cannot erase mulch or planting');
  await assert.rejects(db.query("insert into public.mulch_types(name) values ('Not an admin')"), (error) => error.code === '42501');
});

test('database rejects off-grid, cropped, overlapping, duplicate and malformed mulch areas and layers', async () => {
  await asUser(owner);
  const invalid = [null, {}, mulchPlan({ version: 2 }), mulchPlan({ areas: [] }), mulchPlan({ areas: [null] }),
    mulchPlan({ areas: [mulchArea({ xCm: 1 })] }), mulchPlan({ areas: [mulchArea({ widthCm: 105 })] }),
    mulchPlan({ areas: [mulchArea({ name: '' })] }), mulchPlan({ areas: [mulchArea({ layers: [] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [null] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [{ id: 'a', material: { ...chips, version: 0 } }] })] }),
    mulchPlan({ areas: [mulchArea(), mulchArea({ id: 'other' })] }),
    mulchPlan({ areas: [mulchArea({ widthCm: 50 }), mulchArea({ id: 'other', xCm: 50, widthCm: 50 })] }),
    mulchPlan({ areas: Array.from({ length: 13 }, (_, index) => mulchArea({ id: `area-${index}` })) }),
    mulchPlan({ areas: [mulchArea({ layers: Array.from({ length: 9 }, (_, index) => ({ id: `layer-${index}`, material: chips })) })] })];
  for (const value of invalid) {
    assert.ok(model.validateMulchPlan(value, bed));
    await assert.rejects(save([{ ...bed, mulchPlan: value }], 3), (error) => error.code === '23514');
  }
  await assert.rejects(save([{ ...bed, widthCm: 95, mulchPlan: mulchPlan() }], 3), (error) => error.code === '23514');
});

test('client and database agree on adjacent areas with independent, repeatable material layers', async () => {
  await asUser(owner);
  for (let index = 1; index <= 8; index++) {
    const first = mulchArea({ widthCm: 50, layers: Array.from({ length: index }, (_, i) => ({ id: `first-${i}`, material: chips })) });
    const second = mulchArea({ id: 'other', xCm: 50, widthCm: 50, layers: [{ id: 'second', material: chips }] });
    const draft = mulchPlan({ areas: [first, second] });
    assert.equal(model.validateMulchPlan(draft, bed), null);
    assert.equal((await db.query('select public.myco_valid_mulch_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, mulchPlan: draft }])])).rows[0].valid, true);
  }
});

test('mulch-only plans can be saved and cleared; revoked editors and anonymous users cannot access validation or gardens', async () => {
  await asUser(owner);
  assert.equal((await save([{ ...bed, mulchPlan: mulchPlan() }], 3)).rows[0].version, 4);
  assert.equal((await save([bed], 4)).rows[0].version, 5);
  await db.query('select public.unshare_garden($1,$2)', [gardenId, editor]);
  await asUser(editor);
  assert.equal((await save([{ ...bed, mulchPlan: mulchPlan() }], 5)).rows.length, 0);
  assert.equal((await db.query('select id from public.gardens where id=$1', [gardenId])).rows.length, 0);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select public.myco_valid_mulch_plans($1::jsonb)', [JSON.stringify([bed])]), (error) => error.code === '42501');
});
