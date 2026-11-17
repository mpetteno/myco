import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bed, areaV2, planV5 } from '../planting/fixtures.mjs';

const admin='11111111-1111-4111-8111-111111111111', reader='22222222-2222-4222-8222-222222222222';
async function asUser(db,id) {
  await db.exec('reset role;set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
}
async function setup() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values('${admin}'),('${reader}');`);
  for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  await db.query('insert into public.catalogue_administrators(user_id) values($1)',[admin]);
  const family=(await db.query("insert into public.plant_families(name) values('Solanaceae') returning id")).rows[0].id;
  const crop=(await db.query("insert into public.plant_types(name,family_id,plant_spacing_cm,row_spacing_cm,living_mulch_enabled) values('Tomato',$1,50,80,true) returning *",[family])).rows[0];
  const cultivar=(await db.query("insert into public.plant_cultivars(name,plant_type_id) values('Datterini',$1) returning *",[crop.id])).rows[0];
  const parentCare=(await db.query('insert into public.plant_guidance(plant_type_id,monthly_feed) values($1,true) returning id',[crop.id])).rows[0].id;
  await db.query('insert into public.plant_guidance(plant_type_id,cultivar_id,monthly_feed) values($1,$2,false)',[crop.id,cultivar.id]);
  await db.query("insert into public.plant_depths(plant_type_id,cultivar_id,depth_cm) values($1,$2,0.5)",[crop.id,cultivar.id]);
  const profile=(await db.query('select id from public.calendar_profiles')).rows[0].id;
  const entry=(await db.query("insert into public.plant_calendar_entries(plant_type_id,cultivar_id,calendar_profile_id,activity,planting_method) values($1,$2,$3,'harvest','plant') returning id",[crop.id,cultivar.id,profile])).rows[0].id;
  await db.query('insert into public.calendar_windows(calendar_entry_id,start_month,end_month) values($1,6,9)',[entry]);
  const category=(await db.query("select id from public.mulch_categories where code='organic'")).rows[0].id;
  const material=(await db.query("insert into public.mulch_types(name,category_id) values('Straw',$1) returning *",[category])).rows[0];
  const loaded=(await db.query('select * from public.plant_cultivars where id=$1',[cultivar.id])).rows[0];
  return {db,crop,cultivar:loaded,material,profile,entry,parentCare,family};
}
async function documents(fixture) {
  const {db,crop,cultivar,material,family}=fixture;
  const plant={id:crop.id,name:'Tomato',familyId:family,familyName:'Solanaceae',typeVersion:1,familyVersion:1,plantSpacingCm:50,rowSpacingCm:80,borderDistanceCm:15,cultivarId:cultivar.id,cultivarName:cultivar.name,cultivarVersion:Number(cultivar.version)};
  const document={name:'Garden',dimensions:{widthCm:500,lengthCm:400},beds:[{...bed,
    plantingPlan:planV5({areas:[areaV2({plant,plantSpacingCm:50,rowSpacingCm:80,rowCount:2})]}),
    mulchPlan:{version:1,areas:[{id:'mulch-area',name:'Mulch',xCm:0,yCm:0,widthCm:100,lengthCm:200,layers:[{id:'layer',material:{id:material.id,name:material.name,notes:material.notes,version:Number(material.version)}}]}]}}]};
  const location={enteredLocation:'Milano',displayName:'Milano, Italy',latitude:45.46,longitude:9.19,countryCode:'IT',regionCode:'IT-25'};
  const garden=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,400,$3,$4) returning id',[reader,document.name,JSON.stringify(document.beds),location])).rows[0].id;
  const event=(await db.query("insert into public.garden_layout_events(id,garden_id,event_date,title,source_version,snapshot,actor_id) values(gen_random_uuid(),$1,'2026-11-17','Recorded garden',1,$2,$3) returning *",[garden,document,reader])).rows[0];
  await db.query('insert into public.garden_layout_event_revisions(event_id,garden_id,version,previous_record) values($1,$2,1,$3)',[event.id,garden,event]);
  await db.query("insert into public.bed_activities(id,garden_id,bed_id,kind,planned_date,title,planned_snapshot,source_version,actor_id) values(gen_random_uuid(),$1,$2,'planting','2026-11-20','Plant Datterini',$3,1,$4)",[garden,bed.id,document,reader]);
  return document;
}
async function snapshots(db) {
  await db.exec('reset role;');
  const result={};
  for(const [table,order] of [['gardens','id'],['garden_layout_events','id'],['garden_layout_event_revisions','event_id,version'],['bed_activities','id']])result[table]=(await db.query(`select to_jsonb(t) as record from public.${table} t order by ${order}`)).rows;
  return result;
}
const denied=(promise)=>assert.rejects(promise,(error)=>error.code==='42501');
const stale=(promise)=>assert.rejects(promise,(error)=>error.code==='40001');

test('only admins can use removal RPCs; anonymous and direct deletes are denied, including after revocation',async()=>{
  const {db,cultivar,material}=await setup();
  try {
    await asUser(db,reader);
    await denied(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]));
    await denied(db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,material.version]));
    await asUser(db,admin);
    await denied(db.query('delete from public.plant_cultivars where id=$1',[cultivar.id]));
    await denied(db.query('delete from public.mulch_types where id=$1',[material.id]));
    await stale(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,Number(cultivar.version)+1]));
    await stale(db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,Number(material.version)+1]));
    await db.exec('reset role;set role anon;');
    await denied(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]));
    await denied(db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,material.version]));
    await db.exec('reset role;');await db.query('delete from public.catalogue_administrators where user_id=$1',[admin]);await asUser(db,admin);
    await denied(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]));
    await denied(db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,material.version]));
    assert.equal((await db.query('select id from public.plant_cultivars where id=$1',[cultivar.id])).rows.length,1);
    assert.equal((await db.query('select id from public.mulch_types where id=$1',[material.id])).rows.length,1);
  } finally {await db.close();}
});

test('removal cleans cultivar-owned guidance atomically and preserves parent guidance and saved snapshots',async()=>{
  const fixture=await setup();const {db,crop,cultivar,material,profile,entry,parentCare}=fixture;
  try {
    const document=await documents(fixture);const before=await snapshots(db);
    const profileVersion=Number((await db.query('select version from public.calendar_profiles where id=$1',[profile])).rows[0].version);
    await asUser(db,admin);
    await db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,material.version]);
    await stale(db.query('select public.myco_remove_mulch_type($1,$2)',[material.id,material.version]));
    await db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]);
    await stale(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]));
    for(const table of ['plant_cultivars','mulch_types','plant_depths','plant_calendar_entries','calendar_windows'])assert.equal((await db.query(`select id from public.${table}`)).rows.length,0,table);
    assert.equal((await db.query('select id from public.plant_guidance')).rows[0].id,parentCare);
    assert.equal((await db.query('select id from public.plant_types')).rows[0].id,crop.id);
    assert.equal(Number((await db.query('select version from public.calendar_profiles where id=$1',[profile])).rows[0].version),profileVersion+1);
    assert.equal((await db.query('select id from public.calendar_windows where calendar_entry_id=$1',[entry])).rows.length,0);
    assert.deepEqual(await snapshots(db),before);
    await asUser(db,reader);
    const valid=(await db.query('select public.myco_valid_planting_plans($1) as planting,public.myco_valid_catalogue_snapshots($1) as snapshots',[JSON.stringify(document.beds)])).rows[0];
    assert.deepEqual(valid,{planting:true,snapshots:true});
    await db.query('update public.gardens set beds=$1 where owner_id=$2',[JSON.stringify(document.beds),reader]);
  } finally {await db.close();}
});

test('a living mulch reference blocks cultivar removal until that material is removed',async()=>{
  const {db,crop,cultivar}=await setup();
  try {
    const category=(await db.query("select id from public.mulch_categories where code='living'")).rows[0].id;
    const living=(await db.query("insert into public.mulch_types(name,category_id,plant_type_id,cultivar_id) values('Living cover',$1,$2,$3) returning *",[category,crop.id,cultivar.id])).rows[0];
    await asUser(db,admin);
    await assert.rejects(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]),(error)=>error.code==='23503');
    assert.equal((await db.query('select id from public.plant_guidance where cultivar_id=$1',[cultivar.id])).rows.length,1);
    assert.equal((await db.query('select id from public.plant_depths where cultivar_id=$1',[cultivar.id])).rows.length,1);
    await db.query('select public.myco_remove_mulch_type($1,$2)',[living.id,living.version]);
    await db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]);
    assert.equal((await db.query('select id from public.plant_cultivars')).rows.length,0);
  } finally {await db.close();}
});

test('unexpected foreign-key failures roll back all child cleanup and calendar revisions',async()=>{
  const {db,cultivar,profile,entry}=await setup();
  try {
    await db.exec('create table public.future_cultivar_references(cultivar_id uuid references public.plant_cultivars(id));');
    await db.query('insert into public.future_cultivar_references values($1)',[cultivar.id]);
    const profileVersion=(await db.query('select version from public.calendar_profiles where id=$1',[profile])).rows[0].version;
    await asUser(db,admin);
    await assert.rejects(db.query('select public.myco_remove_cultivar($1,$2)',[cultivar.id,cultivar.version]),(error)=>error.code==='23503');
    assert.equal((await db.query('select id from public.calendar_windows where calendar_entry_id=$1',[entry])).rows.length,1);
    assert.equal((await db.query('select id from public.plant_guidance where cultivar_id=$1',[cultivar.id])).rows.length,1);
    assert.equal((await db.query('select id from public.plant_depths where cultivar_id=$1',[cultivar.id])).rows.length,1);
    assert.equal((await db.query('select version from public.calendar_profiles where id=$1',[profile])).rows[0].version,profileVersion);
  } finally {await db.close();}
});
