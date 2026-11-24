import { areaPlan, rows } from '../planting/area-fixtures.mjs';
import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(resolve('node_modules/.tmp/catalogue-page-'));
const fixtures = {
  catalogueRemoval: `
    import { GardenStorageError } from ${JSON.stringify(resolve('src/features/gardens/gardenErrors.ts'))};
    export const removeCatalogueEntry = async (kind, current) => {
      const data = globalThis.__page; data.removals ??= []; data.removals.push({ kind, current });
      if (data.removalError) throw new GardenStorageError('Dependency', false, data.removalErrorKey ?? 'catalogue.removalInUse');
      if (data.removalWait) await data.removalWait;
      if (kind === 'seed_mixture') data.mixtures = data.mixtures.filter(item => item.id !== current.id);
      else if (kind === 'mulch_category') data.references.mulch_categories = data.references.mulch_categories.filter(item => item.id !== current.id);
      else { const table = kind === 'plant_family' ? 'families' : 'plants'; data.catalogue[table] = data.catalogue[table].filter(item => item.id !== current.id); }
    };`,
  catalogueRepository: `
    export const loadCatalogue = async () => structuredClone(globalThis.__page.catalogue);
    const save = async (table, details, current) => {
      globalThis.__page.writes.push({ table, details, current });
      const saved = { ...details, id: current?.id ?? 'new', version: (current?.version ?? 0) + 1 };
      if (table === 'families') {
        const data = globalThis.__page;
        data.catalogue.families = [...data.catalogue.families.filter(item => item.id !== saved.id), saved];
        data.references.plant_families = [...data.references.plant_families.filter(item => item.id !== saved.id), { ...saved, plant_spacing_cm: saved.plantSpacingCm, row_spacing_cm: saved.rowSpacingCm }];
      }
      return saved;
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
      globalThis.__page.afterCropSave?.(draft);
    };`,
  seedMixtureRepository: `
    export const loadSeedMixtures = async () => { if(globalThis.__page.mixtureLoadError) throw Error('Offline'); return structuredClone(globalThis.__page.mixtures); };
    export const saveSeedMixture = async (details, current) => {
      if (globalThis.__page.saveError) throw { code: '40001' };
      globalThis.__page.writes.push({ table: 'seed_mixtures', details, current });
      const row = { ...details, id: current?.id ?? 'new-mix', version: (current?.version ?? 0) + 1 };
      globalThis.__page.mixtures = [...globalThis.__page.mixtures.filter(item => item.id !== row.id), row];
      globalThis.__page.afterMixtureSave?.(); return row.id;
    };`,
  referenceRepository: `
    export const loadReferenceData = async () => { if(globalThis.__page.referenceError) throw new Error('Offline'); return structuredClone(globalThis.__page.references); };
    export const saveReference = async (table, details, current, windows) => {
      if (globalThis.__page.saveError) throw { code: '40001' };
      globalThis.__page.writes.push({ table, details, current, windows });
      return { ...details, id: current?.id ?? 'new-reference', version: (current?.version ?? 0) + 1 };
    };
    export const removeCultivar = async () => {};`,
  mulchCatalogueRepository: `
    export const loadMulchCatalogue = async () => structuredClone(globalThis.__page.mulch);
    export const saveMulchType = async (details, current) => {
      if (globalThis.__page.saveWait) await globalThis.__page.saveWait;
      if (globalThis.__page.saveError) throw { code: '40001' };
      globalThis.__page.writes.push({ table: 'mulch', details, current });
      return { ...details, id: current?.id ?? 'new', version: (current?.version ?? 0) + 1 };
    };
    export const removeMulchType = async () => {};`,
  useGardens: 'export const useGardens = () => globalThis.__page.store;',
  gardenRepository: `export const listGardens=async()=>structuredClone(globalThis.__page.store?.gardens??[]);
    export const loadGarden=async id=>{const data=globalThis.__page;if(data.gardenLoadError)throw Error('Garden unavailable');return structuredClone(data.documents?.[id]??data.store.active)};`,
  historyRepository: `export const loadGardenEvent=async(gardenId,id)=>{const p=globalThis.__page;return {...p.workEvents.find(e=>e.id===id),document:p.documents?.[gardenId]??p.store.active}};`,
  CalendarHistoryView: `import {createElement} from 'react';export const CalendarHistoryView=({event,onBack})=>createElement('div',null,createElement('h1',null,event.title),createElement('button',{onClick:onBack},'Back to calendar'));`,
  taskRepository: `import {GardenStorageError} from ${JSON.stringify(resolve('src/features/gardens/gardenErrors.ts'))};
    export const taskError=error=>error instanceof Error?error:new GardenStorageError('Task request failed');
    export const loadWork=async ids=>{const p=globalThis.__page;p.workReads??=[];p.workReads.push(ids);if(p.workGate)await p.workGate;if(p.workError)throw Error('Work unavailable');return structuredClone({tasks:(p.tasks??[]).filter(t=>ids.includes(t.gardenId)),events:(p.workEvents??[]).filter(e=>ids.includes(e.gardenId)),planningAvailable:p.planningAvailable??true,checklistAvailable:p.checklistAvailable??true})};
    export const loadTask=async id=>structuredClone(globalThis.__page.tasks.find(t=>t.id===id));
    export const saveTask=async(details,current,id,request,cancel=false)=>{const p=globalThis.__page;p.taskWrites??=[];p.taskWrites.push({details,current,id,request,cancel});if(p.taskGate)await p.taskGate;if(p.taskError)throw new GardenStorageError('Task failed',!!p.taskConflict);const saved={...details,id,version:(current?.version??0)+1,order:1,status:cancel?'cancelled':'planned'};p.tasks=[...(p.tasks??[]).filter(t=>t.id!==id),saved];return saved};
    export const completeTask=async(task,garden,date,notes,confirmed,request)=>{const p=globalThis.__page;p.completeWrites??=[];p.completeWrites.push({task,garden,date,notes,confirmed,request});if(p.completeGate)await p.completeGate;if(p.completeError)throw new GardenStorageError('Saved plan changed',true);const saved={...task,status:'completed',completedDate:date,completedNotes:notes,completionEventId:'completed-event',version:task.version+1};p.tasks=p.tasks.map(t=>t.id===task.id?saved:t);p.workEvents=[{id:'completed-event',gardenId:task.gardenId,title:task.title,notes,date,status:'completed',bedId:task.bedId,kind:task.bedId?'bed':'layout',deleted:false}];return saved};`,
  GardenPage: `import { createElement, useEffect, useState } from 'react';
    import { WorkspaceNav } from ${JSON.stringify(resolve('src/shared/navigation/WorkspaceNavigation.tsx'))};
    export function GardenPage({ pickerOpen, onChooseGardens, onOpenCalendar }) {
      const [draft, setDraft] = useState(0);
      useEffect(() => { globalThis.__page.mounts++; }, []);
      return createElement('main', { 'data-testid': 'garden', 'data-paused': pickerOpen },
        createElement('p', { id: 'draft-value' }, String(draft)),
        createElement('button', { onClick: () => setDraft(draft + 1) }, 'Edit fixture plan'),
        createElement('button', { onClick: onChooseGardens }, 'Your gardens'),
        createElement('button', {onClick:onOpenCalendar}, 'Calendar'), createElement(WorkspaceNav));
    }`,
  AccountPanel: 'export const AccountPanel = () => null;',
};
const aliases = {};
for (const [name, source] of Object.entries(fixtures)) {
  aliases[name] = join(directory, `${name}.mjs`);
  await writeFile(aliases[name], source);
}
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Event']) globalThis[key] = dom.window[key];
globalThis.requestAnimationFrame = (callback) => { callback(); return 0; };
window.HTMLElement.prototype.scrollIntoView = function () {};
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
const { CataloguePage, GardensWorkspace, GrowingCalendar } = await import(pathToFileURL(file).href);
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(async () => { dom.window.close(); await rm(directory, { recursive: true, force: true }); });
const button = (text) => [...document.querySelectorAll('button')].find((item) => (item.textContent.trim() === text || item.getAttribute('aria-label') === text) && !item.closest('[hidden]'));
async function click(text) { if (!button(text) && ['Gardens','Catalogue','Calendar'].includes(text) && button('Menu')) await act(async()=>button('Menu').click()); assert.ok(button(text), 'Missing ' + text); await act(async () => button(text).click()); }
async function clickIn(headingId, label) {
  const section = document.getElementById(headingId).closest('section');
  const target = [...section.querySelectorAll('button')].find((item) => item.textContent.trim() === label);
  assert.ok(target, `Missing ${label} in ${headingId}`); await act(async () => target.click());
}
async function change(id, value) {
  if (id === 'catalogue-section') {
    const labels = { families:'Families', plants:'Crops', plant_cultivars:'Cultivars', seed_mixtures:'Seed mixtures', calendar_profiles:'Configure calendars', calendar_coverage:'Configure calendar coverage', plant_calendar_entries:'Growing calendar', materials:'Mulch materials', mulch_categories:'Configure mulch categories' };
    const group = ['families','plants','plant_cultivars','seed_mixtures'].includes(value) ? 'Plants' : ['materials','mulch_categories'].includes(value) ? 'Mulch' : 'Calendar';
    await click(group);
    const target = [...document.querySelectorAll('[aria-label="Catalogue sections"] button')].find(item=>item.textContent.trim()===labels[value]);
    assert.ok(target, 'Missing section '+value); await act(async()=>target.click()); return;
  }
  const element = document.getElementById(id); assert.ok(element, 'Missing ' + id);
  await act(async () => {
    Object.getOwnPropertyDescriptor(element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set.call(element, value);
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
  return { catalogue: { isAdmin, families: [family], plants: [crop], cultivars: references.plant_cultivars.map(row => ({ ...row, plantTypeId: row.plant_type_id, plantSpacingCm: null, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null })), rules: [] }, references,
    mulch: { isAdmin, categories: references.mulch_categories, types: [{ id: 'straw', name: 'Straw', notes: '', categoryId: 'category', version: 1 }] },
    mixtures: [{ id: 'mix', name: 'Cover mix', notes: '', version: 3, components: [{ plantTypeId: crop.id, cultivarId: 'cultivar', percentage: 100 }] }], writes: [], mounts: 0 };
}
async function open(Component, props, data = fixture()) {
  globalThis.__page = data; root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(Component, props)));
}
const sections = ['families', 'plants', 'plant_cultivars', 'seed_mixtures', 'calendar_profiles', 'calendar_coverage', 'plant_calendar_entries', 'materials', 'mulch_categories'];

test('grouped navigation protects unsaved edits, handles failed saves, and permits discard', async () => {
  let backs=0; const data=fixture();
  await open(CataloguePage,{userId:'admin',onBack:()=>backs++},data);
  assert.deepEqual([...document.querySelectorAll('[aria-label="Catalogue groups"] button')].map(item=>item.textContent),['Plants','Mulch']);
  await change('catalogue-section','plants'); await click('Edit'); await change('details-name','Changed');
  await click('Back to catalogue'); assert.equal(backs,0); await click('Stay');
  assert.equal(document.getElementById('details-name').value,'Changed');
  data.saveError=true; await click('Back to catalogue'); await click('Save and leave');
  assert.equal(backs,0); assert.equal(document.getElementById('details-name').value,'Changed');
  await click('Stay'); data.saveError=false;
  await click('Back to catalogue'); await click('Save and leave'); assert.equal(backs,0);
  await click('Back to gardens'); assert.equal(backs,1);
  assert.equal(data.writes.at(-1).details.name,'Changed');
  await click('Edit'); await change('details-name','Discard me'); await click('Mulch');
  await click('Discard and leave'); assert.ok(button('Add mulch type'));
  await change('catalogue-section','plants'); assert.equal(document.getElementById('details-name').value,'Watermelon');
});

test('ordinary users browse groups without administrator configuration or editing controls', async () => {
  await open(CataloguePage,{userId:'reader',onBack:()=>{}},fixture(false));
  for (const group of ['Plants','Mulch']) {
    await click(group);
    assert.equal(button('Edit'),undefined); assert.equal(button('Remove'),undefined);
    assert.equal([...document.querySelectorAll('[aria-label="Catalogue sections"] button')].some(item=>item.textContent.startsWith('Configure')),false);
  }
  assert.equal(globalThis.__page.writes.length,0);
});

function withStore(active) {
  const data = fixture();
  data.store = { active, gardens: active ? [active] : [], editorVersion: 1, loading: false, error: '',
    remember() {}, async choose() {}, async create() {}, async refresh() {}, retry() {} };
  return data;
}
test('workspace opens a dedicated catalogue and returns without remounting or losing the editor draft', async () => {
  const active = { beds: [], id: 'garden', name: 'Kitchen garden', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 } };
  await open(GardensWorkspace, { user: { id: 'admin' } }, withStore(active));
  await click('Edit fixture plan'); await click('Your gardens');
  assert.equal([...document.querySelectorAll('dialog button')].some(b => b.textContent.trim() === 'Catalogue'), false);
  assert.equal(document.querySelectorAll('dialog button[aria-label^="Switch to"]').length, 0);
  await click('Close'); await click('Catalogue');
  assert.equal(document.querySelector('dialog'), null);
  const editor = document.querySelector('[data-testid="garden"]');
  assert.ok(editor.closest('[hidden]')); assert.ok(editor.closest('[inert]'));
  assert.equal(editor.dataset.paused, 'true');
  assert.equal(document.querySelector('h1').textContent, 'Catalogue');
  await change('catalogue-section', 'materials'); await click('Back to garden');
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.querySelector('[data-testid="garden"]'), editor);
  assert.equal(editor.closest('[hidden]'), null); assert.equal(editor.dataset.paused, 'false');
  assert.equal(document.getElementById('draft-value').textContent, '1');
  assert.equal(globalThis.__page.mounts, 1);
});

test('catalogue is available before creating a garden', async () => {
  await open(GardensWorkspace, { user: { id: 'admin' } }, withStore(null));
  assert.equal(button('Plant catalogue'), undefined); assert.equal(button('Mulch catalogue'), undefined);
  assert.equal(button('Catalogue'), undefined); assert.ok(button('App menu'));
  await click('Catalogue'); assert.ok(document.querySelector('[aria-label="Catalogue groups"]'));
  await click('Back to gardens'); assert.ok(button('Create a garden'));
  assert.equal(document.querySelector('dialog'), null);
});

test('direct garden catalogue navigation returns straight to the preserved draft', async () => {
  const active = { beds: [], id: 'garden', name: 'Kitchen garden', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 } };
  await open(GardensWorkspace, { user: { id: 'admin' } }, withStore(active));
  await click('Edit fixture plan');
  const editor = document.querySelector('[data-testid="garden"]');
  await click('Catalogue');
  assert.equal(document.querySelector('h1').textContent, 'Catalogue');
  await click('Back to garden');
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.querySelector('[data-testid="garden"]'), editor);
  assert.equal(document.getElementById('draft-value').textContent, '1');
  assert.equal(globalThis.__page.mounts, 1);
});


test('mixture editing validates total weight, preserves failed edits and saves components together', async () => {
  await open(CataloguePage, { userId: 'admin', onBack: () => {} });
  await change('catalogue-section', 'seed_mixtures');
  assert.match(document.body.textContent, /Cover mix/); await click('Edit');
  await change('mixture-percentage-0', '60'); await click('Save entry');
  assert.match(document.body.textContent, /must total 100%/); assert.equal(globalThis.__page.writes.length, 0);
  await click('Add component'); await change('mixture-crop-1', 'crop'); await change('mixture-percentage-1', '40');
  globalThis.__page.saveError = true; await click('Save entry');
  assert.match(document.body.textContent, /changed/); assert.equal(document.getElementById('mixture-percentage-0').value, '60');
  globalThis.__page.saveError = false; await click('Save entry');
  const saved = globalThis.__page.writes.at(-1);
  assert.equal(saved.table, 'seed_mixtures'); assert.equal(saved.current.version, 3);
  assert.deepEqual(saved.details.components, [{ plantTypeId: 'crop', cultivarId: 'cultivar', percentage: 60 }, { plantTypeId: 'crop', cultivarId: null, percentage: 40 }]);
});

test('all fields edit directly and one Save submits the complete crop draft; failures preserve it', async () => {
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);
  await change('catalogue-section','plants'); await click(globalThis.__page.catalogue.isAdmin ? 'Edit' : 'View');
  assert.equal(document.querySelectorAll('form').length,1);
  assert.equal(document.querySelectorAll('button[type="submit"]').length,1);
  assert.equal(button('Save').disabled,true);
  assert.equal(button('Edit'),undefined);assert.equal(button('Edit details'),undefined);
  assert.equal(document.querySelectorAll('h4').length,6);
  await change('details-name','Better melon');
  await change('care-monthly_feed','false');await change('depth-seed-depth_cm','3');
  await change('depth-seed-notes','Shallow sowing');
  await change('companion_rules-companion-add','plant:crop');
  data.saveError=true;await click('Save');
  assert.match(document.body.textContent,/changed/);
  assert.equal(document.getElementById('details-name').value,'Better melon');
  assert.equal(document.getElementById('depth-seed-depth_cm').value,'3');

  assert.equal(data.writes.length,0);
  data.saveError=false;await click('Save');
  assert.equal(data.writes.length,1);
  const saved=data.writes[0];assert.equal(saved.table,'crop_editor');assert.equal(saved.details.name,'Better melon');
  assert.equal(saved.changes.find(row=>row.table==='plant_guidance').details.monthly_feed,false);
  assert.equal(saved.changes.find(row=>row.table==='plant_depths').details.depth_cm,3);
  assert.equal(saved.changes.find(row=>row.table==='companion_rules').details.plant_a_id,'crop');
  assert.equal(button('Save').disabled,true);
  assert.match(document.body.textContent,/All changes saved/);
});

test('cultivar edits preserve inheritance and save care, depths, rotation and calendar overrides together',async()=>{
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);
  await change('catalogue-section','plant_cultivars');await click('Edit');
  assert.equal(document.getElementById('care-sun_requirement').value,'');
  assert.equal(document.getElementById('details-notes').placeholder,'');
  assert.equal(document.getElementById('depth-seed-depth_cm').getAttribute('aria-label'),'Seed Depth (cm)');
  assert.match(document.getElementById('care-sun_requirement').textContent,/Use crop default: Full sun/);
  assert.equal(document.getElementById('depth-seed-depth_cm').placeholder,'Inherited: 2');
  await change('care-monthly_feed','false');await change('depth-seed-depth_cm','4');
  await change('rotation_rules-favourable_after-add','plant:crop');
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
  await change('catalogue-section','plants'); await click(globalThis.__page.catalogue.isAdmin ? 'Edit' : 'View');assert.equal(document.querySelectorAll('h4').length,6);
  assert.equal(button('Save'),undefined);assert.equal(button('Add companion'),undefined);
  assert.ok([...document.querySelectorAll('form input,form select,form textarea')].every(field=>field.disabled));
});

test('discard restores the entire draft and pending saves block duplicate requests and navigation',async()=>{
  const data=fixture();await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);await change('catalogue-section','plants'); await click('Edit');
  await change('details-name','Discard me');await change('companion_rules-companion-add','plant:crop');await click('Discard changes');
  assert.equal(document.getElementById('details-name').value,'Watermelon');assert.equal(button('Save').disabled,true);
  await change('details-name','Keep me');
  let release;data.saveWait=new Promise(resolve=>{release=resolve});
  await click('Save');assert.equal(button('Save').disabled,true);assert.equal(document.getElementById('details-name').disabled,true);
  assert.equal(button('Discard changes').disabled,true);await click('Save');
  await act(async()=>release());assert.equal(data.writes.length,1);assert.equal(data.writes[0].details.name,'Keep me');
});

test('relationships use four plant lists without entry forms or notes; moving and undoing links preserves one Save',async()=>{
  const data=fixture();
  data.catalogue.rules=[{id:'pair',version:4,first:{kind:'plant',id:'crop'},second:{kind:'family',id:'family'},relationship:'companion',notes:'Existing explanation retained in storage'}];
  await open(CataloguePage,{userId:'admin',onBack:()=>{}},data);await change('catalogue-section','plants'); await click(globalThis.__page.catalogue.isAdmin ? 'Edit' : 'View');
  const companions=document.getElementById('crop-companions-heading').closest('section');
  const rotations=document.getElementById('crop-rotation-heading').closest('section');
  assert.deepEqual([...companions.querySelectorAll('h5 span:first-child')].map(el=>el.textContent),['Suggestions','Caution']);
  assert.deepEqual([...rotations.querySelectorAll('h5 span:first-child')].map(el=>el.textContent),['Favourable after','Avoid after']);
  assert.equal(companions.querySelector('textarea'),null);assert.equal(rotations.querySelector('textarea'),null);
  assert.doesNotMatch(companions.textContent,/Existing explanation/);
  assert.equal(companions.querySelector('[id$="-relationship"]'),null);
  const clickLabel=async(label)=>{const target=[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')===label);assert.ok(target,label);await act(async()=>target.click());};
  await clickLabel('Remove Cucurbitaceae · Family');
  assert.match(companions.textContent,/Undo/);await clickLabel('Restore Cucurbitaceae · Family');
  assert.equal(button('Save').disabled,true);
  await change('companion_rules-companion-add','cultivar:cultivar');
  assert.equal([...document.getElementById('companion_rules-companion-add').options].some(option=>option.value==='cultivar:cultivar'),false);
  await change('companion_rules-caution-add','cultivar:cultivar');
  assert.equal(companions.querySelectorAll('li').length,2);
  assert.match(document.getElementById('companion_rules-caution-heading').parentElement.textContent,/Crimson Sweet/);
  await change('rotation_rules-favourable_after-add','plant:crop');
  assert.match(rotations.textContent,/Unsaved override/);
  await clickLabel('Remove Watermelon');
  assert.match(document.getElementById('rotation_rules-avoid_after-heading').parentElement.textContent,/Inherited/);
  await click('Save');
  assert.equal(data.writes.length,1);
  assert.equal(data.writes[0].changes.length,1);
  assert.equal(data.writes[0].changes[0].details.relationship,'caution');
  assert.equal(data.writes[0].changes[0].details.notes,'');
  assert.equal(data.writes[0].changes[0].details.cultivar_a_id,'cultivar');
});


test('monthly calendar searches and filters crops, handles winter windows and shows cultivar overrides',async()=>{
  const data=fixture();
  data.references.plant_calendar_entries.push({ ...data.references.plant_calendar_entries[0],id:'winter',activity:'harvest',planting_method:'plant',notes:'Nov-Feb' },
    {...data.references.plant_calendar_entries[0],id:'override',cultivar_id:'cultivar'});
  data.references.calendar_windows.push({id:'winter-window',calendar_entry_id:'winter',start_month:11,end_month:2},
    {id:'override-window',calendar_entry_id:'override',start_month:2,end_month:3});
  await open(GrowingCalendar,{userId:'admin',garden:{name:'Kitchen',beds:[],dimensions:{widthCm:100,lengthCm:100},location:{countryCode:'IT',regionCode:'IT-25',displayName:'Lombardia'}}},data);
  await change('growing-month','4');
  assert.ok(button('Watermelon')); assert.equal(button('Watermelon · Crimson Sweet'),undefined);
  await change('growing-month','2'); assert.ok(button('Watermelon · Crimson Sweet'));
  assert.match(document.body.textContent,/Variety override/);
  await change('growing-activity','harvest'); assert.match(document.body.textContent,/Nov–Feb/);
  await change('growing-search','unknown'); assert.match(document.body.textContent,/No matching activities/);
  await change('growing-search',''); await click('Annual view'); assert.ok(document.querySelector('[role="img"]'));
  const checkbox=document.querySelector('input[type="checkbox"]'); await act(async()=>checkbox.click());
  assert.match(document.body.textContent,/0 crops and varieties/);
});

test('calendar load failures allow retry and missing regional coverage remains explicit',async()=>{
  const data=fixture();data.referenceError=true;
  await open(GrowingCalendar,{userId:'admin',location:{countryCode:'IT',regionCode:'missing',displayName:'Unknown region'}},data);
  assert.ok(document.querySelector('[role="alert"]')); data.referenceError=false; await click('Try again');
  assert.match(document.body.textContent,/No calendar covers this garden/);
  assert.match(document.body.textContent,/not specific to your garden/);
  await click('Annual view'); await click('Watermelon'); assert.ok(document.getElementById('crop-calendar-heading'));
  assert.equal(document.getElementById('calendar-entry-window-0-start_month').tagName,'SELECT');
});

test('growing calendar is a garden action, preserves filters and is absent from the top-right Menu',async()=>{
  await open(GardensWorkspace,{user:{id:'admin'}},withStore({id:'garden',name:'Kitchen',ownerId:'admin',dimensions:{widthCm:500,lengthCm:500},beds:[]}));
  await click('App menu');
  assert.equal([...document.querySelectorAll('dialog button')].some(b=>b.textContent==='Calendar'),false);
  await click('Close'); await click('Calendar'); await click('Seasonal guidance'); await change('growing-month','5'); await change('growing-search','melon');
  await click('Catalogue'); assert.equal(button('Calendar'),undefined);
  await click('Back to calendar');
  assert.equal(document.getElementById('growing-month').value,'5');assert.equal(document.getElementById('growing-search').value,'melon');
  const fields=[...document.querySelectorAll('input[id],select[id]')];
  assert.equal(new Set(fields.map(field=>field.id)).size,fields.length);
});

test('calendar header Back protects dirty crop details and returns to the preserved editor',async()=>{
  const data=withStore({id:'garden',name:'Kitchen',ownerId:'admin',dimensions:{widthCm:500,lengthCm:500},beds:[]});
  await open(GardensWorkspace,{user:{id:'admin'}},data);
  await click('Edit fixture plan'); await click('Calendar'); await click('Seasonal guidance');
  await click('Annual view'); await click('Watermelon'); await change('details-name','Keep calendar edit');
  await click('Back to seasonal guidance'); assert.ok(button('Stay')); await click('Stay');
  assert.equal(document.getElementById('details-name').value,'Keep calendar edit');
  await click('Back to seasonal guidance'); await click('Discard and leave');
  assert.ok(button('Monthly overview'));
  await click('Back to garden');
  assert.equal(document.querySelector('[data-testid="garden"]').closest('[hidden]'),null);
  assert.equal(document.getElementById('draft-value').textContent,'1'); assert.equal(data.mounts,1);
});

test('family form Back uses the same Save, Discard and Stay protection',async()=>{
  await open(CataloguePage,{userId:'admin',onBack:()=>{}}); await change('catalogue-section','families'); await click('Edit');
  await change('catalogue-entry-name','Changed family'); await click('Back to catalogue'); await click('Stay');
  assert.equal(document.getElementById('catalogue-entry-name').value,'Changed family');
  await click('Back to catalogue'); await click('Save and leave');
  assert.equal(globalThis.__page.writes.at(-1).details.name,'Changed family');
  assert.equal(document.querySelector('form'),null);
});

test('catalogue starts at Families, uses compact lists and retains saved family identity', async () => {
  await open(CataloguePage, { userId: 'admin', onBack() {} });
  assert.deepEqual([...document.querySelectorAll('[aria-label="Catalogue sections"] button')].map(item => item.textContent), ['Families', 'Crops', 'Cultivars', 'Seed mixtures']);
  assert.equal(document.querySelector('[aria-label="Catalogue sections"] [aria-current="page"]').textContent, 'Families');
  assert.doesNotMatch(document.body.textContent, /Between plants:/);
  await click('Add family'); await change('catalogue-entry-name', 'New family'); await click('Save entry');
  const form = document.querySelector('form'); assert.ok(form);
  await change('catalogue-entry-name', 'Updated family'); await click('Save entry');
  assert.equal(document.querySelector('form'), form);
  const write = globalThis.__page.writes.at(-1);
  assert.equal(write.current.id, 'new'); assert.equal(write.current.version, 1);
  await click('Back to catalogue'); assert.equal(button('Stay'), undefined);
  assert.match(document.body.textContent, /Updated family/);
});

test('crop saves preserve the mounted form, scroll and current revisions across repeated saves', async () => {
  const data = fixture();
  data.afterCropSave = draft => { const crop = data.references.plant_types[0]; crop.name = draft.details.name; crop.version++; };
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'plants'); await click('Edit');
  const form = document.querySelector('form'), field = document.getElementById('details-name');
  const scroller = document.querySelector('[data-page-scroll]'); scroller.scrollTop = 420;
  await change('details-name', 'First save'); await click('Save');
  assert.equal(document.querySelector('form'), form); assert.equal(document.getElementById('details-name'), field);
  assert.equal(scroller.scrollTop, 420); assert.equal(field.value, 'First save');
  await change('details-name', 'Second save'); await click('Save');
  assert.equal(data.writes[1].version, 2); assert.equal(data.writes[1].cropVersion, 2);
  assert.equal(button('Save').disabled, true);
});

test('committed crop refresh failures keep the draft and retry only the read', async () => {
  const data = fixture(); data.afterCropSave = () => { data.referenceError = true; };
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'plants'); await click('Edit'); await change('details-name', 'Saved draft'); await click('Save');
  assert.match(document.body.textContent, /Saved successfully, but refresh failed/);
  assert.equal(document.getElementById('details-name').value, 'Saved draft');
  assert.equal(button('Save').disabled, true); assert.equal(data.writes.length, 1);
  data.referenceError = false; await click('Refresh saved entry');
  assert.equal(data.writes.length, 1); assert.equal(button('Save').disabled, true);
});

test('seed mixtures remain open with fresh revisions and refresh retries do not duplicate writes', async () => {
  const data = fixture(); await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'seed_mixtures'); await click('Edit');
  await change('mixture-name', 'Saved mix'); await click('Save entry');
  assert.equal(document.getElementById('mixture-name').value, 'Saved mix');
  data.afterMixtureSave = () => { data.mixtureLoadError = true; };
  await change('mixture-notes', 'Second save'); await click('Save entry');
  assert.equal(data.writes.at(-1).current.version, 4);
  assert.match(document.body.textContent, /Saved successfully, but refresh failed/);
  assert.equal(button('Save entry').disabled, true);
  data.mixtureLoadError = false; await click('Refresh saved entry');
  assert.equal(data.writes.length, 2); assert.equal(document.getElementById('mixture-notes').value, 'Second save');
});

test('configuration saves remain open and use the returned revision', async () => {
  await open(CataloguePage, { userId: 'admin', onBack() {} });
  await change('catalogue-section', 'mulch_categories'); await click('Edit');
  await change('reference-name', 'Organic mulch'); await click('Save entry');
  const form = document.querySelector('form');
  await change('reference-name', 'Organic materials'); await click('Save entry');
  assert.equal(document.querySelector('form'), form);
  assert.equal(globalThis.__page.writes.at(-1).current.version, 2);
  await click('Back to catalogue'); assert.equal(button('Stay'), undefined);
});

test('read-only family, mixture and mulch details preserve access without save actions', async () => {
  await open(CataloguePage, { userId: 'reader', onBack() {} }, fixture(false));
  for (const section of ['families', 'seed_mixtures', 'materials']) {
    await change('catalogue-section', section); await click('View');
    assert.ok(document.querySelector('form'));
    assert.equal(document.querySelector('button[type="submit"]'), null);
    assert.ok([...document.querySelectorAll('form input, form select')].every(field => field.matches(':disabled')));
    await click('Back to catalogue');
  }
  assert.equal(globalThis.__page.writes.length, 0);
});

function navigationFixture(admin = true) {
  const data = fixture(admin);
  const family = { ...data.catalogue.families[0], id: 'family-other', name: 'Solanaceae' };
  const melon = { ...data.catalogue.plants[0], id: 'melon', name: 'Melon' };
  const tomato = { ...data.catalogue.plants[0], id: 'tomato', familyId: family.id, name: 'Tomato' };
  data.catalogue.families.push(family); data.catalogue.plants.push(melon, tomato);
  data.references.plant_families.push({ ...family, plant_spacing_cm: 40, row_spacing_cm: 60 });
  for (const crop of [melon, tomato]) data.references.plant_types.push({ ...data.references.plant_types[0], id: crop.id, name: crop.name, family_id: crop.familyId });
  const cultivar = { ...data.catalogue.cultivars[0], id: 'sugar-baby', name: 'Sugar Baby' };
  data.catalogue.cultivars.push(cultivar);
  data.references.plant_cultivars.push({ ...data.references.plant_cultivars[0], id: cultivar.id, name: cultivar.name });
  return data;
}

test('linked family, crop and cultivar details work for readers and return to the original list', async () => {
  await open(CataloguePage, { userId: 'reader', onBack() {} }, navigationFixture(false));
  await click('View Cucurbitaceae');
  assert.ok(button('Open crop Watermelon')); assert.ok(button('Open crop Melon')); assert.equal(button('Open crop Tomato'), undefined);
  await click('Open crop Watermelon');
  assert.equal(document.getElementById('details-name').value, 'Watermelon');
  assert.ok(button('Open family Cucurbitaceae')); assert.ok(button('Open cultivar Crimson Sweet'));
  await click('Open cultivar Crimson Sweet');
  assert.equal(document.getElementById('details-name').value, 'Crimson Sweet');
  assert.ok(button('Open crop Watermelon')); assert.ok(button('Open family Cucurbitaceae'));
  await click('Next'); assert.equal(document.getElementById('details-name').value, 'Sugar Baby');
  assert.equal(button('Next').disabled, true);
  await click('Open crop Watermelon'); await click('Open family Cucurbitaceae');
  assert.equal(document.getElementById('catalogue-entry-name').value, 'Cucurbitaceae');
  assert.equal(document.querySelector('button[type="submit"]'), null);
  await click('Back to catalogue'); assert.equal(button('Stay'), undefined);
  assert.ok(button('View Cucurbitaceae')); assert.equal(globalThis.__page.writes.length, 0);
});

test('Previous and Next follow the filtered crop sequence and restore list search, scroll and focus', async () => {
  await open(CataloguePage, { userId: 'admin', onBack() {} }, navigationFixture());
  await change('catalogue-section', 'plants'); await change('catalogue-search', 'melon');
  const scroller = document.querySelector('[data-page-scroll]'); scroller.scrollTop = 315;
  button('Edit Watermelon').focus(); await click('Edit Watermelon');
  assert.equal(button('Previous').disabled, true); assert.equal(button('Next').disabled, false);
  await click('Next'); assert.equal(document.getElementById('details-name').value, 'Melon');
  assert.equal(button('Next').disabled, true);
  await click('Previous'); assert.equal(document.getElementById('details-name').value, 'Watermelon');
  await click('Back to catalogue');
  assert.equal(document.getElementById('catalogue-search').value, 'melon');
  assert.equal(scroller.scrollTop, 315); assert.ok(document.activeElement === button('Edit Watermelon'), 'focus returns to the originating crop action');
  assert.equal(button('Edit Tomato'), undefined);
});

test('detail navigation guards dirty forms and saves or discards before changing entries', async () => {
  const data = navigationFixture(); await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await click('Edit Cucurbitaceae'); await change('catalogue-entry-name', 'Updated family');
  await click('Next'); await click('Stay'); assert.equal(document.getElementById('catalogue-entry-name').value, 'Updated family');
  await click('Next'); await click('Save and leave');
  assert.equal(data.writes.at(-1).details.name, 'Updated family');
  assert.equal(document.getElementById('catalogue-entry-name').value, 'Solanaceae');
  await click('Previous'); assert.equal(document.getElementById('catalogue-entry-name').value, 'Updated family');
  await click('Open crop Watermelon'); await change('details-name', 'Unsaved crop');
  await click('Open cultivar Crimson Sweet'); await click('Stay');
  assert.equal(document.getElementById('details-name').value, 'Unsaved crop');
  data.saveError = true; await click('Open family Updated family'); await click('Save and leave');
  assert.equal(document.getElementById('details-name').value, 'Unsaved crop');
  await click('Stay'); data.saveError = false;
  await click('Open cultivar Crimson Sweet'); await click('Discard and leave');
  assert.equal(document.getElementById('details-name').value, 'Crimson Sweet');
  assert.equal(button('Save').disabled, true);
});

test('cultivar list search determines its sibling sequence and parent links preserve the origin', async () => {
  await open(CataloguePage, { userId: 'reader', onBack() {} }, navigationFixture(false));
  await change('catalogue-section', 'plant_cultivars'); await change('reference-search', 'Sugar'); await click('View');
  assert.equal(button('Previous').disabled, true); assert.equal(button('Next').disabled, true);
  await click('Open crop Watermelon'); assert.equal(document.getElementById('details-name').value, 'Watermelon');
  await click('Back to catalogue'); assert.equal(document.getElementById('reference-search').value, 'Sugar');
  assert.match(document.body.textContent, /Sugar Baby/);
});

test('empty relationships and single-entry lists show clear boundaries', async () => {
  const data = fixture(false); data.catalogue.cultivars = []; data.references.plant_cultivars = [];
  await open(CataloguePage, { userId: 'reader', onBack() {} }, data);
  await click('View'); assert.equal(button('Previous').disabled, true); assert.equal(button('Next').disabled, true);
  await click('Open crop Watermelon'); assert.match(document.body.textContent, /No cultivars of this crop yet/);
  assert.equal(button('Previous').disabled, true); assert.equal(button('Next').disabled, true);
});

function mulchNavigationFixture(admin = true) {
  const data = fixture(admin);
  data.mulch.categories.push({ id: 'synthetic', code: 'synthetic', name: 'Synthetic mulch', version: 1 }, { id: 'living', code: 'living', name: 'Living mulch', version: 1 });
  data.mulch.types.push({ id: 'hay', name: 'Hay', notes: '', version: 2, categoryId: 'category' },
    { id: 'canvas', name: 'Canvas', notes: '', version: 1, categoryId: 'synthetic' },
    { id: 'living:crop:basil', name: 'Basil', notes: '', version: 1, categoryId: 'living', categoryCode: 'living', plantTypeId: 'crop', available: true });
  return data;
}

test('mulch detail navigation follows the filtered category and restores search, scroll and focus', async () => {
  const data = mulchNavigationFixture();
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'materials'); await change('mulch-catalogue-search', 'a');
  const scroller = document.querySelector('[data-page-scroll]'); scroller.scrollTop = 260;
  button('Edit Straw').focus(); await click('Edit Straw');
  assert.equal(button('Previous').disabled, true); assert.equal(button('Next').disabled, false);
  await change('mulch-type-notes', 'Saved before navigation'); await click('Next'); await click('Stay');
  assert.equal(document.getElementById('mulch-type-notes').value, 'Saved before navigation');
  data.saveError = true; await click('Next'); await click('Save and leave');
  assert.equal(document.getElementById('mulch-type-name').value, 'Straw'); await click('Stay');
  data.saveError = false; await click('Next'); await click('Save and leave');
  assert.equal(document.getElementById('mulch-type-name').value, 'Hay'); assert.equal(button('Next').disabled, true);
  await click('Previous'); assert.equal(document.getElementById('mulch-type-notes').value, 'Saved before navigation');
  await click('Back to catalogue');
  assert.equal(document.getElementById('mulch-catalogue-search').value, 'a'); assert.equal(scroller.scrollTop, 260);
  assert.ok(document.activeElement === button('Edit Straw'), 'focus returns to the material action');
  assert.equal(data.writes.at(-1).current.id, 'straw');
  assert.equal(document.querySelector('section[aria-label="Living mulch"] button[aria-label^="Remove"]'), null);
  assert.equal(document.querySelector('section[aria-label="Living mulch"] button[aria-label^="Edit"]'), null);
});

test('read-only mulch details share plant navigation without editing or living-material management actions', async () => {
  const data = mulchNavigationFixture(false);
  await open(CataloguePage, { userId: 'reader', onBack() {} }, data);
  await change('catalogue-section', 'materials'); await click('View Straw'); await click('Next');
  assert.equal(document.getElementById('mulch-type-name').value, 'Hay');
  assert.equal(document.querySelector('button[type="submit"]'), null);
  await click('Back to catalogue');
  assert.equal(document.querySelector('section[aria-label="Living mulch"] button[aria-label^="Remove"]'), null);
  assert.equal(document.querySelector('section[aria-label="Living mulch"] button[aria-label^="Edit"]'), null);
  assert.equal(data.writes.length, 0);
});

test('mulch sibling controls are disabled during save and Discard navigation resets the form', async () => {
  const data = mulchNavigationFixture(); await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'materials'); await click('Edit Straw');
  await change('mulch-type-name', 'Unsaved name'); await click('Next'); await click('Discard and leave');
  assert.equal(document.getElementById('mulch-type-name').value, 'Hay');
  await change('mulch-type-notes', 'Pending note');
  let release; data.saveWait = new Promise(resolve => { release = resolve; }); await click('Save mulch type');
  assert.equal(button('Previous').matches(':disabled'), true);
  await act(async () => release()); await click('Previous');
  assert.equal(document.getElementById('mulch-type-name').value, 'Straw');
});

test('families offer confirmed removal beside Edit and preserve entries on dependency failures', async () => {
  const data = fixture(); data.catalogue.families.push({ ...data.catalogue.families[0], id: 'unused', name: 'Unused family' });
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await click('Remove Unused family'); assert.match(document.querySelector('dialog').textContent, /Unused family/);
  await click('Cancel'); assert.equal(data.removals, undefined);
  data.removalError = true; data.removalErrorKey = 'catalogue.familyInUse';
  await click('Remove Cucurbitaceae'); await click('Remove from catalogue');
  assert.match(document.querySelector('dialog').textContent, /used by crops or relationship rules/);
  assert.ok(button('Edit Cucurbitaceae')); await click('Cancel');
  data.removalError = false; await click('Remove Unused family'); await click('Remove from catalogue');
  assert.equal(button('Edit Unused family'), undefined); assert.ok(button('Edit Cucurbitaceae'));
  assert.equal(data.removals.at(-1).kind, 'plant_family'); assert.equal(data.removals.at(-1).current.id, 'unused');
});

test('crops explain guidance cleanup and keep their Remove action after a failed request', async () => {
  const data = fixture(); data.catalogue.cultivars = []; data.references.plant_cultivars = [];
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data); await change('catalogue-section', 'plants');
  await click('Remove Watermelon'); assert.match(document.querySelector('dialog').textContent, /care, planting depths, companion rules/);
  data.removalError = true; data.removalErrorKey = 'catalogue.cropInUse'; await click('Remove from catalogue');
  assert.ok(button('Edit Watermelon')); assert.match(document.querySelector('dialog').textContent, /used by cultivars, seed mixtures or living mulch/);
  data.removalError = false; await click('Remove from catalogue'); assert.equal(button('Edit Watermelon'), undefined);
  assert.equal(data.removals.at(-1).kind, 'plant_type'); assert.equal(data.removals.at(-1).current.version, 1);
});

test('seed mixtures and mulch categories have confirmed removal with pending-request protection', async () => {
  const data = fixture(); data.mulch.types = [];
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data); await change('catalogue-section', 'seed_mixtures');
  await click('Remove Cover mix');
  let release; data.removalWait = new Promise(resolve => { release = resolve; });
  await click('Remove from catalogue'); assert.equal(button('Removing…').disabled, true); assert.equal(button('Cancel').disabled, true);
  await act(async () => release()); assert.equal(button('Remove Cover mix'), undefined);
  assert.equal(data.removals.at(-1).kind, 'seed_mixture');
  await change('catalogue-section', 'mulch_categories');
  await click('Remove Organic'); data.removalError = true; data.removalErrorKey = 'catalogue.categoryInUse'; await click('Remove from catalogue');
  assert.match(document.querySelector('dialog').textContent, /used by materials or enabled living-mulch plants/);
  data.removalError = false; await click('Remove from catalogue'); assert.equal(button('Remove Organic'), undefined);
  assert.equal(data.removals.at(-1).kind, 'mulch_category');
});

test('readers have no Remove actions in any plant section or mulch category configuration', async () => {
  await open(CataloguePage, { userId: 'reader', onBack() {} }, fixture(false));
  for (const section of ['families', 'plants', 'plant_cultivars', 'seed_mixtures', 'materials']) {
    await change('catalogue-section', section); assert.equal(button('Remove'), undefined);
  }
  assert.equal(button('Configure mulch categories'), undefined);
});

function livingLinkFixture(admin = true) {
  const data = fixture(admin);
  const crop = data.catalogue.plants[0], cultivar = data.catalogue.cultivars[0];
  crop.livingMulchEnabled = true; data.references.plant_types[0].living_mulch_enabled = true;
  data.mulch.plants = data.catalogue;
  data.mulch.categories.push({ id: 'living', name: 'Living mulch', code: 'living', version: 1 });
  data.mulch.types.push({ id: `living:crop:${crop.id}`, name: crop.name, notes: '', version: 1, categoryId: 'living', categoryCode: 'living', plantTypeId: crop.id, available: true },
    { id: `living:cultivar:${cultivar.id}`, name: `${crop.name} · ${cultivar.name}`, notes: '', version: 1, categoryId: 'living', categoryCode: 'living', plantTypeId: crop.id, cultivarId: cultivar.id, available: true });
  return data;
}

test('living mulch opens the matching crop and cultivar with read-only access and restores list context', async () => {
  const data = livingLinkFixture(false);
  await open(CataloguePage, { userId: 'reader', onBack() {} }, data);
  await change('catalogue-section', 'materials'); await change('mulch-catalogue-search', 'Watermelon');
  const scroller = document.querySelector('[data-page-scroll]'); scroller.scrollTop = 240;
  button('Open crop Watermelon').focus(); await click('Open crop Watermelon');
  assert.equal(document.getElementById('details-name').value, 'Watermelon'); assert.equal(button('Save'), undefined);
  assert.ok([...document.querySelectorAll('form input, form select, form textarea')].every(field => field.matches(':disabled')));
  await click('Next'); assert.equal(document.getElementById('details-name').value, 'Crimson Sweet');
  await click('Back to catalogue');
  assert.equal(document.getElementById('mulch-catalogue-search').value, 'Watermelon'); assert.equal(scroller.scrollTop, 240);
  assert.ok(document.activeElement === button('Open crop Watermelon'));
  await click('Open cultivar Watermelon · Crimson Sweet'); assert.equal(document.getElementById('details-name').value, 'Crimson Sweet');
  await click('Back to catalogue');
  const living = document.querySelector('section[aria-label="Living mulch"]');
  assert.equal([...living.querySelectorAll('button')].filter(item => ['Edit', 'Remove'].includes(item.textContent.trim())).length, 0);
  assert.equal(data.writes.length, 0);
});

test('living plant navigation guards edits and refreshes the mulch list after disabling eligibility', async () => {
  const data = livingLinkFixture();
  data.afterCropSave = draft => {
    const enabled = draft.details.living_mulch_enabled === 'true';
    data.catalogue.plants[0].livingMulchEnabled = enabled;
    data.references.plant_types[0].living_mulch_enabled = enabled;
    if (!enabled) data.mulch.types = data.mulch.types.filter(item => item.categoryCode !== 'living');
  };
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data);
  await change('catalogue-section', 'materials'); await change('mulch-catalogue-search', 'Watermelon');
  button('Open crop Watermelon').focus(); await click('Open crop Watermelon'); await change('details-name', 'Unsaved name');
  await click('Back to catalogue'); await click('Stay'); assert.equal(document.getElementById('details-name').value, 'Unsaved name');
  await click('Discard changes'); await change('details-living_mulch_enabled', 'false');
  data.saveError = true; await click('Save'); assert.equal(document.getElementById('details-living_mulch_enabled').value, 'false');
  data.saveError = false; await click('Save'); await click('Back to catalogue');
  assert.equal(document.getElementById('mulch-catalogue-search').value, 'Watermelon');
  assert.equal(button('Open crop Watermelon'), undefined); assert.match(document.body.textContent, /No matching living mulch plants/);
  assert.ok(document.activeElement === document.getElementById('mulch-catalogue-search'), 'removed entries return focus to the search field');
  assert.equal(data.writes.at(-1).table, 'crop_editor'); assert.equal(data.writes.at(-1).details.living_mulch_enabled, false);
});

for (const admin of [true, false]) test(`catalogue sections share consistent ${admin ? 'administrator' : 'reader'} descriptions`, async () => {
  await open(CataloguePage, { userId: admin ? 'admin' : 'reader', onBack() {} }, fixture(admin));
  const expected = admin ? 'Shared across all gardens. You can add, edit and remove entries.' : 'Shared across all gardens. Catalogue administrators manage these entries.';
  const sections = ['families', 'plants', 'plant_cultivars', 'seed_mixtures', 'materials', ...(admin ? ['mulch_categories'] : [])];
  for (const section of sections) {
    await change('catalogue-section', section);
    const messages = [...document.querySelectorAll('p')].filter(item => !item.closest('[hidden]') && item.textContent.startsWith('Shared across all gardens.'));
    assert.deepEqual(messages.map(item => item.textContent), [expected], section);
    assert.doesNotMatch(document.body.textContent, /An app-wide|You are a catalogue administrator/);
  }
  if (admin) {
    await click('Edit'); assert.doesNotMatch(document.querySelector('form').textContent, /Cultivars inherit crop guidance/);
  }
});


test('workspace Back follows Catalogue and Calendar visits in reverse order without remounting the garden', async () => {
  const active = { id: 'garden', name: 'Kitchen garden', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [] };
  const data = withStore(active);
  await open(GardensWorkspace, { user: { id: 'admin' } }, data);
  await click('Edit fixture plan'); const garden = document.querySelector('[data-testid="garden"]');
  await click('Calendar'); await click('Catalogue');
  assert.ok(button('Back to calendar').closest('[data-page-header]'));
  await click('Back to calendar'); assert.ok(button('Back to garden'));
  await click('Back to garden');
  assert.equal(garden.closest('[hidden]'), null); assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.getElementById('draft-value').textContent, '1'); assert.equal(data.mounts, 1);
});

test('catalogue detail uses one header Back action and restores the workspace destination after returning to its list', async () => {
  let returns = 0;
  await open(CataloguePage, { userId: 'admin', onBack: () => returns++ });
  const header = document.querySelector('[data-page-header]'), title = header.querySelector('h1');
  await click('Edit');
  const back = button('Back to catalogue');
  assert.equal(back.closest('[data-page-header]'), header); assert.equal(back.title, 'Back to catalogue');
  assert.equal([...document.querySelectorAll('button')].filter(item => item.getAttribute('aria-label') === 'Back to catalogue' && !item.closest('[hidden]')).length, 1);
  assert.equal(header.querySelector('h1'), title);
  await click('Back to catalogue'); assert.equal(returns, 0);
  assert.equal(button('Back to gardens').closest('[data-page-header]'), header);
  await click('Back to gardens'); assert.equal(returns, 1);
});

test('Calendar configuration restores each parent Back action after closing a nested form', async () => {
  const data = withStore({ id: 'garden', name: 'Kitchen', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [] });
  await open(GardensWorkspace, { user: { id: 'admin' } }, data);
  await click('Calendar'); await click('Seasonal guidance'); await click('Calendar profiles');
  assert.ok(button('Back to seasonal guidance').closest('[data-page-header]'));
  await click('Add entry');
  assert.ok(button('Back to calendar profiles').closest('[data-page-header]'));
  await click('Back to calendar profiles');
  assert.ok(button('Back to seasonal guidance').closest('[data-page-header]'));
  await click('Back to seasonal guidance'); await click('Back to garden');
  assert.equal(document.querySelector('[data-testid="garden"]').closest('[hidden]'), null);
});

test('garden creation uses the sheet header Back to return to its list without closing the picker', async () => {
  const data = withStore({ id: 'garden', name: 'Kitchen', ownerId: 'admin', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [] });
  await open(GardensWorkspace, { user: { id: 'admin' } }, data);
  await click('Your gardens'); await click('Create another garden');
  assert.equal(document.querySelector('dialog h2').textContent, 'Create garden');
  assert.ok(button('Back to gardens').closest('dialog [data-dialog-header]'));
  await click('Back to gardens');
  assert.equal(document.querySelector('dialog h2').textContent, 'Your gardens');
  assert.ok(document.querySelector('dialog')); assert.ok(button('Create another garden'));
  await click('Close'); assert.equal(document.querySelector('dialog'), null);
});

const rotationGroup = relationship => document.getElementById(`rotation_rules-${relationship}-heading`).parentElement;
for (const admin of [true, false]) for (const section of ['plants', 'plant_cultivars']) test(`automatic family is read-only and write-free for ${admin ? 'administrator' : 'reader'} ${section}`, async () => {
  const data = fixture(admin); data.references.rotation_rules = [];
  await open(CataloguePage, { userId: admin ? 'admin' : 'reader', onBack() {} }, data);
  await change('catalogue-section', section); await click(admin ? 'Edit' : 'View');
  const avoid = rotationGroup('avoid_after'), item = [...avoid.querySelectorAll('li')].find(li => li.textContent.includes('Automatic'));
  assert.ok(item); assert.match(item.textContent, /Cucurbitaceae · Family/); assert.equal(item.querySelectorAll('button').length, 0);
  assert.equal(avoid.querySelectorAll('li').length, 1);
  if (admin) {
    assert.equal(button('Save').disabled, true);
    assert.ok(![...document.getElementById('rotation_rules-avoid_after-add').options].some(option => option.value === 'family:family'));
    assert.ok([...document.getElementById('rotation_rules-favourable_after-add').options].some(option => option.value === 'family:family'));
  }
  await click('Back to catalogue'); assert.equal(document.querySelector('dialog'), null); assert.equal(data.writes.length, 0);
});

test('own-family exceptions replace the fallback and removing an unsaved exception restores it without dirtying the form', async () => {
  const data = fixture(); data.references.rotation_rules = [];
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data); await change('catalogue-section', 'plants'); await click('Edit');
  await change('rotation_rules-favourable_after-add', 'family:family');
  assert.match(rotationGroup('favourable_after').textContent, /Cucurbitaceae.*Exception to the automatic family rule/);
  assert.equal(rotationGroup('avoid_after').querySelectorAll('li').length, 0);
  await click('Remove Cucurbitaceae · Family');
  assert.match(rotationGroup('avoid_after').textContent, /Automatic/); assert.equal(button('Save').disabled, true); assert.equal(data.writes.length, 0);
  await change('rotation_rules-favourable_after-add', 'family:family');
  data.afterCropSave = () => { data.references.rotation_rules = [{ id: 'exception', version: 1, current_plant_id: 'crop', previous_family_id: 'family', relationship: 'favourable_after', notes: '' }]; };
  await click('Save');
  assert.equal(data.writes.length, 1); const changes = data.writes[0].changes; assert.equal(changes.length, 1);
  assert.equal(changes[0].table, 'rotation_rules'); assert.equal(changes[0].details.relationship, 'favourable_after');
  assert.equal(changes[0].details.previous_family_id, 'family'); assert.equal(changes[0].details.current_plant_id, 'crop');
  assert.match(rotationGroup('favourable_after').textContent, /Exception to the automatic family rule/); assert.equal(button('Save').disabled, true);
});

test('existing own-family rules appear once and deleting a stored exception restores only the calculated fallback', async () => {
  const data = fixture(); data.references.rotation_rules = [{ id: 'same-family', version: 2, current_plant_id: 'crop', previous_family_id: 'family', relationship: 'avoid_after', notes: '' }];
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data); await change('catalogue-section', 'plants'); await click('Edit');
  assert.equal(rotationGroup('avoid_after').querySelectorAll('li').length, 1); assert.equal(button('Save').disabled, true);
  await change('rotation_rules-favourable_after-add', 'family:family');
  assert.match(rotationGroup('favourable_after').textContent, /Exception to the automatic family rule/);
  await click('Remove Cucurbitaceae · Family');
  assert.match(rotationGroup('avoid_after').textContent, /Automatic/);
  data.afterCropSave = () => { data.references.rotation_rules = []; };
  await click('Save'); assert.equal(data.writes[0].changes.length, 1); assert.equal(data.writes[0].changes[0].id, 'same-family');
  assert.equal(data.writes[0].changes[0].remove, true); assert.equal(rotationGroup('avoid_after').querySelectorAll('li').length, 1);
});

test('crop and cultivar exceptions retain inherited precedence alongside the automatic family fallback', async () => {
  const data = fixture(false); data.references.rotation_rules[0].relationship = 'favourable_after';
  await open(CataloguePage, { userId: 'reader', onBack() {} }, data); await change('catalogue-section', 'plant_cultivars'); await click('View');
  assert.match(rotationGroup('avoid_after').textContent, /Cucurbitaceae.*Automatic/);
  assert.match(rotationGroup('favourable_after').textContent, /Watermelon.*Exception to the automatic family rule.*Inherited/);
  assert.equal(data.writes.length, 0);
});

test('automatic family follows draft selection, Discard and saved family changes without generating rotation writes', async () => {
  const data = navigationFixture(); data.references.rotation_rules = [];
  await open(CataloguePage, { userId: 'admin', onBack() {} }, data); await change('catalogue-section', 'plants'); await click('Edit');
  await change('details-family_id', 'family-other'); assert.match(rotationGroup('avoid_after').textContent, /Solanaceae.*Automatic/);
  assert.ok([...rotationGroup('avoid_after').querySelectorAll('li')].every(item => !item.textContent.includes('Cucurbitaceae')));
  await click('Discard changes'); assert.match(rotationGroup('avoid_after').textContent, /Cucurbitaceae.*Automatic/); assert.equal(button('Save').disabled, true);
  await change('details-family_id', ''); assert.equal(rotationGroup('avoid_after').querySelectorAll('li').length, 0); await click('Discard changes');
  await change('details-family_id', 'family-other');
  data.afterCropSave = draft => { data.references.plant_types[0].family_id = draft.details.family_id; data.references.plant_types[0].version++; data.catalogue.plants[0].familyId = draft.details.family_id; };
  await click('Save'); assert.deepEqual(data.writes[0].changes, []); assert.equal(data.writes[0].details.family_id, 'family-other');
  assert.match(rotationGroup('avoid_after').textContent, /Solanaceae.*Automatic/); assert.equal(button('Save').disabled, true);
  await click('Back to catalogue'); await change('catalogue-section', 'plant_cultivars'); await click('Edit');
  assert.match(rotationGroup('avoid_after').textContent, /Solanaceae.*Automatic/); assert.equal(data.writes.length, 1);
});

function workFixture() {
  const bed={id:'bed-a',name:'Herbs',xCm:0,yCm:0,widthCm:100,lengthCm:100};
  const garden={id:'garden',name:'Kitchen',ownerId:'admin',version:1,updatedAt:'2026-11-24',dimensions:{widthCm:500,lengthCm:500},beds:[bed],location:{countryCode:'IT',regionCode:'IT-25',displayName:'Lombardia'}};
  const data=withStore(garden);data.tasks=[];data.workEvents=[];data.documents={garden};return data;
}
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const plannedTask=(values={})=>({id:'task',gardenId:'garden',bedId:'bed-a',bedName:'Herbs',activityType:'care',plannedDate:localToday(),title:'Water herbs',notes:'',status:'planned',order:1,version:1,...values});
const dialogButton=label=>[...document.querySelectorAll('dialog')].at(-1)?.querySelectorAll('button')&&[...[...document.querySelectorAll('dialog')].at(-1).querySelectorAll('button')].find(b=>(b.textContent.trim()===label||b.getAttribute('aria-label')===label));
async function clickDialog(label){assert.ok(dialogButton(label),'Missing dialog '+label);await act(async()=>dialogButton(label).click());}
const agenda=()=>document.querySelector('[aria-label="Work agenda"]');
async function openWork(data=workFixture()){await open(GardensWorkspace,{user:{id:'admin'}},data);await click('Calendar');return data;}

test('Calendar starts in Work and planning saves metadata only while preserving the mounted garden draft',async()=>{
  const data=workFixture();await open(GardensWorkspace,{user:{id:'admin'}},data);await click('Edit fixture plan');await click('Calendar');
  assert.equal(button('Work').getAttribute('aria-pressed'),'true');assert.equal(button('Seasonal guidance').getAttribute('aria-pressed'),'false');
  await click('Plan activity');await change('task-title','Water herbs');await change('task-bed','bed-a');await change('task-type','care');
  await click('Back to calendar');await click('Stay');assert.equal(document.getElementById('task-title').value,'Water herbs');
  await click('Back to calendar');await click('Save and leave');
  assert.equal(data.taskWrites.length,1);assert.equal(data.taskWrites[0].details.bedId,'bed-a');assert.equal(data.taskWrites[0].details.gardenId,'garden');
  assert.equal(data.taskWrites[0].details.plannedDate,localToday());assert.equal(data.writes.length,0);assert.equal(data.workEvents.length,0);assert.equal(document.querySelector('dialog'),null);
  assert.match(agenda().textContent,/Water herbs/);await click('Back to garden');assert.equal(document.getElementById('draft-value').textContent,'1');assert.equal(data.mounts,1);
});

test('task save prevents duplicate clicks, retains failed drafts and reuses retry IDs; refresh failure does not repeat the mutation',async()=>{
  const data=await openWork();await click('Plan activity');await change('task-title','Retry task');let release;data.taskGate=new Promise(resolve=>release=resolve);data.taskError=true;
  await click('Save task');assert.equal(button('Saving…').disabled,true);assert.equal(button('Close').disabled,true);assert.equal(data.taskWrites.length,1);
  await act(async()=>button('Saving…').click());assert.equal(data.taskWrites.length,1);await act(async()=>release());assert.match(document.querySelector('dialog').textContent,/Task failed/);
  assert.equal(document.getElementById('task-title').value,'Retry task');data.taskError=false;data.taskGate=undefined;data.workError=true;
  await click('Save task');assert.equal(data.taskWrites.length,2);assert.equal(data.taskWrites[0].id,data.taskWrites[1].id);assert.equal(data.taskWrites[0].request,data.taskWrites[1].request);
  assert.equal(document.querySelector('dialog'),null);assert.match(document.body.textContent,/Task saved/);assert.match(document.body.textContent,/Work unavailable/);
  data.workError=false;await click('Refresh work calendar');assert.equal(data.taskWrites.length,2);assert.match(agenda().textContent,/Retry task/);
});

test('task rescheduling conflicts retain fields until an explicit reload discards them and uses the latest revision',async()=>{
  const data=workFixture();data.tasks=[plannedTask()];await openWork(data);await click('Edit task');await change('task-title','My edit');data.taskError=true;data.taskConflict=true;
  await click('Save task');assert.equal(document.getElementById('task-title').value,'My edit');assert.equal(button('Save task').disabled,true);
  data.tasks=[plannedTask({title:'Other editor',version:3})];await click('Reload task and discard changes');assert.equal(document.getElementById('task-title').value,'Other editor');
  data.taskError=false;await change('task-notes','Rescheduled');await click('Save task');assert.equal(data.taskWrites.at(-1).current.version,3);
});

test('completion reviews the latest saved scope, requires confirmation and records one linked entry with no plan writes',async()=>{
  const data=workFixture();data.tasks=[plannedTask()];await openWork(data);await change('work-type','care');await click('Record completion');
  assert.match(document.querySelector('dialog').textContent,/Herbs · 100 × 100 cm/);assert.equal(dialogButton('Record completion').disabled,true);
  await act(async()=>document.getElementById('task-confirm').click());let release;data.completeGate=new Promise(resolve=>release=resolve);
  await clickDialog('Record completion');assert.equal(button('Recording…').disabled,true);assert.equal(button('Close').disabled,true);await act(async()=>button('Recording…').click());assert.equal(data.completeWrites.length,1);
  await act(async()=>release());assert.equal(data.completeWrites[0].garden.version,1);assert.equal(data.completeWrites[0].confirmed,true);
  assert.equal(agenda().querySelectorAll('li').length,1);assert.match(agenda().textContent,/Completed/);assert.match(agenda().textContent,/Planned for/);assert.equal(data.writes.length,0);
  await click('Open history');assert.ok(button('Back to calendar'));await click('Back to calendar');assert.equal(document.getElementById('work-type').value,'care');assert.equal(agenda().querySelectorAll('li').length,1);
});

test('completion conflicts require a new review and confirmation before retrying the current garden/task revisions',async()=>{
  const data=workFixture();data.tasks=[plannedTask()];await openWork(data);await click('Record completion');await act(async()=>document.getElementById('task-confirm').click());data.completeError=true;
  await clickDialog('Record completion');assert.match(document.querySelector('dialog').textContent,/Saved plan changed/);assert.equal(dialogButton('Record completion').disabled,true);
  data.completeError=false;data.tasks[0].version=2;data.documents.garden={...data.documents.garden,version:4};await click('Reload task and saved plan');assert.equal(document.getElementById('task-confirm').checked,false);
  await act(async()=>document.getElementById('task-confirm').click());await clickDialog('Record completion');assert.equal(data.completeWrites.at(-1).garden.version,4);assert.equal(data.completeWrites.at(-1).task.version,2);
});

test('cancellation is explicit, remains filterable and creates no completed history',async()=>{
  const data=workFixture();data.tasks=[plannedTask()];await openWork(data);await click('Cancel task');await click('Keep task');assert.equal(data.taskWrites,undefined);
  await click('Cancel task');await clickDialog('Cancel task');assert.equal(data.tasks[0].status,'cancelled');assert.equal(data.workEvents.length,0);assert.equal(data.writes.length,0);
  assert.equal(agenda().querySelectorAll('li').length,0);await change('work-status','cancelled');assert.match(agenda().textContent,/Cancelled/);
});

test('all/selected garden filters, overdue dates and late responses do not switch or reset the editor',async()=>{
  const data=workFixture();const other={...data.store.active,id:'other',name:'Orchard'};data.store.gardens.push(other);data.documents.other=other;
  data.tasks=[plannedTask({plannedDate:'2020-01-01'}),plannedTask({id:'other-task',gardenId:'other',title:'Orchard task',activityType:'harvest'})];let release;data.workGate=new Promise(resolve=>release=resolve);
  await openWork(data);data.workGate=undefined;await change('work-gardens','all');assert.match(agenda().textContent,/Orchard task/);
  await act(async()=>release());assert.match(agenda().textContent,/Orchard task/);await change('work-status','overdue');assert.match(agenda().textContent,/Water herbs/);assert.doesNotMatch(agenda().textContent,/Orchard task/);
  await change('work-gardens','selected');const boxes=[...document.querySelectorAll('fieldset input[type=checkbox]')];await act(async()=>boxes.find(b=>b.checked).click());assert.match(document.body.textContent,/Choose at least one garden/);
  assert.equal(data.store.active.id,'garden');assert.equal(data.mounts,1);assert.equal(data.writes.length,0);
});

test('seasonal guidance stays region-scoped and creates a task only through an explicit plan action and save',async()=>{
  const data=await openWork();await click('Seasonal guidance');await click('Annual view');assert.match(document.body.textContent,/Lombardia/);assert.equal(data.taskWrites,undefined);
  await click('Plan an activity');assert.equal(button('Work').getAttribute('aria-pressed'),'true');assert.equal(document.getElementById('task-title').value,'Plan work for Watermelon');
  assert.equal(document.getElementById('task-date').value,localToday());assert.equal(data.taskWrites,undefined);await click('Back to calendar');assert.equal(document.querySelector('dialog'),null);
});

test('missing task beds require retargeting or cancellation without changing the garden layout',async()=>{
  const data=workFixture();data.tasks=[plannedTask()];data.documents.garden={...data.store.active,beds:[]};await openWork(data);await click('Record completion');assert.match(document.body.textContent,/bed is no longer/);assert.equal(document.querySelector('dialog'),null);
  await click('Edit task');assert.match(document.getElementById('task-bed').textContent,/Bed no longer in garden/);await change('task-bed','');await click('Save task');assert.equal(data.tasks[0].bedId,'');assert.equal(data.writes.length,0);
});


test('before dated-task rollout, Calendar keeps completed records and seasonal guidance without opening an unsavable task form',async()=>{
  const data=workFixture();data.planningAvailable=false;const date=localToday();data.workEvents=[{id:'record',gardenId:'garden',date,title:'Completed bed work',notes:'',kind:'bed',bedId:'bed-a',status:'completed',deleted:false}];
  await openWork(data);assert.equal(button('Plan activity').disabled,true);assert.match(agenda().textContent,/Completed bed work/);
  await click('Seasonal guidance');await click('Annual view');await click('Plan an activity');assert.equal(document.querySelector('dialog'),null);assert.match(document.body.textContent,/Dated planning is not available yet/);assert.equal(data.taskWrites,undefined);
});


const workInstruction=index=>document.querySelector(`[aria-label="Work item ${index}"]`);
async function instruction(index,text){await act(async()=>{const field=workInstruction(index);Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(field,text);field.dispatchEvent(new window.Event('input',{bubbles:true}));});}
function checklistFixture(){const data=workFixture();data.documents.garden.beds[0]={...data.documents.garden.beds[0],lengthCm:200,areaPlan:areaPlan(rows())};return data;}

test('planned activities generate editable work, preserve manual instructions across scope changes, and save checklist progress explicitly',async()=>{
  const data=await openWork(checklistFixture());await click('Plan activity');await change('task-title','Plant seedlings');await change('task-bed','bed-a');await change('task-type','planting');
  assert.match(document.getElementById('task-work-recap').value,/Herbs.*100 × 200 cm/);assert.match(workInstruction(1).value,/Plant 12 Type A plants/);
  await instruction(1,'Plant only 6 seedlings');await change('task-work-recap','Six seedlings in the north row');await act(async()=>document.querySelector('[aria-label="Mark work item 1 done"]').click());
  await change('task-type','care');assert.equal(workInstruction(1).value,'Plant only 6 seedlings');assert.match(document.querySelector('dialog').textContent,/instructions were preserved/);
  await click('Back to calendar');await click('Stay');assert.equal(workInstruction(1).value,'Plant only 6 seedlings');await click('Save task');
  assert.equal(data.tasks[0].status,'planned');assert.equal(data.tasks[0].workItems[0].done,true);assert.equal(data.tasks[0].workRecap,'Six seedlings in the north row');assert.equal(data.workEvents.length,0);assert.equal(data.writes.length,0);
  assert.match(agenda().textContent,/Work to do · 1\/1 checked/);assert.equal(data.taskWrites.length,1);
});

test('regenerating a saved recap reviews the latest plan and asks before replacing edited text or checked progress',async()=>{
  const data=checklistFixture();data.tasks=[plannedTask({activityType:'planting',workRecap:'My instructions',workItems:[{id:'mine',text:'Keep 6 seedlings',done:true}]})];await openWork(data);await click('Edit task');
  data.documents.garden.beds[0].areaPlan.areas[0].rowCount=3;data.documents.garden.version=2;
  await click('Generate from saved plan');assert.ok(document.querySelector('[aria-label="Replace work instructions"]'));assert.equal(workInstruction(1).value,'Keep 6 seedlings');assert.equal(button('Save task').disabled,true);
  assert.match(document.querySelector('[aria-label="Replace work instructions"]').textContent,/Plant 18 Type A plants/);await click('Keep my instructions');assert.equal(workInstruction(1).value,'Keep 6 seedlings');
  await click('Generate from saved plan');await click('Replace recap and checklist');assert.match(workInstruction(1).value,/Plant 18 Type A plants/);assert.equal(document.querySelector('[aria-label="Mark work item 1 done"]').checked,false);
  await click('Add work item');await instruction(2,'Install labels');await click('Remove work item 1');assert.equal(workInstruction(1).value,'Install labels');await click('Save task');assert.equal(data.tasks[0].workItems.length,1);assert.equal(data.tasks[0].workItems[0].text,'Install labels');assert.equal(data.taskWrites[0].current.version,1);
});

test('failed generation and task conflicts retain the reviewed checklist and completion shows it without ticking unchecked work',async()=>{
  const data=checklistFixture();data.tasks=[plannedTask({workRecap:'Review herbs',workItems:[{id:'work',text:'Water if needed',done:false}]})];await openWork(data);await click('Edit task');
  data.gardenLoadError=true;await click('Generate from saved plan');assert.equal(workInstruction(1).value,'Water if needed');assert.match(document.querySelector('dialog').textContent,/Garden unavailable/);data.gardenLoadError=false;
  await click('Back to calendar');await click('Record completion');assert.match(document.querySelector('dialog').textContent,/Water if needed/);assert.match(document.querySelector('dialog').textContent,/0\/1 checked/);
  await act(async()=>document.getElementById('task-confirm').click());await clickDialog('Record completion');assert.equal(data.tasks[0].status,'completed');assert.equal(data.tasks[0].workItems[0].done,false);assert.equal(data.completeWrites.length,1);
});

test('before checklist rollout, task title and notes still save through the legacy flow',async()=>{
  const data=workFixture();data.checklistAvailable=false;await openWork(data);await click('Plan activity');assert.equal(document.querySelector('[aria-label="Work to do"]'),null);assert.match(document.querySelector('dialog').textContent,/Work checklists are not available yet/);
  await change('task-title','Legacy task');await change('task-notes','Work details');await click('Save task');assert.equal(data.taskWrites[0].details.workItems,undefined);assert.equal(data.taskWrites[0].details.notes,'Work details');
});
