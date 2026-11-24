import { broadcast, areaPlan, rows } from '../planting/area-fixtures.mjs';
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
const { GardenPage, GardenGrid, plantingDraftKey, BedResizeHandles, canResizePlantingArea, AreaCanvasInfo, BedShape, PlantEntryForm, WorkspaceNavigation, useWorkspaceNavigation } = await loadEditor();
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(() => { dom.window.close(); cleanupEditor(); });
const button = (label) => [...document.querySelectorAll('button')].find((item) => !item.closest('[hidden]') && (item.textContent.trim() === label || item.getAttribute('aria-label') === label));
const click = async (label) => {
  if (['Summary', 'Calendar', 'Add bed', 'Garden settings'].includes(label) && !button(label) && !document.querySelector('[data-testid="bed-canvas"]')) {
    await act(async () => globalThis.__gardenCanvas.onSelectBed(null));
    if (label === 'Garden settings') await act(async () => button('More').click());
  }
  if (label.startsWith('View completed event:') && !button(label) && button('All dates')) await act(async()=>button('All dates').click());
  const item = button(label); assert.ok(item, `Missing button: ${label}`); assert.equal(item.disabled, false, `${label} is disabled`); await act(async () => item.click());
};
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
async function openBed(currentBed = bed, options = {}) {
  globalThis.__editorFixture = { saves: [], save: async () => {}, seedMixtures: [{ id: 'default-mix', name: 'Demo mixture', notes: 'Fixture', version: 1, components: [{ plantTypeId: 'type-a', cultivarId: null, percentage: 100 }] }], mulchCatalogue: { isAdmin: false, types: [straw, chips] }, catalogue: { isAdmin: false,
    families: [{ id: 'family-a', name: 'Family A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40 }],
    plants: [{ id: 'type-a', familyId: 'family-a', name: 'Type A', notes: '', version: 1, plantSpacingCm: null, rowSpacingCm: null }], rules: [] }, ...options };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(GardenPage, {
    user: { id: 'owner-a' }, garden: { id: 'garden-a', ownerId: 'owner-a', name: 'Garden',
      dimensions: { widthCm: 500, lengthCm: 500 }, beds: [currentBed], version: 1, updatedAt: '2026-01-01', location: options.location },
    onSaved: () => {}, onChooseGardens: () => {}, pickerOpen: false, onReload: options.onReload ?? (async () => {}), onDiscardChanges: () => {},
    onOpenCalendar: options.onOpenCalendar, onDeleteGarden: options.onDeleteGarden,
  })));
  await click('Select fixture bed'); await click('Edit bed');
}

test('Edit bed opens a dedicated non-modal screen and its controls keep the drawing mounted', async () => {
  await openBed();
  assert.ok(document.querySelector('main [data-testid="bed-canvas"]'));
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.querySelector('h1').textContent, bed.name);
  assert.equal(document.activeElement, document.querySelector('h1'));
  await click('Settings');
  assert.ok(document.getElementById('bed-name'));
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Summary');
  assert.ok(document.querySelector('aside[aria-label="Bed summary"]'));
  assert.equal(document.querySelector('input[type="checkbox"]'),null);
  assert.ok(document.querySelector('[data-testid="bed-canvas"]'));
  await click('Back to garden');
  assert.ok(button('Select fixture bed'));
});

test('valid bed edits autosave by default, while incomplete fields protect navigation and reload', async () => {
  await openBed(); await click('Add area');
  assert.equal(button('Apply plan'), undefined);
  assert.equal(globalThis.__editorFixture.saves.length, 1);
  assert.match(document.body.textContent, /All changes saved|Saved/);
  await type('planting-plant-spacing', '');
  const warning = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(warning);
  assert.equal(warning.defaultPrevented, true);
  await click('Back to garden');
  assert.ok(document.querySelector('section[aria-label="Unapplied area changes"]'));
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
  assert.equal(globalThis.__editorFixture.saves[0].beds[0].areaPlan.areas.length, 1);
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
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].rowCount, 3);
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

test('bed name and size save atomically with resized areas and reject insufficient plant space', async () => {
  await openBed(); await click('Settings'); await type('bed-name', 'Renamed bed'); await click('Save bed');
  assert.equal(document.querySelector('h1').textContent, 'Renamed bed');
  assert.equal(globalThis.__editorFixture.saves[0].beds[0].name, 'Renamed bed');
  await click('Add area'); await click('Settings'); await type('bed-width', '95'); await click('Save bed');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].widthCm, 95);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].widthCm, 95);
  const count = globalThis.__editorFixture.saves.length;
  await type('bed-width', '30'); await click('Save bed');
  assert.match(document.body.textContent, /more space/); assert.equal(globalThis.__editorFixture.saves.length, count);
});

test('refreshing planting references preserves the draft without offering catalogue management', async () => {
  await openBed(); await click('Add area'); await click('Areas');
  assert.equal(button('Plant catalogue'), undefined);
  await click('Refresh area references');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 1);
  await click('Areas'); await click('Remove selected area');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 0);
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
  assert.ok(!document.body.textContent.includes('Minimum clearances:'));
  await click('Split selected area'); await choose('planting-area-direction', 'length');
  await type('planting-row-count', '3');
  assert.equal(document.getElementById('planting-row-spacing'), null, 'row spacing is calculated in manual-count mode');
 
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan;
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
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan;
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
  assert.match(document.body.textContent, /All changes saved|Saved/);
  await act(async () => globalThis.__editorCanvas.onBounds(id, { xCm: 0, yCm: 0, widthCm: 35, lengthCm: 200 }));
  assert.equal(globalThis.__editorCanvas.plan.areas[0].widthCm, 80);
 
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].widthCm, 80);
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

test('mulch layers belong to the selected area and save in bottom-to-top order', async () => {
  await openBed(); await click('Add area');
  assert.equal(button('Mulch'), undefined);
  await click('Add mulch layer'); await click('Add mulch layer');
  const area = globalThis.__editorCanvas.plan.areas[0];
  await choose(`mulch-layer-${area.mulch[1].id}`, chips.id); await click('Move layer 2 down');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0];
  assert.equal(saved.plantingPlan, undefined); assert.equal(saved.mulchPlan, undefined);
  assert.deepEqual(saved.areaPlan.areas[0].mulch.map((layer) => layer.material.name), ['Wood chips', 'Straw']);
  await click('Back to garden'); await click('Edit bed');
  assert.deepEqual(globalThis.__editorCanvas.plan, saved.areaPlan);
  await click('Areas'); await click('Remove layer 2'); await click('Remove layer 1');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].mulch.length, 0);
});

test('broadcast areas support mulch, resizing and independent area identities', async () => {
  await openBed(); await click('Add area'); await choose('area-kind', 'broadcast'); await type('broadcast-density', '10'); await click('Add mulch layer');
  const id = globalThis.__editorCanvas.plan.areas[0].id;
  await act(async () => globalThis.__editorCanvas.onBounds(id, { xCm: 0, yCm: 0, widthCm: 50, lengthCm: 100 }));
  await click('Add area'); await choose('area-kind', 'broadcast'); await type('broadcast-density', '10'); await click('Add mulch layer');
  const second = globalThis.__editorCanvas.plan.areas[1];
  await act(async () => globalThis.__editorCanvas.onBounds(second.id, { xCm: 0, yCm: 0, widthCm: 50, lengthCm: 100 }));
  assert.deepEqual(globalThis.__editorCanvas.plan.areas[1], second, 'overlap is rejected');
  await act(async () => globalThis.__editorCanvas.onBounds(id, { xCm: 1, yCm: 0, widthCm: 50, lengthCm: 100 }));
  assert.equal(globalThis.__editorCanvas.plan.areas[0].xCm, 0);
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan;
  assert.equal(saved.areas[0].kind, 'broadcast'); assert.equal(saved.areas[0].mulch.length, 1);
  assert.notEqual(saved.areas[0].mulch[0].id, saved.areas[1].mulch[0].id);
});

test('automatic crop labels and attached mulch survive reference refresh and reopening', async () => {
  await openBed(); await click('Add area'); await choose('area-kind', 'broadcast'); await type('broadcast-density', '10');
  assert.equal(document.getElementById('area-name'), null); await click('Add mulch layer');
  await click('Refresh area references'); assert.match(document.getElementById('planting-selected-area').textContent, /Type A/);
  await click('Back to garden'); await click('Edit bed'); await click('Areas');
  assert.equal(document.getElementById('area-name'), null);
  assert.match(document.getElementById('planting-selected-area').textContent, /Type A/);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].mulch.length, 1);
});

test('bed dimensions resize mulch areas and removal clears the area and its layers together', async () => {
  await openBed({ ...bed, mulchPlan: mulchPlan() }); await click('Settings');
  await type('bed-width', '95'); await click('Save bed');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].widthCm, 95);
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].mulchPlan.areas[0].widthCm, 95);
  await click('Areas'); await click('Remove selected area');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 0);
});

test('changing planting method keeps bounds, purpose and mulch while clearing the whole plan removes all areas', async () => {
  await openBed(); await click('Add area'); await click('Add mulch layer');
  await choose('area-purpose', 'green_manure'); await type('broadcast-density', '10');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.kind, 'broadcast'); assert.equal(saved.purpose, 'green_manure'); assert.equal(saved.mulch.length, 1);
  assert.equal(saved.widthCm, bed.widthCm);
  await click('Clear area plan'); await click('Clear all areas'); assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 0);
});

test('inline area focus keeps the bed page, editable panels and autosave history shared', async () => {
  await openBed(); await click('Add area'); await click('Focus area');
  const canvas = document.querySelector('[data-testid="bed-canvas"]');
  assert.ok(button('Back to garden')); assert.equal(button('Close calendar'), undefined);
  assert.equal(globalThis.__editorCanvas.cameraCommand.action, 'focus');
  const writes = globalThis.__editorFixture.saves.length;
  await click('Zoom out'); assert.equal(globalThis.__editorCanvas.cameraCommand.action, 'zoom-out');
  await click('Focus area'); assert.equal(globalThis.__editorCanvas.cameraCommand.action, 'focus');
  assert.equal(button('Areas').getAttribute('aria-expanded'), 'false', 'focus reveals the area on phones');
  await click('Edit selected area');
  assert.equal(document.querySelector('[data-testid="bed-canvas"]'), canvas);
  assert.equal(globalThis.__editorFixture.saves.length, writes, 'view commands never save geometry');
  await type('planting-row-count', '3'); assert.equal(document.getElementById('area-name'), null); await click('Add mulch layer');
  await click('Fit bed');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.rowCount, 3); assert.equal(saved.mulch.length, 1);
  assert.equal(document.querySelector('dialog'), null);
});

test('broadcast green manure calculates seed quantities, requires density and keeps mixture snapshots', async () => {
  await openBed(); await click('Add area'); await click('Focus area');
  const fixture = globalThis.__editorFixture;
  fixture.seedMixtures = [{ id: 'mix', name: 'Cover mix', notes: '', version: 1, components: [{ plantTypeId: 'type-a', cultivarId: null, percentage: 100 }] }];
  await click('Fit bed'); await click('Refresh area references'); await click('Focus area');
  await choose('area-purpose', 'green_manure');
  const writes = fixture.saves.length;
  assert.equal(document.getElementById('area-kind'), null);
  assert.equal(fixture.saves.length, writes, 'missing density remains an unsaved draft');
  await choose('seed-mixture', 'mix'); await type('broadcast-density', '10');
  assert.equal(document.getElementById('broadcast-total').value, '20');
  assert.equal(document.getElementById('broadcast-total').readOnly, true);
  assert.equal(document.getElementById('broadcast-density-unit'), null);
  await click('Add mulch layer');
  const saved = fixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.purpose, 'green_manure'); assert.equal(saved.sowing.mixture.name, 'Cover mix');
  assert.equal(saved.sowing.mixture.components[0].plant.name, 'Type A'); assert.equal(saved.mulch.length, 1);
  fixture.seedMixtures[0].name = 'Changed catalogue name'; await click('Fit bed'); await click('Refresh area references'); await click('Focus area');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].sowing.mixture.name, 'Cover mix');
  await type('broadcast-density', ''); await click('Fit bed'); await click('Back to garden');
  assert.match(document.body.textContent, /could not be saved/); await click('Discard and return');
});

test('broadcast crops use grams per square metre without a unit selector and quantities follow resizing', async () => {
  await openBed(); await click('Add area'); await choose('area-kind', 'broadcast');
  assert.equal(document.getElementById('broadcast-density-unit'), null);
  assert.ok(document.body.textContent.includes('g/m²'));
  assert.ok(!document.body.textContent.includes('Seeds per m²'));
  await type('broadcast-density', '50');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].densityUnit, 'g_m2');
  assert.equal(document.getElementById('broadcast-total').value, '100');
  const area = globalThis.__editorCanvas.plan.areas[0];
  await act(async () => globalThis.__editorCanvas.onBounds(area.id, { ...area, widthCm: 50 }));
  assert.equal(document.getElementById('broadcast-total').value, '50');
  await click('Summary'); assert.match(document.body.textContent, /Broadcast sowing/); assert.match(document.body.textContent, /50 g/);
});

test('editor calendar preserves invalid drafts, filters other beds activities and retains old record geometry',async()=>{
  await openBed(); await click('Add area'); await type('planting-plant-spacing',''); await click('Calendar');
  assert.ok(document.querySelector('[aria-label="Editor calendar"]'));assert.equal(button('Close calendar'),undefined);await click('Calendar');
  assert.equal(document.getElementById('planting-plant-spacing').value,'');
  assert.equal(button('Apply plan'),undefined);
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:3})]})};
  globalThis.__editorFixture.historyEvents=[{id:'layout-old',gardenId:'garden-a',order:1,date:'2026-01-01',title:'Old layout',notes:'',recordedAt:'2026-01-01T12:00:00Z',sourceVersion:1,actorId:'owner-a',kind:'layout',status:'completed',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[old]}},
    {id:'planned:other',bedId:'other-bed',kind:'planting',status:'planned',date:'2026-02-01',order:2,title:'Other bed',notes:'',recordedAt:'2026-02-01T12:00:00Z'}];
  await click('Calendar');
  assert.equal(button('View planned event: Other bed'),undefined);
  await click('View completed event: Old layout'); assert.equal(globalThis.__editorCanvas.readOnly,true);
  assert.equal(globalThis.__editorCanvas.plan.version,3,'historical geometry is never upgraded to the editable format');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].rowCount,3);
  await click('Calendar'); assert.ok(button('Add area'));
  assert.equal(globalThis.__editorFixture.saves.length,1);
});

test('recording a bed checkpoint keeps its autosaved plan unchanged and is visible in bed history',async()=>{
  await openBed();
  const fixture=globalThis.__editorFixture;
  fixture.historyDocument={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed]};
  await click('Add area');const saved=structuredClone(fixture.saves.at(-1));
  await click('Calendar');await click('Record bed changes');await type('activity-title','Planted this bed');
  await act(async()=>document.getElementById('activity-confirm').click());await click('Record bed changes');
  await click('View completed event: Planted this bed');await click('Delete history entry');await click('Delete entry');
  assert.equal(fixture.historyEvents.length,0);
  await click('Calendar');assert.equal(globalThis.__editorCanvas.plan.areas.length,1);
  assert.deepEqual(fixture.saves.at(-1),saved);assert.equal(button('Apply plan'),undefined);
});

test('expanding a focused area autosaves the changed neighbour in the same garden revision',async()=>{
  await openBed();await click('Add area');await click('Split selected area');
  const fixture=globalThis.__editorFixture;
  const [first,second]=globalThis.__editorCanvas.plan.areas;
  await choose('planting-selected-area',first.id);await click('Focus area');
  const writes=fixture.saves.length,version=fixture.currentGarden.version;
  await act(async()=>globalThis.__editorCanvas.onBounds(first.id,{...first,lengthCm:120}));
  assert.equal(fixture.saves.length,writes+1);
  assert.equal(fixture.currentGarden.version,version+1);
  const saved=fixture.saves.at(-1).beds[0].areaPlan.areas;
  assert.equal(saved[0].lengthCm,120);assert.equal(saved[1].yCm,120);assert.equal(saved[1].lengthCm,80);
  assert.equal(saved[1].rowCount,second.rowCount);
  await act(async()=>globalThis.__editorCanvas.onBounds(first.id,{...first,lengthCm:175}));
  assert.equal(fixture.saves.length,writes+1,'a neighbour with no room for plants rejects the whole resize');
  await click('Fit bed');await click('Back to garden');await click('Edit bed');
  assert.deepEqual(globalThis.__editorCanvas.plan.areas,saved);
});

test('browsing the calendar preserves invalid fields and does not autosave an older format',async()=>{
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:2})]})};
  await openBed(old);const fixture=globalThis.__editorFixture;
  assert.equal(fixture.saves.length,0);
  await click('Areas');await type('planting-plant-spacing','');
  await click('Calendar');
  await click('Calendar');
  assert.equal(fixture.saves.length,0);
  assert.equal(document.getElementById('planting-plant-spacing').value,'');
  await type('planting-plant-spacing','30');await type('planting-row-count','3');
  assert.equal(fixture.saves.length,1);
  assert.equal(fixture.saves[0].beds[0].areaPlan.version,5);
});


test('desktop double-click opens any selected area in the shared editor', async () => {
  await openBed(); await click('Back to garden');
  await act(async () => globalThis.__gardenCanvas.onEditBed(bed.id));
  await click('Add area'); const id = globalThis.__editorCanvas.plan.areas[0].id;
  await act(async () => { globalThis.__editorCanvas.onSelect(id); globalThis.__editorCanvas.onOpenArea({ kind: 'planting', id }); });
  assert.ok(button('Back to garden')); await choose('area-kind', 'broadcast'); await type('broadcast-density', '10'); await click('Add mulch layer');
  assert.equal(globalThis.__editorCanvas.cameraCommand.targetId, id);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].kind, 'broadcast');
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
  await click('Focus area');await click('Reset plant spacing');
  assert.equal(document.getElementById('planting-plant-spacing').value,'30');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].rowCount,2);
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
  assert.ok(!more.textContent.includes('Plant catalogue'));assert.ok(!more.textContent.includes('Mulch catalogue'));
  assert.ok(!more.textContent.includes('Your gardens'));assert.ok(more.textContent.includes('Copy bed'));
  assert.ok(!more.textContent.includes('Help')); assert.ok(!more.textContent.includes('Account'));
  await click('Close');await act(async()=>globalThis.__gardenCanvas.onSelectBed(null));await click('More');await click('Garden settings');
  const edit=document.querySelector('dialog');
  for(const label of ['Share garden','Rename garden','Garden size'])assert.ok([...edit.querySelectorAll('button')].some(item=>item.textContent===label));
  await click('Rename garden');await type('garden-name','Woodland garden');await click('Save name');
  assert.equal(globalThis.__editorFixture.saves.at(-1).name,'Woodland garden');
  await click('More');await click('Garden settings');await click('Garden size');await type('garden-width','600');await click('Update garden');
  assert.equal(globalThis.__editorFixture.saves.at(-1).dimensions.widthCm,600);
});

test('Recap groups plant totals by type, shows area dimensions and updates without making edits',async()=>{
  await openBed();assert.equal(button('Plan'),undefined);await click('Summary');
  assert.match(document.querySelector('aside[aria-label="Bed summary"]').textContent,/No areas yet/);
  await click('Add area');await click('Split selected area');
  await click('Summary');const writes=globalThis.__editorFixture.saves.length;
  const plants=document.querySelector('section[aria-label="Plants by type"]');
  assert.equal(plants.querySelectorAll('li').length,1);
  assert.match(plants.textContent,/Type A.*12 plants · 2 areas/);
  assert.match(document.querySelector('section[aria-label="Planting area recap"]').textContent,/100 × 100 cm/);
  const details=document.querySelector('aside[aria-label="Bed summary"]');
  assert.match(details.textContent,/Bed surface2 m²/);assert.match(details.textContent,/Outside areas0 m²/);
  assert.equal(details.querySelectorAll('input:not([type="date"])').length,0,'Recap only adds the advice date control');
  await click('Areas');assert.equal(document.querySelector('section[aria-label="Area settings"] input[type="checkbox"]'), null);
  await type('planting-plant-spacing','10');await click('Summary');
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
  await click('Summary');const recap=document.querySelector('dialog');
  assert.match(recap.textContent,/Garden summary/);assert.match(recap.textContent,/Garden surface25 m²/);assert.match(recap.textContent,/Beds2/);
  assert.match(recap.textContent,/Total plants24/);assert.match(recap.textContent,/Area occupied by beds4 m²/);
  const totals=recap.querySelector('section[aria-label="Garden plants by type"]');
  assert.match(totals.textContent,/Type A12 plants/);assert.match(totals.textContent,/Type B12 plants/);
  assert.equal(recap.querySelector('input'),null);
  assert.equal(fixture.saves.length,writes,'opening Recap does not change the garden');
});

test('garden Recap shows zero plants while counting beds without planting plans',async()=>{
  await openBed();await click('Back to garden');await click('Summary');
  assert.match(document.querySelector('dialog').textContent,/No plant rows or broadcast sowing in these beds yet/);
  assert.match(document.querySelector('dialog').textContent,/Area occupied by beds2 m²/);
  assert.equal(globalThis.__editorFixture.saves.length,0);
});


test('backdated bed edits include planting and mulch while protecting other beds and the current plan',async()=>{
  await openBed();const fixture=globalThis.__editorFixture;
  const other={...bed,id:'other-bed',name:'Other bed',xCm:150};
  fixture.historyEvents=[{id:'past-layout',gardenId:'garden-a',kind:'layout',status:'completed',eventVersion:1,order:1,date:'2025-01-01',title:'Earlier garden',notes:'',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed,other]}}];
  await click('Calendar');await click('Add past bed edit');assert.ok(button('Save history record'));
  assert.equal(button('Calendar'),undefined);await click('Add area');await click('Add mulch layer');
  await click('Back to garden');
  await act(async()=>{
    globalThis.__gardenCanvas.onMoveBed(other.id,{xCm:300,yCm:0});
    globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:20,yCm:0});
  });
  assert.equal(globalThis.__gardenCanvas.beds.find(item=>item.id===other.id).xCm,150);
  await click('Save history record');await type('history-edit-date','2025-02-01');await click('Save record');
  const recorded=fixture.historyEvents.find(item=>item.kind==='bed');assert.ok(recorded);
  const saved=recorded.document.beds.find(item=>item.id===bed.id);
  assert.equal(saved.xCm,20);assert.equal(saved.areaPlan.areas.length,1);assert.equal(saved.areaPlan.areas[0].mulch.length,1);
  assert.equal(recorded.document.beds.find(item=>item.id===other.id).xCm,150);
  assert.equal(fixture.saves.length,0);
  await click('Return to current plan');await click('Calendar');assert.equal(globalThis.__editorCanvas.plan.areas.length,0);
});

test('historical metadata corrections preserve older planting geometry until planting controls are edited',async()=>{
  await openBed();const fixture=globalThis.__editorFixture;
  const old={...bed,plantingPlan:planV3({areas:[areaV2({rowCount:3})]})};
  fixture.historyEvents=[{id:'old-bed',gardenId:'garden-a',kind:'planting',bedId:bed.id,status:'completed',eventVersion:1,order:1,date:'2025-01-01',title:'Older bed',notes:'',document:{name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[old]}}];
  await click('Calendar');await click('View completed event: Older bed');await click('Edit history record');
  assert.equal(globalThis.__editorCanvas.plan.version,5);
  await click('Settings');await type('bed-name','Earlier name');await click('Save bed');
  await click('Save history record');await click('Save record');
  assert.deepEqual(fixture.historyEvents[0].document.beds[0].plantingPlan,old.plantingPlan);
  await click('Edit history record');await click('Areas');await type('planting-row-count','4');
  assert.equal(globalThis.__editorCanvas.plan.version,5);
});


test('purpose precedes planting method and green manure hides the method while keeping broadcast sowing', async () => {
  await openBed(); await click('Add area'); await click('Add mulch layer');
  const initial = globalThis.__editorCanvas.plan.areas[0];
  assert.deepEqual([...document.getElementById('area-kind').options].map((option) => option.value), ['rows', 'broadcast']);
  assert.equal(document.getElementById('area-kind').value, 'rows');
  assert.equal(document.getElementById('area-purpose').value, 'crop');
  assert.ok(document.getElementById('area-purpose').compareDocumentPosition(document.getElementById('area-kind')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  const writes = globalThis.__editorFixture.saves.length;
  await choose('area-purpose', 'green_manure');
  assert.equal(document.getElementById('area-kind'), null);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].kind, 'broadcast');
  assert.equal([...document.getElementById('area-purpose').options].find((option) => option.value === 'green_manure').textContent, 'Green manure');
  assert.equal(document.body.textContent.includes('(sovescio)'), false);
  assert.equal(globalThis.__editorFixture.saves.length, writes, 'density must be supplied before saving broadcast sowing');
  await type('broadcast-density', '5');
  const broadcast = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(broadcast.id, initial.id); assert.equal(broadcast.widthCm, initial.widthCm); assert.deepEqual(broadcast.mulch, initial.mulch);
  assert.equal(broadcast.purpose, 'green_manure');
  await choose('area-purpose', 'crop');
  assert.equal(document.getElementById('area-kind').value, 'broadcast');
  await choose('area-kind', 'rows');
  const rows = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(rows.kind, 'rows'); assert.equal(rows.purpose, 'crop'); assert.equal(rows.mulch.length, 1);
});


test('areas cannot be created without a catalogue crop or seed mixture', async () => {
  await openBed();
  globalThis.__editorFixture.catalogue.plants = [];
  globalThis.__editorFixture.seedMixtures.length = 0;
  await click('Add area');
  assert.equal(globalThis.__editorCanvas.plan.areas.length, 0);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  assert.match(document.body.textContent, /Add a crop or seed mixture/);
});

test('plant selection chooses a crop first, filters optional cultivars and clears the cultivar when crops change', async () => {
  await openBed(); await click('Add area');
  const catalogue = globalThis.__editorFixture.catalogue;
  catalogue.plants.push({ ...catalogue.plants[0], id: 'type-b', name: 'Type B' });
  const cultivar = { notes: '', version: 2, plantSpacingCm: 20, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null };
  catalogue.cultivars = [{ ...cultivar, id: 'var-a', plantTypeId: 'type-a', name: 'Early A' }, { ...cultivar, id: 'var-b', plantTypeId: 'type-b', name: 'Early B' }];
  await click('Refresh area references');
  assert.deepEqual([...document.getElementById('planting-crop').options].map((option) => option.value), ['type-a', 'type-b']);
  assert.deepEqual([...document.getElementById('planting-cultivar').options].map((option) => option.value), ['', 'var-a']);
  await choose('planting-cultivar', 'var-a');
  let saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.plant.id, 'type-a'); assert.equal(saved.plant.cultivarId, 'var-a'); assert.equal(saved.plantSpacingCm, 20);
  await choose('planting-crop', 'type-b');
  saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.plant.id, 'type-b'); assert.equal(saved.plant.cultivarId, undefined);
  assert.deepEqual([...document.getElementById('planting-cultivar').options].map((option) => option.value), ['', 'var-b']);
  await choose('planting-cultivar', 'var-b');
  catalogue.cultivars = catalogue.cultivars.filter((item) => item.id !== 'var-b'); await click('Refresh area references');
  assert.equal(document.getElementById('planting-cultivar').value, 'var-b');
  assert.match(document.getElementById('planting-cultivar').textContent, /Early B \(saved reference\)/);
  await choose('planting-crop', 'type-a'); await choose('area-kind', 'broadcast');
  await choose('broadcast-cultivar', 'var-a'); await type('broadcast-density', '5');
  saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.sowing.kind, 'crop'); assert.equal(saved.sowing.plant.id, 'type-a'); assert.equal(saved.sowing.plant.cultivarId, 'var-a');
  await choose('broadcast-cultivar', '');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].sowing.plant.cultivarId, undefined);
});

test('green manure offers seed mixtures only, and does not fall back to a crop when no mixtures exist', async () => {
  await openBed(); await click('Add area'); await choose('area-purpose', 'green_manure');
  assert.equal(document.getElementById('seed-mixture').value, 'default-mix');
  for (const id of ['planting-crop', 'planting-cultivar', 'broadcast-crop', 'broadcast-cultivar', 'broadcast-material', 'area-kind']) assert.equal(document.getElementById(id), null);
  await type('broadcast-density', '10');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].sowing.kind, 'mixture');
  await choose('area-purpose', 'crop'); await type('broadcast-density', '10');
  globalThis.__editorFixture.seedMixtures.length = 0; await click('Refresh area references');
  const writes = globalThis.__editorFixture.saves.length;
  await choose('area-purpose', 'green_manure'); await type('broadcast-density', '10');
  assert.equal(document.getElementById('seed-mixture').value, '');
  assert.match(document.body.textContent, /No seed mixtures are available/);
  assert.equal(globalThis.__editorFixture.saves.length, writes);
  assert.equal(document.getElementById('broadcast-crop'), null);
});


test('Harvest crop shows crop and optional cultivar only; mixtures remain exclusive to Green manure', async () => {
  await openBed(); await click('Add area');
  assert.ok(document.getElementById('planting-crop'));
  assert.equal(document.getElementById('seed-mixture'), null);
  await choose('area-kind', 'broadcast');
  assert.ok(document.getElementById('broadcast-crop'));
  assert.equal(document.getElementById('broadcast-material'), null);
  assert.equal(document.getElementById('seed-mixture'), null);
  await type('broadcast-density', '5'); await click('Add mulch layer');
  await choose('area-purpose', 'green_manure'); await type('broadcast-density', '10');
  const mixture = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(mixture.sowing.kind, 'mixture'); assert.ok(document.getElementById('seed-mixture'));
  const writes = globalThis.__editorFixture.saves.length;
  await choose('area-purpose', 'crop');
  assert.equal(document.getElementById('seed-mixture'), null);
  assert.equal(document.getElementById('broadcast-material'), null);
  assert.ok(document.getElementById('broadcast-crop'));
  assert.equal(document.getElementById('broadcast-density').value, '');
  assert.equal(globalThis.__editorFixture.saves.length, writes);
  await type('broadcast-density', '6');
  const crop = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(crop.purpose, 'crop'); assert.equal(crop.sowing.kind, 'crop');
  assert.equal(crop.id, mixture.id); assert.deepEqual(crop.mulch, mixture.mulch);
});

test('editing an older Harvest crop mixture requires choosing a crop and entering its own density', async () => {
  const legacy = { ...areaPlan(broadcast({ purpose: 'crop' })), version: 3 };
  await openBed({ ...bed, areaPlan: legacy }); await click('Areas');
  assert.equal(document.getElementById('broadcast-crop').value, '');
  assert.equal(document.getElementById('seed-mixture'), null);
  assert.equal(document.getElementById('broadcast-material'), null);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  await choose('broadcast-crop', 'type-a');
  assert.equal(document.getElementById('broadcast-density').value, '');
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  await type('broadcast-density', '5');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].sowing.kind, 'crop');
  assert.equal(legacy.areas[0].sowing.kind, 'mixture');
});


test('area names follow crop, optional cultivar and seed mixture selections without a name field', async () => {
  await openBed({ ...bed, areaPlan: areaPlan(rows({ name: 'Old custom name' })) }); await click('Areas');
  const fixture = globalThis.__editorFixture, catalogue = fixture.catalogue;
  catalogue.plants.push({ ...catalogue.plants[0], id: 'type-b', name: 'Type B' });
  catalogue.cultivars = [{ id: 'var-a', plantTypeId: 'type-a', name: 'Early A', notes: '', version: 1, plantSpacingCm: null, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null }];
  fixture.seedMixtures.push({ ...fixture.seedMixtures[0], id: 'second-mix', name: 'Second mixture' });
  await click('Refresh area references'); await click('Focus area');
  assert.equal(document.getElementById('area-name'), null);
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Type A/);
  await choose('planting-cultivar', 'var-a');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Early A/);
  await choose('planting-cultivar', '');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Type A/);
  await choose('planting-crop', 'type-b');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Type B/);
  await choose('area-purpose', 'green_manure'); await type('broadcast-density', '10');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Demo mixture/);
  await choose('seed-mixture', 'second-mix');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Second mixture/);
  assert.equal(document.getElementById('area-name'), null);
  await click('Fit bed');
  assert.match(document.getElementById('planting-selected-area').textContent, /Second mixture/);
  assert.ok(!document.body.textContent.includes('Old custom name'));
  await click('Summary'); assert.match(document.body.textContent, /Second mixture/);
  await click('Back to garden'); await click('Edit bed'); await click('Areas'); await click('Focus area');
  assert.match(document.getElementById('planting-selected-area').selectedOptions[0].textContent, /Second mixture/);
});


test('adjacent areas retain all their plants without a cross-area spacing control or override warning', async () => {
  const first = rows({ widthCm: 50, rowCount: 1, rowSpacingCm: 100, plant: { ...snapshot, rowSpacingCm: 100, borderDistanceCm: 15 } });
  const second = { ...structuredClone(first), id: 'second', xCm: 50 };
  await openBed({ ...bed, areaPlan: areaPlan(first, second) }); await click('Areas');
  assert.equal(document.querySelector('section[aria-label="Area settings"] input[type="checkbox"]'), null);
  assert.ok(!document.body.textContent.includes('Keep spacing between areas'));
  await click('Summary');
  assert.match(document.querySelector('section[aria-label="Plants by type"]').textContent, /12 plants · 2 areas/);
  assert.ok(!document.body.textContent.includes('Spacing checks between different areas are overridden'));
  assert.equal(globalThis.__editorFixture.saves.length, 0);
});


test('area settings contain fields and validation without explanatory paragraphs', async () => {
  await openBed(); await click('Add area'); await click('Focus area');
  const controls = () => document.querySelector('aside[aria-label="Areas"]');
  assert.ok(document.getElementById('area-purpose'));
  assert.ok(document.getElementById('planting-crop'));
  assert.ok(document.getElementById('planting-row-count'));
  assert.equal([...controls().querySelectorAll('p')].filter(p => !p.closest('details')).length, 0);
  for (const text of ['Measurements and resizing stay', 'Saved reference:', 'Minimum clearances:', 'Grid spacing:', 'Your chosen rows', 'Custom spacing overrides']) assert.ok(!document.body.textContent.includes(text));
  const writes = globalThis.__editorFixture.saves.length;
  await type('planting-plant-spacing', '');
  assert.equal(globalThis.__editorFixture.saves.length, writes);
  assert.ok([...document.querySelectorAll('[role="alert"]')].some((element) => /spacing/.test(element.textContent)));
  await type('planting-plant-spacing', '30');
  await choose('area-purpose', 'green_manure'); await type('broadcast-density', '10');
  assert.ok(document.getElementById('seed-mixture'));
  assert.equal(document.getElementById('broadcast-total').readOnly, true);
  assert.equal(document.getElementById('broadcast-total').value, '20');
  assert.equal(document.getElementById('broadcast-component-0').readOnly, true);
  assert.equal(document.getElementById('broadcast-component-0').value, '20');
  assert.equal([...controls().querySelectorAll('p')].filter(p => !p.closest('details')).length, 0);
  for (const text of ['Mixture proportions are by weight', 'Green manure is grown for the soil', 'No mulch on this area']) assert.ok(!controls().textContent.includes(text));
});

function suggestionOptions() {
  const crop = (id, name) => ({ id, name, familyId: 'family-a', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40, borderDistanceCm: 15 });
  return {
    location: { countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' },
    catalogue: { isAdmin: false, families: [{ id: 'family-a', name: 'Family A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40 }], plants: [crop('type-a', 'Type A'), crop('type-b', 'Type B')], rules: [] },
    references: { plant_cultivars: [], plant_guidance: [], plant_depths: [], rotation_rules: [], mulch_categories: [], plant_types: [], plant_families: [], isAdmin: false,
      calendar_profiles: [{ id: 'profile', name: 'Regional', code: 'regional', version: 1 }], calendar_coverage: [{ id: 'coverage', country_code: 'IT', region_code: 'IT-25', calendar_profile_id: 'profile' }],
      plant_calendar_entries: ['type-a', 'type-b'].map((id) => ({ id, plant_type_id: id, cultivar_id: null, calendar_profile_id: 'profile', activity: 'direct_sowing', planting_method: 'seed', notes: '' })),
      calendar_windows: ['type-a', 'type-b'].map((id) => ({ id, calendar_entry_id: id, start_month: 10, end_month: 2 })) },
  };
}
const suggestionsPanel = () => document.querySelector('section[aria-label="Suggestions"]');
async function useSuggested(label) {
  const card = [...suggestionsPanel().querySelectorAll('article')].find((a) => a.querySelector('h5').textContent === label);
  assert.ok(card, `Missing suggestion ${label}`);
  await act(async () => card.querySelector('button').click());
}

test('automatic suggestions are read-only until chosen and apply atomically with geometry and mulch preserved', async () => {
  const original = rows({ mulch: [{ id: 'layer', material: straw }] });
  await openBed({ ...bed, areaPlan: areaPlan(original) }, suggestionOptions()); await click('Suggestions');
  assert.ok(suggestionsPanel()); assert.match(suggestionsPanel().textContent, /Lombardia/);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  const reads = globalThis.__editorFixture.suggestionReads;
  await useSuggested('Type B');
  const saved = globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0];
  assert.equal(saved.plant.id, 'type-b'); assert.equal(saved.id, original.id);
  for (const key of ['xCm', 'yCm', 'widthCm', 'lengthCm']) assert.equal(saved[key], original[key]);
  assert.deepEqual(saved.mulch, original.mulch);
  assert.equal(globalThis.__editorFixture.saves.length, 1);
  assert.equal(globalThis.__editorFixture.suggestionReads, reads, 'plan edits recompute locally');
  assert.equal(globalThis.__editorFixture.eventWrites, undefined);
  await click('Focus area');
  assert.ok(suggestionsPanel()); assert.match(suggestionsPanel().textContent, /Your current selection · Type B/);
});

test('advice date changes update seasonal results without saving or fetching and Today restores the local date', async () => {
  await openBed({ ...bed, areaPlan: areaPlan(rows()) }, suggestionOptions()); await click('Suggestions');
  const reads = globalThis.__editorFixture.suggestionReads;
  const dateId = suggestionsPanel().querySelector('input[type="date"]').id;
  await type(dateId, '2027-07-01');
  assert.match(suggestionsPanel().textContent, /Outside the recorded sowing/);
  await type(dateId, '2027-11-01'); assert.match(suggestionsPanel().textContent, /In the regional calendar window/);
  assert.equal(globalThis.__editorFixture.suggestionReads, reads); assert.equal(globalThis.__editorFixture.saves.length, 0);
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  assert.equal(suggestionsPanel().querySelector('input').value, '2027-11-01', 'focus preserves explicit date');
  assert.equal(globalThis.__editorFixture.suggestionReads, reads + 1);
  await click('Today');
  const today = new Date();
  assert.equal(suggestionsPanel().querySelector('input').value, `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
});

test('green-manure suggestions require an explicit density before autosave', async () => {
  const original = rows({ mulch: [{ id: 'layer', material: straw }] });
  await openBed({ ...bed, areaPlan: areaPlan(original) }, suggestionOptions()); await click('Suggestions');
  await useSuggested('Demo mixture');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].purpose, 'green_manure');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].kind, 'broadcast');
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  assert.match(document.body.textContent, /sowing density/);
  await click('Areas'); await type('broadcast-density', '10');
  assert.equal(globalThis.__editorFixture.saves.length, 1);
  const saved = globalThis.__editorFixture.saves[0].beds[0].areaPlan.areas[0];
  assert.equal(saved.sowing.mixture.id, 'default-mix'); assert.equal(saved.density, 10);
  assert.deepEqual(saved.mulch, original.mulch); assert.equal(saved.id, original.id);
});

test('suggestion failures retry independently without blocking editing or claiming safe rotation', async () => {
  await openBed({ ...bed, areaPlan: areaPlan(rows()) }, { ...suggestionOptions(),
    referenceLoad: async () => { throw Error('Reference offline'); }, suggestionHistoryLoad: async () => { throw Error('History offline'); } });
  await click('Suggestions');
  assert.match(suggestionsPanel().textContent, /Reference guidance could not be loaded/);
  assert.match(suggestionsPanel().textContent, /Rotation advice is unavailable/);
  assert.ok(!suggestionsPanel().textContent.includes('Some of this ground has no recorded'));
  await click('Areas'); await type('planting-row-count', '3'); await click('Suggestions'); assert.equal(globalThis.__editorFixture.saves.length, 1);
  delete globalThis.__editorFixture.referenceLoad; delete globalThis.__editorFixture.suggestionHistoryLoad;
  await click('Retry suggestions');
  assert.ok(!suggestionsPanel().textContent.includes('could not be loaded'));
  assert.match(suggestionsPanel().textContent, /Some of this ground has no recorded/);
  assert.equal(globalThis.__editorFixture.saves.length, 1);
});

test('returning from history refreshes suggestions, including corrected and deleted observations', async () => {
  await openBed({ ...bed, areaPlan: areaPlan(rows()) }, suggestionOptions()); await click('Suggestions');
  const fixture = globalThis.__editorFixture;
  fixture.historyEvents = [{ id: 'past', date: '2020-01-01', order: 1, title: 'Recorded crop', notes: '', status: 'completed', kind: 'layout',
    document: { name: 'Garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [{ ...bed, areaPlan: areaPlan(rows({ plant: { ...snapshot, name: 'Old crop' } })) }] } }];
  await click('Calendar'); await click('Calendar');
  assert.match(suggestionsPanel().textContent, /Old crop recorded on 2020-01-01/);
  fixture.historyEvents[0].document.beds[0].areaPlan.areas[0].plant.name = 'Corrected crop';
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  assert.match(suggestionsPanel().textContent, /Corrected crop recorded/);
  fixture.historyEvents = [];
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  assert.ok(!suggestionsPanel().textContent.includes('Corrected crop recorded'));
  assert.equal(fixture.saves.length, 0);
});

test('late suggestion responses after leaving the editor cannot replace the next garden state', async () => {
  let finish;
  await openBed({ ...bed, areaPlan: areaPlan(rows()) }, { ...suggestionOptions(), suggestionHistoryLoad: () => new Promise((resolve) => { finish = resolve; }) });
  await click('Back to garden');
  await act(async () => finish([]));
  assert.equal(suggestionsPanel(), null); assert.equal(globalThis.__editorFixture.saves.length, 0);
});

test('automatic advice date advances at midnight while an explicit planning date stays fixed', async () => {
  const NativeDate = globalThis.Date, nativeTimeout = globalThis.setTimeout;
  let now = new NativeDate(2026, 10, 18, 23, 59, 59).getTime();
  const scheduled = [];
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = nativeTimeout(callback, delay, ...args);
    if (delay >= 1000) scheduled.push({ callback, timer });
    return timer;
  };
  try {
    await openBed({ ...bed, areaPlan: areaPlan(rows()) }, suggestionOptions()); await click('Suggestions');
    assert.equal(suggestionsPanel().querySelector('input').value, '2026-11-18');
    now = new NativeDate(2026, 10, 19, 0, 0, 0).getTime();
    const midnight = scheduled.at(-1); clearTimeout(midnight.timer);
    await act(async () => midnight.callback());
    assert.equal(suggestionsPanel().querySelector('input').value, '2026-11-19');
    await type(suggestionsPanel().querySelector('input').id, '2027-04-01');
    now = new NativeDate(2026, 10, 20, 0, 0, 0).getTime();
    const nextMidnight = scheduled.at(-1); clearTimeout(nextMidnight.timer);
    await act(async () => nextMidnight.callback());
    assert.equal(suggestionsPanel().querySelector('input').value, '2027-04-01');
    assert.equal(globalThis.__editorFixture.saves.length, 0);
  } finally {
    globalThis.Date = NativeDate; globalThis.setTimeout = nativeTimeout;
    for (const { timer } of scheduled) clearTimeout(timer);
  }
});

test('area deletion and confirmed clearing can restore complete planting and mulch snapshots', async () => {
  await openBed(); await click('Add area'); await click('Add mulch layer');
  const original = structuredClone(globalThis.__editorCanvas.plan);
  await click('Remove selected area');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 0);
  await click('Undo');
  assert.deepEqual(globalThis.__editorCanvas.plan, original);
  assert.deepEqual(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan, original);
  const count = globalThis.__editorFixture.saves.length;
  await click('Clear area plan');
  assert.equal(globalThis.__editorFixture.saves.length, count, 'opening confirmation does not clear');
  await click('Keep areas');
  assert.deepEqual(globalThis.__editorCanvas.plan, original);
  await click('Clear area plan'); await click('Clear all areas');
  assert.equal(globalThis.__editorCanvas.plan.areas.length, 0);
  await click('Undo'); assert.deepEqual(globalThis.__editorCanvas.plan, original);
});

test('undoing a zoomed area keeps the bed page usable', async () => {
  await openBed(); await click('Add area'); await click('Focus area');
  assert.ok(button('Fit bed'));
  await click('Undo');
  assert.ok(button('Back to garden'));
  assert.equal(globalThis.__editorCanvas.plan.areas.length, 0);
  assert.equal(button('Undo').disabled, true);
});

test('mobile panel toggles expose the actual expanded state and an explicit selected-area edit action', async () => {
  await openBed({ ...bed, plantingPlan: planV5() });
  assert.equal(button('Areas').getAttribute('aria-expanded'), 'false');
  assert.equal(button('Areas').getAttribute('aria-pressed'), 'false');
  await click('Edit selected area');
  assert.equal(button('Areas').getAttribute('aria-expanded'), 'true');
  assert.equal(button('Areas').getAttribute('aria-controls'), 'bed-inspector');
  await click('Hide controls');
  assert.equal(button('Areas').getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, button('Areas'));
});

test('numeric geometry rejects overflow and off-grid input and saves valid positions through the usual queue', async () => {
  await openBed(); await click('Settings');
  await type('bed-position-xCm', '450'); await click('Update position');
  assert.match(document.body.textContent, /extend outside the garden/);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  await type('bed-position-xCm', '101'); await click('Update position');
  assert.match(document.body.textContent, /multiples of 5 cm/);
  await type('bed-position-xCm', '100'); await click('Update position');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].xCm, 100);
  await click('Back to garden'); await click('Undo');
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 0);
  await click('Select fixture bed'); await click('Edit bed'); await click('Add area');
  await type('area-bounds-xCm', '25'); await click('Update area bounds');
  assert.match(document.body.textContent, /extend outside the bed/);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].xCm, 0);
  await type('area-bounds-xCm', '0'); await type('area-bounds-lengthCm', '150'); await click('Update area bounds');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].lengthCm, 150);
  await click('Undo'); assert.equal(globalThis.__editorCanvas.plan.areas[0].lengthCm, 200);
});

test('garden deletion undo preserves a complete bed and queues restoration behind a pending delete save', async () => {
  await openBed({ ...bed, plantingPlan: planV5(), mulchPlan: mulchPlan() }); await click('Back to garden');
  const original = structuredClone(globalThis.__gardenCanvas.beds[0]);
  let release;
  globalThis.__editorFixture.save = () => new Promise(resolve => { release = resolve; });
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })));
  assert.equal(globalThis.__gardenCanvas.beds.length, 0);
  await click('Undo');
  assert.deepEqual(globalThis.__gardenCanvas.beds[0], original);
  globalThis.__editorFixture.save = async () => {};
  await act(async () => release());
  assert.deepEqual(globalThis.__editorFixture.saves.at(-1).beds[0], original);
  assert.equal(button('Undo').disabled, true, 'undo stays in the header without changing layout when exhausted');
});


test('selecting a garden bed replaces one toolbar action without adding a row or opening an editor', async () => {
  await openBed(); await click('Back to garden');
  await act(async()=>globalThis.__gardenCanvas.onSelectBed(null));
  const footer=document.querySelector('footer'); const canvasButton=button('Select fixture bed');
  assert.deepEqual([...footer.querySelectorAll('button')].map(item=>item.textContent),['Add bed','Summary','Calendar','More']);
  const row=footer.firstElementChild;
  assert.equal(button('Resize bed'), undefined);
  await click('Select fixture bed');
  assert.equal(document.querySelector('footer'),footer); assert.equal(footer.firstElementChild,row);
  assert.equal(row.children.length,1); assert.equal(document.querySelector('dialog'),null);
  assert.equal(button('Resize bed').disabled, false);
  assert.deepEqual([...footer.querySelectorAll('button')].map(item=>item.textContent),['Edit bed','Resize bed','Bed summary','Calendar','More']);
  assert.equal(button('Select fixture bed'),canvasButton); assert.equal(document.querySelector('[data-testid="bed-canvas"]'),null);
  await act(async()=>globalThis.__gardenCanvas.onSelectBed(null));
  assert.equal(footer.firstElementChild,row); assert.ok(button('Summary'));
});

test('explicit area resize survives adjustments and ends on Done, deselection, undo and redo', async () => {
  await openBed({ ...bed, areaPlan: areaPlan(rows({ id: 'resize-area' })) });
  assert.equal(globalThis.__editorCanvas.resizing, false);
  await click('Resize area'); assert.equal(globalThis.__editorCanvas.resizing, true);
  const area = globalThis.__editorCanvas.plan.areas[0];
  await act(async () => globalThis.__editorCanvas.onBounds(area.id, { ...area, widthCm: area.widthCm - 5 }));
  assert.equal(globalThis.__editorCanvas.resizing, true);
  assert.equal(globalThis.__editorCanvas.plan.areas[0].widthCm, area.widthCm - 5);
  await click('Done resizing'); assert.equal(globalThis.__editorCanvas.resizing, false);
  await click('Resize area'); await act(async () => globalThis.__editorCanvas.onSelect(null));
  assert.equal(globalThis.__editorCanvas.resizing, false);
  await click('Undo'); assert.equal(globalThis.__editorCanvas.resizing, false);
  assert.equal(button('Redo').disabled, false);
  await click('Redo'); assert.equal(globalThis.__editorCanvas.resizing, false);
  await act(async () => globalThis.__editorCanvas.onSelect('resize-area'));
  await click('Pan view'); assert.equal(globalThis.__editorCanvas.panning, true);
  await click('Resize area');
  assert.equal(globalThis.__editorCanvas.panning, false); assert.equal(globalThis.__editorCanvas.resizing, true);
  await click('Pan view'); assert.equal(globalThis.__editorCanvas.resizing, false);
  await click('Edit selected area'); assert.equal(globalThis.__editorCanvas.panning, false);
});

test('creating an area starts resizing; focused editor shares mode and visible redo', async () => {
  await openBed(); await click('Add area');
  assert.equal(globalThis.__editorCanvas.resizing, true);
  const id = globalThis.__editorCanvas.selectedId;
  await act(async () => globalThis.__editorCanvas.onOpenArea({ kind: 'planting', id }));
  assert.equal(globalThis.__editorCanvas.resizing, true);
  await click('Done resizing'); assert.equal(globalThis.__editorCanvas.resizing, false);
  assert.ok(button('Redo')); assert.equal(button('Redo').disabled, true);
  await click('Undo'); assert.ok(button('Back to garden'));
  await click('Redo'); assert.equal(globalThis.__editorCanvas.resizing, false);
});

test('bed selection needs explicit Resize and a newly created bed starts resizing', async () => {
  await openBed(); await click('Back to garden');
  assert.equal(globalThis.__gardenCanvas.resizing, false);
  await click('Resize bed');
  assert.equal(globalThis.__gardenCanvas.resizing, true);
  await click('Done resizing'); assert.equal(globalThis.__gardenCanvas.resizing, false);
  await click('Add bed'); await type('bed-name', 'New bed'); await type('bed-width', '50'); await type('bed-length', '50');
  const submit = document.querySelector('dialog button[type="submit"]'); assert.ok(submit);
  await act(async () => submit.click());
  assert.equal(globalThis.__gardenCanvas.resizing, true);
  assert.equal(globalThis.__gardenCanvas.beds.find(item => item.id === globalThis.__gardenCanvas.selectedBedId).name, 'New bed');
  await click('Undo'); assert.equal(globalThis.__gardenCanvas.resizing, false);
  assert.equal(globalThis.__gardenCanvas.beds.length, 1);
  await click('Redo'); assert.equal(globalThis.__gardenCanvas.resizing, false);
  assert.equal(globalThis.__gardenCanvas.beds.length, 2);
});

test('family filtering narrows crop choices without editing planting and works in focused row and broadcast editors', async () => {
  await openBed(); await click('Add area');
  const catalogue = globalThis.__editorFixture.catalogue;
  catalogue.families.push({ ...catalogue.families[0], id: 'family-b', name: 'Family B' }, { ...catalogue.families[0], id: 'family-empty', name: 'Empty family' });
  catalogue.plants.push({ ...catalogue.plants[0], id: 'type-b', name: 'Type B', familyId: 'family-b' });
  catalogue.cultivars = [{ id: 'var-b', plantTypeId: 'type-b', name: 'Early B', version: 1, notes: '', plantSpacingCm: 20, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null }];
  await click('Refresh area references');
  const count = globalThis.__editorFixture.saves.length;
  await choose('planting-family', 'family-b');
  assert.deepEqual([...document.getElementById('planting-crop').options].map(option => option.value), ['', 'type-b']);
  assert.match(document.body.textContent, /Current planting: Type A/);
  assert.equal(globalThis.__editorFixture.saves.length, count);
  await choose('planting-crop', 'type-b'); await choose('planting-cultivar', 'var-b');
  let area = globalThis.__editorCanvas.plan.areas[0];
  assert.equal(area.plant.id, 'type-b'); assert.equal(area.plant.cultivarId, 'var-b');
  assert.equal(area.plantSpacingCm, 20);
  const savedCount = globalThis.__editorFixture.saves.length;
  await choose('planting-family', 'family-empty'); assert.match(document.body.textContent, /No crops in this family/);
  assert.equal(document.getElementById('planting-cultivar'), null);
  assert.equal(globalThis.__editorFixture.saves.length, savedCount);
  await choose('planting-family', ''); assert.equal(document.getElementById('planting-crop').value, 'type-b');
  await click('Focus area'); await choose('planting-family', 'family-a');
  assert.deepEqual([...document.getElementById('planting-crop').options].map(option => option.value), ['', 'type-a']);
  await choose('planting-crop', 'type-a');
  assert.equal(globalThis.__editorCanvas.plan.areas[0].plant.cultivarId, undefined);
  await choose('area-kind', 'broadcast'); await choose('broadcast-family', 'family-b');
  assert.deepEqual([...document.getElementById('broadcast-crop').options].map(option => option.value), ['', 'type-b']);
  await choose('broadcast-crop', 'type-b'); await choose('broadcast-cultivar', 'var-b'); await type('broadcast-density', '5');
  area = globalThis.__editorCanvas.plan.areas[0];
  assert.equal(area.sowing.plant.id, 'type-b'); assert.equal(area.sowing.plant.cultivarId, 'var-b');
});

test('family filtering retains saved references and safely resets when the selected family disappears', async () => {
  await openBed(); await click('Add area');
  const catalogue = globalThis.__editorFixture.catalogue;
  catalogue.plants = []; await click('Refresh area references');
  assert.match(document.getElementById('planting-crop').textContent, /Type A \(saved reference\)/);
  const count = globalThis.__editorFixture.saves.length;
  await choose('planting-family', 'family-a'); assert.match(document.body.textContent, /Current planting: Type A/);
  catalogue.families = []; await click('Refresh area references');
  assert.equal(document.getElementById('planting-family').value, '');
  assert.equal(document.getElementById('planting-crop').value, 'type-a');
  assert.equal(globalThis.__editorFixture.saves.length, count);
});

test('removing a seed mixture keeps its saved plan reference visible without editing the bed', async () => {
  await openBed(); await click('Add area'); await choose('area-purpose', 'green_manure'); await type('broadcast-density', '5');
  const before = structuredClone(globalThis.__editorCanvas.plan), count = globalThis.__editorFixture.saves.length;
  globalThis.__editorFixture.seedMixtures = []; await click('Refresh area references');
  assert.equal(document.getElementById('seed-mixture').value, 'default-mix');
  assert.match(document.getElementById('seed-mixture').textContent, /Demo mixture \(saved reference\)/);
  assert.doesNotMatch(document.body.textContent, /No seed mixtures are available/);
  assert.deepEqual(globalThis.__editorCanvas.plan, before); assert.equal(globalThis.__editorFixture.saves.length, count);
});

test('advice is separate from editable settings and retains the planning date across panels and selections', async () => {
  const first = rows({ id: 'first', widthCm: 50 }), second = rows({ id: 'second', xCm: 50, widthCm: 50 });
  await openBed({ ...bed, areaPlan: areaPlan(first, second) }, suggestionOptions()); await click('Areas');
  assert.ok(document.getElementById('planting-crop')); assert.equal(suggestionsPanel(), null);
  const canvas = document.querySelector('[data-testid="bed-canvas"]'), resize = button('Resize area'), focus = button('Focus area');
  await click('Suggestions');
  assert.ok(suggestionsPanel()); assert.equal(document.getElementById('planting-crop'), null);
  await type(suggestionsPanel().querySelector('input[type="date"]').id, '2027-04-01');
  await act(async () => globalThis.__editorCanvas.onSelect(second.id));
  assert.ok(suggestionsPanel()); assert.equal(suggestionsPanel().querySelector('input').value, '2027-04-01');
  await click('Areas'); assert.equal(suggestionsPanel(), null);
  await act(async () => globalThis.__editorCanvas.onSelect(null));
  assert.equal(button('Resize area'), resize); assert.equal(resize.disabled, true);
  assert.equal(button('Focus area'), focus); assert.equal(focus.disabled, true);
  await act(async () => globalThis.__editorCanvas.onSelect(first.id));
  assert.equal(resize.disabled, false); assert.equal(focus.disabled, false);
  await click('Summary'); assert.equal(suggestionsPanel(), null);
  await click('Settings'); assert.equal(suggestionsPanel(), null);
  await click('Suggestions'); assert.equal(suggestionsPanel().querySelector('input').value, '2027-04-01');
  assert.equal(document.querySelector('[data-testid="bed-canvas"]'), canvas);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
});

test('garden saving feedback stays outside the selector and clears after saving or a successful retry', async () => {
  await openBed(); await click('Back to garden');
  const selector = document.querySelector('button[title="Choose garden"]');
  const status = () => [...document.querySelectorAll('[role="status"]')].find(item => item.textContent === 'Saving…');
  assert.equal(status(), undefined); assert.ok(!document.body.textContent.includes('Saved'));
  let finish;
  globalThis.__editorFixture.save = () => new Promise(resolve => { finish = resolve; });
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 50, yCm: 0 }));
  assert.ok(status()); assert.equal(status().closest('header'), null);
  assert.ok(!selector.textContent.includes('Saving')); assert.equal(document.querySelector('button[title="Choose garden"]'), selector);
  await act(async () => finish()); assert.equal(status(), undefined);
  assert.ok(!document.body.textContent.includes('Saved'));
  globalThis.__editorFixture.save = async () => { throw Error('Offline fixture'); };
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 75, yCm: 0 }));
  const error = document.querySelector('[role="alert"]');
  assert.match(error.textContent, /current changes are not saved/); assert.equal(error.closest('header'), null);
  assert.ok(!selector.textContent.includes('not saved')); assert.equal(status(), undefined);
  globalThis.__editorFixture.save = async () => {};
  await click('Retry save'); assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(status(), undefined); assert.ok(!document.body.textContent.includes('Saved'));
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].xCm, 75);
});


test('garden resizing updates all areas atomically, preserves minimum rows and restores complete snapshots with Undo/Redo', async () => {
  const original = { ...bed, areaPlan: areaPlan(rows({ widthCm: 50, mulch: [{ id: 'layer', material: straw }] }), rows({ id: 'second', xCm: 50, widthCm: 50 })) };
  await openBed(original); await click('Back to garden');
  await act(async () => globalThis.__gardenCanvas.onResizeBed(bed.id, { ...bed, widthCm: 80, lengthCm: 100 }));
  const resized = structuredClone(globalThis.__editorFixture.saves.at(-1).beds[0]);
  assert.equal(globalThis.__editorFixture.saves.length, 1); assert.deepEqual(resized.areaPlan.areas.map(a => [a.xCm, a.widthCm, a.lengthCm, a.rowCount]), [[0,40,100,2],[40,40,100,2]]);
  assert.deepEqual(resized.areaPlan.areas[0].mulch, original.areaPlan.areas[0].mulch);
  await click('Undo'); assert.deepEqual(globalThis.__gardenCanvas.beds[0], original);
  await click('Redo'); assert.deepEqual(globalThis.__gardenCanvas.beds[0], resized);
  const writes = globalThis.__editorFixture.saves.length;
  await act(async () => globalThis.__gardenCanvas.onResizeBed(bed.id, { ...bed, widthCm: 60, lengthCm: 100 }));
  assert.equal(globalThis.__editorFixture.saves.length, writes); assert.deepEqual(globalThis.__gardenCanvas.beds[0], resized);
  assert.equal(globalThis.__editorFixture.historyEvents?.length ?? 0, 0);
});

test('garden and bed actions stay separate and general Help/Account live in the top-right Menu', async () => {
  await openBed(); await click('Back to garden');
  await act(async () => globalThis.__gardenCanvas.onSelectBed(null));
  const toolbar = () => [...document.querySelectorAll('footer button')].map(b => b.textContent);
  assert.deepEqual(toolbar(), ['Add bed','Summary','Calendar','More']);
  await click('More'); let dialog = document.querySelector('dialog');
  assert.ok(button('Garden settings')); assert.ok(button('Paste bed')); assert.equal(button('Copy bed'), undefined);
  assert.ok(!dialog.textContent.includes('Help')); assert.ok(!dialog.textContent.includes('Account')); await click('Close');
  await click('Select fixture bed'); assert.deepEqual(toolbar(), ['Edit bed','Resize bed','Bed summary','Calendar','More']);
  await click('More'); dialog = document.querySelector('dialog');
  assert.ok(button('Copy bed')); assert.ok(button('Delete bed')); assert.equal(button('Garden settings'), undefined); assert.equal(button('Paste bed'), undefined);
  await click('Close'); await click('App menu'); assert.ok(button('Help')); assert.ok(button('Account')); assert.equal(button('Copy bed'), undefined);
  assert.equal(document.querySelectorAll('dialog button[aria-label^="Switch to"]').length, 0);
  assert.ok(document.querySelector('header[data-page-header] button[aria-label^="Switch to"]'));
  await click('Help'); assert.match(document.querySelector('dialog').textContent, /How to use Myco/); await click('Close');
});

test('global Account checks protect an invalid bed draft and wait for the garden save queue', async () => {
  await openBed(); await act(async () => root.unmount());
  function Probe() { globalThis.__signOutCheck = useWorkspaceNavigation().beforeSignOut; return null; }
  root = createRoot(document.getElementById('root'));
  const garden = { id:'garden-a',ownerId:'owner-a',name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[bed],version:1,updatedAt:'2026-01-01' };
  await act(async () => root.render(createElement(WorkspaceNavigation, { destination:'gardens', user:{id:'owner-a'}, onNavigate() {} },
    createElement(Probe), createElement(GardenPage, { user:{id:'owner-a'}, garden, onSaved() {}, onChooseGardens() {}, pickerOpen:false, onReload:async()=>{}, onDiscardChanges() {} }))));
  await click('Select fixture bed'); await click('Edit bed'); await click('Add area'); await type('planting-plant-spacing','');
  assert.match(await globalThis.__signOutCheck(), /Complete or discard/);
  await type('planting-plant-spacing','30'); await click('Back to garden');
  let finish; globalThis.__editorFixture.save=()=>new Promise(resolve=>{finish=resolve;});
  await act(async()=>globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:50,yCm:0}));
  let finished=false; const checking=globalThis.__signOutCheck().then(value=>{finished=true;return value;});
  await Promise.resolve(); assert.equal(finished,false);
  await act(async()=>finish()); assert.equal(await checking,null);
});

test('bed More uses the name and dimensions only in its dialog title', async () => {
  await openBed();await click('Back to garden');await click('More');
  const dialog=document.querySelector('dialog');
  assert.equal(dialog.querySelector('h2').textContent,`${bed.name} · ${bed.widthCm} × ${bed.lengthCm} cm`);
  assert.equal(dialog.textContent.split(bed.name).length-1,1);
});

test('editor Calendar opens beside selected beds and full calendar waits for pending saves', async () => {
  let opened=0,finish;
  await openBed(bed,{onOpenCalendar:()=>opened++});await click('Back to garden');
  assert.ok(button('Calendar'));await click('More');assert.equal(document.querySelector('dialog').textContent.includes('Calendar'),false);await click('Close');
  await click('Calendar');assert.ok(document.querySelector('[aria-label="Editor calendar"]'));await click('Close calendar');
  globalThis.__editorFixture.save=()=>new Promise(resolve=>{finish=resolve;});
  await act(async()=>globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:50,yCm:0}));
  await click('Calendar');assert.equal(opened,0);await act(async()=>finish());await click('Open full calendar');assert.equal(opened,1);
  await click('App menu');assert.equal(document.querySelector('dialog').textContent.includes('Calendar'),false);
});

test('garden deletion confirms the named garden, supports cancellation, blocks duplicate requests and retains failures', async () => {
  let calls=0,finish;
  await openBed(bed,{onDeleteGarden:async current=>{calls++;assert.equal(current.id,'garden-a');await new Promise((resolve,reject)=>{finish={resolve,reject};});}});
  await click('Back to garden');await act(async()=>globalThis.__gardenCanvas.onSelectBed(null));
  await click('More');await click('Delete garden');
  assert.equal(calls,0);assert.match(document.querySelector('dialog h2').textContent,/Delete “Garden”/);
  await click('Keep garden');assert.equal(calls,0);
  await click('More');await click('Delete garden');await click('Delete garden');
  assert.equal(calls,1);assert.equal(button('Close').disabled,true);assert.equal(button('Keep garden').disabled,true);
  await act(async()=>button('Deleting…').click());assert.equal(calls,1);
  await act(async()=>finish.reject(Error('Network failed')));
  assert.match(document.querySelector('[role="alert"]').textContent,/Check your connection/);assert.equal(button('Close').disabled,false);
  await click('Delete garden');assert.equal(calls,2);await act(async()=>finish.resolve());
});

test('garden deletion waits for saves and passes the latest revision; shared editors cannot delete', async () => {
  let finish,deleted;
  await openBed(bed,{onDeleteGarden:async current=>{deleted=current;}});await click('Back to garden');
  await act(async()=>globalThis.__gardenCanvas.onSelectBed(null));
  globalThis.__editorFixture.save=()=>new Promise(resolve=>{finish=resolve;});
  await act(async()=>globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:50,yCm:0}));
  await click('More');await click('Delete garden');await click('Delete garden');assert.equal(deleted,undefined);
  await act(async()=>finish());assert.equal(deleted.version,2);assert.equal(deleted.beds[0].xCm,50);
  await click('Close');await act(async()=>root.unmount());root=null;
  await openBed(bed,{onDeleteGarden:async()=>{throw Error('unexpected');}});
  // The owner identity comes from the garden document; render the actual page as a shared editor.
  await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(createElement(GardenPage,{user:{id:'editor'},garden:{id:'garden-a',ownerId:'owner-a',name:'Shared',dimensions:{widthCm:500,lengthCm:500},beds:[bed],version:1,updatedAt:'2026-01-01'},onSaved(){},onChooseGardens(){},pickerOpen:false,onReload:async()=>{},onDiscardChanges(){},onDeleteGarden:async()=>{throw Error('unexpected');}})));
  await click('More');assert.equal(button('Delete garden'),undefined);
});

test('garden navigation controls focus the selection without writes and switch Pan and Resize modes exclusively', async () => {
  await openBed(); await click('Back to garden');
  const writes = globalThis.__editorFixture.saves.length;
  await click('Focus bed'); assert.deepEqual(globalThis.__gardenCanvas.cameraCommand, { action: 'focus', targetId: bed.id, revision: 1 });
  await click('Zoom in'); assert.equal(globalThis.__gardenCanvas.cameraCommand.action, 'zoom-in');
  await click('Zoom out'); assert.equal(globalThis.__gardenCanvas.cameraCommand.action, 'zoom-out');
  await click('Resize bed'); assert.equal(globalThis.__gardenCanvas.resizing, true);
  await click('Pan view'); assert.equal(globalThis.__gardenCanvas.panning, true); assert.equal(globalThis.__gardenCanvas.resizing, false);
  await click('Resize bed'); assert.equal(globalThis.__gardenCanvas.panning, false); assert.equal(globalThis.__gardenCanvas.resizing, true);
  await act(async () => globalThis.__gardenCanvas.onSelectBed(null)); assert.equal(button('Focus bed').disabled, true);
  await click('Fit garden'); assert.equal(globalThis.__gardenCanvas.cameraCommand.action, 'fit');
  assert.equal(globalThis.__editorFixture.saves.length, writes);
});

test('plant minimum clearances autosave, show actual gaps, undo/reset and reject incomplete or undersized drafts', async () => {
  await openBed(); await click('Add area');
  assert.equal(document.getElementById('plant-clearance-left').value, '15');
  assert.equal(document.getElementById('plant-clearance-left-actual').textContent, 'Actual: 30 cm');
  assert.match(document.body.textContent, /Area position & size/);
  await type('plant-clearance-left', '50');
  const writes = globalThis.__editorFixture.saves;
  assert.deepEqual(writes.at(-1).beds[0].areaPlan.areas[0].clearancesCm, { left: 50 });
  assert.equal(document.getElementById('plant-clearance-left-actual').textContent, 'Actual: 50 cm');
  assert.equal(document.getElementById('plant-clearance-right-actual').textContent, 'Actual: 15 cm');
  assert.match(document.body.textContent, /Row gaps reach 35 cm/);
  await click('Undo'); assert.equal(document.getElementById('plant-clearance-left').value, '15');
  await click('Redo'); assert.equal(document.getElementById('plant-clearance-left').value, '50');
  const before = writes.length;
  await type('plant-clearance-left', '10'); assert.equal(writes.length, before); assert.match(document.body.textContent, /saved crop minimum \(15 cm\)/);
  await type('plant-clearance-left', ''); assert.equal(writes.length, before); assert.equal(document.getElementById('plant-clearance-left').value, '');
  await click('Back to garden'); assert.ok(button('Keep editing')); await click('Keep editing');
  await click('Reset clearances'); assert.equal(document.getElementById('plant-clearance-left').value, '15');
  assert.equal(writes.at(-1).beds[0].areaPlan.areas[0].clearancesCm, undefined);
  assert.equal(document.getElementById('plant-clearance-left-actual').textContent, 'Actual: 30 cm');
});

test('minimums follow bed edges through row direction changes; summaries and reference refresh use the same saved overrides', async () => {
  await openBed(); await click('Add area');
  await type('plant-clearance-left', '50'); await type('plant-clearance-top', '30'); await type('plant-clearance-bottom', '20');
  const before = structuredClone(globalThis.__editorCanvas.plan.areas[0].clearancesCm);
  await choose('planting-area-direction', 'width');
  assert.deepEqual(globalThis.__editorCanvas.plan.areas[0].clearancesCm, before);
  assert.equal(document.getElementById('plant-clearance-left-actual').textContent, 'Actual: 55 cm');
  await click('Refresh area references'); assert.deepEqual(globalThis.__editorCanvas.plan.areas[0].clearancesCm, before);
  await click('Summary'); assert.match(document.body.textContent, /Actual clearances:/);
  assert.match(document.body.textContent, /left 55 cm/);
  assert.match(document.body.textContent, /4 plants/);
});

test('choosing a crop with a larger saved minimum retains overrides for correction without saving an invalid layout', async () => {
  const catalogue = { isAdmin: false, families: [{ id: 'family-a', name: 'Family A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40 }], rules: [], plants: [
    { id: 'type-a', familyId: 'family-a', name: 'Type A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40, borderDistanceCm: 15 },
    { id: 'type-b', familyId: 'family-a', name: 'Type B', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40, borderDistanceCm: 35 },
  ] };
  await openBed(bed, { catalogue }); await click('Add area'); await type('plant-clearance-top', '20');
  const count = globalThis.__editorFixture.saves.length;
  await choose('planting-crop', 'type-b'); assert.equal(globalThis.__editorFixture.saves.length, count);
  assert.equal(document.getElementById('plant-clearance-top').value, '20'); assert.match(document.body.textContent, /saved crop minimum \(35 cm\)/);
  await click('Reset clearances'); assert.equal(document.getElementById('plant-clearance-top').value, '35');
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas[0].plant.id, 'type-b');
});

test('a missing saved seed mixture appears once in the fallback options', async () => {
  const saved = broadcast();
  await openBed({ ...bed, areaPlan: areaPlan(saved) }, { seedMixtures: [] });
  assert.equal([...document.getElementById('seed-mixture').options].filter(option => option.value === saved.sowing.mixture.id).length, 1);
});

test('Suggestions displays automatic family cautions and explicit exceptions without saving; interval warnings remain visible', async () => {
  const options = suggestionOptions();
  const previous = rows({ plant: { ...rows().plant, id: 'old-crop', name: 'Previous crop' } });
  options.historyEvents = [{ id: 'old-event', gardenId: 'garden-a', date: '2025-01-01', order: 1, status: 'completed', kind: 'layout',
    document: { name: 'Garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [{ ...bed, areaPlan: areaPlan(previous) }] } }];
  const historical = structuredClone(options.historyEvents);
  await openBed({ ...bed, areaPlan: areaPlan(rows()) }, options); await click('Suggestions');
  const card = () => [...suggestionsPanel().querySelectorAll('article')].find(article => article.querySelector('h5').textContent === 'Type A');
  assert.match(card().textContent, /Automatic rotation caution after Previous crop: same family \(Family A\)/);
  globalThis.__editorFixture.references.rotation_rules = [{ id: 'exception', version: 1, current_family_id: null, current_plant_id: 'type-a', previous_family_id: null, previous_plant_id: 'old-crop', relationship: 'favourable_after', notes: 'Explicit exception' }];
  globalThis.__editorFixture.references.plant_guidance = [{ id: 'care', version: 1, plant_type_id: 'type-a', cultivar_id: null, rotation_years: 3 }];
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  assert.match(card().textContent, /Favourable rotation after Previous crop: Explicit exception/);
  assert.match(card().textContent, /Allow 3 years between crops of this family/);
  assert.doesNotMatch(card().textContent, /Automatic rotation caution/);
  assert.deepEqual(globalThis.__editorFixture.historyEvents, historical); assert.equal(globalThis.__editorFixture.saves.length, 0);
});


test('bed calendar includes its records and garden checkpoints, defaults planning to the bed, and preserves drafts through previews',async()=>{
  await openBed({...bed,areaPlan:areaPlan(rows())});const f=globalThis.__editorFixture;
  const date=new Date().toISOString().slice(0,10),recordedDocument={name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[{...bed,areaPlan:areaPlan(rows())}]};
  f.historyDocument=recordedDocument;f.planningAvailable=true;
  f.historyEvents=[{id:'layout',gardenId:'garden-a',order:1,date,title:'Whole garden',notes:'',kind:'layout',document:recordedDocument},{id:'bed-record',gardenId:'garden-a',order:2,date,title:'This bed',notes:'',kind:'bed',bedId:bed.id,document:recordedDocument},{id:'other',gardenId:'garden-a',order:3,date,title:'Other bed record',notes:'',kind:'bed',bedId:'other',document:recordedDocument}];
  f.tasks=[{id:'task-a',gardenId:'garden-a',bedId:bed.id,activityType:'care',plannedDate:date,title:'Water this bed',notes:'',status:'planned',order:1,version:1},{id:'task-b',gardenId:'garden-a',bedId:'other',activityType:'care',plannedDate:date,title:'Water another bed',notes:'',status:'planned',order:2,version:1}];
  await click('Areas');await type('planting-plant-spacing','');const drawing=documentNode('[data-testid="bed-canvas"]');
  await click('Calendar');assert.ok(button('View completed event: Whole garden'));assert.ok(button('View completed event: This bed'));assert.equal(button('View completed event: Other bed record'),undefined);
  assert.match(documentNode('[aria-label="Work agenda"]').textContent,/Water this bed/);assert.doesNotMatch(documentNode('[aria-label="Work agenda"]').textContent,/Water another bed/);
  assert.equal(document.getElementById('work-gardens'),null);assert.equal(button('Previous event'),undefined);assert.equal(button('Next event'),undefined);
  assert.deepEqual([...document.querySelectorAll('nav[aria-label="Bed tools"] button[aria-pressed=true]')].map(button=>button.textContent.trim()),['Calendar']);
  await click('Areas');assert.equal(document.querySelector('[aria-label="Editor calendar"]'),null);assert.equal(document.getElementById('planting-plant-spacing').value,'');await click('Calendar');
  await click('Plan activity');assert.equal(document.getElementById('task-bed').value,bed.id);await type('task-title','Inspect this bed');
  assert.equal(drawing.closest('[hidden]'),null,'task planning leaves the editable drawing active');await click('Save task');assert.equal(f.taskWrites.length,1);assert.equal(f.taskWrites[0].details.bedId,bed.id);
  await click('View completed event: This bed');assert.ok(drawing.closest('[hidden]'));assert.equal(globalThis.__editorCanvas.readOnly,true);
  await click('Return to current plan');await click('Calendar');assert.equal(documentNode('[data-testid="bed-canvas"]'),drawing);assert.equal(document.getElementById('planting-plant-spacing').value,'');assert.equal(f.saves.length,0);
});
function documentNode(selector){const node=globalThis.document.querySelector(selector);assert.ok(node,selector);return node;}
