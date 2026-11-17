import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
import { areaPlan, rows, broadcast, unplanted, bed } from '../planting/area-fixtures.mjs';
import { straw } from '../mulch/fixtures.mjs';
import { planV5 } from '../planting/fixtures.mjs';
const model = await loadModule('tests/planting/area-modules.ts', 'areas-db');
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111', reader = '22222222-2222-4222-8222-222222222222';
let crop, otherCrop, cultivar, garden, historyBeforeSpacing;
async function asUser(id) { await db.exec('reset role;set role authenticated;'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); }
const sqlError = (promise, code) => assert.rejects(promise, (error) => error.code === code);
before(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values('${admin}'),('${reader}');`);
  for (const file of (await readdir('supabase/migrations')).sort()) {
    if (file.includes('018_')) garden = (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id', [reader, 'Legacy rows', JSON.stringify([{ ...bed, plantingPlan: planV5() }])])).rows[0].id;
    if (file.includes('025_')) {
      await asUser(reader);
      const version = Number((await db.query('select version from public.gardens where id=$1', [garden])).rows[0].version);
      historyBeforeSpacing = (await db.query('select * from public.record_garden_layout_event($1,$2,$3,$4,$5,$6)', [garden, version, '44444444-4444-4444-8444-444444444444', '2026-10-01', 'Before independent spacing', ''])).rows[0].snapshot;
      await db.exec('reset role;');
    }
    const sql = await readFile('supabase/migrations/' + file, 'utf8');
    await db.exec(file.includes('021_') ? `do $migration$ begin\n${sql.replace(/^begin;\s*/, '').replace(/\s*commit;\s*$/, '')}\nend; $migration$;` : sql);
  }
  await db.query('insert into public.catalogue_administrators(user_id) values($1)', [admin]);
  await asUser(admin);
  const family = (await db.query("insert into public.plant_families(name) values('Family') returning id")).rows[0].id;
  crop = (await db.query("insert into public.plant_types(name,family_id) values('Crop',$1) returning id", [family])).rows[0].id;
  otherCrop = (await db.query("insert into public.plant_types(name,family_id) values('Other',$1) returning id", [family])).rows[0].id;
  cultivar = (await db.query("insert into public.plant_cultivars(name,plant_type_id) values('Cultivar',$1) returning id", [crop])).rows[0].id;
});
after(async () => { await db.close(); cleanupModules(); });
const composition = () => [{ plant_type_id: crop, cultivar_id: cultivar, weight_percent: 60 }, { plant_type_id: otherCrop, cultivar_id: null, weight_percent: 40 }];
const save = (id = null, version = null, components = composition(), name = 'Mix') => db.query('select public.myco_save_seed_mixture($1,$2,$3,$4) as id', [id, version, { name, notes: '' }, components]);

test('migration preserves bed outlines and row geometry while moving rows into the shared area plan', async () => {
  await asUser(reader);
  const saved = (await db.query('select beds from public.gardens where id=$1', [garden])).rows[0].beds[0];
  assert.equal(saved.plantingPlan, undefined); assert.equal(saved.areaPlan.areas[0].kind, 'rows');
  assert.equal(saved.areaPlan.areas[0].plant.id, planV5().areas[0].plant.id);
  assert.equal(model.validateAreaPlan(saved.areaPlan, bed), null);
});

test('mixtures save atomically, reject stale revisions, invalid totals, duplicate components and mismatched cultivars', async () => {
  await asUser(admin);
  const id = (await save()).rows[0].id;
  assert.equal((await db.query('select count(*)::integer as n from public.seed_mixture_components where mixture_id=$1', [id])).rows[0].n, 2);
  await save(id, 1); await sqlError(save(id, 1), '40001');
  await sqlError(save(id, 2, [composition()[0]]), '23514');
  await sqlError(save(id, 2, [{ ...composition()[0], weight_percent: 50 }, { ...composition()[0], weight_percent: 50 }]), '23505');
  await sqlError(save(id, 2, [{ plant_type_id: otherCrop, cultivar_id: cultivar, weight_percent: 100 }]), '23503');
  assert.equal(Number((await db.query('select version from public.seed_mixtures where id=$1', [id])).rows[0].version), 2);
  assert.equal((await db.query('select sum(weight_percent)::integer as total from public.seed_mixture_components where mixture_id=$1', [id])).rows[0].total, 100);
  await sqlError(db.query('select public.myco_remove_cultivar($1,1)', [cultivar]), '23503');
});

test('only catalogue admins write mixtures; readers browse and use them, and anonymous users are denied', async () => {
  await asUser(reader); await db.query('select * from public.seed_mixtures'); await db.query('select * from public.seed_mixture_components');
  await sqlError(save(null, null, composition(), 'Forbidden'), '42501');
  for (const table of ['seed_mixtures', 'seed_mixture_components']) {
    await sqlError(db.query(`insert into public.${table} default values`), '42501');
    await sqlError(db.query(`delete from public.${table}`), '42501');
  }
  await db.exec('reset role;set role anon;'); await sqlError(db.query('select * from public.seed_mixtures'), '42501');
  await sqlError(save(), '42501');
});

test('client and database agree on area validation for all methods, snapshots, mulch and malformed input', async () => {
  await asUser(reader);
  const greenCrop = areaPlan(broadcast({ sowing: { kind: 'crop', plant: rows().plant } }));
  const harvestMixture = areaPlan(broadcast({ purpose: 'crop' }));
  const harvestSeeds = areaPlan(broadcast({ purpose: 'crop', sowing: { kind: 'crop', plant: rows().plant }, densityUnit: 'seeds_m2' }));
  const cases = [{ ...areaPlan(rows()), respectAreaSpacing: true }, harvestMixture, { ...harvestMixture, version: 3 }, harvestSeeds, { ...harvestSeeds, version: 3 }, greenCrop, { ...greenCrop, version: 2 }, areaPlan(broadcast({ purpose: 'crop', sowing: { kind: 'crop', plant: rows().plant } })), areaPlan(), areaPlan(rows()), areaPlan(broadcast()), areaPlan(unplanted()), areaPlan(unplanted({ mulch: [{ id: 'layer', material: straw }] })),
    areaPlan(rows({ widthCm: 50 }), broadcast({ id: 'sown', xCm: 50, widthCm: 50 })),
    null, {}, areaPlan(null), areaPlan(unplanted({ xCm: 1 })), areaPlan(unplanted({ purpose: 'wrong' })), areaPlan(rows({ plantSpacingCm: 0 })), areaPlan(rows({ purpose: 'green_manure' })), { ...areaPlan(unplanted()), version: 1 }, { ...areaPlan(rows({ purpose: 'green_manure' })), version: 1 },
    areaPlan(rows({ plant: null })), areaPlan(broadcast({ density: 0 })), areaPlan(broadcast({ densityUnit: 'seeds_m2' })),
    areaPlan(broadcast({ sowing: { kind: 'crop', plant: {} } })), areaPlan(unplanted({ mulch: [{ id: 'bad', material: {} }] })),
    areaPlan(unplanted(), unplanted({ id: 'overlap' })), areaPlan(unplanted({ mulch: [{ id: 'same', material: straw }, { id: 'same', material: straw }] }))];
  for (const plan of cases) {
    const expected = !model.validateAreaPlan(plan, bed);
    const valid = (await db.query('select public.myco_valid_area_plans($1) as valid', [JSON.stringify([{ ...bed, areaPlan: plan }])])).rows[0].valid;
    assert.equal(valid, expected, JSON.stringify(plan));
  }
  const mixed = [{ ...bed, areaPlan: areaPlan(unplanted()), plantingPlan: planV5() }];
  assert.equal((await db.query('select public.myco_valid_area_plans($1) as valid', [JSON.stringify(mixed)])).rows[0].valid, false);
  await db.query('update public.gardens set beds=$1 where id=$2', [JSON.stringify([{ ...bed, areaPlan: areaPlan(broadcast()) }]), garden]);
  await sqlError(db.query('update public.gardens set beds=$1 where id=$2', [JSON.stringify([{ ...bed, areaPlan: areaPlan(broadcast({ density: 0 })) }]), garden]), '23514');
  assert.equal((await db.query('select public.myco_valid_planting_plans($1) as valid', [JSON.stringify([{ ...bed, areaPlan: areaPlan(broadcast({ density: 0 })) }])])).rows[0].valid, false);
});


test('unified snapshots are recorded in history and malformed area edits are rejected by history validation', async () => {
  await asUser(reader);
  const version = Number((await db.query('select version from public.gardens where id=$1', [garden])).rows[0].version);
  const eventId = '33333333-3333-4333-8333-333333333333';
  const event = (await db.query('select * from public.record_garden_layout_event($1,$2,$3,$4,$5,$6)', [garden, version, eventId, '2026-11-17', 'Sown green manure', 'Fixture'])).rows[0];
  assert.equal(event.snapshot.beds[0].areaPlan.areas[0].purpose, 'green_manure');
  await db.exec('reset role;');
  const invalid = structuredClone(event.snapshot); invalid.beds[0].areaPlan.areas[0].density = 0;
  assert.equal((await db.query('select public.myco_valid_history_document($1) as valid', [invalid])).rows[0].valid, false);
  const mixId = (await db.query('select id from public.seed_mixtures limit 1')).rows[0].id;
  await sqlError(db.query('update public.seed_mixture_components set weight_percent=1 where mixture_id=$1', [mixId]), '23514');
  assert.equal((await db.query('select sum(weight_percent)::integer as total from public.seed_mixture_components where mixture_id=$1', [mixId])).rows[0].total, 100);
});


test('spacing migration updates current plans without changing recorded history or row configuration', async () => {
  await asUser(reader);
  const snapshot = (await db.query("select snapshot from public.garden_layout_events where id='44444444-4444-4444-8444-444444444444'")).rows[0].snapshot;
  assert.deepEqual(snapshot, historyBeforeSpacing);
  assert.equal(snapshot.beds[0].areaPlan.respectAreaSpacing, true);
  const current = (await db.query('select beds from public.gardens where id=$1', [garden])).rows[0].beds[0];
  assert.equal(current.areaPlan.respectAreaSpacing, false);
});
