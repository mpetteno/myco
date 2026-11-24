import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
import { rows, broadcast, areaPlan, bed } from './area-fixtures.mjs';
import { areaV2, planV3, planV4, planV5 } from './fixtures.mjs';
const model = await loadModule('tests/planting/modules.ts', 'clearances');
const areas = await loadModule('tests/planting/area-modules.ts', 'clearance-areas');
after(cleanupModules);
const preview = area => model.previewPlanting(planV5({ areas: [area] }), { ...bed, widthCm: 300, lengthCm: 400 });

test('absent and default clearances retain existing positions, counts and legacy layouts', () => {
  for (const rowDirection of ['length', 'width']) for (const rowCount of [null, 1, 2, 4]) {
    const area = areaV2({ rowDirection, rowCount });
    const before = preview(area), explicit = preview({ ...area, clearancesCm: { top: 15, right: 15, bottom: 15, left: 15 } });
    assert.deepEqual(before, explicit);
    for (const legacy of [planV3, planV4]) {
      assert.ok(model.previewPlanting(legacy({ areas: [area] }), bed).points.length);
      assert.ok(model.validatePlantingPlan(legacy({ areas: [{ ...area, clearancesCm: {} }] }), bed));
    }
  }
});

test('asymmetric minimums stay on bed axes in both row directions and survive area moves', () => {
  for (const rowDirection of ['length', 'width']) for (const rowCount of [null, 1, 2]) {
    const area = areaV2({ rowDirection, rowCount, clearancesCm: { top: 35, right: 20, bottom: 25, left: 45 } });
    const result = preview(area); assert.equal(result.error, null); assert.ok(result.points.length);
    const min = model.effectiveClearances(area), measurements = model.getAreaMeasurements(planV5(), area, bed);
    const actual = model.actualClearances(measurements, area);
    for (const side of model.clearanceSides) assert.ok(actual[side] >= min[side], `${side}: ${actual[side]} >= ${min[side]}`);
    assert.ok(measurements.filter(m => m.kind === 'border').every(m => !m.warning && m.recommendedCm >= 15));
    const moved = preview({ ...area, xCm: 50, yCm: 100 }); assert.equal(moved.error, null);
    assert.deepEqual(moved.points.map(p => ({ ...p, xCm: p.xCm - 50, yCm: p.yCm - 100 })), result.points);
  }
});

test('manual rows compress to respect minima, automatic rows recalculate, and impossible layouts fail', () => {
  const area = areaV2({ rowCount: 2, clearancesCm: { left: 50, right: 15 } });
  const layout = model.areaRowLayout(planV5(), area, bed);
  assert.equal(layout.rowStep, 35); assert.equal(layout.rows, 2);
  assert.deepEqual([layout.rowPosition(0), layout.rowPosition(1)], [50, 85]);
  const auto = { ...area, rowCount: null }; assert.equal(model.areaRowLayout(planV5(), auto, bed).rows, 1);
  for (const value of [{ ...area, widthCm: 65 }, { ...auto, widthCm: 60 }, { ...auto, lengthCm: 25 }]) assert.ok(preview(value).error);
  const two = planV5({ areas: [{ ...auto, widthCm: 60 }, areaV2({ id: 'other', xCm: 100, rowCount: null })] });
  assert.ok(model.previewPlanting(two, { widthCm: 300, lengthCm: 400 }).error, 'another populated area cannot hide an empty overridden area');
});

test('clearance validation rejects malformed values, unsafe numbers and values below the saved crop minimum', () => {
  const bad = [null, [], 15, '15', { left: null }, { left: '20' }, { top: 0 }, { right: -5 }, { left: 10 }, { bottom: 17.5 }, { top: 16 }, { left: Infinity }, { right: Number.MAX_SAFE_INTEGER + 1 }, { unknown: 20 }];
  for (const clearancesCm of bad) assert.ok(preview(areaV2({ clearancesCm })).error, JSON.stringify(clearancesCm));
  assert.ok(preview(areaV2({ clearancesCm: { left: 20 }, plant: { ...areaV2().plant, borderDistanceCm: 25 } })).error);
  assert.equal(preview(areaV2({ clearancesCm: { left: 25 }, plant: { ...areaV2().plant, borderDistanceCm: 25 } })).error, null);
  assert.ok(areas.validateAreaPlan(areaPlan(broadcast({ clearancesCm: { left: 20 } })), bed));
});

test('area and bed resizing preserve clearances in cm and stop before any affected area no longer fits', () => {
  const first = rows({ clearancesCm: { left: 50 } }), source = { ...bed, areaPlan: areaPlan(first) };
  const resized = areas.resizeBedContents(source, { ...bed, widthCm: 70 }); assert.equal(resized.error, null);
  assert.deepEqual(resized.bed.areaPlan.areas[0].clearancesCm, { left: 50 });
  assert.ok(areas.resizeBedContents(source, { ...bed, widthCm: 65 }).error);
  const other = rows({ id: 'other', xCm: 100, clearancesCm: { right: 50 } }), size = { widthCm: 200, lengthCm: 200 };
  const plan = areaPlan(first, other);
  assert.ok(areas.resizePlanAreas(plan, first.id, { ...first, widthCm: 130 }, size));
  assert.equal(areas.resizePlanAreas(plan, first.id, { ...first, widthCm: 135 }, size), null);
});

test('copy, paste and reload preserve independent overrides and summary quantities', () => {
  const first = rows({ clearancesCm: { left: 50, top: 30 } }), plan = areaPlan(first);
  const copy = areas.copyAreaPlan(plan); copy.areas[0].clearancesCm.left = 60; assert.equal(first.clearancesCm.left, 50);
  const size = { ...bed, widthCm: 300 };
  const pasted = areas.getPastedArea(first, size, plan); assert.ok(pasted); assert.notEqual(pasted.id, first.id); assert.deepEqual(pasted.clearancesCm, first.clearancesCm);
  const loaded = areas.areaPlanFromBed(JSON.parse(JSON.stringify({ ...size, areaPlan: areaPlan(first, pasted) })));
  assert.deepEqual(loaded.areas.map(a => a.clearancesCm), [first.clearancesCm, first.clearancesCm]);
  const count = model.previewPlanting(areas.rowPlan(loaded), size).points.length;
  assert.equal(areas.getGardenRecap([{ ...size, areaPlan: loaded }]).totalPlants, count);
});
