import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
const model = await loadModule('tests/catalogue/reference-modules.ts', 'reference-model');
after(cleanupModules);
const crop = { id: 'watermelon', name: 'Watermelon', notes: '', familyId: 'cucurbits', plantSpacingCm: 100, rowSpacingCm: 200, borderDistanceCm: 15, livingMulchEnabled: true, version: 3 };
const cultivar = { id: 'crimson', name: 'Crimson Sweet', notes: '', plantTypeId: crop.id, plantSpacingCm: 120, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null, version: 2 };
const catalogue = { families: [{ id: crop.familyId, name: 'Cucurbitaceae', version: 1 }], plants: [crop], cultivars: [cultivar], rules: [], isAdmin: false };
test('cultivars inherit independently and snapshots retain crop identity, cultivar identity and effective spacing', () => {
  assert.deepEqual(model.effectiveCultivar(crop, cultivar), { ...crop, plantSpacingCm: 120 });
  assert.equal(model.effectiveCultivar(crop, { ...cultivar, livingMulchEnabled: false }).livingMulchEnabled, false);
  assert.throws(() => model.effectiveCultivar(crop, { ...cultivar, plantTypeId: 'wrong' }), /does not belong/);
  const snapshot = model.snapshotPlant(crop, catalogue, cultivar);
  assert.equal(snapshot.id, crop.id); assert.equal(snapshot.name, crop.name);
  assert.equal(snapshot.cultivarId, cultivar.id); assert.equal(snapshot.cultivarVersion, 2);
  assert.equal(snapshot.plantSpacingCm, 120); assert.equal(snapshot.rowSpacingCm, 200);
  crop.plantSpacingCm = 50; cultivar.name = 'Changed';
  assert.equal(snapshot.plantSpacingCm, 120); assert.equal(snapshot.cultivarName, 'Crimson Sweet');
});
test('care overrides preserve explicit false and missing activity overrides inherit while empty overrides suppress', () => {
  const data = { plant_guidance: [{ plant_type_id: 'crop', cultivar_id: null, monthly_feed: true, watering_notes: 'Often' }, { plant_type_id: 'crop', cultivar_id: 'variety', monthly_feed: false, watering_notes: null }],
    plant_calendar_entries: [{ id: 'base', plant_type_id: 'crop', calendar_profile_id: 'italy', cultivar_id: null, activity: 'harvest', planting_method: 'plant' },
      { id: 'override-without-windows', plant_type_id: 'crop', calendar_profile_id: 'italy', cultivar_id: 'variety', activity: 'harvest', planting_method: 'plant' },
      { id: 'sow', plant_type_id: 'crop', calendar_profile_id: 'italy', cultivar_id: null, activity: 'direct_sowing', planting_method: 'seed' }] };
  const care = model.effectiveGuidance(data, 'crop', 'variety');
  assert.equal(care.monthly_feed, false); assert.equal(care.watering_notes, 'Often');
  assert.deepEqual(model.effectiveCalendar(data, 'crop', 'italy', 'variety').map((row) => row.id), ['sow', 'override-without-windows']);
  assert.deepEqual(model.effectiveCalendar(data, 'crop', 'italy').map((row) => row.id), ['base', 'sow']);
});
test('living mulch eligibility follows crop and cultivar without preventing saved layers from being displayed', () => {
  const categories = [{ id: 'living', code: 'living' }];
  const material = { categoryId: 'living', plantTypeId: crop.id, cultivarId: cultivar.id };
  assert.equal(model.materialAvailable(material, categories, catalogue), true);
  assert.equal(model.materialAvailable(material, categories, { ...catalogue, cultivars: [{ ...cultivar, livingMulchEnabled: false }] }), false);
  assert.equal(model.materialAvailable({ ...material, cultivarId: 'missing' }, categories, catalogue), false);
  assert.equal(model.materialAvailable({ categoryId: null }, categories, catalogue), true);
});
test('manual region locations allow an optional trimmed city and retain legacy coordinate validation', () => {
  const location = { enteredLocation: 'Milano', displayName: 'Milano, Italy', latitude: 45.46, longitude: 9.19, countryCode: 'IT', regionCode: 'IT-25' };
  assert.equal(model.validGardenLocation(location), true);
  const region = { countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' };
  assert.deepEqual(model.createRegionLocation('IT-25'), region);
  assert.deepEqual(model.createRegionLocation('IT-25', ' Milano '), { ...region, displayName: 'Milano, Lombardia', city: 'Milano' });
  assert.deepEqual(model.createRegionLocation('IT-25', '  '), region);
  assert.equal(model.validGardenLocation(region), true);
  assert.equal(model.createRegionLocation('IT-82'), undefined);
  assert.equal(model.createRegionLocation(''), undefined);
  assert.equal(model.createRegionLocation('IT-25', 'a'.repeat(101)), undefined);
  for (const value of [undefined, {}, { ...region, city: 12 }, { ...region, city: 'a'.repeat(101) }, { ...region, latitude: 45 },
    { ...region, displayName: ' ' }, { ...location, regionCode: 'IT-82' }, { ...location, latitude: NaN }, { ...location, longitude: 190 },
    { ...location, countryCode: 'FR' }, { ...location, enteredLocation: '' }]) assert.equal(model.validGardenLocation(value), false);
});

test('linked lists deduplicate inherited targets using the most specific relationship',()=>{
  const data={plant_types:[{id:'crop',family_id:'family',name:'Crop'}],plant_cultivars:[{id:'variety',plant_type_id:'crop',name:'Variety'}],plant_guidance:[],plant_depths:[],calendar_profiles:[],
    rotation_rules:[{id:'broad',version:1,current_family_id:'family',previous_plant_id:'other',relationship:'avoid_after',notes:''},{id:'specific',version:1,current_plant_id:'crop',previous_plant_id:'other',relationship:'favourable_after',notes:''}]};
  const catalogue={rules:[{id:'broad',version:1,first:{kind:'family',id:'family'},second:{kind:'plant',id:'other'},relationship:'caution',notes:''},{id:'specific',version:1,first:{kind:'plant',id:'crop'},second:{kind:'plant',id:'other'},relationship:'companion',notes:''}]};
  const draft=model.createCropDraft(data,catalogue,'crop','variety');
  assert.equal(draft.rows.filter(row=>row.table==='companion_rules').length,1);
  assert.equal(draft.rows.find(row=>row.table==='companion_rules').values.relationship,'companion');
  assert.equal(draft.rows.filter(row=>row.table==='rotation_rules').length,1);
  assert.equal(draft.rows.find(row=>row.table==='rotation_rules').values.relationship,'favourable_after');
  const moved=model.linkCropRelationship(draft,draft,'companion_rules','plant:other','caution');
  const changes=model.cropChanges(moved,draft,'crop','variety');
  assert.equal(changes.length,1);assert.equal(changes[0].id,null);assert.equal(changes[0].source_id,'specific');
  assert.equal(changes[0].details.cultivar_a_id,'variety');
  assert.deepEqual(model.linkCropRelationship(moved,draft,'companion_rules','plant:other','companion'),draft);
  assert.deepEqual(model.removeCropRelationship(moved,draft,moved.rows.find(row=>row.table==='companion_rules').key),draft);
});

test('calendar normalization preserves every month for every pair of month ranges', () => {
  for(let a=1;a<=12;a++) for(let b=1;b<=12;b++) for(let c=1;c<=12;c++) for(let d=1;d<=12;d++) {
    const input=[{start_month:a,end_month:b},{start_month:c,end_month:d}];
    const output=model.normalizeWindows(input);
    assert.deepEqual(model.normalizeWindows(output),output);
    for(let month=1;month<=12;month++) assert.equal(output.some(w=>model.monthInWindow(month,w.start_month,w.end_month)),input.some(w=>model.monthInWindow(month,w.start_month,w.end_month)));
  }
  assert.deepEqual(model.normalizeWindows([]),[]);
  assert.throws(()=>model.normalizeWindows([{start_month:0,end_month:3}]));
  assert.equal(model.calendarNote('Feb-Mar',[{start_month:2,end_month:3}]),'');
  assert.equal(model.calendarNote('Feb-Mar (from crowns)',[{start_month:2,end_month:3}]),'Feb-Mar (from crowns)');
});
