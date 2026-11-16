import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadEditor, cleanupEditor } from './helpers.mjs';
import { bed, plan, planV3, areaV2, snapshot, planV5 } from '../planting/fixtures.mjs';
import { straw, chips, mulchPlan } from '../mulch/fixtures.mjs';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'KeyboardEvent'])
  globalThis[key] = dom.window[key];
window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { GardenPage, GardenGrid, plantingDraftKey, BedResizeHandles, canResizePlantingArea, AreaCanvasInfo, BedShape, PlantEntryForm } = await loadEditor();
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(() => { dom.window.close(); cleanupEditor(); });
const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
const click = async (label) => { const item = button(label); assert.ok(item, `Missing button: ${label}`); assert.equal(item.disabled, false, `${label} is disabled`); await act(async () => item.click()); };
async function type(id, value) {
  const input = document.getElementById(id); assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function choose(id, value) {
  const input = document.getElementById(id); assert.ok(input);
  await act(async () => { input.value = value; input.dispatchEvent(new window.Event('change', { bubbles: true })); });
}
async function openBed(currentBed = bed) {
  globalThis.__editorFixture = { saves: [], save: async () => {}, mulchCatalogue: { isAdmin: false, types: [straw, chips] }, catalogue: { isAdmin: false,
    families: [{ id: 'family-a', name: 'Family A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40 }],
    plants: [{ id: 'type-a', familyId: 'family-a', name: 'Type A', notes: '', version: 1, plantSpacingCm: null, rowSpacingCm: null }], rules: [] } };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(GardenPage, {
    user: { id: 'owner-a' }, garden: { id: 'garden-a', ownerId: 'owner-a', name: 'Garden',
      dimensions: { widthCm: 500, lengthCm: 500 }, beds: [currentBed], version: 1, updatedAt: '2026-01-01' },
    onSaved: () => {}, onChooseGardens: () => {}, pickerOpen: false, onReload: async () => {}, onDiscardChanges: () => {},
  })));
  await click('Select fixture bed'); await click('Edit bed');
}

test('Edit bed opens a dedicated non-modal screen and its controls keep the drawing mounted', async () => {
  await openBed();
  assert.ok(document.querySelector('main [data-testid="bed-canvas"]'));
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.querySelector('h1').textContent, bed.name);
  assert.equal(document.activeElement, document.querySelector('h1'));
  await click('Bed');
  assert.ok(document.getElementById('bed-name'));
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Recap');
  assert.ok(document.querySelector('aside[aria-label="Bed recap"]'));
  assert.equal(document.querySelector('input[type="checkbox"]'),null);
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Back to garden');
  assert.ok(button('Select fixture bed'));
});

test('valid bed edits autosave by default, while incomplete fields protect navigation and reload', async () => {
  await openBed(); await click('Add area');
  assert.equal(button('Apply plan'), undefined);
  assert.equal(globalThis.__editorFixture.saves.length, 1);
  assert.match(document.body.textContent, /All changes saved/);
  await type('planting-plant-spacing', '');
  const warning = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(warning);
  assert.equal(warning.defaultPrevented, true);
  await click('Back to garden');
  assert.ok(document.querySelector('section[aria-label="Unapplied planting changes"]'));
  assert.equal(document.querySelector('dialog'), null);
  await click('Keep editing'); assert.match(document.body.textContent, /Changes need attention/);
  await click('Back to garden'); await click('Discard and return');
  assert.ok(button('Select fixture bed')); assert.equal(globalThis.__editorFixture.saves.length, 1);
  await click('Edit bed'); assert.equal(globalThis.__editorCanvas.plan.areas[0].plantSpacingCm,30);
});

test('returning from the bed editor waits for its pending automatic save', async () => {
  await openBed();
  let complete;
  globalThis.__editorFixture.save = () => new Promise((resolve) => { complete = resolve; });
  await click('Add area');
  assert.equal(globalThis.__editorFixture.saves[0].beds[0].plantingPlan.areas.length, 1);
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Back to garden');
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'), 'pending save keeps the editor visible');
  await act(async () => complete());
  assert.ok(button('Select fixture bed'));
});

test('failed automatic saves keep the editor and its latest data available for retry', async () => {
  await openBed();
  globalThis.__editorFixture.save = async () => { throw Error('Offline fixture'); };
  await click('Add area'); await type('planting-row-count','3');await click('Back to garden');
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  assert.match(document.body.textContent, /not saved|Check your connection/);
  globalThis.__editorFixture.save = async () => {};
  await click('Retry save');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan.areas[0].rowCount, 3);
  await click('Back to garden');assert.ok(button('Edit bed'));
});

test('garden Delete and Backspace shortcuts stay inactive while editing a bed', async () => {
  await openBed();
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
  });
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  assert.equal(globalThis.__editorFixture.saves.length, 0);
});

test('bed name changes save on the page and dimensions cannot crop draft areas', async () => {
  await openBed(); await click('Bed'); await type('bed-name', 'Renamed bed'); await click('Save bed');
  assert.equal(document.querySelector('h1').textContent, 'Renamed bed');
  assert.equal(globalThis.__editorFixture.saves[0].beds[0].name, 'Renamed bed');
  await click('Add area'); await click('Bed'); await type('bed-width', '95'); await click('Save bed');
  assert.match(document.body.textContent, /crop a draft planting area/);
  assert.equal(globalThis.__editorFixture.saves.length, 2);
});

test('catalogue access preserves the planting draft and all areas can be removed automatically', async () => {
  await openBed(); await click('Add area'); await click('Areas'); await click('Plant catalogue');
  await click('Back to areas');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan.areas.length, 1);
  await click('Areas'); await click('Remove selected area');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan, undefined);
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
});

test('dirty comparison tracks planting choices while ignoring refreshed companion notes', () => {
  const original = plan();
  assert.equal(plantingDraftKey(original), plantingDraftKey({ ...original, advice: [{ firstAreaId: 'area-a', secondAreaId: 'area-a', relationship: 'caution', notes: 'Refreshed advice' }] }));
  assert.notEqual(plantingDraftKey(original), plantingDraftKey({ ...original, areas: [{ ...original.areas[0], plantSpacingCm: 10 }] }));
  assert.notEqual(plantingDraftKey(original), plantingDraftKey({ ...original, areas: [{ ...original.areas[0], plant: { ...snapshot, typeVersion: 2 } }] }));
  assert.equal(plantingDraftKey(undefined), plantingDraftKey({ ...original, areas: [] }));
});

test('each area has its own saved direction and row count, defaulting to the longer bed side', async () => {
  await openBed({ ...bed, widthCm: 300, lengthCm: 100 }); await click('Add area');
  assert.equal(document.getElementById('planting-area-direction').value, 'width');
  assert.equal(document.getElementById('planting-row-count').value, '2');
  assert.match(document.body.textContent, /Minimum clearances: 15 cm at row sides and 15 cm at row ends/);
  await click('Split selected area'); await choose('planting-area-direction', 'length');
  await type('planting-row-count', '3');
  assert.equal(document.getElementById('planting-row-spacing'), null, 'row spacing is calculated in manual-count mode');
 
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan;
  assert.equal(saved.version, 5);
  assert.equal(saved.areas[0].rowDirection, 'width'); assert.equal(saved.areas[0].rowCount, 2);
  assert.equal(saved.areas[1].rowDirection, 'length'); assert.equal(saved.areas[1].rowCount, 3);
  await type('planting-row-count', '');
  assert.ok(document.getElementById('planting-row-spacing'));
});

test('a row count can be entered even when the catalogue has no row-spacing recommendation', async () => {
  await openBed();
  globalThis.__editorFixture.catalogue.families[0].rowSpacingCm = null;
  await click('Add area'); await type('planting-row-count', '2');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan;
  assert.equal(saved.areas[0].rowCount, 2); assert.equal(saved.areas[0].plant.rowSpacingCm, null);
});

test('bed grid repeats every 5 cm and remains transparent above planting-area fills in both themes', async () => {
  const prototype = window.HTMLCanvasElement.prototype;
  const original = prototype.getContext, previousMatrix = globalThis.DOMMatrix;
  let fills = 0, strokes = 0, scale;
  prototype.getContext = () => ({ fillRect() { fills++; }, strokeRect() { strokes++; } });
  globalThis.DOMMatrix = class { scale(value) { scale = value; return this; } };
  try {
    root = createRoot(document.getElementById('root'));
    for (const dark of [false, true]) {
      await act(async () => root.render(createElement(GardenGrid, { widthCm: 100, lengthCm: 200, pixelsPerCm: 1, dark, surface: 'bed' })));
      assert.equal(globalThis.__gridShape.listening, false);
      let destination;
      globalThis.__gridShape.sceneFunc({ createPattern: () => ({ setTransform() {} }), setAttr() {}, fillRect(...values) { destination = values; } });
      assert.equal(scale, 5 / 64); assert.deepEqual(destination, [0, 0, 100, 200]);
    }
    assert.equal(fills, 0, 'bed overlay does not repaint the soil or areas'); assert.equal(strokes, 2);
  } finally { prototype.getContext = original; globalThis.DOMMatrix = previousMatrix; }
});

test('area resize commits balance borders, compress rows, reject cropping and keep warnings advisory', async () => {
  await openBed(); await click('Add area'); await type('planting-row-count', '3');
  const id = globalThis.__editorCanvas.plan.areas[0].id;
  await act(async () => globalThis.__editorCanvas.onBounds(id, { xCm: 0, yCm: 0, widthCm: 80, lengthCm: 200 }));
  assert.match(document.body.textContent, /Row gaps reach 25 cm/);
  assert.match(document.body.textContent, /All changes saved/);
  await act(async () => globalThis.__editorCanvas.onBounds(id, { xCm: 0, yCm: 0, widthCm: 35, lengthCm: 200 }));
  assert.equal(globalThis.__editorCanvas.plan.areas[0].widthCm, 80);
 
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan.areas[0].widthCm, 80);
});

test('drag handles restore the last fitting geometry instead of letting rows lose their margins', async () => {
  const area = areaV2({ rowCount: 3 });
  const draft = planV3({ areas: [area] });
  const rectangle = { ...area, name: 'Area fixture' };
  const previews = [], commits = [];
  globalThis.__resizeHandles = [];
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(BedResizeHandles, { bed: rectangle, beds: [rectangle], garden: bed,
    pixelsPerCm: 1, onPreview: (value) => previews.push(value), onCommit: (value) => commits.push(value),
    canResize: (value) => canResizePlantingArea(draft, area, value, bed) })));
  const handle = globalThis.__resizeHandles.find((item) => item.x === 100 && item.y === 100);
  assert.ok(handle);
  const node = { value: { x: 80, y: 100 }, x() { return this.value.x; }, y() { return this.value.y; }, position(value) { this.value = value; } };
  handle.onDragStart(); handle.onDragMove({ target: node });
  assert.equal(previews.at(-1).widthCm, 80);
  node.position({ x: 45, y: 100 }); handle.onDragMove({ target: node });
  assert.equal(previews.at(-1).widthCm, 80); assert.equal(node.x(), 80);
  handle.onDragEnd({ target: node }); assert.equal(commits[0].widthCm, 80);
});

test('area name and live size sit in a fixed-height information bar with a text warning', async () => {
  root = createRoot(document.getElementById('root'));
  const area = areaV2({ widthCm: 80, rowCount: 3 });
  await act(async () => root.render(createElement(AreaCanvasInfo, { area, index: 0, measurements: [
    { kind: 'row-gap', warning: true, distanceCm: 20, recommendedCm: 40 },
  ] })));
  assert.match(document.querySelector('header').className, /h-12/);
  assert.match(document.body.textContent, /80 × 200 cm/);
  assert.match(document.body.textContent, /closer than the catalogue recommendation/);
});

test('mulch areas and layers edit alongside planting and save atomically without persisting layer previews', async () => {
  await openBed(); await click('Add area'); await click('Mulch'); await click('Add mulch area');
  assert.equal(globalThis.__editorCanvas.editingMulch, true);
  assert.equal(globalThis.__editorCanvas.plan.areas.length, 1);
  assert.equal(globalThis.__editorCanvas.mulch.plan.areas[0].widthCm, bed.widthCm);
  await click('Add layer on top');
  const area = globalThis.__editorCanvas.mulch.plan.areas[0];
  await choose(`mulch-layer-${area.layers[1].id}`, chips.id);
  await click('Preview layer 1');
  assert.equal(globalThis.__editorCanvas.mulch.preview.layerId, area.layers[0].id);
  await click('Move layer 2 down');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0];
  assert.equal(saved.plantingPlan.areas.length, 1);
  assert.deepEqual(saved.mulchPlan.areas[0].layers.map((layer) => layer.material.name), ['Wood chips', 'Straw']);
  assert.equal(saved.mulchPlan.preview, undefined);
  await click('Back to garden'); await click('Edit bed'); await click('Mulch');
  assert.deepEqual(globalThis.__editorCanvas.mulch.plan, saved.mulchPlan);
});

test('mulch gestures stay within the bed without overlap and an unplanted bed autosaves mulch', async () => {
  await openBed(); await click('Mulch'); await click('Add mulch area');
  const id = globalThis.__editorCanvas.mulch.plan.areas[0].id;
  await act(async () => globalThis.__editorCanvas.mulch.onBounds(id, { xCm: 0, yCm: 0, widthCm: 50, lengthCm: 100 }));
  await click('Add mulch area');
  const second = globalThis.__editorCanvas.mulch.plan.areas[1];
  await act(async () => globalThis.__editorCanvas.mulch.onBounds(second.id, { xCm: 0, yCm: 0, widthCm: 50, lengthCm: 100 }));
  assert.deepEqual(globalThis.__editorCanvas.mulch.plan.areas[1], second, 'overlap is rejected');
  await act(async () => globalThis.__editorCanvas.mulch.onBounds(id, { xCm: 1, yCm: 0, widthCm: 50, lengthCm: 100 }));
  assert.equal(globalThis.__editorCanvas.mulch.plan.areas[0].xCm, 0, 'off-grid changes are rejected');
  await act(async () => globalThis.__editorCanvas.mulch.onBounds(id, { xCm: 95, yCm: 0, widthCm: 50, lengthCm: 100 }));
  assert.equal(globalThis.__editorCanvas.mulch.plan.areas[0].xCm, 0, 'overflow is rejected');
 
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0];
  assert.equal(saved.plantingPlan, undefined); assert.equal(saved.mulchPlan.areas.length, 2);
});

test('mulch edits autosave through catalogue navigation and invalid names protect leaving', async () => {
  await openBed(); await click('Mulch'); await click('Add mulch area');
  await type('mulch-area-name', 'Winter cover');
  await click('Mulch catalogue'); await click('Back to mulch plan');
  assert.equal(document.getElementById('mulch-area-name').value, 'Winter cover');
  await type('mulch-area-name','');
  const writes=globalThis.__editorFixture.saves.length;
  const warning = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(warning);
  assert.equal(warning.defaultPrevented, true);
  await click('Back to garden'); assert.match(document.body.textContent, /could not be saved/);
  await click('Discard and return');
  assert.equal(globalThis.__editorFixture.saves.length, writes); assert.ok(button('Select fixture bed'));
  await click('Edit bed');assert.equal(globalThis.__editorCanvas.mulch.plan.areas[0].name,'Winter cover');
});

test('bed metadata cannot crop mulch and removing the last area clears saved mulch', async () => {
  await openBed({ ...bed, mulchPlan: mulchPlan() }); await click('Bed');
  await type('bed-width', '95'); await click('Save bed');
  assert.match(document.body.textContent, /crop a draft mulch area/);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  await click('Mulch'); await click('Remove selected mulch area');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].mulchPlan, undefined);
});

test('clearing a planting plan keeps mulch and autosaves both plans', async () => {
  await openBed(); await click('Add area'); await click('Mulch'); await click('Add mulch area');
  await click('Areas'); await click('Clear planting plan');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0];
  assert.equal(saved.plantingPlan, undefined); assert.equal(saved.mulchPlan.areas.length, 1);
});

test('focused planting and mulch area pages keep the bed draft and autosave through the same save flow',async()=>{
  await openBed(); await click('Add area'); await click('Areas'); await click('Open area editor');
  assert.ok(button('← Back to bed')); assert.equal(globalThis.__editorCanvas.focus.kind,'planting');
  assert.ok(button('Hide settings'));assert.equal(globalThis.__editorCanvas.focusZoom,0.8);
  await click('Zoom out');assert.ok(globalThis.__editorCanvas.focusZoom<0.8);
  await click('Fit area');assert.equal(globalThis.__editorCanvas.focusZoom,0.8);
  await click('Hide settings');assert.ok(button('Show settings'));await click('Show settings');
   await type('planting-row-count','3');
  await click('← Back to bed'); assert.equal(globalThis.__editorCanvas.plan.areas[0].rowCount,3);
  await click('Mulch'); await click('Add mulch area'); await click('Open area editor');
  assert.equal(globalThis.__editorCanvas.focus.kind,'mulch'); 
  await type('focused-mulch-name','Winter cover'); await click('Add layer on top');
 
  const saved=globalThis.__editorFixture.saves.at(-1).beds[0];
  assert.equal(saved.plantingPlan.areas[0].rowCount,3);
  assert.equal(saved.mulchPlan.areas[0].name,'Winter cover'); assert.equal(saved.mulchPlan.areas[0].layers.length,2);
  assert.equal(document.querySelector('dialog'),null);
});

test('bed history protects invalid edits, filters other beds activities and preserves old plan geometry',async()=>{
  await openBed(); await click('Add area'); await type('planting-plant-spacing',''); await click('History');
  assert.match(document.body.textContent,/before opening bed history/); await click('Keep editing');
  assert.equal(button('Apply plan'),undefined);
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:3})]})};
  globalThis.__editorFixture.historyEvents=[{id:'layout-old',gardenId:'garden-a',order:1,date:'2026-01-01',title:'Old layout',notes:'',recordedAt:'2026-01-01T12:00:00Z',sourceVersion:1,actorId:'owner-a',kind:'layout',status:'completed',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[old]}},
    {id:'planned:other',bedId:'other-bed',kind:'planting',status:'planned',date:'2026-02-01',order:2,title:'Other bed',notes:'',recordedAt:'2026-02-01T12:00:00Z'}];
  await click('History'); await click('Discard and view history');
  assert.equal(button('View planned event: Other bed'),undefined);
  await click('Previous event'); assert.equal(globalThis.__editorCanvas.readOnly,true);
  assert.equal(globalThis.__editorCanvas.plan.version,3,'historical geometry is never upgraded to the editable format');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].rowCount,3);
  await click('← Back to bed'); assert.ok(button('Add area'));
  assert.equal(globalThis.__editorFixture.saves.length,1);
});

test('recording a bed checkpoint keeps its autosaved plan unchanged and is visible in bed history',async()=>{
  await openBed();
  const fixture=globalThis.__editorFixture;
  fixture.historyDocument={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed]};
  await click('Add area');const saved=structuredClone(fixture.saves.at(-1));
  await click('History');await click('Record bed changes');await type('activity-title','Planted this bed');
  await act(async()=>document.getElementById('activity-confirm').click());await click('Record bed changes');
  await click('View completed event: Planted this bed');await click('Delete history entry');await click('Delete entry');
  assert.equal(fixture.historyEvents.length,0);
  await click('← Back to bed');assert.equal(globalThis.__editorCanvas.plan.areas.length,1);
  assert.deepEqual(fixture.saves.at(-1),saved);assert.equal(button('Apply plan'),undefined);
});

test('expanding a focused area autosaves the changed neighbour in the same garden revision',async()=>{
  await openBed();await click('Add area');await click('Split selected area');
  const fixture=globalThis.__editorFixture;
  const [first,second]=globalThis.__editorCanvas.plan.areas;
  await choose('planting-area',first.id);await click('Open area editor');
  const writes=fixture.saves.length,version=fixture.currentGarden.version;
  await act(async()=>globalThis.__editorCanvas.onBounds(first.id,{...first,lengthCm:120}));
  assert.equal(fixture.saves.length,writes+1);
  assert.equal(fixture.currentGarden.version,version+1);
  const saved=fixture.saves.at(-1).beds[0].plantingPlan.areas;
  assert.equal(saved[0].lengthCm,120);assert.equal(saved[1].yCm,120);assert.equal(saved[1].lengthCm,80);
  assert.equal(saved[1].rowCount,second.rowCount);
  await act(async()=>globalThis.__editorCanvas.onBounds(first.id,{...first,lengthCm:175}));
  assert.equal(fixture.saves.length,writes+1,'a neighbour with no room for plants rejects the whole resize');
  await click('← Back to bed');await click('Back to garden');await click('Edit bed');
  assert.deepEqual(globalThis.__editorCanvas.plan.areas,saved);
});

test('opening an older plan and discarding invalid fields does not autosave a format change',async()=>{
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:2})]})};
  await openBed(old);const fixture=globalThis.__editorFixture;
  assert.equal(fixture.saves.length,0);
  await click('Areas');await type('planting-plant-spacing','');
  await click('History');await click('Discard and view history');
  await click('← Back to bed');
  assert.equal(fixture.saves.length,0);
  assert.match(document.body.textContent,/All changes saved/);
  await click('Areas');await type('planting-row-count','3');
  assert.equal(fixture.saves.length,1);
  assert.equal(fixture.saves[0].beds[0].plantingPlan.version,5);
});


test('desktop double-click opens the selected bed and planting/mulch area editor',async()=>{
  await openBed();await click('Back to garden');
  await act(async()=>globalThis.__gardenCanvas.onEditBed(bed.id));
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Add area');const id=globalThis.__editorCanvas.plan.areas[0].id;
  await act(async()=>{globalThis.__editorCanvas.onSelect(id);globalThis.__editorCanvas.onOpenArea({kind:'planting',id});});
  assert.equal(globalThis.__editorCanvas.focus.kind,'planting');assert.ok(button('← Back to bed'));
  await click('← Back to bed');await click('Mulch');await click('Add mulch area');
  const mulchId=globalThis.__editorCanvas.mulch.plan.areas[0].id;
  await act(async()=>{globalThis.__editorCanvas.mulch.onSelect(mulchId);globalThis.__editorCanvas.onOpenArea({kind:'mulch',id:mulchId});});
  assert.equal(globalThis.__editorCanvas.focus.kind,'mulch');
});

test('the Konva bed surface opens on mouse double-click and never opens read-only snapshots',async()=>{
  root=createRoot(document.getElementById('root'));let opened=0;
  const props={bed,dark:false,garden:{widthCm:500,lengthCm:500},beds:[bed],onMove(){},selected:false,onSelect(){},
    onOpen(){opened++;},onMovingChange(){},onMovePreview(){},pixelsPerCm:1};
  await act(async()=>root.render(createElement(BedShape,props)));
  assert.equal(globalThis.__shapeGroup.onDblTap,undefined,'touch keeps the existing explicit editor buttons');
  await act(async()=>globalThis.__shapeGroup.onDblClick());assert.equal(opened,1);
  await act(async()=>root.render(createElement(BedShape,{...props,readOnly:true})));
  await act(async()=>globalThis.__shapeGroup.onDblClick());assert.equal(opened,1);
});

test('area fields reset independently, omit orientation sizes and automatic-count wording, and use a red removal button',async()=>{
  await openBed();await click('Add area');
  assert.deepEqual([...document.getElementById('planting-area-direction').options].map(item=>item.textContent),['Along bed length','Along bed width']);
  assert.ok(!document.body.textContent.includes('empty = automatic'));
  assert.equal(button('Use current catalogue spacing'),undefined);
  assert.match(button('Remove selected area').className,/bg-red-700/);
  await type('planting-row-count','4');await type('planting-plant-spacing','10');
  await click('Reset number of rows');
  assert.equal(document.getElementById('planting-row-count').value,'2');
  assert.equal(document.getElementById('planting-plant-spacing').value,'10');
  await click('Open area editor');await click('Reset plant spacing');
  assert.equal(document.getElementById('planting-plant-spacing').value,'30');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].plantingPlan.areas[0].rowCount,2);
});

test('the plant-type catalogue form loads, validates and submits its border-distance property',async()=>{
  root=createRoot(document.getElementById('root'));const saved=[];
  const families=[{id:'family-a',name:'Family'}];
  const render=kind=>act(async()=>root.render(createElement(PlantEntryForm,{key:kind,kind,families,onSave:async details=>{saved.push(details);},onCancel(){}})));
  await render('plant');assert.equal(document.getElementById('catalogue-border-distance').value,'15');
  await type('catalogue-entry-name','Lettuce');await choose('catalogue-family','family-a');await type('catalogue-border-distance','12');await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(saved.length,0);assert.match(document.body.textContent,/steps of 5 cm/);
  await type('catalogue-border-distance','25');await click('Save entry');assert.equal(saved[0].borderDistanceCm,25);
  await render('family');assert.equal(document.getElementById('catalogue-border-distance'),null);
});

test('switching palette preserves selected areas and incomplete edits without saving a garden change',async()=>{
  await openBed();await click('Add area');await type('planting-row-count','3');await type('planting-plant-spacing','');
  const fixture=globalThis.__editorFixture,writes=fixture.saves.length,id=globalThis.__editorCanvas.selectedId;
  const toggle=button('Switch to light mode')??button('Switch to dark mode');assert.ok(toggle);
  const previous=document.documentElement.dataset.theme;
  await act(async()=>toggle.click());
  assert.notEqual(document.documentElement.dataset.theme,previous);
  assert.equal(fixture.saves.length,writes);
  assert.equal(globalThis.__editorCanvas.selectedId,id);
  assert.equal(document.getElementById('planting-row-count').value,'3');
  assert.equal(document.getElementById('planting-plant-spacing').value,'');
  assert.match(document.body.textContent,/Changes need attention/);
});


test('Edit garden groups sharing, rename and size while More no longer contains those actions or the duplicate bed editor',async()=>{
  await openBed();await click('Back to garden');await click('More');
  const more=document.querySelector('dialog');assert.ok(more);
  assert.ok(!more.textContent.includes('Edit and plan selected bed'));
  for(const label of ['Share garden','Rename garden','Garden size'])assert.ok(![...more.querySelectorAll('button')].some(item=>item.textContent===label));
  assert.ok(more.textContent.includes('Plant catalogue'));assert.ok(more.textContent.includes('Copy bed'));
  await click('Close');await click('Edit garden');
  const edit=document.querySelector('dialog');
  for(const label of ['Share garden','Rename garden','Garden size'])assert.ok([...edit.querySelectorAll('button')].some(item=>item.textContent===label));
  await click('Rename garden');await type('garden-name','Woodland garden');await click('Save name');
  assert.equal(globalThis.__editorFixture.saves.at(-1).name,'Woodland garden');
  await click('Edit garden');await click('Garden size');await type('garden-width','600');await click('Update garden');
  assert.equal(globalThis.__editorFixture.saves.at(-1).dimensions.widthCm,600);
});

test('Recap groups plant totals by type, shows area dimensions and updates without making edits',async()=>{
  await openBed();assert.equal(button('Plan'),undefined);await click('Recap');
  assert.match(document.querySelector('aside[aria-label="Bed recap"]').textContent,/No planting areas yet/);
  await click('Add area');await click('Split selected area');
  await click('Recap');const writes=globalThis.__editorFixture.saves.length;
  const plants=document.querySelector('section[aria-label="Plants by type"]');
  assert.equal(plants.querySelectorAll('li').length,1);
  assert.match(plants.textContent,/Type A.*12 plants · 2 areas/);
  assert.match(document.querySelector('section[aria-label="Planting area recap"]').textContent,/100 × 100 cm/);
  const details=document.querySelector('aside[aria-label="Bed recap"]');
  assert.match(details.textContent,/Bed surface2 m²/);assert.match(details.textContent,/Outside planting areas0 m²/);
  assert.equal(details.querySelector('input'),null,'Recap contains no editing controls');
  await click('Areas');assert.ok(document.querySelector('section[aria-label="Planting settings"] input[type="checkbox"]'));
  await type('planting-plant-spacing','10');await click('Recap');
  assert.match(document.querySelector('section[aria-label="Plants by type"]').textContent,/22 plants · 2 areas/);
  assert.equal(globalThis.__editorFixture.saves.length,writes+1,'switching menus does not save garden changes');
});


test('garden Recap totals plants across copied beds and shows their full footprint without creating edits',async()=>{
  const plantingPlan=planV5({areas:[areaV2({lengthCm:100,rowCount:2}),
    areaV2({id:'area-b',yCm:100,lengthCm:100,rowCount:2,plant:{...snapshot,id:'type-b',name:'Type B'}})]});
  await openBed({...bed,plantingPlan});await click('Back to garden');
  await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true,cancelable:true})));
  await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true})));
  const fixture=globalThis.__editorFixture,writes=fixture.saves.length;
  await click('Recap');const recap=document.querySelector('dialog');
  assert.match(recap.textContent,/Garden recap/);assert.match(recap.textContent,/Garden surface25 m²/);assert.match(recap.textContent,/Beds2/);
  assert.match(recap.textContent,/Total plants24/);assert.match(recap.textContent,/Area occupied by beds4 m²/);
  const totals=recap.querySelector('section[aria-label="Garden plants by type"]');
  assert.match(totals.textContent,/Type A12 plants/);assert.match(totals.textContent,/Type B12 plants/);
  assert.equal(recap.querySelector('input'),null);
  assert.equal(fixture.saves.length,writes,'opening Recap does not change the garden');
});

test('garden Recap shows zero plants while counting beds without planting plans',async()=>{
  await openBed();await click('Back to garden');await click('Recap');
  assert.match(document.querySelector('dialog').textContent,/No planting plans in these beds yet/);
  assert.match(document.querySelector('dialog').textContent,/Area occupied by beds2 m²/);
  assert.equal(globalThis.__editorFixture.saves.length,0);
});


test('backdated bed edits include planting and mulch while protecting other beds and the current plan',async()=>{
  await openBed();const fixture=globalThis.__editorFixture;
  const other={...bed,id:'other-bed',name:'Other bed',xCm:150};
  fixture.historyEvents=[{id:'past-layout',gardenId:'garden-a',kind:'layout',status:'completed',eventVersion:1,order:1,date:'2025-01-01',title:'Earlier garden',notes:'',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed,other]}}];
  await click('History');await click('Add past bed edit');assert.ok(button('Save history record'));
  assert.equal(button('History'),undefined);await click('Add area');await click('Mulch');await click('Add mulch area');
  await click('Back to garden');
  await act(async()=>{
    globalThis.__gardenCanvas.onMoveBed(other.id,{xCm:300,yCm:0});
    globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:20,yCm:0});
  });
  assert.equal(globalThis.__gardenCanvas.beds.find(item=>item.id===other.id).xCm,150);
  await click('Save history record');await type('history-edit-date','2025-02-01');await click('Save record');
  const recorded=fixture.historyEvents.find(item=>item.kind==='bed');assert.ok(recorded);
  const saved=recorded.document.beds.find(item=>item.id===bed.id);
  assert.equal(saved.xCm,20);assert.equal(saved.plantingPlan.areas.length,1);assert.equal(saved.mulchPlan.areas.length,1);
  assert.equal(recorded.document.beds.find(item=>item.id===other.id).xCm,150);
  assert.equal(fixture.saves.length,0);
  await click('Plan');await click('← Back to bed');assert.equal(globalThis.__editorCanvas.plan.areas.length,0);
});

test('historical metadata corrections preserve older planting geometry until planting controls are edited',async()=>{
  await openBed();const fixture=globalThis.__editorFixture;
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:3})]})};
  fixture.historyEvents=[{id:'old-bed',gardenId:'garden-a',kind:'planting',bedId:bed.id,status:'completed',eventVersion:1,order:1,date:'2025-01-01',title:'Older bed',notes:'',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[old]}}];
  await click('History');await click('View completed event: Older bed');await click('Edit history record');
  assert.equal(globalThis.__editorCanvas.plan.version,3);
  await click('Bed');await type('bed-name','Earlier name');await click('Save bed');
  await click('Save history record');await click('Save record');
  assert.deepEqual(fixture.historyEvents[0].document.beds[0].plantingPlan,old.plantingPlan);
  await click('Edit history record');await click('Areas');await type('planting-row-count','4');
  assert.equal(globalThis.__editorCanvas.plan.version,5);
});
