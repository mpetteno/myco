import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { areaV2, bed, planV4, planV5 } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'balanced-rows');
after(cleanupModules);

test('two rows keep the requested spacing and maximise balanced border gaps until reaching 15 cm', () => {
  for (const [widthCm, expected] of [[140, [50, 90]], [100, [30, 70]], [70, [15, 55]], [60, [15, 45]]]) {
    const area = areaV2({ widthCm, rowCount: 2 });
    const draft = planV5({ areas: [area] });
    const size = { ...bed, widthCm };
    const layout = model.areaRowLayout(draft, area, size);
    assert.deepEqual([layout.rowPosition(0), layout.rowPosition(1)], expected);
    assert.equal(layout.error, null);
    const preview = model.previewPlanting(draft, size);
    assert.equal(preview.counts[0].rows, 2);
    assert.ok(preview.rowGuides.every((row) => row.warning === (widthCm < 70)));
    assert.ok(model.getAreaMeasurements(draft, area, size).filter((item) => item.kind === 'border').every((item) => item.distanceCm >= 15));
  }
});

test('resizing keeps spacing as a target and restores it when the area grows again', () => {
  const area = areaV2({ rowCount: 3 });
  const draft = planV5({ areas: [area] });
  const narrow = { ...area, widthCm: 80 };
  const compressed = model.areaRowLayout(draft, narrow, bed);
  assert.deepEqual([0, 1, 2].map(compressed.rowPosition), [15, 40, 65]);
  assert.equal(compressed.rowStep, 25);
  const wider = model.areaRowLayout(draft, { ...area, widthCm: 140 }, { ...bed, widthCm: 140 });
  assert.deepEqual([0, 1, 2].map(wider.rowPosition), [30, 70, 110]);
  assert.equal(area.rowSpacingCm, 40);
  assert.equal(model.canResizePlantingArea(draft, area, { ...area, widthCm: 40 }, bed), true);
  assert.equal(model.canResizePlantingArea(draft, area, { ...area, widthCm: 35 }, bed), false);
});

test('both orientations and shifted areas stay on the grid with centred row-distance guides', () => {
  for (const rowDirection of ['length', 'width']) {
    const area = areaV2({ xCm: 10, yCm: 20, widthCm: 95, lengthCm: 185, rowDirection, rowCount: 4 });
    const draft = planV5({ areas: [area] });
    const preview = model.previewPlanting(draft, { widthCm: 300, lengthCm: 300 });
    assert.equal(preview.error, null);
    assert.ok(preview.points.every((point) => point.xCm % 5 === 0 && point.yCm % 5 === 0));
    const all = model.getAreaMeasurements(draft, area, bed);
    const coordinate = rowDirection === 'length' ? 'yCm' : 'xCm';
    const centre = rowDirection === 'length' ? area.yCm + area.lengthCm / 2 : area.xCm + area.widthCm / 2;
    const borderGuide = all.find((item) => item.id === 'row-start');
    for (const gap of all.filter((item) => item.kind === 'row-gap')) {
      assert.equal(gap.start[coordinate], centre); assert.equal(gap.end[coordinate], centre);
      assert.notEqual(gap.start[coordinate], borderGuide.start[coordinate]);
    }
    const borders = all.filter((item) => item.id === 'row-start' || item.id === 'row-end');
    assert.ok(borders.every((item) => item.distanceCm >= 15));
    assert.ok(Math.abs(borders[0].distanceCm - borders[1].distanceCm) <= 5);
  }
});

test('automatic counts, single rows, fractional spacing and explicit overrides retain balanced placement', () => {
  for (const [values, expected] of [
    [{ rowCount: null }, [30, 70]], [{ rowCount: 1 }, [50]],
    [{ rowCount: 2, rowSpacingCm: 42.5 }, [30, 75]],
    [{ rowCount: 2, rowSpacingCm: 20 }, [40, 60]],
    [{ rowCount: 4 }, [15, 40, 60, 85]],
  ]) {
    const area = areaV2(values), draft = planV5({ areas: [area] });
    const layout = model.areaRowLayout(draft, area, bed);
    assert.deepEqual(Array.from({ length: layout.rows }, (_, index) => layout.rowPosition(index)), expected);
  }
});

test('older saved layouts keep their geometry until reapplied and preserve the chosen row count', () => {
  const saved = planV4();
  const before = model.previewPlanting(saved, bed).rowGuides.map((row) => row.x1Cm);
  assert.deepEqual(before, [20, 80]);
  const draft = model.editablePlantingPlan(bed, saved);
  assert.equal(draft.version, 5); assert.equal(draft.areas[0].rowCount, 2);
  assert.deepEqual(model.previewPlanting(draft, bed).rowGuides.map((row) => row.x1Cm), [30, 70]);
  assert.deepEqual(model.previewPlanting(saved, bed).rowGuides.map((row) => row.x1Cm), before);
});
