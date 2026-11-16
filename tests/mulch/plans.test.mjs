import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { bed, planV5 } from '../planting/fixtures.mjs';
import { chips, mulchArea, mulchPlan } from './fixtures.mjs';

const model = await loadModule('tests/mulch/modules.ts', 'mulch-plans');
after(cleanupModules);

test('mulch is independent of planting boundaries, stays on-grid inside the bed and uses layers for stacking', () => {
  const document = { name: 'Garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [{ ...bed, plantingPlan: planV5(), mulchPlan: mulchPlan() }] };
  assert.equal(model.validateGarden(document), null);
  assert.deepEqual(model.freeMulchArea(bed, []), { xCm: 0, yCm: 0, widthCm: 100, lengthCm: 200 });
  assert.equal(model.freeMulchArea(bed, [mulchArea()]), null);
});

test('malformed areas, layers, snapshots and oversized documents are rejected', () => {
  const invalid = [null, {}, mulchPlan({ version: 2 }), mulchPlan({ areas: [] }), mulchPlan({ areas: [null] }),
    mulchPlan({ areas: [mulchArea({ xCm: 1 })] }), mulchPlan({ areas: [mulchArea({ widthCm: 105 })] }),
    mulchPlan({ areas: [mulchArea({ name: ' ' })] }), mulchPlan({ areas: [mulchArea({ layers: [] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [null] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [{ id: 'a', material: { ...chips, version: 0 } }] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [{ id: 'a', material: { ...chips, notes: 'x'.repeat(2001) } }] })] }),
    mulchPlan({ areas: [mulchArea({ layers: [{ id: 'a', material: chips }, { id: 'a', material: chips }] })] }),
    mulchPlan({ areas: [mulchArea(), mulchArea({ id: 'other' })] }),
    mulchPlan({ areas: Array.from({ length: 13 }, (_, index) => mulchArea({ id: `a-${index}` })) }),
    mulchPlan({ areas: [mulchArea({ layers: Array.from({ length: 9 }, (_, index) => ({ id: `l-${index}`, material: chips })) })] })];
  for (const value of invalid) assert.ok(model.validateMulchPlan(value, bed));
});

test('layer order defines the visible surface, previews stay temporary, and copies have independent identities', () => {
  const original = mulchPlan(), area = original.areas[0];
  assert.equal(model.visibleMulchLayer(area, null).material.name, 'Wood chips');
  assert.equal(model.visibleMulchLayer(area, { areaId: area.id, layerId: 'layer-a' }).material.name, 'Straw');
  const reordered = model.reorderMulchLayer(area.layers, 'layer-a', 1);
  assert.equal(reordered.at(-1).material.name, 'Straw');
  assert.equal(area.layers.at(-1).material.name, 'Wood chips');
  assert.deepEqual(model.reorderMulchLayer(area.layers, 'layer-b', 1), area.layers);
  const copied = model.getPastedBed({ ...bed, mulchPlan: original }, { widthCm: 500, lengthCm: 500 }, [bed], 'copied');
  assert.notEqual(copied.mulchPlan.areas[0].id, area.id);
  assert.notEqual(copied.mulchPlan.areas[0].layers[0].id, area.layers[0].id);
  copied.mulchPlan.areas[0].layers[0].material.name = 'Changed';
  assert.equal(area.layers[0].material.name, 'Straw');
  assert.equal(model.canResizeBed({ ...bed, mulchPlan: original, widthCm: 95 }, { widthCm: 500, lengthCm: 500 }, [bed]), false);
  assert.equal(model.canResizeBed({ ...bed, mulchPlan: original, widthCm: 150 }, { widthCm: 500, lengthCm: 500 }, [bed]), true);
});

test('mulch rendering punches a union of physical 5 cm circles after all area fills, including edge plants', () => {
  const fills = [], arcs = [], order = [];
  const context = { globalCompositeOperation: 'source-over', fillStyle: '',
    fillRect(...bounds) { fills.push({ bounds, color: this.fillStyle, operation: this.globalCompositeOperation }); order.push('area'); },
    beginPath() { order.push('path'); }, moveTo() {}, arc(...values) { arcs.push(values); },
    fill(...args) { order.push('clearance'); assert.equal(this.globalCompositeOperation, 'destination-out'); assert.equal(args.length, 0); },
  };
  const draft = mulchPlan({ areas: [mulchArea({ widthCm: 50 }), mulchArea({ id: 'other', xCm: 50, widthCm: 50 })] });
  const points = [{ xCm: 48, yCm: 20 }, { xCm: 52, yCm: 20 }, { xCm: -2, yCm: 30 }];
  model.paintMulch(context, draft, points, null);
  assert.deepEqual(order, ['area', 'area', 'path', 'clearance']);
  assert.ok(fills.every((fill) => fill.operation === 'source-over' && fill.color === model.mulchColor(chips.id)));
  assert.deepEqual(arcs.map((arc) => arc.slice(0, 3)), points.map((point) => [point.xCm, point.yCm, 5]));
  assert.equal(context.globalCompositeOperation, 'source-over');
});

test('focused mulch surfaces use the area resolution and translate physical cm instead of enlarging a blurry whole-bed image',()=>{
  const previousDocument=globalThis.document,previousWindow=globalThis.window, transforms=[];
  const context={scale(...values){transforms.push(['scale',...values]);},translate(...values){transforms.push(['translate',...values]);},fillRect(){},beginPath(){},moveTo(){},arc(){},fill(){}};
  const surface={width:0,height:0,getContext:()=>context};
  globalThis.document={createElement:()=>surface};globalThis.window={devicePixelRatio:2};
  try {
    model.createMulchSurface(mulchPlan(),[],{widthCm:10000,lengthCm:10000},30,null,{xCm:150,yCm:50,widthCm:10,lengthCm:20});
    assert.equal(surface.width,600);assert.equal(surface.height,1200);
    assert.deepEqual(transforms,[['scale',60,60],['translate',-150,-50]]);
  } finally {globalThis.document=previousDocument;globalThis.window=previousWindow;}
});
