import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadEditor, cleanupEditor } from '../bed-editor/helpers.mjs';
import { bed, plan } from '../planting/fixtures.mjs';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'KeyboardEvent']) globalThis[key] = dom.window[key];
window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { GardenPage } = await loadEditor();
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });
after(() => { dom.window.close(); cleanupEditor(); });
const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
const documentAt = (xCm) => ({ name: 'Garden', dimensions: { widthCm: 500, lengthCm: 500 }, beds: [{ ...bed, xCm }] });
const events = () => [10, 20, 30].map((xCm, index) => ({ id: `event-${index}`, gardenId: 'garden-a', order: index + 1,
  sourceVersion: index + 1, date: `${month}-${index < 2 ? '10' : '20'}`, title: `Change ${index + 1}`, notes: '',
  actorId: 'owner-a', recordedAt: '2026-11-16T12:00:00Z', document: documentAt(xCm) }));
const button = (label) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === label || item.getAttribute('aria-label') === label);
async function click(label) { const item = button(label); assert.ok(item, `Missing button: ${label}`); assert.equal(item.disabled, false, `${label} is disabled`); await act(async () => item.click()); }
async function type(id, value) {
  const input = document.getElementById(id); assert.ok(input);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
async function openGarden(historyEvents = events()) {
  globalThis.__editorFixture = { saves: [], save: async () => {}, historyEvents, eventWrites: [], historyDocument: documentAt(50) };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(GardenPage, { user: { id: 'owner-a' },
    garden: { ...documentAt(50), id: 'garden-a', ownerId: 'owner-a', version: 1, updatedAt: '2026-11-16T12:00:00Z' },
    onSaved() {}, onChooseGardens() {}, pickerOpen: false, onReload: async () => { globalThis.__editorFixture.reloads = (globalThis.__editorFixture.reloads ?? 0) + 1; }, onDiscardChanges() {},
  })));
}
async function key(value, extra = {}) {
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra })));
}

test('previous/next events visit separate same-day snapshots and Plan restores the current editor', async () => {
  await openGarden(); await click('History'); await click('Previous event');
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 30);
  assert.equal(globalThis.__gardenCanvas.readOnly, true);
  await click('Previous event'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 20);
  await click('Previous event'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 10);
  assert.equal(button('Previous event').disabled, true);
  await click('Next event'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 20);
  await click('Plan'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 50);
  assert.equal(globalThis.__gardenCanvas.readOnly, false);
});

test('calendar marks event dates, shows the latest earlier event and never invents a pre-history layout', async () => {
  await openGarden(); await click('History');
  assert.ok(button(`${month}-10, 2 events`));
  await click(`${month}-15, no events`);
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 20);
  await click('Previous event'); assert.match(document.querySelector('section[aria-label="History navigation"]').textContent, /Change 2/);
  await click(`${month}-05, no events`);
  assert.match(document.body.textContent, /No layout was recorded on or before/);
  assert.equal(button('Select fixture bed'), undefined);
  await click('Next event'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 10);
});

test('historical selection disables layout mutations, Delete/Backspace and paste while preserving the current layout', async () => {
  await openGarden(); await click('Select fixture bed'); await key('c', { ctrlKey: true });
  await click('History'); await click('Previous event');
  assert.equal(button('Add bed').disabled, true); assert.equal(button('Edit bed').disabled, true);
  await act(async () => {
    globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 75, yCm: 0 });
    globalThis.__gardenCanvas.onResizeBed(bed.id, { xCm: 0, yCm: 0, widthCm: 150, lengthCm: 200 });
  });
  await key('Delete'); await key('Backspace'); await key('v', { ctrlKey: true });
  assert.equal(globalThis.__editorFixture.saves.length, 0);
  await click('Plan'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 50);
  await key('v', { ctrlKey: true });
  assert.equal(globalThis.__gardenCanvas.beds.length, 2, 'paste works again in the live editor');
});

test('grouped edits create one dated event only when explicitly saved and capture the latest saved revision', async () => {
  await openGarden([]);
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 60, yCm: 0 }));
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 70, yCm: 0 }));
  assert.equal(globalThis.__editorFixture.historyEvents.length, 0);
  await click('History'); await click('Record garden changes');
  await type('event-date', `${month}-10`); await type('event-title', 'Prepared spring beds'); await type('event-notes', 'Moved the first bed');
  await click('Record garden changes');
  const fixture = globalThis.__editorFixture, recorded = fixture.historyEvents[0];
  assert.equal(fixture.eventWrites.length, 1);
  assert.equal(recorded.sourceVersion, fixture.saves.length + 1);
  assert.equal(recorded.document.beds[0].xCm, 70);
  assert.equal(recorded.title, 'Prepared spring beds');
  assert.match(document.body.textContent, /Garden changes recorded/);
  await click('Previous event'); assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 70);
});

test('failed event saves preserve the form and reuse the request identity on retry', async () => {
  await openGarden([]); await click('History'); await click('Record garden changes');
  await type('event-title', 'Autumn changes');
  globalThis.__editorFixture.eventSave = async () => { throw new Error('Offline'); };
  await click('Record garden changes'); assert.match(document.body.textContent, /Offline/);
  assert.equal(document.getElementById('event-title').value, 'Autumn changes');
  globalThis.__editorFixture.eventSave = async () => {};
  await click('Record garden changes');
  assert.equal(globalThis.__editorFixture.eventWrites[0].requestId, globalThis.__editorFixture.eventWrites[1].requestId);
  assert.equal(globalThis.__editorFixture.historyEvents.length, 1);
});

test('a late snapshot response cannot replace the current layout after Plan is selected', async () => {
  await openGarden(); await click('History');
  let complete;
  globalThis.__editorFixture.historyLoad = () => new Promise((resolve) => { complete = resolve; });
  await click('Previous event'); assert.match(document.body.textContent, /Loading history/);
  await click('Plan');
  await act(async () => complete(events()[2]));
  assert.equal(globalThis.__gardenCanvas.readOnly, false);
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm, 50);
});

test('recording waits for pending autosaves and captures the revision that actually finished saving', async () => {
  await openGarden([]);
  let complete;
  globalThis.__editorFixture.save = () => new Promise((resolve) => { complete = resolve; });
  await act(async () => globalThis.__gardenCanvas.onMoveBed(bed.id, { xCm: 80, yCm: 0 }));
  await click('History');
  assert.equal(button('Record garden changes').disabled, true);
  assert.equal(globalThis.__editorFixture.eventWrites.length, 0);
  await act(async () => complete());
  await click('Record garden changes'); await click('Record garden changes');
  const event = globalThis.__editorFixture.historyEvents[0];
  assert.equal(event.sourceVersion, 2); assert.equal(event.document.beds[0].xCm, 80);
});

test('a concurrent event-recording conflict offers an explicit reload of the current garden', async () => {
  await openGarden([]); await click('History'); await click('Record garden changes');
  globalThis.__editorFixture.eventSave = async () => { throw Object.assign(new Error('Changed in another session'), { conflict: true }); };
  await click('Record garden changes');
  assert.ok(button('Reload current layout')); await click('Reload current layout');
  assert.equal(globalThis.__editorFixture.reloads, 1);
});

test('the single plan records a bed explicitly and does not expose separate work controls',async()=>{
  await openGarden([]);await click('History');
  assert.equal(button('Start work'),undefined);assert.doesNotMatch(document.body.textContent,/Open work/);
  await click('Record bed changes');
  assert.equal(document.getElementById('activity-kind'),null);assert.doesNotMatch(document.body.textContent,/Work type/);
  await type('activity-title','Planted bed');
  assert.ok(document.getElementById('activity-date').value);
  await act(async()=>document.getElementById('activity-confirm').click());await click('Record bed changes');
  const fixture=globalThis.__editorFixture;
  assert.equal(fixture.saves.length,0);assert.equal(fixture.activityWrites.length,1);
  assert.equal(fixture.historyEvents[0].status,'completed');assert.equal(fixture.historyEvents[0].kind,'bed');
  assert.ok(!('kind' in fixture.activityWrites[0].details));
  await click('View completed event: Planted bed');
  assert.deepEqual(globalThis.__gardenCanvas.beds,fixture.historyDocument.beds);
});

test('deleting an entry requires confirmation, preserves later snapshots and leaves the autosaved plan alone',async()=>{
  await openGarden();await click('History');await click('View completed event: Change 2');
  await click('Delete history entry');await click('Cancel');
  assert.equal(globalThis.__editorFixture.historyEvents.length,3);
  await click('Delete history entry');await click('Delete entry');
  const fixture=globalThis.__editorFixture;
  assert.equal(fixture.historyEvents.length,2);assert.equal(fixture.saves.length,0);
  assert.equal(button('View completed event: Change 2'),undefined);
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm,10,'falls back to the earlier entry on the selected date');
  await click('Next event');assert.equal(globalThis.__gardenCanvas.beds[0].xCm,30);
  await click('Plan');assert.equal(globalThis.__gardenCanvas.beds[0].xCm,50);
});

test('failed deletion retains the confirmation and reuses the deletion request on retry',async()=>{
  await openGarden();await click('History');await click('View completed event: Change 3');
  const fixture=globalThis.__editorFixture;fixture.historyDelete=async()=>{throw Error('Connection lost');};
  await click('Delete history entry');await click('Delete entry');
  assert.match(document.querySelector('dialog').textContent,/Connection lost/);
  assert.equal(fixture.historyEvents.length,3);fixture.historyDelete=async()=>{};
  await click('Delete entry');assert.equal(fixture.historyEvents.length,2);
  assert.equal(fixture.historyDeletes[0].requestId,fixture.historyDeletes[1].requestId);
});

test('default garden planning autosaves bed edits without history and keeps recorded physical snapshots fixed',async()=>{
  await openGarden([]);const fixture=globalThis.__editorFixture;
  fixture.catalogue={isAdmin:false,families:[{id:'family-a',name:'Family',notes:'',version:1,plantSpacingCm:30,rowSpacingCm:40}],
    plants:[{id:'type-a',familyId:'family-a',name:'Type',notes:'',version:1,plantSpacingCm:null,rowSpacingCm:null}],rules:[]};
  await click('Select fixture bed');await click('Edit bed');await click('Add area');
  assert.equal(button('Apply plan'),undefined);assert.equal(fixture.saves.length,1);
  assert.equal(fixture.historyEvents.length,0);
  await click('Back to garden');await click('History');await click('Record garden changes');
  assert.match(document.body.textContent,/only after implementing this entire garden plan/);
  await type('event-title','Rows implemented');await click('Record garden changes');
  assert.equal(fixture.historyEvents.length,1);
  assert.equal(fixture.historyEvents[0].document.beds[0].plantingPlan.areas[0].rowCount,2);
  await click('Close history');await click('Edit bed');await click('Areas');await type('planting-row-count','3');
  assert.equal(fixture.saves.at(-1).beds[0].plantingPlan.areas[0].rowCount,3);
  assert.equal(fixture.historyEvents.length,1);
  assert.equal(fixture.historyEvents[0].document.beds[0].plantingPlan.areas[0].rowCount,2,'new planning cannot rewrite completed history');
  await click('Back to garden');await click('History');await click('Previous event');
  assert.equal(globalThis.__gardenCanvas.beds[0].plantingPlan.areas[0].rowCount,2);
  await click('Plan');assert.equal(globalThis.__gardenCanvas.beds[0].plantingPlan.areas[0].rowCount,3);
});


test('Edit garden keeps layout changes disabled while viewing recorded history',async()=>{
  await openGarden();await click('History');await click('Previous event');await click('Edit garden');
  const dialog=document.querySelector('dialog');assert.ok(dialog);
  for(const label of ['Rename garden','Garden size']){
    const action=[...dialog.querySelectorAll('button')].find(item=>item.textContent===label);
    assert.ok(action);assert.equal(action.disabled,true);
  }
  const sharing=[...dialog.querySelectorAll('button')].find(item=>item.textContent==='Share garden');
  assert.equal(sharing.disabled,false);
  assert.equal(globalThis.__editorFixture.saves.length,0);
});


test('garden Recap follows the selected historical beds and returns to the working plan totals',async()=>{
  const old=events()[0];old.document.beds[0]={...bed,widthCm:150,plantingPlan:plan()};
  await openGarden([old]);await click('History');await click('Previous event');await click('Recap');
  assert.match(document.querySelector('dialog').textContent,/Total plants21/);
  assert.match(document.querySelector('dialog').textContent,/Area occupied by beds3 m²/);
  await click('Close');await click('Plan');await click('Recap');
  assert.match(document.querySelector('dialog').textContent,/Total plants0/);
  assert.match(document.querySelector('dialog').textContent,/Area occupied by beds2 m²/);
  assert.equal(globalThis.__editorFixture.saves.length,0);
  assert.equal(globalThis.__editorFixture.eventWrites.length,0);
});


test('backdated garden edits use an independent draft and leave later records and the current plan unchanged',async()=>{
  await openGarden();const fixture=globalThis.__editorFixture,later=structuredClone(fixture.historyEvents[2]);
  await click('History');await click(`${month}-15, no events`);await click('Add past garden edit');
  assert.equal(globalThis.__gardenCanvas.readOnly,false);assert.equal(globalThis.__gardenCanvas.beds[0].xCm,20);
  await act(async()=>globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:75,yCm:0}));
  assert.equal(fixture.saves.length,0);assert.equal(fixture.historyEdits,undefined);
  await click('Save history record');await type('history-edit-date',`${month}-12`);await type('history-edit-title','Earlier layout');await click('Save record');
  assert.equal(fixture.historyEvents.length,4);assert.deepEqual(fixture.historyEvents.find(item=>item.id===later.id),later);
  assert.equal(globalThis.__gardenCanvas.beds[0].xCm,75);assert.equal(globalThis.__gardenCanvas.readOnly,true);
  await click('View completed event: Change 3');assert.equal(globalThis.__gardenCanvas.beds[0].xCm,30);
  await click('Plan');assert.equal(globalThis.__gardenCanvas.beds[0].xCm,50);
  assert.equal(fixture.saves.length,0);assert.equal(fixture.eventWrites.length,0);
});

test('existing records can change their historical layout, date, title and notes without changing another event',async()=>{
  await openGarden();const fixture=globalThis.__editorFixture,later=structuredClone(fixture.historyEvents[2]);
  await click('History');await click('View completed event: Change 1');await click('Edit history record');
  await click('Edit garden');await click('Garden size');await type('garden-width','600');await click('Update garden');
  await click('Save history record');await type('history-edit-date',`${month}-09`);await type('history-edit-title','Corrected early layout');await type('history-edit-notes','Measured again');await click('Save record');
  const corrected=fixture.historyEvents.find(item=>item.id==='event-0');
  assert.equal(corrected.eventVersion,2);assert.equal(corrected.date,`${month}-09`);assert.equal(corrected.notes,'Measured again');
  assert.equal(corrected.document.dimensions.widthCm,600);assert.deepEqual(fixture.historyEvents.find(item=>item.id===later.id),later);
  await click('Plan');assert.equal(globalThis.__gardenCanvas.dimensions.widthCm,500);
  assert.equal(fixture.saves.length,0);
});

test('historical drafts protect leaving, survive failed saves and reload a conflicting record explicitly',async()=>{
  await openGarden();const fixture=globalThis.__editorFixture;
  await click('History');await click('View completed event: Change 1');await click('Edit history record');
  await act(async()=>globalThis.__gardenCanvas.onMoveBed(bed.id,{xCm:80,yCm:0}));
  const warning=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(warning);assert.equal(warning.defaultPrevented,true);
  await click('← History');assert.ok(button('Discard historical draft'));await click('Keep editing history');
  await click('Save history record');await type('history-edit-title','Keep this correction');
  fixture.historyEditSave=async()=>{throw Error('Offline');};await click('Save record');assert.match(document.body.textContent,/Offline/);
  assert.equal(document.getElementById('history-edit-title').value,'Keep this correction');
  const requestId=fixture.historyEdits[0].requestId;
  await click('Save record');assert.equal(fixture.historyEdits[1].requestId,requestId);
  fixture.historyEditSave=async()=>{};
  fixture.historyEvents[0]={...fixture.historyEvents[0],eventVersion:2,document:documentAt(90)};
  await click('Save record');assert.ok(button('Reload record and discard draft'));
  await click('Reload record and discard draft');assert.equal(globalThis.__gardenCanvas.beds[0].xCm,90);
  assert.equal(document.getElementById('history-edit-title'),null);assert.equal(fixture.saves.length,0);
});

test('a date before the first record starts an explicit current-plan template without changing that plan',async()=>{
  await openGarden([]);await click('History');await click('Add past garden edit');
  assert.equal(globalThis.__gardenCanvas.beds[0].id,bed.id);
  await click('Add bed');await type('bed-name','Earlier bed');await type('bed-width','100');await type('bed-length','200');
  await act(async()=>document.querySelector('dialog form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  await click('Save history record');await type('history-edit-date','2025-01-01');await click('Save record');
  assert.equal(globalThis.__editorFixture.historyEvents[0].document.beds.find(item=>item.name==='Earlier bed').name,'Earlier bed');
  assert.equal(globalThis.__editorFixture.historyEvents[0].document.beds[0].id,bed.id);
  await click('Plan');assert.equal(globalThis.__gardenCanvas.beds[0].name,bed.name);
});

test('leaving history cancels a late response that would otherwise open a historical draft',async()=>{
  await openGarden();await click('History');let resolve;
  globalThis.__editorFixture.historyEditLoad=()=>new Promise(done=>{resolve=done;});
  await click('Add past garden edit');await click('Plan');await act(async()=>resolve(events()[0]));
  assert.equal(button('Save history record'),undefined);assert.equal(globalThis.__gardenCanvas.beds[0].xCm,50);
});
