import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const migration = await readFile('supabase/migrations/202611240030_mulch_materials_and_depth_notes.sql', 'utf8');
let crop, cultivar, living, depthIds;
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values('${admin}');`);
  for (const file of (await readdir('supabase/migrations')).sort()) if (file < '202611240030') await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
  const family = (await db.query("insert into public.plant_families(name) values('Family') returning id")).rows[0].id;
  crop = (await db.query("insert into public.plant_types(name,family_id,living_mulch_enabled) values('Clover',$1,true) returning id", [family])).rows[0].id;
  cultivar = (await db.query("insert into public.plant_cultivars(name,plant_type_id) values('White clover',$1) returning id", [crop])).rows[0].id;
  living = (await db.query("select id from public.mulch_categories where code='living'")).rows[0].id;
  depthIds = [];
  for (const [method, depth, notes] of [['seed', 2, ' 2.00 '], ['plant', 3, '3 cm deep'], ['bulb', 4, '5'], ['tuber', 6, '']]) {
    depthIds.push((await db.query('insert into public.plant_depths(plant_type_id,planting_method,depth_cm,notes) values($1,$2,$3,$4) returning id', [crop, method, depth, notes])).rows[0].id);
  }
  await db.query('insert into public.catalogue_administrators(user_id) values($1)', [admin]);
});
after(() => db.close());

test('starter materials use the requested categories and cleanup is targeted, backed up and repeat-safe', async () => {
  await db.exec(migration);
  const rows = (await db.query('select m.name,c.code from public.mulch_types m join public.mulch_categories c on c.id=m.category_id order by m.name')).rows;
  assert.deepEqual(rows.map(row => row.name), ['cartone', 'compost', 'corteccia', 'fieno', 'leaves', 'paglia', "sfalci d'erba", 'telo sintetico']);
  assert.ok(rows.every(row => row.code === (row.name === 'telo sintetico' ? 'synthetic' : 'organic')));
  const notes = (await db.query('select id,notes,depth_cm,version from public.plant_depths order by id')).rows;
  assert.equal(notes.find(row => row.id === depthIds[0]).notes, '');
  assert.equal(notes.find(row => row.id === depthIds[1]).notes, '3 cm deep');
  assert.equal(notes.find(row => row.id === depthIds[2]).notes, '5');
  const backup = (await db.query('select row_data from public.plant_depth_notes_backup_202611240030')).rows;
  assert.equal(backup.length, 1); assert.equal(backup[0].row_data.notes, ' 2.00 ');
  await db.exec(migration);
  assert.deepEqual((await db.query('select id,notes,depth_cm,version from public.plant_depths order by id')).rows, notes);
  assert.equal((await db.query('select count(*) from public.mulch_types')).rows[0].count, 8);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.plant_depth_notes_backup_202611240030'), error => error.code === '42501');
  await db.exec('reset role');
});

const material = (variety = false) => ({ id: `living:${variety ? 'cultivar' : 'crop'}:${variety ? cultivar : crop}`, name: 'Clover', notes: '', version: 1,
  categoryId: living, categoryCode: 'living', plantTypeId: crop, cultivarId: variety ? cultivar : null });
function beds(m, layerId = 'layer', legacy = false) {
  const layer = { id: layerId, material: m };
  const area = { id: 'area', name: '', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 100 };
  return [{ id: 'bed', name: 'Bed', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 100, ...(legacy
    ? { mulchPlan: { version: 1, areas: [{ ...area, name: 'Mulch', layers: [layer] }] } }
    : { areaPlan: { version: 1, respectAreaSpacing: true, areas: [{ ...area, kind: 'unplanted', purpose: 'crop', mulch: [layer] }] } }) }];
}
async function createGarden(document) {
  return (await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,500,$3,$4) returning id', [admin, 'Living test', JSON.stringify(document), JSON.stringify({ countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' })])).rows[0].id;
}
test('derived living material is accepted only while eligible and existing snapshots remain valid', async () => {
  await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  for (const legacy of [false, true]) {
    await db.query('update public.plant_types set living_mulch_enabled=true where id=$1', [crop]);
    const original = beds(material(), 'layer', legacy), id = await createGarden(original);
    await db.query('update public.plant_types set living_mulch_enabled=false where id=$1', [crop]);
    await db.query('update public.gardens set name=$1,beds=$2 where id=$3', ['Preserved', JSON.stringify(original), id]);
    await assert.rejects(createGarden(original), error => error.code === '23514');
    await assert.rejects(db.query('update public.gardens set beds=$1 where id=$2', [JSON.stringify(beds(material(), 'new-layer', legacy)), id]), error => error.code === '23514');
  }
  await db.exec('reset role');
});
test('cultivar eligibility follows overrides and prevents forged derived identifiers', async () => {
  await db.query('update public.plant_types set living_mulch_enabled=true where id=$1', [crop]);
  await createGarden(beds(material(true)));
  await db.query('update public.plant_cultivars set living_mulch_enabled=false where id=$1', [cultivar]);
  await assert.rejects(createGarden(beds(material(true))), error => error.code === '23514');
  await db.query('update public.plant_cultivars set living_mulch_enabled=true where id=$1', [cultivar]);
  await db.query('update public.plant_types set living_mulch_enabled=false where id=$1', [crop]);
  await createGarden(beds(material(true)));
  await assert.rejects(createGarden(beds({ ...material(true), id: 'living:crop:forged' })), error => error.code === '23514');
});

test('depth-note rollback restores originals without overwriting later edits', async () => {
  const rollback = await readFile('supabase/rollbacks/202611240030_depth_notes.sql', 'utf8');
  await db.exec(rollback);
  assert.equal((await db.query('select notes from public.plant_depths where id=$1', [depthIds[0]])).rows[0].notes, ' 2.00 ');
  await db.query("update public.plant_depths set notes='Useful later note' where id=$1", [depthIds[0]]);
  await db.exec(rollback);
  assert.equal((await db.query('select notes from public.plant_depths where id=$1', [depthIds[0]])).rows[0].notes, 'Useful later note');
});
