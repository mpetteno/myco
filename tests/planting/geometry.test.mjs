import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { area, areaV2, bed, plan, planV2 } from './fixtures.mjs';

const model = await loadModule('tests/planting/modules.ts', 'planting');
after(cleanupModules);

test('legacy plans retain their original 5 cm clearance and global row direction', () => {
  const alongLength = model.previewPlanting(plan(), bed);
  assert.equal(alongLength.points.length, 21);
  assert.deepEqual(alongLength.counts, [{ plants: 21, rows: 3 }]);
  assert.equal(model.previewPlanting(plan({ rowDirection: 'width' }), bed).points.length, 20);
  for (const point of alongLength.points) {
    assert.ok(point.xCm >= 5 && point.xCm <= 95 && point.yCm >= 5 && point.yCm <= 195);
    assert.equal(point.xCm % 5, 0); assert.equal(point.yCm % 5, 0);
  }
  assert.equal(model.previewPlanting(plan({ areas: [area({ widthCm: 10, lengthCm: 10 })] }), { widthCm: 10, lengthCm: 10 }).points.length, 1);
  assert.equal(model.previewPlanting(plan({ areas: [area({ widthCm: 5, lengthCm: 5 })] }), { widthCm: 5, lengthCm: 5 }).points.length, 0);
});

test('version-2 plans keep 15 cm bed clearance and editable plans preserve their direction', () => {
  assert.equal(model.defaultRowDirection(bed), 'length');
  assert.equal(model.defaultRowDirection({ widthCm: 200, lengthCm: 100 }), 'width');
  const preview = model.previewPlanting(planV2(), bed);
  assert.equal(preview.error, null); assert.equal(preview.points.length, 12);
  assert.deepEqual(preview.counts, [{ plants: 12, rows: 2 }]);
  for (const point of preview.points) {
    assert.ok(point.xCm >= 15 && point.xCm <= 85 && point.yCm >= 15 && point.yCm <= 185);
    assert.equal(point.xCm % 5, 0); assert.equal(point.yCm % 5, 0);
  }
  const upgraded = model.editablePlantingPlan(bed, plan());
  assert.equal(upgraded.version, 5); assert.equal(upgraded.areas[0].rowDirection, 'length');
  assert.equal(model.previewPlanting(upgraded, bed).points.length, 12);
});

test('chosen row counts spread evenly on the grid and a single row is centred', () => {
  const draft = planV2({ areas: [areaV2({ rowCount: 4 })] });
  const preview = model.previewPlanting(draft, bed);
  assert.equal(preview.error, null); assert.equal(preview.counts[0].rows, 4);
  assert.deepEqual(preview.rowGuides.map((row) => row.x1Cm), [15, 40, 60, 85]);
  const layout = model.areaRowLayout(draft, draft.areas[0], bed);
  assert.equal(layout.rowStep, 20); assert.equal(layout.maxRowStep, 25);
  const single = model.previewPlanting(planV2({ areas: [areaV2({ rowCount: 1 })] }), bed);
  assert.equal(single.counts[0].rows, 1);
  assert.ok(single.points.every((point) => point.xCm === 50));
  assert.match(model.previewPlanting(planV2({ areas: [areaV2({ rowCount: 16 })] }), bed).error, /only 15 fit/);
});

test('different areas can use perpendicular rows while keeping cross-area spacing or explicitly overriding it', () => {
  const areas = [areaV2({ widthCm: 50, plantSpacingCm: 20, rowSpacingCm: 20, rowDirection: 'length' }),
    areaV2({ id: 'area-b', xCm: 50, widthCm: 50, plantSpacingCm: 30, rowSpacingCm: 40, rowDirection: 'width', rowCount: 4 })];
  const preview = model.previewPlanting(planV2({ areas }), bed);
  assert.equal(preview.error, null);
  const layouts = areas.map((area) => model.areaRowLayout(planV2({ areas }), area, bed));
  for (const a of preview.points.filter((point) => point.areaIndex === 0))
    for (const b of preview.points.filter((point) => point.areaIndex === 1))
      assert.ok(Math.abs(a.xCm - b.xCm) >= Math.max(layouts[0].gapX, layouts[1].gapX)
        || Math.abs(a.yCm - b.yCm) >= Math.max(layouts[0].gapY, layouts[1].gapY));
  assert.equal(preview.counts[1].rows, 4);
  assert.equal(preview.rowGuides.filter((row) => row.areaIndex === 1).length, 4);
  const relaxed = model.previewPlanting(planV2({ areas, respectAreaSpacing: false }), bed);
  assert.ok(relaxed.points.length >= preview.points.length);
});

test('rejects invalid per-area row controls and preserves zero capacity inside the border', () => {
  for (const rowCount of [0, -1, 1.5, 20001, undefined])
    assert.ok(model.validatePlantingPlan(planV2({ areas: [areaV2({ rowCount })] }), bed));
  assert.ok(model.validatePlantingPlan(planV2({ areas: [areaV2({ rowDirection: undefined })] }), bed));
  const small = { widthCm: 25, lengthCm: 25 };
  assert.equal(model.previewPlanting(planV2({ areas: [areaV2(small)] }), small).points.length, 0);
  const smallest = { widthCm: 30, lengthCm: 30 };
  assert.equal(model.previewPlanting(planV2({ areas: [areaV2(smallest)] }), smallest).points.length, 1);
});

test('rounds fractional spacing up to the grid and supports denser plan-specific overrides', () => {
  assert.equal(model.gridSpacingCm(12.5), 15);
  const custom = plan({ areas: [area({ plantSpacingCm: 12.5, rowSpacingCm: 15 })] });
  const preview = model.previewPlanting(custom, bed);
  assert.ok(preview.points.length > model.previewPlanting(plan(), bed).points.length);
  assert.equal(preview.points[1].yCm - preview.points[0].yCm, 15);
  assert.equal(custom.areas[0].plant.plantSpacingCm, 30, 'catalogue snapshot is retained');
});

test('uses the larger spacing between neighbouring areas and allows explicitly overriding those checks', () => {
  const areas = [area({ widthCm: 50, plantSpacingCm: 20, rowSpacingCm: 20 }),
    area({ id: 'area-b', xCm: 50, widthCm: 50, plantSpacingCm: 30, rowSpacingCm: 40 })];
  const preview = model.previewPlanting(plan({ areas }), bed);
  for (const a of preview.points.filter((point) => point.areaIndex === 0))
    for (const b of preview.points.filter((point) => point.areaIndex === 1))
      assert.ok(Math.abs(a.xCm - b.xCm) >= 40 || Math.abs(a.yCm - b.yCm) >= 30);
  const relaxed = model.previewPlanting(plan({ areas, respectAreaSpacing: false }), bed);
  assert.ok(relaxed.points.length > preview.points.length);
  assert.equal(relaxed.error, null);
});

test('areas can split, move and resize without overlap; resizing the bed preserves saved areas', () => {
  const halves = model.splitArea(area(), 'area-b');
  assert.equal(halves[0].lengthCm + halves[1].lengthCm, 200);
  assert.equal(halves[1].yCm, 100);
  assert.equal(model.validatePlantingPlan(plan({ areas: halves }), bed), null);
  assert.equal(model.freeArea(bed, [area()]), null);
  assert.ok(model.freeArea(bed, [halves[0]]));
  const planted = { ...bed, plantingPlan: plan() };
  assert.equal(model.canResizeBed({ ...planted, widthCm: 95 }, { widthCm: 500, lengthCm: 500 }, [planted]), false);
  assert.equal(model.canResizeBed({ ...planted, widthCm: 150 }, { widthCm: 500, lengthCm: 500 }, [planted]), true);
  assert.equal(model.previewPlanting(plan(), { widthCm: 150, lengthCm: 250 }).points.length, 21, 'enlarging the bed does not silently expand saved areas');
});

test('companion cautions are saved as advice and never block a plan', () => {
  const first = area({ widthCm: 50 }), second = area({ id: 'area-b', xCm: 50, widthCm: 50, plant: { ...area().plant, id: 'type-b', familyId: 'family-b' } });
  const draft = plan({ areas: [first, second] });
  const catalogue = { families: [], plants: [], isAdmin: false, rules: [{ first: { kind: 'family', id: 'family-a' }, second: { kind: 'family', id: 'family-b' }, relationship: 'caution', notes: 'Fixture warning' }] };
  const advice = model.planAdvice(draft, catalogue);
  assert.equal(advice[0].relationship, 'caution');
  assert.equal(advice[0].notes, 'Fixture warning');
  assert.equal(model.previewPlanting({ ...draft, advice }, bed).error, null);
});

test('invalid inputs and oversized plans fail promptly without partial counts or enormous allocations', () => {
  for (const bad of [plan({ areas: [null] }), plan({ areas: [area({ plantSpacingCm: 0 })] }),
    plan({ areas: [area({ xCm: 1 })] }), plan({ areas: [area(), area({ id: 'area-b' })] }),
    plan({ areas: [area({ widthCm: 105 })] }), plan({ rowDirection: 'diagonal' }), plan({ version: 2 })])
    assert.ok(model.validatePlantingPlan(bad, bed));
  const huge = { widthCm: 100000000, lengthCm: 100000000 };
  const preview = model.previewPlanting(plan({ areas: [area({ ...huge, plantSpacingCm: 5, rowSpacingCm: 5 })] }), huge);
  assert.match(preview.error, /exceeds/); assert.equal(preview.points.length, 0);
  assert.deepEqual(preview.counts, [{ plants: 0, rows: 0 }]);
});

test('copy/paste creates an independent plan with remapped area and advice identities', () => {
  const areas = model.splitArea(area(), 'area-b');
  const original = plan({ areas, advice: [{ firstAreaId: 'area-a', secondAreaId: 'area-b', relationship: 'caution', notes: 'Fixture' }] });
  const pasted = model.getPastedBed({ ...bed, plantingPlan: original }, { widthCm: 500, lengthCm: 500 }, [bed], 'bed-copy');
  assert.notEqual(pasted.plantingPlan.areas[0].id, original.areas[0].id);
  assert.equal(pasted.plantingPlan.advice[0].firstAreaId, pasted.plantingPlan.areas[0].id);
  pasted.plantingPlan.areas[0].plant.name = 'Changed copy';
  assert.equal(original.areas[0].plant.name, 'Type A');
  assert.equal(model.validatePlantingPlan(pasted.plantingPlan, pasted), null);
});
