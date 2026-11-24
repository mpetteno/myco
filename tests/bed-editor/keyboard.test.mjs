import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadEditor, cleanupEditor } from './helpers.mjs';
import { bed } from '../planting/fixtures.mjs';
import { rows, broadcast, areaPlan } from '../planting/area-fixtures.mjs';
import { straw, chips } from '../mulch/fixtures.mjs';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'KeyboardEvent']) globalThis[key] = dom.window[key];
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { GardenPage } = await loadEditor();
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; window.getSelection().removeAllRanges(); });
after(() => { dom.window.close(); cleanupEditor(); });
const selectedArea = () => globalThis.__editorCanvas.plan.areas.find(area => area.id === globalThis.__editorCanvas.selectedId);
const button = label => [...document.querySelectorAll('button')].find(item => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
async function click(label) { if (label === 'Calendar' && !button(label)) await act(async()=>globalThis.__gardenCanvas.onSelectBed(null)); const target = button(label); assert.ok(target, `Missing ${label}`); assert.equal(target.disabled, false); await act(async () => target.click()); }
async function key(value, modifiers = { ctrlKey: true }, target = window) {
  const event = new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers });
  await act(async () => target.dispatchEvent(event)); return event;
}
async function open(beds = [bed], options = {}) {
  const document = { name: 'Garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds };
  globalThis.__editorFixture = { saves: [], save: async () => {}, historyEvents: [], eventWrites: [], historyDocument: document,
    seedMixtures: [], mulchCatalogue: { isAdmin: false, types: [straw, chips] },
    catalogue: { isAdmin: false, families: [{ id: 'family-a', name: 'Family A', notes: '', version: 1, plantSpacingCm: 30, rowSpacingCm: 40 }],
      plants: [{ id: 'type-a', familyId: 'family-a', name: 'Type A', notes: '', version: 1, plantSpacingCm: null, rowSpacingCm: null }], rules: [] }, ...options };
  root = createRoot(globalThis.document.getElementById('root'));
  await act(async () => root.render(createElement(GardenPage, { user: { id: 'owner-a' }, garden: { ...document, id: 'garden-a', ownerId: 'owner-a', version: 1, updatedAt: '2026-01-01' },
    pickerOpen: false, onSaved() {}, onChooseGardens() {}, onReload: async () => {}, onDiscardChanges() {} })));
  await click('Select fixture bed');
}
const source = () => rows({ lengthCm: 80, mulch: [{ id: 'layer-a', material: straw }, { id: 'layer-b', material: chips }] });

test('garden copy/paste, undo and both redo shortcuts restore complete beds through autosave', async () => {
  const original = { ...bed, areaPlan: areaPlan(source()) };
  await open([original]);
  await key('c', { metaKey: true }); await key('v', { metaKey: true });
  assert.equal(globalThis.__gardenCanvas.beds.length, 2);
  const copied = structuredClone(globalThis.__gardenCanvas.beds[1]);
  assert.notEqual(copied.areaPlan.areas[0].id, original.areaPlan.areas[0].id);
  await key('z', { metaKey: true }); assert.equal(globalThis.__gardenCanvas.beds.length, 1);
  await key('Z', { metaKey: true, shiftKey: true }); assert.deepEqual(globalThis.__gardenCanvas.beds[1], copied);
  await key('z'); await key('y'); assert.deepEqual(globalThis.__gardenCanvas.beds[1], copied);
  assert.deepEqual(globalThis.__editorFixture.saves.at(-1).beds[1], copied);
  assert.equal(globalThis.__editorFixture.eventWrites.length, 0);
});

test('a no-op move preserves redo while a new real edit discards it', async () => {
  await open();
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 50, yCm: 0 }));
  await key('z');
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 0, yCm: 0 }));
  await key('y'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 50);
  await key('z');
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 100, yCm: 0 }));
  const event = await key('y'); assert.equal(event.defaultPrevented, false);
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 100);
});

test('areas copy their planting snapshots and ordered mulch independently, and undo/redo autosave the exact pasted IDs', async () => {
  await open([{ ...bed, areaPlan: areaPlan(source()) }]); await click('Edit bed');
  await key('c');
  await act(async () => globalThis.__editorCanvas.onBounds('area-a', { xCm: 0, yCm: 0, widthCm: 100, lengthCm: 90 }));
  await key('v');
  const pasted = structuredClone(selectedArea());
  assert.equal(pasted.yCm, 90); assert.equal(pasted.lengthCm, 80, 'copy retains the original geometry');
  assert.equal(pasted.yCm % 5, 0); assert.equal(pasted.xCm % 5, 0);
  assert.deepEqual(pasted.plant, source().plant); assert.notEqual(pasted.id, 'area-a');
  assert.deepEqual(pasted.mulch.map(layer => layer.material), [straw, chips]);
  assert.ok(pasted.mulch.every((layer, index) => layer.id !== source().mulch[index].id));
  await key('z'); assert.equal(globalThis.__editorCanvas.plan.areas.length, 1);
  await key('z', { ctrlKey: true, shiftKey: true });
  assert.deepEqual(globalThis.__editorCanvas.plan.areas[1], pasted);
  assert.deepEqual(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan, globalThis.__editorCanvas.plan);
  assert.equal(globalThis.__editorFixture.historyEvents.length, 0);
});

test('focused areas support copy/paste and the same undo/redo history as the bed editor', async () => {
  await open([{ ...bed, areaPlan: areaPlan(source()) }]); await click('Edit bed');
  await act(async () => globalThis.__editorCanvas.onOpenArea({ kind: 'planting', id: 'area-a' }));
  await key('c'); await key('v');
  const id = selectedArea().id;
  assert.equal(globalThis.__editorCanvas.selectedId, id);
  assert.equal(globalThis.__editorCanvas.cameraCommand.targetId, 'area-a', 'paste leaves the camera alone');
  await key('z'); assert.equal(globalThis.__editorCanvas.plan.areas.length, 1);
  assert.ok(button('Back to garden'), 'removing the focused copy returns to the bed');
  await key('y'); assert.equal(globalThis.__editorCanvas.plan.areas.length, 2);
  await act(async () => globalThis.__editorCanvas.onOpenArea({ kind: 'planting', id }));
  await click('Fit bed'); await key('z'); assert.equal(globalThis.__editorCanvas.plan.areas.length, 1);
});

test('an area can be copied to another bed without sharing nested mixture data or mulch IDs', async () => {
  const area = broadcast({ lengthCm: 80, mulch: source().mulch });
  const other = { ...bed, id: 'bed-b', name: 'Bed B', xCm: 200 };
  await open([{ ...bed, areaPlan: areaPlan(area) }, other]); await click('Edit bed');
  await key('c'); await click('Back to garden');
  await act(async () => globalThis.__gardenCanvas.onEditBed(other.id));
  await key('v');
  const pasted = selectedArea();
  assert.equal(pasted.kind, 'broadcast'); assert.deepEqual(pasted.sowing, area.sowing);
  assert.notEqual(pasted.sowing, area.sowing); assert.notEqual(pasted.id, area.id);
  assert.deepEqual(pasted.mulch.map(layer => layer.material), area.mulch.map(layer => layer.material));
  assert.notEqual(pasted.mulch[0].id, area.mulch[0].id);
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].areaPlan.areas.length, 1);
});

test('pasting into a full bed fails without shrinking neighbours, creating undo entries or saving', async () => {
  await open([{ ...bed, areaPlan: areaPlan(rows()) }]); await click('Edit bed');
  const before = structuredClone(globalThis.__editorCanvas.plan);
  await key('c'); await key('v');
  assert.deepEqual(globalThis.__editorCanvas.plan, before); assert.equal(globalThis.__editorFixture.saves.length, 0);
  assert.match(document.body.textContent, /cannot be pasted here/);
  assert.equal((await key('z')).defaultPrevented, false);
});

test('text inputs, select controls, editable elements, composition and modified browser shortcuts retain their native behavior', async () => {
  await open([{ ...bed, areaPlan: areaPlan(source()) }]); await click('Edit bed'); await key('c');
  const before = structuredClone(globalThis.__editorCanvas.plan);
  for (const target of [document.getElementById('planting-row-count'), document.getElementById('area-purpose')]) {
    assert.ok(target);
    for (const shortcut of ['c', 'v', 'z', 'y']) assert.equal((await key(shortcut, { ctrlKey: true }, target)).defaultPrevented, false);
  }
  const editable = document.createElement('div'); editable.setAttribute('contenteditable', 'true'); document.body.append(editable);
  assert.equal((await key('v', { metaKey: true }, editable)).defaultPrevented, false); editable.remove();
  for (const modifiers of [{ ctrlKey: true, isComposing: true }, { ctrlKey: true, repeat: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, shiftKey: true }]) {
    assert.equal((await key('v', modifiers)).defaultPrevented, false);
  }
  assert.deepEqual(globalThis.__editorCanvas.plan, before);
});

test('modal confirmations and read-only bed history block shortcuts in editors behind them', async () => {
  await open([{ ...bed, areaPlan: areaPlan(source()) }]); await click('Edit bed'); await key('c');
  await click('Areas'); await click('Clear area plan');
  assert.ok(document.querySelector('dialog[open]'));
  for (const shortcut of ['c', 'v', 'z', 'y']) assert.equal((await key(shortcut)).defaultPrevented, false);
  await click('Keep areas'); await click('Calendar');await click([...document.querySelectorAll('[aria-label^="Work month"] button')].find(b=>b.getAttribute('aria-label')?.includes('activities')).getAttribute('aria-label'));
  for (const shortcut of ['c', 'v', 'z', 'y']) assert.equal((await key(shortcut)).defaultPrevented, false);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
});

test('undo and redo coalesce safely behind a pending garden autosave', async () => {
  await open(); let release;
  globalThis.__editorFixture.save = () => new Promise(resolve => { release = resolve; });
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 50, yCm: 0 }));
  await key('z'); await key('y'); await key('z');
  globalThis.__editorFixture.save = async () => {};
  await act(async () => release());
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 0);
  assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].xCm, 0);
  await key('y'); assert.equal(globalThis.__editorFixture.saves.at(-1).beds[0].xCm, 50);
});

test('historical drafts handle their own shortcuts without the current garden editor intercepting them', async () => {
  await open();
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 50, yCm: 0 }));
  const saved = structuredClone(globalThis.__editorFixture.saves.at(-1));
  await click('Calendar'); await click('Add past garden edit'); await click('Select fixture bed');
  await key('c'); await key('v'); assert.equal(globalThis.__gardenCanvas.beds.length, 2);
  await key('z'); assert.equal(globalThis.__gardenCanvas.beds.length, 1);
  await key('y'); assert.equal(globalThis.__gardenCanvas.beds.length, 2);
  assert.deepEqual(globalThis.__editorFixture.saves.at(-1), saved);
  assert.equal(globalThis.__editorFixture.historyEdits?.length ?? 0, 0);
});

test('the area limit blocks paste even when there is geometrically free space', async () => {
  const areas = Array.from({ length: 12 }, (_, index) => broadcast({ id: `area-${index}`, xCm: index * 5, widthCm: 5, lengthCm: 100 }));
  await open([{ ...bed, areaPlan: areaPlan(...areas) }]); await click('Edit bed');
  await key('c'); await key('v');
  assert.equal(globalThis.__editorCanvas.plan.areas.length, 12);
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  assert.match(document.body.textContent, /cannot be pasted here/);
});
