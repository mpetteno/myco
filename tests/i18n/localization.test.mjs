import { after,afterEach,test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';

const dom=new JSDOM('<html lang="en"><div id="root"></div></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','Event'])globalThis[key]=dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react');
const {createRoot}=await import('react-dom/client');
mkdirSync('node_modules/.tmp',{recursive:true});
const directory=mkdtempSync(resolve('node_modules/.tmp/myco-i18n-'));
const result=await build({configFile:false,envFile:false,logLevel:'silent',build:{write:false,minify:false,
  lib:{entry:'tests/i18n/modules.ts',formats:['es']},rolldownOptions:{external:['react','react/jsx-runtime']}}});
const file=join(directory,'i18n.mjs');
writeFileSync(file,(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code);
const module=await import(pathToFileURL(file).href);
let root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;});
after(()=>{dom.window.close();rmSync(directory,{recursive:true,force:true});});
// Fixture translations exercise the extension API alongside shipped suggestion messages.
const messages={...module.catalogues,it:{
  'record.garden':'Registra modifiche al giardino','record.bed':'Registra modifiche all’aiuola',
  'record.recording':'Registrazione…','record.confirmBedRequired':'Conferma il lavoro completato.',
  'record.reload':'Ricarica il piano','history.conflict':'Il piano è cambiato. Ricaricalo.',
  'history.connection':'Connessione non disponibile.','validation.eventTitle':'Inserisci un titolo.',
}};
const defaults={onSave:async()=>{},onReload:async()=>{},onCancel:()=>{}};
async function render(locale='en',garden={},bed={}){
  root??=createRoot(document.getElementById('root'));
  await act(async()=>root.render(createElement(module.I18nProvider,{locale,messages},
    createElement(module.GardenEventForm,{...defaults,...garden}),
    createElement(module.ActivityForm,{...defaults,beds:[{id:'bed-a',name:'User’s bed'}],...bed}))));
}
async function type(id,value){await act(async()=>{
  const input=document.getElementById(id);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
  input.dispatchEvent(new window.Event('input',{bubbles:true}));
});}
async function submit(index){await act(async()=>document.querySelectorAll('form')[index].dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));}

test('regional languages resolve to registered catalogues and unsupported or invalid locales fall back to English',()=>{
  assert.equal(module.createI18n('it-IT',messages).locale,'it');
  assert.equal(module.createI18n('IT',messages).t('record.garden'),messages.it['record.garden']);
  for(const locale of ['fr-FR','not_a_locale',''])assert.equal(module.createI18n(locale,messages).locale,'en');
  assert.equal(module.createI18n('it').locale,'it');
  assert.equal(module.createI18n('it').t('suggestions.today'),'Oggi');
});

test('missing translations use English and interpolation preserves values literally',()=>{
  const {t}=module.createI18n('it-IT',messages);
  assert.equal(t('record.notes'),'Notes (optional)');
  assert.ok(t('record.gardenDescription',{bedAction:t('record.bed')}).includes(messages.it['record.bed']));
  assert.ok(t('record.gardenDescription',{bedAction:'<$&> {another}'}).includes('<$&> {another}'));
});

test('validation uses the provided language while non-UI callers keep English defaults',()=>{
  const details={date:'2026-11-17',title:'',notes:''},t=module.createI18n('it',messages).t;
  assert.equal(module.validateEventDetails(details,t),'Inserisci un titolo.');
  assert.equal(module.validateActivity({...details,bedId:'bed-a'},t),'Inserisci un titolo.');
  assert.equal(module.validateEventDetails(details),'Enter a title of 1 to 120 characters.');
});

test('English form headings and confirmation buttons match their recording actions',async()=>{
  await render();
  assert.deepEqual([...document.querySelectorAll('h3')].map(item=>item.textContent),['Record garden changes','Record bed changes']);
  assert.deepEqual([...document.querySelectorAll('button[type="submit"]')].map(item=>item.textContent),['Record garden changes','Record bed changes']);
});

test('changing the locale translates the forms without modifying names, draft fields or recorded payloads',async()=>{
  let saved,finish;
  const bedProps={onSave:async(details)=>{saved=details;await new Promise(resolve=>{finish=resolve;});}};
  await render('en',{},bedProps);
  await type('event-title','My garden notes');await type('activity-title','My bed notes');
  await render('it-IT',{},bedProps);
  assert.equal(document.documentElement.lang,'it');
  assert.equal(document.getElementById('event-title').value,'My garden notes');
  assert.equal(document.getElementById('activity-title').value,'My bed notes');
  assert.equal(document.querySelector('option').textContent,'User’s bed');
  assert.equal(document.querySelectorAll('h3')[1].textContent,messages.it['record.bed']);
  await submit(1);assert.equal(document.querySelectorAll('[role="alert"]')[1].textContent,'Conferma il lavoro completato.');
  await act(async()=>document.getElementById('activity-confirm').click());await submit(1);
  assert.equal(document.querySelectorAll('button[type="submit"]')[1].textContent,'Registrazione…');
  assert.equal(document.querySelectorAll('button[type="submit"]')[1].disabled,true);
  assert.equal(saved.title,'My bed notes');assert.equal(saved.bedId,'bed-a');
  assert.deepEqual(Object.keys(saved).sort(),['bedId','date','notes','title']);
  await act(async()=>finish());
});

test('server conflicts and failed reloads use translated messages while preserving the entered title',async()=>{
  await render('it',{
    onSave:async()=>{throw module.historyError({code:'40001'});},
    onReload:async()=>{throw Error('Offline');},
  });
  await type('event-title','My title');await submit(0);
  assert.equal(document.querySelector('[role="alert"]').textContent,messages.it['history.conflict']);
  const reload=[...document.querySelectorAll('button')].find(item=>item.textContent==='Ricarica il piano');assert.ok(reload);
  await act(async()=>reload.click());
  assert.equal(document.querySelector('[role="alert"]').textContent,messages.it['history.connection']);
  assert.equal(document.getElementById('event-title').value,'My title');
});
