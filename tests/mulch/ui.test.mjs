import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadPanel, cleanupPanel } from './ui-helpers.mjs';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'Event', 'MouseEvent']) globalThis[key] = dom.window[key];
window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MulchCataloguePanel } = await loadPanel();
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(() => { dom.window.close(); cleanupPanel(); });
const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
async function click(label) { const item = button(label); assert.ok(item, `Missing button: ${label}`); await act(async () => item.click()); }
async function type(id, value) {
  const input = document.getElementById(id); assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function open(data, loadError = null) {
  globalThis.__mulchFixture = { data, loadError, writes: [], removals: [], save: async () => {} };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(MulchCataloguePanel, { userId: 'user-a' })));
}

test('readers can search names and notes without seeing editing controls', async () => {
  await open({ isAdmin: false, types: [
    { id: 'straw', name: 'Straw', notes: 'Dry material', version: 1 },
    { id: 'chips', name: 'Wood chips', notes: '', version: 1 },
  ] });
  assert.equal(button('Add mulch type'), undefined); assert.equal(button('Edit Straw'), undefined);
  assert.equal(button('Remove Straw'), undefined);
  await type('mulch-catalogue-search', 'DRY');
  assert.equal(document.querySelectorAll('li').length, 1);
  assert.match(document.querySelector('li').textContent, /Straw/);
  await type('mulch-catalogue-search', 'missing');
  assert.match(document.body.textContent, /No matching mulch types/);
});

test('administrators add and edit types; failed writes preserve the form and allow a retry', async () => {
  await open({ isAdmin: true, types: [], categories: [{ id: 'organic', name: 'Organic mulch', code: 'organic' }] });
  assert.match(document.body.textContent, /No mulch types yet/);
  await click('Add mulch type'); await type('mulch-type-name', ' Straw '); await type('mulch-type-notes', ' Dry material ');
  await act(async () => { const select = document.getElementById('mulch-category'); select.value = 'organic'; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
  globalThis.__mulchFixture.save = async () => { throw { code: '23505' }; };
  await click('Save mulch type');
  assert.match(document.body.textContent, /already exists/);
  assert.equal(document.getElementById('mulch-type-name').value, ' Straw ');
  globalThis.__mulchFixture.save = async () => {};
  await click('Save mulch type');
  assert.match(document.body.textContent, /Mulch type|Catalogue saved/);
  assert.equal(document.getElementById('mulch-type-notes').value, ' Dry material ');
  await type('mulch-type-notes', 'Updated notes'); await click('Save mulch type');
  assert.equal(document.getElementById('mulch-type-notes').value, 'Updated notes');
  await click('Back to catalogue');
  await click('Edit Straw');
  assert.equal(document.getElementById('mulch-type-notes').value, 'Updated notes');
  assert.equal(globalThis.__mulchFixture.writes.at(-1).current.version, 1);
});

test('load retry and refreshed administrator revocation remove editing controls', async () => {
  const data = { isAdmin: true, types: [{ id: 'straw', name: 'Straw', notes: '', version: 1 }] };
  await open(data, new Error('Offline'));
  assert.match(document.body.textContent, /Could not reach the mulch catalogue/);
  globalThis.__mulchFixture.loadError = null; await click('Try again');
  await click('Edit Straw'); await type('mulch-type-name', 'Straw revised');
  globalThis.__mulchFixture.save = async () => { throw { code: '42501' }; };
  await click('Save mulch type');
  assert.match(document.body.textContent, /Only catalogue administrators/);
  assert.equal(document.getElementById('mulch-type-name').value, 'Straw revised');
  await click('Back to catalogue');
  globalThis.__mulchFixture.data = { ...data, isAdmin: false }; await click('Refresh catalogue');
  assert.equal(button('Add mulch type'), undefined); assert.equal(button('Edit Straw'), undefined);
  assert.equal(button('Remove Straw'), undefined);
});

test('admin removal confirms the selected material, supports cancellation, and retains it after failed requests',async()=>{
  await open({isAdmin:true,types:[{id:'straw',name:'Straw',notes:'',version:3},{id:'chips',name:'Wood chips',notes:'',version:1}]});
  await click('Remove Straw');
  assert.match(document.querySelector('dialog').textContent,/Remove Straw\?/);
  assert.match(document.querySelector('dialog').textContent,/Existing garden plans/);
  await click('Cancel');assert.equal(globalThis.__mulchFixture.removals.length,0);
  await click('Remove Straw');globalThis.__mulchFixture.removeError='40001';await click('Remove from catalogue');
  assert.match(document.querySelector('dialog').textContent,/changed or was already removed/);
  assert.ok(button('Edit Straw'));assert.equal(globalThis.__mulchFixture.removals[0].version,3);
  globalThis.__mulchFixture.removeError='42501';await click('Remove from catalogue');
  assert.match(document.querySelector('dialog').textContent,/Only catalogue administrators/);
  globalThis.__mulchFixture.removeError=null;await click('Remove from catalogue');
  assert.equal(document.querySelector('dialog'),null);assert.equal(button('Edit Straw'),undefined);
  assert.ok(button('Edit Wood chips'));assert.match(document.body.textContent,/Catalogue entry removed/);
});

test('removal prevents duplicate submission and dismissal while the request is pending',async()=>{
  await open({isAdmin:true,types:[{id:'straw',name:'Straw',notes:'',version:1}]});
  let finish;globalThis.__mulchFixture.remove=()=>new Promise((resolve)=>{finish=resolve;});
  await click('Remove Straw');await click('Remove from catalogue');
  assert.equal(button('Removing…').disabled,true);assert.equal(button('Cancel').disabled,true);
  await click('Removing…');await click('Cancel');
  assert.equal(globalThis.__mulchFixture.removals.length,1);
  await act(async()=>finish());assert.equal(document.querySelector('dialog'),null);
});

test('living mulch is shown without material-management controls and cannot be created manually', async () => {
  await open({ isAdmin: true, categories: [{ id: 'organic', name: 'Organic mulch', code: 'organic' }, { id: 'living', name: 'Living mulch', code: 'living' }], types: [
    { id: 'straw', name: 'paglia', notes: '', version: 1, categoryId: 'organic' },
    { id: 'living:crop:basil', name: 'Basil', notes: '', version: 1, categoryId: 'living', categoryCode: 'living', plantTypeId: 'basil' },
  ] });
  const section = document.querySelector('section[aria-label="Living mulch"]'); assert.match(section.textContent, /Basil/);
  assert.ok(button('Open crop Basil')); assert.equal(button('Edit Basil'), undefined); assert.equal(button('Remove Basil'), undefined); assert.ok(button('Edit paglia'));
  await click('Add mulch type');
  assert.deepEqual([...document.getElementById('mulch-category').options].map(option => option.value), ['', 'organic']);
  assert.equal(document.getElementById('mulch-living-plant'), null);
});
