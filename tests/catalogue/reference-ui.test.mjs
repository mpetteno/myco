import { test, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory=await mkdtemp(resolve('node_modules/.tmp/reference-ui-'));
const repository=join(directory,'repository.mjs');
await writeFile(repository,`import { GardenStorageError } from ${JSON.stringify(resolve('src/features/gardens/gardenErrors.ts'))};
export const loadReferenceData=async()=>structuredClone(globalThis.__referenceUI.data);
export const removeCultivar=async(current)=>{
  const fixture=globalThis.__referenceUI;fixture.removals.push(current);
  if(fixture.removeError)throw new GardenStorageError('Removal failed',false,fixture.removeError==='23503'?'catalogue.cultivarInUse':'catalogue.removalStale');
  fixture.data.plant_cultivars=fixture.data.plant_cultivars.filter(item=>item.id!==current.id);
};
export const saveReference=async(...args)=>{globalThis.__referenceUI.writes.push(args);if(globalThis.__referenceUI.error)throw globalThis.__referenceUI.error;};`);
const catalogueRepository=join(directory,'catalogue.mjs');
await writeFile(catalogueRepository, `
  export const loadCatalogue=async()=>{
    const data=globalThis.__referenceUI.data;
    return { isAdmin:data.isAdmin, rules:[],
      families:data.plant_families.map(row=>({...row,plantSpacingCm:row.plant_spacing_cm ?? null,rowSpacingCm:row.row_spacing_cm ?? null})),
      plants:data.plant_types.map(row=>({...row,familyId:row.family_id,plantSpacingCm:row.plant_spacing_cm ?? null,rowSpacingCm:row.row_spacing_cm ?? null})),
      cultivars:data.plant_cultivars.map(row=>({...row,plantTypeId:row.plant_type_id,plantSpacingCm:row.plant_spacing_cm ?? null,rowSpacingCm:row.row_spacing_cm ?? null,borderDistanceCm:row.border_distance_cm ?? null,livingMulchEnabled:row.living_mulch_enabled ?? null})) };
  };
  export const savePlant=async()=>{};
  export const saveRule=async()=>{};
`);
const cropEditorRepository=join(directory,'crop-editor.mjs');
await writeFile(cropEditorRepository, `export const saveCropEditor=async(...args)=>{globalThis.__referenceUI.writes.push(args);if(globalThis.__referenceUI.error)throw globalThis.__referenceUI.error;};`);
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','HTMLInputElement','HTMLSelectElement','Event'])globalThis[key]=dom.window[key];
window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react'),{createRoot}=await import('react-dom/client');
const result=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[{name:'reference-fixtures',enforce:'pre',resolveId(source){if(source.endsWith('/referenceRepository'))return repository;if(source.endsWith('/catalogueRepository'))return catalogueRepository;if(source.endsWith('/cropEditorRepository'))return cropEditorRepository;}}],build:{write:false,minify:false,lib:{entry:'tests/catalogue/reference-ui-modules.ts',formats:['es']},rolldownOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(result)?result[0]:result).output;
const file=join(directory,'ui.mjs');await writeFile(file,output.find((item)=>item.type==='chunk').code);
const {ReferenceCataloguePanel,GardenCreateForm,GardenLocationForm}=await import(pathToFileURL(file).href);
let root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;});
after(async()=>{dom.window.close();await rm(directory,{recursive:true,force:true});});
const button=(text)=>[...document.querySelectorAll('button')].find((item)=>item.textContent.trim()===text);
async function click(text){assert.ok(button(text),'Missing '+text);await act(async()=>button(text).click());}
async function change(id,value){const element=document.getElementById(id);assert.ok(element,'Missing '+id);await act(async()=>{Object.getOwnPropertyDescriptor(element.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
const empty=()=>Object.fromEntries(['plant_cultivars','plant_guidance','plant_depths','calendar_profiles','calendar_coverage','plant_calendar_entries','rotation_rules','mulch_categories','plant_types','plant_families','calendar_windows'].map((key)=>[key,[]]));
async function open(Component,props,data){globalThis.__referenceUI={data,writes:[],removals:[],locations:[]};root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(Component,props)));}
test('readers browse cultivar guidance without management controls; admin errors preserve overrides',async()=>{
  const data={...empty(),isAdmin:false,plant_types:[{id:'melon',name:'Watermelon'}],plant_cultivars:[{id:'crimson',name:'Crimson Sweet',plant_type_id:'melon',version:1,notes:'',plant_spacing_cm:120,row_spacing_cm:null,border_distance_cm:null,living_mulch_enabled:null}]};
  await open(ReferenceCataloguePanel,{userId:'reader'},data);
  assert.match(document.body.textContent,/Crimson Sweet/);assert.equal(button('Add entry'),undefined);assert.equal(button('Edit'),undefined);
  assert.equal(button('Remove'),undefined);
  await act(async()=>root.unmount());root=null;
  await open(ReferenceCataloguePanel,{userId:'admin'},{...data,isAdmin:true});
  await click('View details');await change('details-plant_spacing_cm','130');
  globalThis.__referenceUI.error={code:'40001'};await click('Save');
  assert.match(document.body.textContent,/changed/);assert.equal(document.getElementById('details-plant_spacing_cm').value,'130');
  assert.equal(globalThis.__referenceUI.writes[0][4].details.row_spacing_cm,'');
  assert.equal(globalThis.__referenceUI.writes[0][2],1);
});

test('cultivar removal is admin-only, reports living-mulch dependencies and is unavailable in other sections',async()=>{
  const data={...empty(),isAdmin:true,plant_types:[{id:'tomato',name:'Tomato'}],plant_cultivars:[{id:'datterini',name:'Datterini',plant_type_id:'tomato',version:4,notes:''}],calendar_profiles:[{id:'italy',name:'Italy',code:'italy',notes:''}]};
  await open(ReferenceCataloguePanel,{userId:'admin'},data);
  await click('Remove');assert.match(document.querySelector('dialog').textContent,/Remove Datterini\?/);
  await click('Cancel');assert.equal(globalThis.__referenceUI.removals.length,0);
  await click('Remove');globalThis.__referenceUI.removeError='23503';await click('Remove from catalogue');
  assert.match(document.querySelector('dialog').textContent,/used by a living mulch type/);
  assert.equal(globalThis.__referenceUI.removals[0].id,'datterini');assert.equal(globalThis.__referenceUI.removals[0].version,4);
  assert.ok(button('View details'));globalThis.__referenceUI.removeError=null;await click('Remove from catalogue');
  assert.equal(document.querySelector('dialog'),null);assert.equal(button('Remove'),undefined);
  assert.match(document.body.textContent,/Catalogue entry removed/);
  await change('reference-section','calendar_profiles');assert.ok(button('Edit'));assert.equal(button('Remove'),undefined);
});
test('garden creation requires a region, retains an optional city and saves without a lookup', async () => {
  const created=[];await open(GardenCreateForm,{onCreate:async(document)=>created.push(document)},{});
  await change('new-garden-name','Garden');await change('new-garden-width','100');await change('new-garden-length','100');
  await click('Create garden');assert.equal(created.length,0);assert.match(document.body.textContent,/Choose a supported garden region/);
  await change('garden-location-city',' Milano ');
  await change('garden-location-region','IT-25');
  await click('Create garden');
  assert.deepEqual(created[0].location,{countryCode:'IT',regionCode:'IT-25',displayName:'Milano, Lombardia',city:'Milano'});
  assert.equal(button('Find location'),undefined);
  await change('garden-location-region','IT-21');
  assert.equal(document.getElementById('garden-location-city').value,' Milano ');
  await click('Create garden');assert.equal(created[1].location.displayName,'Milano, Piemonte');
  await change('garden-location-region','');await click('Create garden');assert.equal(created.length,2);
  await change('garden-location-city',' ');await change('garden-location-region','IT-25');await click('Create garden');
  assert.deepEqual(created[2].location,{countryCode:'IT',regionCode:'IT-25',displayName:'Lombardia'});
});

test('existing garden saves region-only metadata and preserves legacy coordinates until fields are edited', async () => {
  const location={enteredLocation:'Milano',displayName:'Milano, Lombardia',latitude:45.46,longitude:9.19,countryCode:'IT',regionCode:'IT-25'};
  const saved=[];await open(GardenLocationForm,{initial:location,onSave:(value)=>saved.push(value)},{});
  assert.equal(document.getElementById('garden-location-region').value,'IT-25');
  await click('Save location');assert.deepEqual(saved,[location]);
  await change('garden-location-city','Bergamo');await click('Save location');
  assert.deepEqual(saved[1],{countryCode:'IT',regionCode:'IT-25',displayName:'Bergamo, Lombardia',city:'Bergamo'});
  await change('garden-location-region','');assert.equal(button('Save location').disabled,true);
  await change('garden-location-city','');await change('garden-location-region','IT-52');await click('Save location');
  assert.deepEqual(saved[2],{countryCode:'IT',regionCode:'IT-52',displayName:'Toscana'});
});
