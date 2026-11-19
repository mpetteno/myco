import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const migration = await readFile('supabase/migrations/202611190029_calendar_cleanup.sql','utf8');
const admin='11111111-1111-4111-8111-111111111111';
let crop, profile;
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users(id) values('${admin}');`);
  for(const file of (await readdir('supabase/migrations')).sort()) if(file<'202611190029') await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  const family=(await db.query("insert into public.plant_families(name) values('Family') returning id")).rows[0].id;
  crop=(await db.query("insert into public.plant_types(name,family_id) values('Crop',$1) returning id",[family])).rows[0].id;
  profile=(await db.query('select id from public.calendar_profiles')).rows[0].id;
  await db.query('insert into public.catalogue_administrators(user_id) values($1)',[admin]);
});
after(()=>db.close());
const months=windows=>Array.from({length:12},(_,i)=>i+1).filter(m=>windows.some(w=>w.start_month<=w.end_month?m>=w.start_month&&m<=w.end_month:m>=w.start_month||m<=w.end_month));
test('migration cleans imported notes and adjacent ranges, preserves gaps and provenance, and is repeat-safe',async()=>{
  const cases=[['seedbed_sowing','seed','Jan-Feb; Oct-Dec',[{start_month:1,end_month:2},{start_month:10,end_month:12}]],
    ['direct_sowing','seed','Mar-Jul; Aug-Sep',[{start_month:3,end_month:7},{start_month:8,end_month:9}]],
    ['transplant','plant','Feb-Mar (from crowns)',[{start_month:2,end_month:3},{start_month:8,end_month:9}]],
    ['harvest','plant','',[]]];
  const originals=[];
  for(const [activity,method,notes,windows] of cases){
    const entry=(await db.query('insert into public.plant_calendar_entries(plant_type_id,calendar_profile_id,activity,planting_method,notes) values($1,$2,$3,$4,$5) returning *',[crop,profile,activity,method,notes])).rows[0];
    for(const w of windows) await db.query('insert into public.calendar_windows(calendar_entry_id,start_month,end_month) values($1,$2,$3)',[entry.id,w.start_month,w.end_month]);
    originals.push({entry,windows});
  }
  await db.exec(migration);
  for(const {entry,windows} of originals){
    const next=(await db.query('select * from public.plant_calendar_entries where id=$1',[entry.id])).rows[0];
    const ranges=(await db.query('select start_month,end_month from public.calendar_windows where calendar_entry_id=$1 order by start_month',[entry.id])).rows;
    assert.deepEqual(months(ranges),months(windows)); assert.equal(next.plant_type_id,entry.plant_type_id); assert.equal(next.activity,entry.activity);
    assert.equal(next.notes,entry.notes.includes('(')?entry.notes:'');
  }
  const backups=(await db.query('select * from public.calendar_cleanup_backup_202611190029')).rows;
  assert.equal(backups.length,2); assert.equal(backups[0].window_data.length,2);
  const versions=(await db.query('select id,version from public.plant_calendar_entries order by id')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select id,version from public.plant_calendar_entries order by id')).rows,versions);
  assert.deepEqual((await db.query('select * from public.calendar_cleanup_backup_202611190029')).rows,backups);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.calendar_cleanup_backup_202611190029'),e=>e.code==='42501');
  await db.exec('reset role');
});
test('SQL normalization preserves month sets, merges wrapping ranges, rejects invalid values and handles full years',async()=>{
  for(let i=0;i<144;i++){
    const input=[{start_month:i%12+1,end_month:Math.floor(i/12)+1},{start_month:(i*7)%12+1,end_month:(i*5)%12+1}];
    const out=(await db.query('select public.myco_normalize_calendar_windows($1) as windows',[JSON.stringify(input)])).rows[0].windows;
    assert.deepEqual(months(out),months(input));
    assert.deepEqual((await db.query('select public.myco_normalize_calendar_windows($1) as windows',[JSON.stringify(out)])).rows[0].windows,out);
  }
  for(const value of [null,{},[{start_month:0,end_month:2}],[{start_month:1.5,end_month:2}],[{start_month:1,end_month:13}]])
    await assert.rejects(db.query('select public.myco_normalize_calendar_windows($1)',[JSON.stringify(value)]),e=>e.code==='23514');
});
test('both save paths normalize windows without weakening permissions or stale-version checks',async()=>{
  await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  const details={plant_type_id:crop,cultivar_id:null,calendar_profile_id:profile,activity:'harvest',planting_method:'seed',notes:'Jan-Feb; Mar-Apr'};
  const windows=[{start_month:1,end_month:2},{start_month:3,end_month:4}];
  const entry=(await db.query('select * from public.myco_save_calendar_entry(null,null,$1,$2)',[details,JSON.stringify(windows)])).rows[0];
  assert.equal(entry.notes,'');
  assert.deepEqual((await db.query('select start_month,end_month from public.calendar_windows where calendar_entry_id=$1',[entry.id])).rows,[{start_month:1,end_month:4}]);
  const owner=(await db.query('select version from public.plant_types where id=$1',[crop])).rows[0];
  const change={table:'plant_calendar_entries',id:entry.id,version:entry.version,details,remove:false,windows:[{start_month:10,end_month:12},{start_month:1,end_month:2}]};
  await db.query('select public.myco_save_crop_editor($1,null,$2,$2,$3,$4)',[crop,owner.version,{name:'Crop',scientific_name:'',plant_spacing_cm:null,row_spacing_cm:null,family_id:(await db.query('select family_id from public.plant_types where id=$1',[crop])).rows[0].family_id,notes:'',border_distance_cm:15,living_mulch_enabled:false},JSON.stringify([change])]);
  assert.deepEqual((await db.query('select start_month,end_month from public.calendar_windows where calendar_entry_id=$1',[entry.id])).rows,[{start_month:10,end_month:2}]);
  await assert.rejects(db.query('select public.myco_save_calendar_entry($1,$2,$3,$4)',[entry.id,entry.version,details,'[]']),e=>e.code==='40001');
  await db.exec('reset role');
});

test('data rollback restores original ranges and notes and refuses a second overwrite',async()=>{
  const backups=(await db.query('select * from public.calendar_cleanup_backup_202611190029')).rows;
  const rollback=await readFile('supabase/rollbacks/202611190029_calendar_cleanup.sql','utf8');
  await db.exec(rollback);
  for(const backup of backups){
    assert.equal((await db.query('select notes from public.plant_calendar_entries where id=$1',[backup.entry_id])).rows[0].notes,backup.entry_data.notes);
    assert.deepEqual((await db.query('select * from public.calendar_windows where calendar_entry_id=$1 order by start_month,end_month',[backup.entry_id])).rows.map(w=>({start_month:w.start_month,end_month:w.end_month})),backup.window_data.map(w=>({start_month:w.start_month,end_month:w.end_month})));
  }
  const before=(await db.query('select id,version,notes from public.plant_calendar_entries order by id')).rows;
  await assert.rejects(db.exec(rollback),/changed after cleanup/);await db.exec('rollback');
  assert.deepEqual((await db.query('select id,version,notes from public.plant_calendar_entries order by id')).rows,before);
});
