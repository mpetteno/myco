import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(resolve('node_modules/.tmp/catalogue-page-'));
const fixtures = {
  catalogueRepository: `
    export const loadCatalogue = async () => structuredClone(globalThis.__page.catalogue);
    const save = async (table, details, current) => {
      globalThis.__page.writes.push({ table, details, current });
      return { ...details, id: current?.id ?? 'new', version: (current?.version ?? 0) + 1 };
    };
    export const saveFamily = (...args) => save('families', ...args);
    export const savePlant = (...args) => save('plants', ...args);
    export const saveRule = (...args) => save('rules', ...args);`,
  cropEditorRepository: `
    import { cropChanges,cropDetailsPayload } from ${JSON.stringify(resolve('src/features/catalogue/cropEditor.ts'))};
    export const saveCropEditor=async(cropId,cultivarId,version,cropVersion,draft,initial)=>{
      if(globalThis.__page.saveWait) await globalThis.__page.saveWait;
      if(globalThis.__page.saveError) throw {code:'40001'};
      globalThis.__page.writes.push({table:'crop_editor',cropId,cultivarId,version,cropVersion,details:cropDetailsPayload(draft),changes:cropChanges(draft,initial,cropId,cultivarId)});
    };`,
  seedMixtureRepository: `
    export const loadSeedMixtures = async () => structuredClone(globalThis.__page.mixtures);
    export const saveSeedMixture = async (details, current) => {
      if (globalThis.__page.saveError) throw { code: '40001' };
      globalThis.__page.writes.push({ table: 'seed_mixtures', details, current });
    };`,
  referenceRepository: `
    export const loadReferenceData = async () => structuredClone(globalThis.__page.references);
    export const saveReference = async (table, details, current, windows) => {
      if (globalThis.__page.saveError) throw { code: '40001' };
      globalThis.__page.writes.push({ table, details, current, windows });
    };
    export const removeCultivar = async () => {};`,
  mulchCatalogueRepository: `
    export const loadMulchCatalogue = async () => structuredClone(globalThis.__page.mulch);
    export const saveMulchType = async (details, current) => {
      globalThis.__page.writes.push({ table: 'mulch', details, current });
      return { ...details, id: current?.id ?? 'new', version: (current?.version ?? 0) + 1 };
    };
    export const removeMulchType = async () => {};`,
  useGardens: 'export const useGardens = () => globalThis.__page.store;',
  GardenPage: `import { createElement, useEffect, useState } from 'react';
    export function GardenPage({ pickerOpen, onChooseGardens }) {
      const [draft, setDraft] = useState(0);
      useEffect(() => { globalThis.__page.mounts++; }, []);
      return createElement('main', { 'data-testid': 'garden', 'data-paused': pickerOpen },
        createElement('p', { id: 'draft-value' }, String(draft)),
        createElement('button', { onClick: () => setDraft(draft + 1) }, 'Edit fixture plan'),
        createElement('button', { onClick: onChooseGardens }, 'Your gardens'));
    }`,
  AccountPanel: 'export const AccountPanel = () => null;',
};
const aliases = {};
for (const [name, source] of Object.entries(fixtures)) {
  aliases[name] = join(directory, `${name}.mjs`);
  await writeFile(aliases[name], source);
}
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'Event']) globalThis[key] = dom.window[key];
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const built = await build({ configFile: false, envFile: false, logLevel: 'silent',
  plugins: [{ name: 'page-fixtures', enforce: 'pre', resolveId(source) {
    return Object.entries(aliases).find(([name]) => source.endsWith('/' + name))?.[1];
  } }], build: { write: false, minify: false, lib: { entry: 'tests/catalogue/page-ui-modules.ts', formats: ['es'] },
    rolldownOptions: { external: ['react', 'react/jsx-runtime'] } } });
const output = (Array.isArray(built) ? built[0] : built).output;
const file = join(directory, 'ui.mjs');
await writeFile(file, output.find((item) => item.type === 'chunk').code);
const { CataloguePage, GardensWorkspace } = await import(pathToFileURL(file).href);
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(async () => { dom.window.close(); await rm(directory, { recursive: true, force: true }); });
const button = (text) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === text && !item.closest('[hidden]'));
async function click(text) { assert.ok(button(text), 'Missing ' + text); await act(async () => button(text).click()); }
async function clickIn(headingId, label) {
  const section = document.getElementById(headingId).closest('section');
  const target = [...section.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
  assert.ok(target, `Missing ${label} in ${headingId}`); await act(async () => target.click());
}
async function change(id, value) {
  const element = document.getElementById(id); assert.ok(element, 'Missing ' + id);
  await act(async () => {
    Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
function fixture(isAdmin = true) {
  const family = { id: 'family', name: 'Cucurbitaceae', notes: '', plantSpacingCm: 100, rowSpacingCm: 120, version: 1 };
  const crop = { ...family, id: 'crop', name: 'Watermelon', familyId: family.id, borderDistanceCm: 15, livingMulchEnabled: false };
  const references = Object.fromEntries(['plant_cultivars', 'plant_guidance', 'plant_depths', 'calendar_profiles', 'calendar_coverage', 'plant_calendar_entries', 'rotation_rules', 'mulch_categories', 'calendar_windows'].map((table) => [table, []]));
  Object.assign(references, { isAdmin, plant_types: [{...crop,family_id:family.id,scientific_name:'',plant_spacing_cm:100,row_spacing_cm:120,border_distance_cm:15,living_mulch_enabled:false}], plant_families: [{...family,plant_spacing_cm:100,row_spacing_cm:120}],
    plant_cultivars: [{ id: 'cultivar', name: 'Crimson Sweet', plant_type_id: crop.id, notes: '', version: 1 }],
    plant_guidance: [{ id: 'care', plant_type_id: crop.id, cultivar_id: null, sun_requirement: 'full_sun', version: 1 }],
    plant_depths: [{ id: 'depth', plant_type_id: crop.id, cultivar_id: null, planting_method: 'seed', depth_cm: 2, notes: '', version: 1 }],
    calendar_profiles: [{ id: 'calendar', name: 'Italy', code: 'italy', notes: '', version: 1 }],
    calendar_coverage: [{ id: 'coverage', calendar_profile_id: 'calendar', country_code: 'IT', region_code: 'IT-25', version: 1 }],
    plant_calendar_entries: [{ id: 'entry', calendar_profile_id: 'calendar', plant_type_id: crop.id, cultivar_id: null, activity: 'direct_sowing', planting_method: 'seed', notes: '', version: 1 }],
    calendar_windows: [{ id: 'window', calendar_entry_id: 'entry', start_month: 4, end_month: 6, version: 1 }],
    rotation_rules: [{ id: 'rotation', current_family_id: family.id, previous_plant_id: crop.id, relationship: 'avoid_after', notes: '', version: 1 }],
    mulch_categories: [{ id: 'category', name: 'Organic', code: 'organic', notes: '', version: 1 }],
  });
  return { catalogue: { isAdmin, families: [family], plants: [crop], rules: [] }, references,
    mulch: { isAdmin, categories: references.mulch_categories, types: [{ id: 'straw', name: 'Straw', notes: '', categoryId: 'category', version: 1 }] },
    mixtures: [{ id: 'mix', name: 'Cover mix', notes: '', version: 3, components: [{ plantTypeId: crop.id, cultivarId: 'cultivar', percentage: 100 }] }], writes: [], mounts: 0 };
}
async function open(Component, props, data = fixture()) {
  globalThis.__page = data; root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Component, props)));
}
const sections = ['families', 'plants', 'plant_cultivars', 'seed_mixtures', 'calendar_profiles', 'calendar_coverage', 'plant_calendar_entries', 'materials', 'mulch_categories'];

test('one page reaches every catalogue section and protects active administrator forms', async () => {
  let backs = 0;
  await open(CataloguePage, { userId: 'admin', onBack: () => backs++ });
  assert.deepEqual([...document.querySelectorAll('#catalogue-section option')].map((item) => item.value), sections);
  assert.deepEqual([...document.querySelectorAll('#catalogue-section optgroup')].map((item) => item.label), ['Plants', 'Calendar', 'Mulch']);
  for (const section of sections) {
    await change('catalogue-section', section);
    assert.equal(document.getElementById('reference-section'), null);
    if (section === 'plants' || section === 'plant_cultivars') { await click('View details'); await change('details-name', 'Changed'); } else await click('Edit');
    assert.equal(document.getElementById('catalogue-section').disabled, true, section);
    assert.equal(button('Back to gardens').disabled, true, section);
    await click('Back to gardens'); assert.equal(backs, 0);
    await click(section === 'plants' || section === 'plant_cultivars' ? 'Discard changes' : 'Back to catalogue');
    assert.equal(document.getElementById('catalogue-section').disabled, false, section);
  }
  await change('catalogue-section', 'plant_calendar_entries'); await click('Edit');
  await change('window-0-start_month', '5');
  globalThis.__page.saveError = true; await click('Save entry');
  assert.equal(document.getElementById('catalogue-section').disabled, true);
  assert.equal(document.getElementById('window-0-start_month').value, '5');
  globalThis.__page.saveError = false; await click('Save entry');
  assert.equal(document.getElementById('catalogue-section').disabled, false);
  assert.deepEqual(globalThis.__page.writes.at(-1).windows, [{ start_month: 5, end_month: 6 }]);
  await change('catalogue-section', 'materials'); await click('Remove');
  assert.equal(button('Back to gardens').disabled, true);
  await click('Cancel'); assert.equal(button('Back to gardens').disabled, false);
  await click('Back to gardens'); assert.equal(backs, 1);
});

test('ordinary users browse all sections without catalogue management controls', async () => {
  await open(CataloguePage, { userId: 'reader', onBack: () => {} }, fixture(false));
  for (const section of sections) {
    await change('catalogue-section', section);
    assert.equal(button('Edit'), undefined, section);
    assert.equal(button('Remove'), undefined, section);
    assert.equal([...document.querySelectorAll('button')].some((item) => /^Add /.test(item.textContent)), false, section);
  }
  assert.equal(globalThis.__page.writes.length, 0);
});

function withStore(active) {
  const data = fixture();
  data.store = { active, gardens: active ? [active] : [], editorVersion: 1, loading: false, error: '',
    remember() {}, async choose() {}, async create() {}, async refresh() {}, retry() {} };
  return data;
}
test('workspace opens a dedicated catalogue and returns without remounting or losing the editor draft', async () => {
  const active = { id: 'garden', name: 'Kitchen garden', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 } };
  await open(GardensWorkspace, { user: { id: 'admin' } }, withStore(active));
  await click('Edit fixture plan'); await click('Your gardens'); await click('Catalogue');
  assert.equal(document.querySelector('dialog'), null);
  const editor = document.querySelector('[data-testid="garden"]');
  assert.ok(editor.closest('[hidden]')); assert.ok(editor.closest('[inert]'));
  assert.equal(editor.dataset.paused, 'true');
  assert.equal(document.querySelector('h1').textContent, 'Catalogue');
  await change('catalogue-section', 'materials'); await click('Back to gardens');
  assert.ok(document.querySelector('dialog')); await click('Close');
  assert.equal(document.querySelector('[data-testid="garden"]'), editor);
  assert.equal(editor.closest('[hidden]'), null); assert.equal(editor.dataset.paused, 'false');
  assert.equal(document.getElementById('draft-value').textContent, '1');
  assert.equal(globalThis.__page.mounts, 1);
});

test('catalogue is available before creating a garden', async () => {
  await open(GardensWorkspace, { user: { id: 'admin' } }, withStore(null));
  assert.equal(button('Plant catalogue'), undefined); assert.equal(button('Mulch catalogue'), undefined);
  await click('Catalogue'); assert.ok(document.getElementById('catalogue-section'));
  await click('Back to gardens'); assert.ok(button('Create a garden'));
  assert.equal(document.querySelector('dialog'), null);
});


test('mixture editing validates total weight, preserves failed edits and saves components together', async () => {
  await open(CataloguePage, { userId: 'admin', onBack: () => {} });
  await change('catalogue-section', 'seed_mixtures');
  assert.match(document.body.textContent, /Cover mix/); await click('Edit');
  assert.equal(document.getElementById('catalogue-section').disabled, true);
  await change('mixture-percentage-0', '60'); await click('Save entry');
  assert.match(document.body.textContent, /must total 100%/); assert.equal(globalThis.__page.writes.length, 0);
  await click('Add component'); await change('mixture-crop-1', 'crop'); await change('mixture-percentage-1', '40');
  globalThis.__page.saveError = true; await click('Save entry');
  assert.match(document.body.textContent, /changed/); assert.equal(document.getElementById('mixture-percentage-0').value, '60');
  globalThis.__page.saveError = false; await click('Save entry');
  const saved = globalThis.__page.writes.at(-1);
  assert.equal(saved.table, 'seed_mixtures'); assert.equal(saved.current.version, 3);
  assert.deepEqual(saved.details.components, [{ plantTypeId: 'crop', cultivarId: 'cultivar', percentage: 60 }, { plantTypeId: 'crop', cultivarId: null, percentage: 40 }]);
  assert.equal(document.getElementById('catalogue-section').disabled, false);
});

test('all fields edit directly and one Save submits the complete crop draft; failures preserve it', async () => {
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);
  await click('Watermelon');
  assert.equal(document.querySelectorAll('form').length,1);
  assert.equal(document.querySelectorAll('button[type="submit"]').length,1);
  assert.equal(button('Save').disabled,true);
  assert.equal(button('Edit'),undefined);assert.equal(button('Edit details'),undefined);
  assert.equal(document.querySelectorAll('h4').length,6);
  await change('details-name','Better melon');
  await change('care-monthly_feed','false');await change('depth-seed-depth_cm','3');
  await change('depth-seed-notes','Shallow sowing');
  await click('Add companion');
  assert.ok([...document.querySelectorAll('option')].some(option=>option.textContent==='Companion suggestion'));
  const companion=document.querySelector('[id$="-target"]');
  await change(companion.id,'plant:crop');
  data.saveError=true;await click('Save');
  assert.match(document.body.textContent,/changed/);
  assert.equal(document.getElementById('details-name').value,'Better melon');
  assert.equal(document.getElementById('depth-seed-depth_cm').value,'3');
  assert.equal(document.getElementById('catalogue-section').disabled,true);
  assert.equal(data.writes.length,0);
  data.saveError=false;await click('Save');
  assert.equal(data.writes.length,1);
  const saved=data.writes[0];assert.equal(saved.table,'crop_editor');assert.equal(saved.details.name,'Better melon');
  assert.equal(saved.changes.find(row=>row.table==='plant_guidance').details.monthly_feed,false);
  assert.equal(saved.changes.find(row=>row.table==='plant_depths').details.depth_cm,3);
  assert.equal(saved.changes.find(row=>row.table==='companion_rules').details.plant_a_id,'crop');
  assert.equal(button('Save').disabled,true);assert.equal(document.getElementById('catalogue-section').disabled,false);
  assert.match(document.body.textContent,/All changes saved/);
});

test('cultivar edits preserve inheritance and save care, depths, rotation and calendar overrides together',async()=>{
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);
  await change('catalogue-section','plant_cultivars');await click('Crimson Sweet');
  assert.equal(document.getElementById('care-sun_requirement').value,'');
  assert.equal(document.getElementById('details-notes').placeholder,'');
  assert.equal(document.getElementById('depth-seed-depth_cm').getAttribute('aria-label'),'Seed Depth (cm)');
  assert.match(document.getElementById('care-sun_requirement').textContent,/Use crop default: Full sun/);
  assert.equal(document.getElementById('depth-seed-depth_cm').placeholder,'Inherited: 2');
  await change('care-monthly_feed','false');await change('depth-seed-depth_cm','4');
  await change('rotation-rotation-relationship','favourable_after');
  assert.match(document.getElementById('crop-rotation-heading').closest('section').textContent,/Unsaved override/);
  await change('calendar-entry-window-0-start_month','5');
  await click('Save');assert.equal(data.writes.length,1);
  const saved=data.writes[0];assert.equal(saved.cultivarId,'cultivar');
  assert.deepEqual(saved.changes.map(row=>row.table),['plant_guidance','plant_depths','rotation_rules','plant_calendar_entries']);
  assert.equal(saved.changes[0].details.sun_requirement,null);
  assert.equal(saved.changes[0].details.monthly_feed,false);
  assert.equal(saved.changes[1].id,null);assert.equal(saved.changes[1].details.cultivar_id,'cultivar');
  assert.equal(saved.changes[2].details.current_cultivar_id,'cultivar');assert.equal(saved.changes[2].details.current_family_id,null);
  assert.deepEqual(saved.changes[3].windows,[{start_month:5,end_month:6}]);assert.equal(saved.changes[3].id,null);
});

test('readers see the whole page without editing or saving controls',async()=>{
  await open(CataloguePage,{userId:'reader',onBack:()=>{}},fixture(false));
  await click('Watermelon');assert.equal(document.querySelectorAll('h4').length,6);
  assert.equal(button('Save'),undefined);assert.equal(button('Add companion'),undefined);
  assert.ok([...document.querySelectorAll('form input,form select,form textarea')].every(field=>field.disabled));
});

test('discard restores the entire draft and pending saves block duplicate requests and navigation',async()=>{
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);await click('View details');
  await change('details-name','Discard me');await click('Add companion');await click('Discard changes');
  assert.equal(document.getElementById('details-name').value,'Watermelon');assert.equal(button('Save').disabled,true);
  await change('details-name','Keep me');
  let release;data.saveWait=new Promise(resolve=>{release=resolve});
  await click('Save');assert.equal(button('Save').disabled,true);assert.equal(document.getElementById('details-name').disabled,true);
  assert.equal(button('Discard changes').disabled,true);await click('Save');
  await act(async()=>release());assert.equal(data.writes.length,1);assert.equal(data.writes[0].details.name,'Keep me');
});
