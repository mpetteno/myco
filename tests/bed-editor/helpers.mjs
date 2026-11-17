import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

// Keep React external so the component and the DOM renderer share one instance.
mkdirSync('node_modules/.tmp', { recursive: true });
const directory = mkdtempSync(resolve('node_modules/.tmp/myco-editor-'));
const catalogue = join(directory, 'catalogue.mjs');
const mulch = join(directory, 'mulch.mjs');
const mixtures = join(directory, 'mixtures.mjs');
writeFileSync(mixtures, 'export const loadSeedMixtures = async () => globalThis.__editorFixture.seedMixtures ?? [];');
const repository = join(directory, 'repository.mjs');
const canvas = join(directory, 'canvas.mjs');
const gardenCanvas = join(directory, 'garden-canvas.mjs');
const history = join(directory, 'history.mjs');
const activities = join(directory, 'activities.mjs');
const editing = join(directory, 'history-editing.mjs');
const konva = join(directory, 'konva.mjs');
writeFileSync(catalogue, `export const loadCatalogue = async () => globalThis.__editorFixture.catalogue;
  export const saveFamily = async () => { throw Error('Unexpected catalogue write'); };
  export const savePlant = saveFamily; export const saveRule = saveFamily;`);
writeFileSync(mulch, `export const loadMulchCatalogue = async () => globalThis.__editorFixture.mulchCatalogue ?? { types: [], isAdmin: false };
  export const removeMulchType = async () => { throw Error('Unexpected mulch catalogue removal'); };
  export const saveMulchType = async () => { throw Error('Unexpected mulch catalogue write'); };`);
writeFileSync(repository, `export const saveGardenLocation = async (current, location) => ({ ...current, location, version: current.version + 1 });
export const saveGarden = async (current, document) => {
  globalThis.__editorFixture.saves.push(document);
  await globalThis.__editorFixture.save();
  const next={ ...current, ...document, version: current.version + 1 };globalThis.__editorFixture.currentGarden=next;return next;
};
export const loadGarden = async (id) => {
  const fixture=globalThis.__editorFixture;
  return structuredClone(fixture.currentGarden ?? { ...fixture.historyDocument,id,ownerId:'owner-a',version:1,updatedAt:'2026-11-16T12:00:00Z' });
};`);
writeFileSync(canvas, `import { createElement } from 'react';
  export const BedPlantingMarks = () => null;
  export const AreaPlanCanvas = (props) => { globalThis.__areaCanvas = props; globalThis.__editorCanvas = props; return createElement('div', { 'data-testid': 'bed-canvas' }); };
  export const BedPlanCanvas = (props) => { globalThis.__editorCanvas = props; return createElement('div', { 'data-testid': 'bed-canvas' }); };`);
writeFileSync(gardenCanvas, `import { createElement } from 'react';
  export const GardenCanvas = (props) => { globalThis.__gardenCanvas = props;
    return createElement('button', { disabled: !props.beds.length, onClick: () => props.onSelectBed(props.beds[0].id) }, 'Select fixture bed'); };`);
writeFileSync(history, `export const historyError = (error) => error instanceof Error ? error : new Error('History unavailable');
  export const listGardenEvents = async () => globalThis.__editorFixture.historyEvents ?? [];
  export const loadGardenEvent = async (gardenId, id) => {
    if (globalThis.__editorFixture.historyLoad) return globalThis.__editorFixture.historyLoad(id);
    return structuredClone(globalThis.__editorFixture.historyEvents.find(event => event.id === id));
  };
  export const recordGardenEvent = async (gardenId, version, details, requestId) => {
    const fixture = globalThis.__editorFixture;
    fixture.eventWrites.push({ gardenId, version, details, requestId });
    await fixture.eventSave?.();
    const event = { ...details, id: requestId, gardenId, order: (fixture.historyEvents?.length ?? 0) + 1,
      sourceVersion: version, recordedAt: '2026-11-16T12:00:00Z', actorId: 'owner-a',
      document: structuredClone(fixture.saves.at(-1) ?? fixture.historyDocument) };
    fixture.historyEvents = [...(fixture.historyEvents ?? []).filter(item => item.id !== event.id), event];
    return event;
  };`);
writeFileSync(editing, `export const deleteHistoryEntry = async(gardenId,eventId,version,requestId) => {
  const fixture=globalThis.__editorFixture;
  fixture.historyDeletes??=[];fixture.historyDeletes.push({gardenId,eventId,version,requestId});
  await fixture.historyDelete?.();
  const event=fixture.historyEvents.find(item=>item.id===eventId);
  if(event&&(event.eventVersion??1)!==version)throw Object.assign(Error('History record changed'),{conflict:true});
  fixture.historyEvents=fixture.historyEvents.filter(item=>item.id!==eventId);
};
export const loadHistoryAtDate = async (gardenId,date) => {
  const fixture=globalThis.__editorFixture;
  if(fixture.historyEditLoad)return fixture.historyEditLoad(date);
  return structuredClone((fixture.historyEvents??[]).filter(item=>item.status!=='planned'&&item.date<=date).sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order).at(-1)??null);
};
export const saveHistoricalEvent = async (gardenId,draft,document,details,eventId,requestId) => {
  const fixture=globalThis.__editorFixture;
  fixture.historyEdits??=[];fixture.historyEdits.push({gardenId,draft:structuredClone(draft),document:structuredClone(document),details:{...details},eventId,requestId});
  await fixture.historyEditSave?.();
  const stored=fixture.historyEvents?.find(item=>item.id===eventId);
  if(stored&&(stored.eventVersion??1)!==(draft.event?.eventVersion??1))throw Object.assign(Error('History record changed'),{conflict:true});
  const event={...draft.event,...details,id:eventId,gardenId,kind:draft.kind,bedId:draft.bedId,status:'completed',
    eventVersion:stored?(stored.eventVersion??1)+1:1,order:stored?.order??(fixture.historyEvents?.length??0)+1,
    sourceVersion:1,recordedAt:stored?.recordedAt??'2026-11-16T12:00:00Z',document:structuredClone(document)};
  fixture.historyEvents=[...(fixture.historyEvents??[]).filter(item=>item.id!==eventId),event];return event;
};`);
writeFileSync(activities, `export const recordCompletedActivity = async (gardenId,version,details,id) => {
  const fixture=globalThis.__editorFixture;
  fixture.activityWrites??=[];fixture.activityWrites.push({gardenId,version,details,id});
  await fixture.activitySave?.();
  const event={...details,id,gardenId,kind:'bed',status:'completed',order:(fixture.historyEvents?.length??0)+1,
    sourceVersion:version,recordedAt:'2026-11-17T12:00:00Z',actorId:'owner-a',
    document:structuredClone(fixture.saves.at(-1)??fixture.historyDocument)};
  fixture.historyEvents=[...(fixture.historyEvents??[]).filter(item=>item.id!==id),event];
};`);
writeFileSync(konva, `import { createElement } from 'react';
  export const Group = (props) => { globalThis.__shapeGroup = props; return createElement('div', null, props.children); };
  export const Rect = () => null;
  export const Shape = (props) => { globalThis.__gridShape = props; return null; };
  export const Circle = (props) => { globalThis.__resizeHandles?.push(props); return null; };`);

export async function loadEditor() {
  const result = await build({ configFile: false, envFile: false, logLevel: 'silent',
    plugins: [{ name: 'editor-fixtures', enforce: 'pre', resolveId(source) {
      if (source.endsWith('/catalogueRepository')) return catalogue;
      if (source.endsWith('/mulchCatalogueRepository')) return mulch;
      if (source.endsWith('/seedMixtureRepository')) return mixtures;
      if (source.endsWith('/gardenRepository')) return repository;
      if (source.endsWith('/BedPlanCanvas') || source.endsWith('/BedPlantingMarks') || source.endsWith('/AreaPlanCanvas')) return canvas;
      if (source.endsWith('/GardenCanvas')) return gardenCanvas;
      if (source.endsWith('/historyRepository')) return history;
      if (source.endsWith('/historyEditingRepository')) return editing;
      if (source.endsWith('/activityRepository')) return activities;
      if (source === 'react-konva') return konva;
    } }],
    build: { write: false, minify: false, lib: { entry: 'tests/bed-editor/modules.ts', formats: ['es'] },
      rolldownOptions: { external: ['react', 'react/jsx-runtime'] } },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const file = join(directory, 'editor.mjs');
  writeFileSync(file, output.find((item) => item.type === 'chunk').code);
  return import(pathToFileURL(file).href);
}
export const cleanupEditor = () => rmSync(directory, { recursive: true, force: true });
