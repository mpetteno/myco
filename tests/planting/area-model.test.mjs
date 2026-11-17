import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
import { areaPlan, rows, broadcast, unplanted, bed, mixture } from './area-fixtures.mjs';
import { straw } from '../mulch/fixtures.mjs';
const model = await loadModule('tests/planting/area-modules.ts', 'areas');
after(cleanupModules);

test('row and broadcast areas save independently; optional mulch follows the area rectangle', () => {
  for (const area of [rows(), broadcast()]) {
    const plan = areaPlan(area);
    assert.equal(model.validateAreaPlan(plan, bed), null);
    assert.equal(model.validateGarden({ name: 'Garden', dimensions: bed, beds: [{ ...bed, areaPlan: plan }] }), null);
    area.mulch.push({ id: 'layer', material: straw });
    const mulch = model.areaMulchPlan(plan);
    assert.equal(mulch.areas[0].widthCm, area.widthCm); assert.equal(mulch.areas[0].layers[0].material.name, straw.name);
    assert.equal(model.validateAreaPlan(plan, bed), null);
    assert.equal(model.rowPlan(plan).areas.length, area.kind === 'rows' ? 1 : 0);
  }
  assert.equal(model.validateAreaPlan(areaPlan(), bed), null);
  assert.equal(model.validateAreaPlan(areaPlan(broadcast({ name: '  ', mulch: [{ id: 'layer', material: straw }] })), bed), null);
});

test('broadcast quantities use the entire surface and weight composition; legacy seed counts round up', () => {
  const area = broadcast(); assert.deepEqual(model.sowingQuantity(area), { total: 25, components: [{ name: 'Type A', grams: 15 }, { name: 'Type B', grams: 10 }] });
  assert.equal(model.sowingQuantity({ ...area, widthCm: 50 }).total, 12.5);
  const crop = { kind: 'crop', plant: mixture().components[0].plant };
  assert.equal(model.sowingQuantity(broadcast({ sowing: crop, density: 0.25, densityUnit: 'seeds_m2' })).total, 1);
  assert.match(model.validateAreaPlan(areaPlan(broadcast({ densityUnit: 'seeds_m2' })), bed), /grams/);
});

test('malformed snapshots, invalid density, overlapping areas and duplicated mulch are rejected', () => {
  const mix = mixture(); mix.components[0].percentage = 59;
  const malformed = [null, {}, areaPlan(null), areaPlan(unplanted({ xCm: 1 })), areaPlan(unplanted({ widthCm: 105 })),
    areaPlan(rows(), unplanted({ id: 'another' })), areaPlan(broadcast({ density: 0 })), areaPlan(broadcast({ density: Infinity })),
    areaPlan(broadcast({ sowing: { kind: 'mixture', mixture: mix } })), areaPlan(broadcast({ sowing: null, mulch: [{ id: 'layer', material: straw }] })),
    areaPlan(rows({ plant: { name: 'Missing snapshot fields' } })), areaPlan(unplanted({ purpose: 'invalid' })),
    areaPlan(unplanted({ mulch: [{ id: 'same', material: straw }, { id: 'same', material: straw }] }))];
  for (const plan of malformed) assert.ok(model.validateAreaPlan(plan, bed), JSON.stringify(plan));
});

test('resizing and copying keep mixed-area content and give areas and mulch independent identities', () => {
  const source = areaPlan(broadcast({ widthCm: 50, mulch: [{ id: 'layer', material: straw }] }), broadcast({ id: 'sown', xCm: 50, widthCm: 50 }));
  const resized = model.resizePlanAreas(source, 'area-a', { xCm: 0, yCm: 0, widthCm: 60, lengthCm: 200 }, bed);
  assert.equal(resized[1].xCm, 60); assert.equal(resized[1].widthCm, 40); assert.equal(model.sowingQuantity(resized[1]).total, 10);
  const copy = model.copyAreaPlan(source); assert.notEqual(copy.areas[0].id, source.areas[0].id); assert.notEqual(copy.areas[0].mulch[0].id, 'layer');
  copy.areas[1].sowing.mixture.components[0].percentage = 1;
  assert.equal(source.areas[1].sowing.mixture.components[0].percentage, 60);
  const pasted = model.getPastedBed({ name: 'Seed bed', widthCm: 100, lengthCm: 200, areaPlan: source }, { widthCm: 500, lengthCm: 500 }, [], 'copy');
  assert.notEqual(pasted.areaPlan.areas[1].id, 'sown');
  const recap = model.getGardenRecap([{ ...bed, areaPlan: source }]); assert.equal(recap.totalPlants, 0);
});

test('mixture catalogue validates complete weight composition and cultivar-specific components', () => {
  const details = { name: 'Mix', notes: '', components: [{ plantTypeId: 'crop', cultivarId: null, percentage: 60 }, { plantTypeId: 'other', cultivarId: null, percentage: 40 }] };
  assert.equal(model.validateSeedMixture(details), null);
  assert.match(model.validateSeedMixture({ ...details, components: [details.components[0]] }), /100/);
  assert.match(model.validateSeedMixture({ ...details, components: [details.components[0], { ...details.components[0], percentage: 40 }] }), /once/);
});


test('new plans reject unplanted areas and green-manure rows while legacy snapshots remain readable', () => {
  assert.match(model.validateAreaPlan(areaPlan(unplanted()), bed), /Choose Plant rows or Broadcast sowing/);
  assert.match(model.validateAreaPlan(areaPlan(rows({ purpose: 'green_manure' })), bed), /Harvest crop/);
  assert.equal(model.validateAreaPlan({ ...areaPlan(unplanted()), version: 1 }, bed), null);
  assert.equal(model.validateAreaPlan({ ...areaPlan(rows({ purpose: 'green_manure' })), version: 1 }, bed), null);
  const editable = model.areaPlanFromBed({ ...bed, areaPlan: { ...areaPlan(rows({ purpose: 'green_manure' })), version: 1 } });
  assert.equal(editable.version, 5); assert.equal(editable.areas[0].purpose, 'crop');
});


test('green manure requires a mixture in new plans while earlier crop-based snapshots remain readable', () => {
  const crop = { kind: 'crop', plant: mixture().components[0].plant };
  const greenCrop = areaPlan(broadcast({ sowing: crop }));
  assert.match(model.validateAreaPlan(greenCrop, bed), /seed mixture/);
  assert.equal(model.validateAreaPlan({ ...greenCrop, version: 2 }, bed), null);
  assert.equal(model.validateAreaPlan(areaPlan(broadcast({ sowing: crop, purpose: 'crop' })), bed), null);
  const editable = model.areaPlanFromBed({ ...bed, areaPlan: { ...greenCrop, version: 2 } });
  assert.equal(editable.areas[0].sowing.kind, 'mixture');
  assert.match(model.validateAreaPlan(editable, bed), /Choose a seed mixture/);
});


test('editing a legacy seed-count area requires a gram density without reinterpreting the saved count', () => {
  const crop = { kind: 'crop', plant: mixture().components[0].plant };
  const saved = { ...areaPlan(broadcast({ purpose: 'crop', sowing: crop, density: 50, densityUnit: 'seeds_m2' })), version: 3 };
  const editable = model.areaPlanFromBed({ ...bed, areaPlan: saved });
  assert.equal(editable.areas[0].densityUnit, 'g_m2');
  assert.equal(editable.areas[0].density, 0);
  assert.ok(model.validateAreaPlan(editable, bed));
  assert.equal(saved.areas[0].densityUnit, 'seeds_m2'); assert.equal(saved.areas[0].density, 50);
  assert.equal(model.sowingQuantity(saved.areas[0]).total, 100);
});


test('Harvest crop rejects seed mixtures in new plans while older mixture snapshots remain readable', () => {
  const mixturePlan = areaPlan(broadcast({ purpose: 'crop' }));
  assert.match(model.validateAreaPlan(mixturePlan, bed), /Choose a crop for Harvest crop/);
  assert.equal(model.validateAreaPlan({ ...mixturePlan, version: 3 }, bed), null);
  assert.equal(model.validateAreaPlan(areaPlan(broadcast()), bed), null);
  const editable = model.areaPlanFromBed({ ...bed, areaPlan: { ...mixturePlan, version: 3 } });
  assert.match(model.validateAreaPlan(editable, bed), /Choose a crop/);
  assert.equal(mixturePlan.areas[0].sowing.kind, 'mixture');
});


test('area labels derive from crop, cultivar or mixture rather than old custom names', () => {
  const named = { name: 'Old custom name' };
  assert.equal(model.areaLabel(rows(named)), 'Type A');
  assert.equal(model.areaLabel(rows({ ...named, plant: { ...rows().plant, cultivarId: 'early', cultivarName: 'Early variety', cultivarVersion: 1 } })), 'Early variety');
  assert.equal(model.areaLabel(broadcast(named)), 'Green manure mix');
  assert.equal(model.areaLabel(broadcast({ ...named, purpose: 'crop', sowing: { kind: 'crop', plant: rows().plant } })), 'Type A');
  const covered = rows({ ...named, mulch: [{ id: 'layer', material: straw }] });
  assert.equal(model.areaMulchPlan(areaPlan(covered)).areas[0].name, 'Type A');
});


test('area spacing is independent, preserves border distances and keeps legacy history geometry readable', () => {
  const plant = { ...rows().plant, rowSpacingCm: 100, borderDistanceCm: 15 };
  const first = rows({ widthCm: 50, rowCount: 1, rowSpacingCm: 100, plant });
  const second = { ...structuredClone(first), id: 'second', xCm: 50 };
  const plan = areaPlan(first, second);
  const preview = model.previewPlanting(model.rowPlan(plan), bed);
  assert.deepEqual(preview.counts.map((count) => count.plants), [6, 6]);
  assert.equal(model.validateAreaPlan(plan, bed), null);
  assert.ok(preview.points.every((point) => point.xCm === 25 || point.xCm === 75));
  const historical = { ...plan, version: 4, respectAreaSpacing: true };
  assert.deepEqual(model.previewPlanting(model.rowPlan(historical), bed).counts.map((count) => count.plants), [6, 0]);
  const editable = model.areaPlanFromBed({ ...bed, areaPlan: historical });
  assert.equal(editable.respectAreaSpacing, false);
  assert.equal(historical.respectAreaSpacing, true);
  assert.equal(model.validateAreaPlan({ ...plan, respectAreaSpacing: true }, bed), 'Each area uses its own row and border spacing.');
});
