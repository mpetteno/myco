import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
import { rows, broadcast, areaPlan, bed } from './area-fixtures.mjs';
import { planV3, areaV2 } from './fixtures.mjs';
import { straw, mulchPlan } from '../mulch/fixtures.mjs';
const model = await loadModule('tests/planting/area-modules.ts', 'bed-resize');
after(cleanupModules);

test('bed resizing scales shared edges, gaps and attached mulch without changing planting choices', () => {
  const source = { ...bed, widthCm: 200, areaPlan: areaPlan(rows({ widthCm: 100, mulch: [{ id: 'layer', material: straw }] }), broadcast({ id: 'cover', xCm: 100, widthCm: 100 })) };
  const saved = structuredClone(source);
  for (const [widthCm, lengthCm] of [[150, 150], [300, 250]]) {
    const result = model.resizeBedContents(source, { ...source, xCm: 20, yCm: 30, widthCm, lengthCm });
    assert.equal(result.error, null); const [first, second] = result.bed.areaPlan.areas;
    assert.equal(first.xCm + first.widthCm, second.xCm); assert.equal(second.xCm + second.widthCm, widthCm);
    assert.equal(first.lengthCm, lengthCm); assert.equal(second.lengthCm, lengthCm);
    assert.equal(first.rowCount, 2); assert.equal(first.plantSpacingCm, 30); assert.deepEqual(first.mulch, saved.areaPlan.areas[0].mulch);
    assert.deepEqual(second.sowing, saved.areaPlan.areas[1].sowing); assert.equal(second.density, saved.areaPlan.areas[1].density);
    assert.equal(model.validateAreaPlan(result.bed.areaPlan, result.bed), null);
  }
  assert.deepEqual(source, saved);
});

test('minimum row clearances and chosen rows stop shrinking atomically; broadcast areas can shrink to one cell', () => {
  const source = { ...bed, areaPlan: areaPlan(rows({ plant: { ...rows().plant, borderDistanceCm: 15 } })) };
  assert.equal(model.resizeBedContents(source, { ...source, widthCm: 35, lengthCm: 30 }).error, null);
  for (const dimensions of [{ widthCm: 30, lengthCm: 30 }, { widthCm: 35, lengthCm: 25 }]) {
    assert.match(model.resizeBedContents(source, { ...source, ...dimensions }).error, /more space/);
    assert.equal(model.getResizedBed(source, 'bottom-right', { xCm: dimensions.widthCm, yCm: dimensions.lengthCm }, { widthCm: 500, lengthCm: 500 }, [source]), null);
  }
  const cover = { ...bed, areaPlan: areaPlan(broadcast()) };
  assert.equal(model.resizeBedContents(cover, { ...cover, widthCm: 5, lengthCm: 5 }).error, null);
});

test('legacy planting and mulch resize together without upgrading formats or altering snapshots', () => {
  const source = { ...bed, plantingPlan: planV3({ areas: [areaV2({ rowCount: 2 })] }), mulchPlan: mulchPlan() };
  const result = model.resizeBedContents(source, { ...source, widthCm: 80, lengthCm: 150 });
  assert.equal(result.error, null); assert.equal(result.bed.plantingPlan.version, 3);
  assert.equal(result.bed.plantingPlan.areas[0].widthCm, 80); assert.equal(result.bed.plantingPlan.areas[0].lengthCm, 150);
  assert.equal(result.bed.mulchPlan.areas[0].widthCm, 80); assert.deepEqual(result.bed.mulchPlan.areas[0].layers, source.mulchPlan.areas[0].layers);
  assert.deepEqual(result.bed.plantingPlan.areas[0].plant, source.plantingPlan.areas[0].plant);
});

test('every bed handle adjusts areas while keeping the opposite edge and enforcing garden collisions', () => {
  const source = { ...bed, xCm: 100, yCm: 100, areaPlan: areaPlan(rows()) };
  const garden = { widthCm: 500, lengthCm: 500 };
  for (const [handle, xCm, yCm] of [['top-left', 110, 110], ['top-middle', 150, 110], ['top-right', 190, 110], ['middle-left', 110, 200], ['middle-right', 190, 200], ['bottom-left', 110, 290], ['bottom-middle', 150, 290], ['bottom-right', 190, 290]]) {
    const next = model.getResizedBed(source, handle, { xCm, yCm }, garden, [source]); assert.ok(next, handle);
    assert.equal(next.areaPlan.areas[0].widthCm, next.widthCm); assert.equal(next.areaPlan.areas[0].lengthCm, next.lengthCm);
    assert.equal(model.validateAreaPlan(next.areaPlan, next), null);
  }
  const neighbour = { ...bed, id: 'other', xCm: 200, yCm: 100 };
  assert.equal(model.getResizedBed(source, 'middle-right', { xCm: 210, yCm: 200 }, garden, [source, neighbour]), null);
});
