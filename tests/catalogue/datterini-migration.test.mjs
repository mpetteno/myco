import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { bed, areaV2, planV5 } from '../planting/fixtures.mjs';

const migrationName='202611170019_datterini_cultivar.sql';
const migration=await readFile('supabase/migrations/'+migrationName,'utf8');
const legacyId='89764aeb-96fc-4215-8950-93ac3653b61d';
const familyId='3707ce5a-e28e-43e1-b70d-1b1d5a718bbb';
const owner='11111111-1111-4111-8111-111111111111';

async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
    insert into auth.users(id) values('${owner}');`);
  for(const file of (await readdir('supabase/migrations')).sort().filter((name)=>name<migrationName))await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  return db;
}

async function seed(db,documents=false) {
  await db.query("insert into public.plant_families(id,name,plant_spacing_cm,row_spacing_cm) values($1,'Tomatoes',50,80)",[familyId]);
  await db.query("insert into public.plant_types(id,family_id,name,notes) values($1,$2,'Datterini','')",[legacyId,familyId]);
  const solanaceae=(await db.query("insert into public.plant_families(name) values('Solanaceae') returning id")).rows[0].id;
  const tomato=(await db.query("insert into public.plant_types(family_id,name,plant_spacing_cm,row_spacing_cm) values($1,'Tomato',40,100) returning *",[solanaceae])).rows[0];
  if(!documents)return {tomato};
  const plant={id:legacyId,name:'Datterini',familyId,familyName:'Tomatoes',typeVersion:1,familyVersion:1,plantSpacingCm:50,rowSpacingCm:80,borderDistanceCm:15};
  const document={name:'Garden',dimensions:{widthCm:500,lengthCm:400},beds:[{...bed,plantingPlan:planV5({areas:[areaV2({plant,plantSpacingCm:50,rowSpacingCm:80,rowCount:2})]})}]};
  const location={enteredLocation:'Milano',displayName:'Milano, Italy',latitude:45.46,longitude:9.19,countryCode:'IT',regionCode:'IT-25'};
  const garden=(await db.query('insert into public.gardens(owner_id,name,width_cm,length_cm,beds,location) values($1,$2,500,400,$3,$4) returning id',[owner,document.name,JSON.stringify(document.beds),location])).rows[0].id;
  const event=(await db.query("insert into public.garden_layout_events(id,garden_id,event_date,title,source_version,snapshot,actor_id) values(gen_random_uuid(),$1,'2026-11-17','Original garden',1,$2,$3) returning *",[garden,document,owner])).rows[0];
  await db.query('insert into public.garden_layout_event_revisions(event_id,garden_id,version,previous_record,corrected_by) values($1,$2,1,$3,$4)',[event.id,garden,event,owner]);
  await db.query("insert into public.bed_activities(id,garden_id,bed_id,kind,planned_date,title,planned_snapshot,source_version,actor_id) values(gen_random_uuid(),$1,$2,'planting','2026-11-20','Plant Datterini',$3,1,$4)",[garden,bed.id,document,owner]);
  return {tomato,document};
}

async function snapshots(db) {
  const result={};
  for(const [table,order] of [['gardens','id'],['garden_layout_events','id'],['garden_layout_event_revisions','event_id,version'],['bed_activities','id']])result[table]=(await db.query(`select to_jsonb(t) as record from public.${table} t order by ${order}`)).rows;
  return result;
}

test('moves Datterini under Tomato with the same ID and effective spacing, preserving all plans and history',async()=>{
  const db=await database();
  try {
    const {tomato,document}=await seed(db,true);
    const before=await snapshots(db);
    const oldCrop=(await db.query('select * from public.plant_types where id=$1',[legacyId])).rows[0];
    await db.exec(migration);
    const cultivar=(await db.query('select * from public.plant_cultivars where id=$1',[legacyId])).rows[0];
    assert.equal(cultivar.name,'Datterini');assert.equal(cultivar.plant_type_id,tomato.id);
    assert.equal(Number(cultivar.plant_spacing_cm),50);assert.equal(Number(cultivar.row_spacing_cm),80);
    assert.equal(Number(cultivar.border_distance_cm),15);assert.equal(cultivar.living_mulch_enabled,false);
    assert.equal(cultivar.version,oldCrop.version);assert.deepEqual(cultivar.created_at,oldCrop.created_at);
    assert.equal((await db.query('select * from public.plant_types where id=$1',[legacyId])).rows.length,0);
    assert.equal((await db.query('select * from public.plant_families where id=$1',[familyId])).rows.length,0);
    assert.deepEqual((await db.query('select * from public.plant_types where id=$1',[tomato.id])).rows[0],tomato);
    assert.deepEqual(await snapshots(db),before);
    const valid=(await db.query('select public.myco_valid_planting_plans($1) as planting,public.myco_valid_history_document($2) as history',[JSON.stringify(document.beds),document])).rows[0];
    assert.deepEqual(valid,{planting:true,history:true});
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from public.plant_cultivars where id=$1',[legacyId])).rows[0],cultivar);
    assert.deepEqual(await snapshots(db),before);
  } finally {await db.close();}
});

test('a fresh database without the legacy entry is unchanged',async()=>{
  const db=await database();
  try {
    await db.exec(migration);
    assert.equal((await db.query('select * from public.plant_cultivars')).rows.length,0);
    assert.equal((await db.query('select * from public.plant_types')).rows.length,0);
  } finally {await db.close();}
});

test('unhandled catalogue references or sibling crops abort the conversion without deleting data',async()=>{
  for(const scenario of ['sibling','guidance','duplicate']) {
    const db=await database();
    try {
      const {tomato}=await seed(db);
      if(scenario==='sibling')await db.query("insert into public.plant_types(family_id,name) values($1,'Another tomato')",[familyId]);
      if(scenario==='guidance')await db.query('insert into public.plant_depths(plant_type_id,depth_cm) values($1,1)',[legacyId]);
      if(scenario==='duplicate')await db.query("insert into public.plant_cultivars(plant_type_id,name) values($1,'Datterini')",[tomato.id]);
      await assert.rejects(db.exec(migration),/other crops|references changed|already exists/);
      await db.exec('rollback;');
      assert.equal((await db.query('select * from public.plant_types where id=$1',[legacyId])).rows.length,1);
      assert.equal((await db.query('select * from public.plant_families where id=$1',[familyId])).rows.length,1);
      assert.equal((await db.query('select * from public.plant_cultivars where id=$1',[legacyId])).rows.length,0);
    } finally {await db.close();}
  }
});
