import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111', reader = '22222222-2222-4222-8222-222222222222';
let family, crop, otherCrop, cultivar, calendar, living, organic, material, oldGarden;
const location = { enteredLocation: 'Milano', displayName: 'Milano, Lombardia, Italia', latitude: 45.46, longitude: 9.19, countryCode: 'IT', regionCode: 'IT-25' };
async function asUser(id) { await db.exec('reset role; set role authenticated;'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); }
const denied = (promise) => assert.rejects(promise, (e) => e.code === '42501');
const invalid = (promise) => assert.rejects(promise, (e) => e.code === '23514');
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values('${admin}'),('${reader}');`);
  const files = (await readdir('supabase/migrations')).sort();
  for (const file of files) {
    if (file.includes('018_')) {
      oldGarden = (await db.query("insert into public.gardens(owner_id,name,width_cm,length_cm) values($1,'Legacy',100,100) returning id", [reader])).rows[0].id;
    }
    await db.exec(await readFile('supabase/migrations/'+file, 'utf8'));
  }
  await db.query('insert into public.catalogue_administrators(user_id) values($1)', [admin]);
  await asUser(admin);
  family = (await db.query("insert into public.plant_families(name) values('Cucurbitaceae') returning id")).rows[0].id;
  crop = (await db.query("insert into public.plant_types(name,family_id,living_mulch_enabled) values('Watermelon',$1,true) returning id", [family])).rows[0].id;
  otherCrop = (await db.query("insert into public.plant_types(name,family_id) values('Zucchini',$1) returning id", [family])).rows[0].id;
  cultivar = (await db.query("insert into public.plant_cultivars(name,plant_type_id) values('Crimson Sweet',$1) returning id", [crop])).rows[0].id;
  calendar = (await db.query('select id from public.calendar_profiles')).rows[0].id;
  living = (await db.query("select id from public.mulch_categories where code='living'")).rows[0].id;
  organic = (await db.query("select id from public.mulch_categories where code='organic'")).rows[0].id;
  material = (await db.query("insert into public.mulch_types(name,category_id,plant_type_id,cultivar_id) values('Living watermelon',$1,$2,$3) returning id", [living,crop,cultivar])).rows[0].id;
});
after(() => db.close());

test('new catalogue tables allow authenticated reading, restrict writes and metadata, and deny anonymous access', async () => {
  const tables = ['plant_cultivars','plant_guidance','plant_depths','calendar_profiles','calendar_coverage','plant_calendar_entries','calendar_windows','rotation_rules','mulch_categories','catalogue_import_sources','catalogue_import_decisions'];
  await asUser(reader);
  for (const table of tables) {
    await db.query(`select * from public.${table}`);
    await denied(db.query(`insert into public.${table} default values`));
    assert.equal((await db.query(`update public.${table} set ${table === 'calendar_coverage' ? "country_code='IT'" : table === 'calendar_windows' ? 'start_month=1' : table === 'plant_guidance' ? 'monthly_feed=true' : table === 'plant_depths' ? 'depth_cm=1' : table === 'plant_calendar_entries' ? "notes='forbidden'" : table === 'rotation_rules' ? "notes='forbidden'" : table === 'catalogue_import_sources' ? "mapping_notes='forbidden'" : table === 'catalogue_import_decisions' ? "notes='forbidden'" : "name='forbidden'"} returning id`).catch((e) => { if (table === 'calendar_windows' && e.code === '42501') return { rows: [] }; throw e; })).rows.length, 0);
    await denied(db.query(`delete from public.${table}`));
  }
  await asUser(admin);
  await denied(db.query('update public.plant_cultivars set version=99 where id=$1',[cultivar]));
  await db.exec('reset role; set role anon;');
  for (const table of tables) await denied(db.query(`select * from public.${table}`));
});

test('guidance ownership, nullable booleans, revisions and uniqueness are enforced', async () => {
  await asUser(admin);
  const before = Number((await db.query('select version from public.plant_cultivars where id=$1',[cultivar])).rows[0].version);
  await db.query('insert into public.plant_guidance(plant_type_id,cultivar_id,monthly_feed) values($1,$2,false)',[crop,cultivar]);
  assert.equal((await db.query('select monthly_feed from public.plant_guidance where cultivar_id=$1',[cultivar])).rows[0].monthly_feed,false);
  assert.equal(Number((await db.query('select version from public.plant_cultivars where id=$1',[cultivar])).rows[0].version),before+1);
  await assert.rejects(db.query('insert into public.plant_guidance(plant_type_id,cultivar_id) values($1,$2)',[otherCrop,cultivar]),(e)=>e.code==='23503');
  await assert.rejects(db.query('insert into public.plant_guidance(plant_type_id,cultivar_id) values($1,$2)',[crop,cultivar]),(e)=>e.code==='23505');
  await invalid(db.query("insert into public.plant_cultivars(name,plant_type_id,border_distance_cm) values('Wrong spacing',$1,12)",[crop]));
});

test('calendar windows are saved atomically, support disjoint and wrapping ranges, and protect stale versions', async () => {
  const details = { plant_type_id:crop,cultivar_id:null,calendar_profile_id:calendar,activity:'direct_sowing',planting_method:'seed',notes:'' };
  await asUser(reader);
  await denied(db.query('select public.myco_save_calendar_entry(null,null,$1,$2)',[details,[]]));
  await asUser(admin);
  let entry = (await db.query('select * from public.myco_save_calendar_entry(null,null,$1,$2)',[details,JSON.stringify([{start_month:2,end_month:4},{start_month:10,end_month:1}])])).rows[0];
  assert.equal((await db.query('select * from public.calendar_windows where calendar_entry_id=$1',[entry.id])).rows.length,2);
  await denied(db.query('insert into public.calendar_windows(calendar_entry_id,start_month,end_month) values($1,3,4)',[entry.id]));
  await invalid(db.query('select public.myco_save_calendar_entry($1,$2,$3,$4)',[entry.id,entry.version,details,JSON.stringify([{start_month:0,end_month:5}])]));
  assert.equal(Number((await db.query('select version from public.plant_calendar_entries where id=$1',[entry.id])).rows[0].version),Number(entry.version));
  await db.query('select public.myco_save_calendar_entry($1,$2,$3,$4)',[entry.id,entry.version,details,JSON.stringify([])]);
  await assert.rejects(db.query('select public.myco_save_calendar_entry($1,$2,$3,$4)',[entry.id,entry.version,details,JSON.stringify([])]),(e)=>e.code==='40001');
  assert.equal((await db.query('select * from public.calendar_windows where calendar_entry_id=$1',[entry.id])).rows.length,0);
});

test('rotation rules preserve direction and living material references require eligibility and cultivar ownership', async () => {
  await asUser(admin);
  await db.query("insert into public.rotation_rules(current_plant_id,previous_plant_id,relationship) values($1,$2,'avoid_after'),($2,$1,'favourable_after')",[crop,otherCrop]);
  assert.equal((await db.query('select * from public.rotation_rules')).rows.length,2);
  await invalid(db.query("insert into public.mulch_types(name,category_id,plant_type_id) values('Ineligible',$1,$2)",[living,otherCrop]));
  await invalid(db.query("insert into public.mulch_types(name,category_id,plant_type_id) values('Not living',$1,$2)",[organic,crop]));
  await assert.rejects(db.query("insert into public.mulch_types(name,category_id,plant_type_id,cultivar_id) values('Wrong owner',$1,$2,$3)",[living,otherCrop,cultivar]),(e)=>['23503','23514'].includes(e.code));
});

test('new gardens require supported locations while old gardens remain usable; revoked eligibility preserves existing layers only', async () => {
  await asUser(reader);
  await db.query("update public.gardens set name='Legacy still editable' where id=$1",[oldGarden]);
  await invalid(db.query("insert into public.gardens(owner_id,name,width_cm,length_cm) values($1,'Missing location',100,100)",[reader]));
  await invalid(db.query("insert into public.gardens(owner_id,name,width_cm,length_cm,location) values($1,'Unsupported',100,100,$2)",[reader,{...location,regionCode:'IT-82'}]));
  const beds=[{id:'bed',name:'Bed',xCm:0,yCm:0,widthCm:100,lengthCm:100,mulchPlan:{version:1,areas:[{id:'area',name:'Mulch',xCm:0,yCm:0,widthCm:100,lengthCm:100,layers:[{id:'layer',material:{id:material,name:'Living watermelon',notes:'',version:1,plantTypeId:crop,cultivarId:cultivar}}]}]}}];
  const garden=(await db.query("insert into public.gardens(owner_id,name,width_cm,length_cm,location,beds) values($1,'New garden',100,100,$2,$3) returning id",[reader,location,JSON.stringify(beds)])).rows[0].id;
  await asUser(admin);await db.query('update public.plant_types set living_mulch_enabled=false where id=$1',[crop]);
  await asUser(reader);
  await db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(beds),garden]);
  const copy=structuredClone(beds);copy[0].mulchPlan.areas[0].layers[0].id='new-layer';
  await invalid(db.query('update public.gardens set beds=$1 where id=$2',[JSON.stringify(copy),garden]));
  await invalid(db.query('update public.gardens set location=null where id=$1',[garden]));
  await denied(db.query("insert into public.plant_types(name,family_id) values('Reader cannot edit',$1)",[family]));
});

test('manual region and optional city work for existing gardens and shared editors without changing layouts', async () => {
  await asUser(reader);
  const region = { countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' };
  const before = (await db.query('select beds from public.gardens where id=$1', [oldGarden])).rows[0].beds;
  await db.query('update public.gardens set location=$1 where id=$2', [region, oldGarden]);
  assert.deepEqual((await db.query('select location,beds from public.gardens where id=$1', [oldGarden])).rows[0], { location: region, beds: before });
  const garden = (await db.query("insert into public.gardens(owner_id,name,width_cm,length_cm,location) values($1,'Region only',100,100,$2) returning id", [reader, region])).rows[0].id;
  for (const value of [{ ...region, regionCode: 'IT-82' }, { ...region, city: 12 }, { ...region, city: 'a'.repeat(101) },
    { ...region, latitude: 45 }, { ...region, latitude: '45', longitude: 9 }, { ...region, latitude: 91, longitude: 9 }]) {
    await invalid(db.query('update public.gardens set location=$1 where id=$2', [value, garden]));
  }
  await db.exec('reset role;');
  await db.query('insert into public.garden_members(garden_id,user_id) values($1,$2)', [garden, admin]);
  await asUser(admin);
  const city = { ...region, city: 'Milano', displayName: 'Milano, Lombardia' };
  assert.equal((await db.query('update public.gardens set location=$1 where id=$2 returning id', [city, garden])).rows.length, 1);
  assert.deepEqual((await db.query('select location from public.gardens where id=$1', [garden])).rows[0].location, city);
  // A catalogue administrator has no additional access to an unshared garden.
  assert.equal((await db.query('update public.gardens set location=$1 where id=$2 returning id', [city, oldGarden])).rows.length, 0);
});

test('administrator revocation immediately blocks guidance RPCs without blocking reading', async () => {
  await db.exec('reset role;');await db.query('delete from public.catalogue_administrators where user_id=$1',[admin]);await asUser(admin);
  assert.equal((await db.query('update public.plant_cultivars set notes=\'revoked\' where id=$1 returning id',[cultivar])).rows.length,0);
  await denied(db.query("insert into public.plant_depths(plant_type_id,depth_cm) values($1,1)",[crop]));
  await denied(db.query('select public.myco_save_calendar_entry(null,null,$1,$2)',[{},[]]));
  assert.equal((await db.query('select id from public.plant_types')).rows.length,2);
});
