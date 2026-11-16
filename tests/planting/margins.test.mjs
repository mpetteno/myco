import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { bed, areaV2, planV3, planV4 } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'spacing-margins');
after(cleanupModules);

test('fixed 20 cm margins stay independent of catalogue spacing and survive resizing in both directions', () => {
  for (const rowDirection of ['length', 'width']) {
    const area = areaV2({ rowDirection, rowCount: 2,
      plant: { ...areaV2().plant, plantSpacingCm: 80, rowSpacingCm: 100 } });
    const draft = planV4({ areas: [area] });
    assert.deepEqual(model.planAreaMargins(draft, area), { alongCm: 20, acrossCm: 20 });
    const resized = rowDirection === 'length' ? { ...area, xCm: 10, widthCm: 80 } : { ...area, yCm: 10, lengthCm: 180 };
    const layout = model.areaRowLayout(draft, resized, bed);
    const origin = rowDirection === 'length' ? resized.xCm : resized.yCm;
    const size = rowDirection === 'length' ? resized.widthCm : resized.lengthCm;
    assert.equal(layout.rowPosition(0) - origin, 20);
    assert.equal(origin + size - layout.rowPosition(1), 20);
    const measurements = model.getAreaMeasurements(draft, resized, bed);
    assert.ok(measurements.filter((item) => item.kind === 'border').every((item) => item.distanceCm >= 20));
    assert.equal(model.canResizePlantingArea(draft, area, resized, bed), true);
    const tooSmall = rowDirection === 'length' ? { ...area, widthCm: 40 } : { ...area, lengthCm: 40 };
    assert.equal(model.canResizePlantingArea(draft, area, tooSmall, bed), false);
  }
});

test('area margins use half the catalogue spacing, rounded up to the grid, independently of chosen row density', () => {
  const area = areaV2({ rowCount: 3 });
  assert.deepEqual(model.areaSpacingMargins(area), { alongCm: 15, acrossCm: 20 });
  assert.deepEqual(model.areaSpacingMargins({ ...area, plantSpacingCm: 10, rowSpacingCm: 10 }), { alongCm: 15, acrossCm: 20 });
  const fractional = areaV2({ plant: { ...area.plant, plantSpacingCm: 25, rowSpacingCm: 45 } });
  assert.deepEqual(model.areaSpacingMargins(fractional), { alongCm: 15, acrossCm: 25 });
  const unknown = areaV2({ plant: { ...area.plant, plantSpacingCm: null, rowSpacingCm: null }, plantSpacingCm: 12, rowSpacingCm: 22 });
  assert.deepEqual(model.areaSpacingMargins(unknown), { alongCm: 10, acrossCm: 15 });
});

test('moving and resizing preserve relative margins while a fixed row count adjusts its inner spacing', () => {
  const area = areaV2({ rowCount: 3 });
  const draft = planV3({ areas: [area] });
  const initial = model.areaRowLayout(draft, area, bed);
  assert.deepEqual([initial.rowPosition(0), initial.rowPosition(2)], [20, 80]);
  const narrower = { ...area, widthCm: 80 };
  const resized = model.areaRowLayout(draft, narrower, bed);
  assert.deepEqual([resized.rowPosition(0), resized.rowPosition(2)], [20, 60]);
  assert.equal(resized.rowStep, 20);
  const shifted = { ...narrower, xCm: 10, yCm: 20, lengthCm: 180 };
  const moved = model.areaRowLayout(draft, shifted, bed);
  assert.deepEqual([moved.rowPosition(0) - shifted.xCm, shifted.xCm + shifted.widthCm - moved.rowPosition(2)], [20, 20]);
  assert.equal(model.canResizePlantingArea(draft, area, narrower, bed), true);
  assert.equal(model.canResizePlantingArea(draft, area, { ...area, widthCm: 45 }, bed), false);
});

test('automatic spacing balances unused space and both row directions keep area-relative clearance', () => {
  for (const rowDirection of ['length', 'width']) {
    const area = areaV2({ xCm: 10, yCm: 10, widthCm: 85, lengthCm: 185, rowDirection });
    const draft = planV3({ areas: [area] });
    const preview = model.previewPlanting(draft, bed);
    assert.equal(preview.error, null);
    const measurements = model.getAreaMeasurements(draft, area, bed);
    for (const value of measurements.filter((item) => item.kind === 'border')) assert.equal(value.warning, false);
    const sides = measurements.filter((item) => item.id.startsWith('row-') && item.kind === 'border');
    assert.ok(sides.every((item) => item.distanceCm >= 20));
    assert.ok(Math.abs(sides[0].distanceCm - sides[1].distanceCm) <= 5);
  }
});

test('tight rows produce warning measurements and guides while the plan remains applicable', () => {
  const area = areaV2({ rowCount: 4 });
  const draft = planV3({ areas: [area] });
  const preview = model.previewPlanting(draft, bed);
  const measurements = model.getAreaMeasurements(draft, area, bed);
  assert.equal(preview.error, null); assert.equal(preview.counts[0].rows, 4);
  assert.ok(measurements.filter((item) => item.kind === 'row-gap').every((item) => item.warning));
  assert.ok(preview.rowGuides.every((row) => row.warning));
  assert.ok(measurements.filter((item) => item.kind === 'border').every((item) => !item.warning));
  const safe = areaV2({ rowCount: 2 });
  assert.ok(model.getAreaMeasurements(planV3({ areas: [safe] }), safe, bed).every((item) => !item.warning));
});

test('measurements remain bounded and malformed spacing does not produce invalid drawing coordinates', () => {
  const area = areaV2({ widthCm: 100, lengthCm: 200, rowCount: 13 });
  const draft = planV3({ areas: [area] });
  assert.ok(model.visibleAreaMeasurements(model.getAreaMeasurements(draft, area, bed)).length <= 8);
  assert.deepEqual(model.getAreaMeasurements(draft, { ...area, plantSpacingCm: 0 }, bed), []);
  assert.deepEqual(model.getAreaMeasurements(draft, { ...area, rowCount: 0 }, bed), []);
});
