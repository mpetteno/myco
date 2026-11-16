import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { area, areaV2, bed, plan, planV2, planV3, planV4, planV5 } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'planting-db');
const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const editor = '22222222-2222-4222-8222-222222222222';
let gardenId;
before(async () => {
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${owner}','owner@example.test',now()), ('${editor}','editor@example.test',now());`);
  for (const file of ['202611160001_saved_gardens.sql', '202611160002_garden_sharing.sql', '202611160003_plant_catalogues.sql']) await migrate(file);
  await asUser(owner);
  gardenId = (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning id', [owner, 'Fixture garden', JSON.stringify([bed])])).rows[0].id;
  await db.query('select public.share_garden($1,$2)', [gardenId, 'editor@example.test']);
  await db.exec('reset role;');
  await migrate('202611160004_bed_planting_plans.sql');
  await migrate('202611160005_area_rows.sql');
  await migrate('202611160006_spacing_margins.sql');
  await migrate('202611160007_fixed_area_margins.sql');
  await migrate('202611160008_balanced_area_rows.sql');
  await migrate('202611160014_plant_border_distance.sql');
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
const saveBeds = (beds, version) => db.query('update public.gardens set beds=$1 where id=$2 and version=$3 returning beds,version', [JSON.stringify(beds), gardenId, version]);

test('migration preserves old gardens and saves plans atomically for owners and shared editors', async () => {
  await asUser(owner);
  assert.deepEqual((await db.query('select beds from public.gardens where id=$1', [gardenId])).rows[0].beds, [bed]);
  const saved = await saveBeds([{ ...bed, plantingPlan: plan() }], 1);
  assert.equal(saved.rows[0].version, 2);
  assert.deepEqual(saved.rows[0].beds[0].plantingPlan, plan());
  await asUser(editor);
  const loaded = (await db.query('select beds from public.gardens where id=$1', [gardenId])).rows[0].beds[0];
  assert.equal(model.previewPlanting(loaded.plantingPlan, loaded).points.length, 21);
  const custom = plan({ respectAreaSpacing: false, areas: [area({ plantSpacingCm: 10, rowSpacingCm: 15 })] });
  const updated = await saveBeds([{ ...bed, xCm: 20, plantingPlan: custom }], 2);
  assert.equal(updated.rows[0].version, 3);
  assert.equal(updated.rows[0].beds[0].plantingPlan.areas[0].plant.plantSpacingCm, 30);
  await asUser(owner);
  assert.equal((await saveBeds([bed], 2)).rows.length, 0, 'stale changes cannot erase a shared plan');
});

test('database rejects malformed plans, overlaps, off-grid areas, overflow and excessive point counts', async () => {
  await asUser(owner);
  const invalid = [null, {}, plan({ version: 2 }), plan({ areas: [] }), plan({ areas: [null] }),
    plan({ areas: [area({ xCm: 1 })] }), plan({ areas: [area({ widthCm: 105 })] }),
    plan({ areas: [area({ plantSpacingCm: 0 })] }), plan({ areas: [area({ rowSpacingCm: '15' })] }),
    plan({ areas: [area(), area({ id: 'area-b' })] }), plan({ areas: [area({ plant: null })] }),
    plan({ areas: [area({ plant: { ...area().plant, familyVersion: 0 } })] }),
    plan({ areas: [area({ widthCm: 5, lengthCm: 5 })] }), plan({ rowDirection: 'diagonal' }),
    plan({ advice: [{ firstAreaId: 'missing', secondAreaId: 'area-a', relationship: 'caution', notes: '' }] }),
    plan({ areas: Array.from({ length: 13 }, (_, index) => area({ id: `area-${index}` })) })];
  for (const value of invalid)
    await assert.rejects(saveBeds([{ ...bed, plantingPlan: value }], 3), (error) => error.code === '23514');
  const huge = { ...bed, widthCm: 1000, lengthCm: 1000 };
  const oversized = { ...huge, plantingPlan: plan({ areas: [area({ widthCm: 1000, lengthCm: 1000, plantSpacingCm: 0.5, rowSpacingCm: 0.5 })] }) };
  assert.equal((await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([oversized])])).rows[0].valid, false);
  const loaded = (await db.query('select beds from public.gardens where id=$1', [gardenId])).rows[0].beds[0];
  assert.equal(loaded.xCm, 20, 'failed saves leave the previous layout intact');
});

test('client and database agree for varied dimensions, directions and fractional or custom spacing', async () => {
  await asUser(owner);
  for (let index = 0; index < 24; index++) {
    const size = { widthCm: 10 + index * 5, lengthCm: 20 + (index % 5) * 25 };
    const draft = plan({ rowDirection: index % 2 ? 'width' : 'length', respectAreaSpacing: index % 3 !== 0,
      areas: [area({ ...size, plantSpacingCm: [5, 12.5, 30, 45][index % 4], rowSpacingCm: [10, 22.5, 40][index % 3] })] });
    assert.equal(model.previewPlanting(draft, size).error, null);
    const valid = await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, ...size, plantingPlan: draft }])]);
    assert.equal(valid.rows[0].valid, true);
  }
});

test('database accepts independent directions and custom row counts, rejecting impossible or malformed controls', async () => {
  await asUser(owner);
  const areas = [areaV2({ widthCm: 50, rowCount: 3 }), areaV2({ id: 'area-b', xCm: 50, widthCm: 50, rowDirection: 'width', rowCount: 2 })];
  const draft = planV2({ areas, respectAreaSpacing: false });
  assert.equal(model.previewPlanting(draft, bed).error, null);
  const check = async (value, size = bed) => (await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, ...size, plantingPlan: value }])])).rows[0].valid;
  assert.equal(await check(draft), true);
  const inserted = await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning beds',
    [owner, 'Per-area row fixture', JSON.stringify([{ ...bed, plantingPlan: draft }])]);
  assert.deepEqual(inserted.rows[0].beds[0].plantingPlan, draft);
  for (const rowCount of [0, -1, 1.5, 16, 20001, '3', undefined])
    assert.equal(await check(planV2({ areas: [areaV2({ rowCount })] })), false);
  assert.equal(await check(planV2({ areas: [areaV2({ rowDirection: 'diagonal' })] })), false);
  for (let index = 0; index < 20; index++) {
    const size = { widthCm: 30 + index * 5, lengthCm: 40 + index * 10 };
    const area = areaV2({ ...size, rowDirection: index % 2 ? 'width' : 'length', rowCount: index % 3 ? 1 : null, plantSpacingCm: 12.5 });
    const value = planV2({ areas: [area] });
    assert.equal(model.previewPlanting(value, size).error, null);
    assert.equal(await check(value, size), true);
  }
  assert.equal(await check(planV2({ areas: [areaV2({ widthCm: 25, lengthCm: 25 })] }), { widthCm: 25, lengthCm: 25 }), false);
});

test('database and client agree on spacing-based margins while condensed rows remain valid overrides', async () => {
  await asUser(owner);
  const check = async (value, size = bed) => (await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, ...size, plantingPlan: value }])])).rows[0].valid;
  const draft = planV3({ areas: [areaV2({ rowCount: 4 })] });
  assert.equal(model.previewPlanting(draft, bed).error, null);
  assert.equal(await check(draft), true);
  const inserted = await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning beds',
    [owner, 'Spacing margin fixture', JSON.stringify([{ ...bed, plantingPlan: draft }])]);
  assert.deepEqual(inserted.rows[0].beds[0].plantingPlan, draft);
  const tooSmall = planV3({ areas: [areaV2({ widthCm: 45, rowCount: 3 })] });
  assert.ok(model.previewPlanting(tooSmall, bed).error); assert.equal(await check(tooSmall), false);
  for (let index = 0; index < 24; index++) {
    const size = { widthCm: 50 + index * 5, lengthCm: 80 + index * 5 };
    const plant = { ...areaV2().plant, plantSpacingCm: [null, 12.5, 25, 30][index % 4], rowSpacingCm: [null, 22.5, 40][index % 3] };
    const area = areaV2({ ...size, plant, plantSpacingCm: 12.5, rowSpacingCm: 20, rowCount: index % 2 ? 2 : null, rowDirection: index % 3 ? 'width' : 'length' });
    const value = planV3({ areas: [area] });
    const preview = model.previewPlanting(value, size);
    assert.equal(await check(value, size), !preview.error && preview.points.length > 0);
  }
});

test('fixed-margin plans round-trip and client/database agree independently of catalogue recommendations', async () => {
  await asUser(owner);
  const check = async (value, size = bed) => (await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, ...size, plantingPlan: value }])])).rows[0].valid;
  const draft = planV4();
  const inserted = await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning beds',
    [owner, 'Fixed margin fixture', JSON.stringify([{ ...bed, plantingPlan: draft }])]);
  assert.deepEqual(inserted.rows[0].beds[0].plantingPlan, draft);
  for (let index = 0; index < 24; index++) {
    const size = { widthCm: 30 + index * 5, lengthCm: 80 + index * 5 };
    const plant = { ...areaV2().plant, plantSpacingCm: [null, 10, 80][index % 3], rowSpacingCm: [null, 40, 100][index % 3] };
    const area = areaV2({ ...size, plant, plantSpacingCm: 12.5, rowCount: index % 2 ? 2 : null, rowDirection: index % 3 ? 'width' : 'length' });
    const value = planV4({ areas: [area] });
    const preview = model.previewPlanting(value, size);
    assert.equal(await check(value, size), !preview.error && preview.points.length > 0);
  }
  assert.equal(await check(planV4({ areas: [areaV2({ widthCm: 40, rowCount: 2 })] })), false);
});

test('balanced plans save with 15 cm minimum borders and match client capacity in both directions', async () => {
  await asUser(owner);
  const check = async (value, size = bed) => (await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid', [JSON.stringify([{ ...bed, ...size, plantingPlan: value }])])).rows[0].valid;
  const draft = planV5({ areas: [areaV2({ widthCm: 35, rowCount: 2 })] });
  const inserted = await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds) values($1,$2,500,500,$3) returning beds',
    [owner, 'Balanced row fixture', JSON.stringify([{ ...bed, plantingPlan: draft }])]);
  assert.deepEqual(inserted.rows[0].beds[0].plantingPlan, draft);
  for (let index = 0; index < 32; index++) {
    const size = { widthCm: 25 + index * 5, lengthCm: 30 + index * 5 };
    const area = areaV2({ ...size, rowCount: [null, 1, 2, 4][index % 4], rowDirection: index % 3 ? 'width' : 'length',
      plantSpacingCm: [12.5, 30][index % 2], rowSpacingCm: [22.5, 40, 80][index % 3] });
    const value = planV5({ areas: [area] });
    const preview = model.previewPlanting(value, size);
    assert.equal(await check(value, size), !preview.error && preview.points.length > 0);
  }
  assert.equal(await check(planV5({ areas: [areaV2({ widthCm: 30, rowCount: 2 })] })), false);
});

test('bed resizing cannot crop saved planting areas, plans can be cleared, and revoked editors lose access', async () => {
  await asUser(owner);
  await assert.rejects(saveBeds([{ ...bed, widthCm: 95, plantingPlan: plan() }], 3), (error) => error.code === '23514');
  assert.equal((await saveBeds([bed], 3)).rows[0].version, 4);
  await db.query('select public.unshare_garden($1,$2)', [gardenId, editor]);
  await asUser(editor);
  assert.equal((await saveBeds([{ ...bed, plantingPlan: plan() }], 4)).rows.length, 0);
  assert.equal((await db.query('select id from public.gardens where id=$1', [gardenId])).rows.length, 0);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select public.myco_valid_planting_plans($1)', [JSON.stringify([bed])]), (error) => error.code === '42501');
});

test('client and database agree on per-plant border distances, legacy fallbacks and malformed snapshots',async()=>{
  await db.exec('reset role;');
  for(const borderDistanceCm of [5,10,15,25,40,50,100])for(const rowDirection of ['length','width'])for(const rowCount of [null,1,2,4]){
    const draft=planV5({areas:[areaV2({rowDirection,rowCount,plant:{...area().plant,borderDistanceCm}})]});
    const preview=model.previewPlanting(draft,bed);
    const server=(await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid',[JSON.stringify([{...bed,plantingPlan:draft}])])).rows[0].valid;
    assert.equal(server,!preview.error&&preview.points.length>0,JSON.stringify({borderDistanceCm,rowDirection,rowCount}));
    if(server)assert.ok(model.getAreaMeasurements(draft,draft.areas[0],bed).filter(item=>item.kind==='border').every(item=>item.distanceCm>=borderDistanceCm));
  }
  const legacy=planV5({areas:[areaV2({rowCount:2})]});
  assert.deepEqual(model.previewPlanting(legacy,bed),model.previewPlanting(planV5({areas:[areaV2({rowCount:2,plant:{...area().plant,borderDistanceCm:15}})]}),bed));
  for(const borderDistanceCm of [null,0,-5,12,12.5,'15',9007199254740995]){
    const draft=planV5({areas:[areaV2({plant:{...area().plant,borderDistanceCm}})]});
    assert.ok(model.validatePlantingPlan(draft,bed));
    assert.equal((await db.query('select public.myco_valid_planting_plans($1::jsonb) as valid',[JSON.stringify([{...bed,plantingPlan:draft}])])).rows[0].valid,false);
  }
});
