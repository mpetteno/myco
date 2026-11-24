import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react'),{createRoot}=await import('react-dom/client');
const directory=mkdtempSync(resolve('node_modules/.tmp/garden-store-'));
const stub=join(directory,'repository.mjs');
writeFileSync(stub,`export const listGardens=async()=>globalThis.__gardens.listGate??structuredClone(globalThis.__gardens.documents);
export const loadGarden=async id=>structuredClone(globalThis.__gardens.documents.find(g=>g.id===id));
export const createGarden=async()=>{throw Error('Unexpected creation')};
export const deleteGarden=async garden=>{globalThis.__gardens.deletions.push(garden);await globalThis.__gardens.remove?.();globalThis.__gardens.documents=globalThis.__gardens.documents.filter(g=>g.id!==garden.id)};`);
const entry=join(directory,'entry.ts');writeFileSync(entry,`export {useGardens} from ${JSON.stringify(resolve('src/features/gardens/useGardens.ts'))}`);
const result=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[{name:'store-fixture',enforce:'pre',resolveId(id){if(id.endsWith('/gardenRepository'))return stub;}}],build:{write:false,minify:false,lib:{entry,formats:['es']},rolldownOptions:{external:['react','react/jsx-runtime']}}});
const file=join(directory,'store.mjs');writeFileSync(file,(Array.isArray(result)?result[0]:result).output.find(i=>i.type==='chunk').code);
const {useGardens}=await import(pathToFileURL(file).href);
after(()=>{dom.window.close();rmSync(directory,{recursive:true,force:true});});

test('failed deletion keeps the active garden; success and late refreshes cannot restore a deleted garden',async()=>{
  const first={id:'first',ownerId:'owner',name:'Garden',dimensions:{widthCm:500,lengthCm:500},beds:[],version:3,updatedAt:'2026-11-24'},second={...first,id:'second',name:'Other'};
  globalThis.__gardens={documents:[first,second],deletions:[]};let store;
  function Probe(){store=useGardens('owner');return null;}
  const root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(Probe)));
  assert.equal(store.active.id,'first');assert.equal(store.gardens.length,2);
  globalThis.__gardens.remove=async()=>{throw Error('Offline');};
  await act(async()=>assert.rejects(store.remove(store.active),/Offline/));assert.equal(store.active.id,'first');assert.equal(store.gardens.length,2);
  let finish;globalThis.__gardens.listGate=new Promise(resolve=>{finish=resolve;});let refreshing;
  await act(async()=>{refreshing=store.refresh();});
  globalThis.__gardens.remove=async()=>{};await act(async()=>store.remove(store.active));assert.equal(store.active,null);assert.deepEqual(store.gardens.map(g=>g.id),['second']);
  await act(async()=>{finish([first,second]);await refreshing;});assert.deepEqual(store.gardens.map(g=>g.id),['second']);
  await act(async()=>store.remember(first));assert.deepEqual(store.gardens.map(g=>g.id),['second']);
  await act(async()=>store.choose('second'));assert.equal(store.active.id,'second');
  await act(async()=>root.unmount());
});
