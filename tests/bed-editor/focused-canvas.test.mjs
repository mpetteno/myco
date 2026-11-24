import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { areaPlan, rows } from '../planting/area-fixtures.mjs';
import { bed,areaV2,planV5 } from '../planting/fixtures.mjs';

mkdirSync('node_modules/.tmp',{recursive:true});
const directory=mkdtempSync(resolve('node_modules/.tmp/myco-focused-'));
const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react');const {createRoot}=await import('react-dom/client');
const stub=join(directory,'surfaces.mjs');
writeFileSync(stub,`import {createElement,forwardRef,useImperativeHandle,useRef} from 'react';
  export const Stage=forwardRef(({children},ref)=>{useImperativeHandle(ref,()=>({find:()=>globalThis.__cameraDragNodes??[]}));return createElement('div',null,children)});
  export const Layer=(props)=>{globalThis.__focusLayer=props;globalThis.__cameraAreas=[];return createElement('div',null,props.children)};
  export const Rect=()=>null;
  export const Circle=(props)=>{globalThis.__focusHandles.push(props);return null};
  export const BedShape=(props)=>{const {bed,onOpen}=props;globalThis.__cameraShape=props;globalThis.__focusOpen=onOpen;globalThis.__focusShown=bed;globalThis.__cameraAreas.push(bed.id);globalThis.__focusHandles=[];return null};
  export const useElementSize=()=>({ref:useRef(null),sizePx:globalThis.__focusSize});
  export const useDarkMode=()=>false;
  export const GardenGrid=()=>null;export const MulchMarks=()=>null;
  export const PlantingMarks=()=>null;export const AreaRowDistanceGuides=()=>null;
  export const BedAlignmentGuides=()=>null;export const BedDistanceGuides=()=>null;
  export const BedLabel=()=>null;
`);
const entry=join(directory,'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(resolve('src/features/plan-camera/planCamera.ts'))}; export { GardenCanvas } from ${JSON.stringify(resolve('src/features/garden/GardenCanvas.tsx'))}; export { BedPlanCanvas } from ${JSON.stringify(resolve('src/features/planting/BedPlanCanvas.tsx'))}; export { AreaPlanCanvas } from ${JSON.stringify(resolve('src/features/area-editor/AreaPlanCanvas.tsx'))};`);
const result=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[{name:'focus-surfaces',enforce:'pre',resolveId(source){
  if(source==='react-konva'||['/BedShape','/BedLabel','/useElementSize','/useDarkMode','/GardenGrid','/MulchMarks','/PlantingMarks','/AreaRowDistanceGuides','/BedAlignmentGuides','/BedDistanceGuides'].some(suffix=>source.endsWith(suffix)))return stub;
}}],build:{write:false,minify:false,lib:{entry,formats:['es']},rolldownOptions:{external:['react','react/jsx-runtime']}}});
writeFileSync(join(directory,'canvas.mjs'),(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code);
const {GardenCanvas,BedPlanCanvas,AreaPlanCanvas,zoomCamera,fitBoundsCamera}=await import(pathToFileURL(join(directory,'canvas.mjs')).href);
after(()=>{dom.window.close();rmSync(directory,{recursive:true,force:true});});

test('focused resize keeps the live preview and camera stable through multiple moves and shrinks neighbours and stops before their rows no longer fit',async()=>{
  for(const size of [{width:1000,height:600},{width:360,height:740}]){
    globalThis.__focusSize=size;globalThis.__focusHandles=[];
    const root=createRoot(document.getElementById('root')),commits=[];
    const area=areaV2({rowCount:2,widthCm:100}),other=areaV2({id:'other',xCm:100,widthCm:100,rowCount:2});
    await act(async()=>root.render(createElement(BedPlanCanvas,{bed:{...bed,widthCm:200},plan:planV5({areas:[area,other]}),
      selectedId:area.id,focus:{kind:'planting',id:area.id},focusZoom:0.8,editingMulch:false,onSelect(){},onBounds(id,bounds){commits.push(bounds)},
      mulch:{plan:{version:1,areas:[]},selectedId:null,preview:null,onSelect(){},onBounds(){}}})));
    const camera={x:globalThis.__focusLayer.x,y:globalThis.__focusLayer.y,scale:globalThis.__focusLayer.scaleX};
    const handle=globalThis.__focusHandles.find(item=>item.x===100&&item.y===100);assert.ok(handle);
    const node={value:{x:80,y:100},x(){return this.value.x},y(){return this.value.y},position(value){this.value=value}};
    await act(async()=>{handle.onDragStart();handle.onDragMove({target:node});});
    assert.equal(globalThis.__focusShown.widthCm,80,'the preview must not reset to the original area');
    node.position({x:90,y:100});await act(async()=>handle.onDragMove({target:node}));
    assert.equal(globalThis.__focusShown.widthCm,90);
    assert.deepEqual({x:globalThis.__focusLayer.x,y:globalThis.__focusLayer.y,scale:globalThis.__focusLayer.scaleX},camera);
    node.position({x:110,y:100});await act(async()=>handle.onDragMove({target:node}));
    assert.equal(globalThis.__focusShown.widthCm,110);
    node.position({x:170,y:100});await act(async()=>handle.onDragMove({target:node}));
    assert.equal(globalThis.__focusShown.widthCm,110);assert.equal(node.x(),110);
    await act(async()=>handle.onDragEnd({target:node}));assert.equal(commits.at(-1).widthCm,110);
    await act(async()=>root.unmount());
  }
});


test('canvas double-click routing selects the right planting or mulch area and stays disabled in history',async()=>{
  globalThis.__focusSize={width:1000,height:600};globalThis.__focusHandles=[];
  const root=createRoot(document.getElementById('root')),opened=[],selected=[];
  const area=areaV2({rowCount:2});
  const props={bed,plan:planV5({areas:[area]}),selectedId:null,onSelect:id=>selected.push(id),onBounds(){},onOpenArea:focus=>opened.push(focus),
    editingMulch:false,mulch:{plan:{version:1,areas:[{...area,id:'mulch-a',name:'Cover',layers:[]}]},selectedId:null,preview:null,onSelect:id=>selected.push(id),onBounds(){}}};
  await act(async()=>root.render(createElement(BedPlanCanvas,props)));
  await act(async()=>globalThis.__focusOpen());assert.deepEqual(opened.at(-1),{kind:'planting',id:area.id});assert.equal(selected.at(-1),area.id);
  await act(async()=>root.render(createElement(BedPlanCanvas,{...props,editingMulch:true})));
  await act(async()=>globalThis.__focusOpen());assert.deepEqual(opened.at(-1),{kind:'mulch',id:'mulch-a'});
  await act(async()=>root.render(createElement(BedPlanCanvas,{...props,readOnly:true})));
  assert.equal(globalThis.__focusOpen,undefined);
  await act(async()=>root.unmount());
});

test('current area canvas shows resize handles only in explicit Resize mode', async () => {
  globalThis.__focusSize = { width: 1000, height: 600 }; globalThis.__focusHandles = [];
  const root = createRoot(document.getElementById('root'));
  const props = { bed, plan: areaPlan(rows({ id: 'selected-area' })), selectedId: 'selected-area', onSelect() {}, onBounds() {} };
  await act(async () => root.render(createElement(AreaPlanCanvas, props)));
  assert.equal(globalThis.__focusHandles.length, 0);
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, resizing: true })));
  assert.equal(globalThis.__focusHandles.length, 8);
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, resizing: true, readOnly: true })));
  assert.equal(globalThis.__focusHandles.length, 0);
  await act(async () => root.unmount());
});

const cameraSnapshot = () => ({ x: globalThis.__focusLayer.x, y: globalThis.__focusLayer.y, scale: globalThis.__focusLayer.scaleX, rotation: globalThis.__focusLayer.rotation });
const surface = () => document.querySelector('[role="img"]');
function touch(type, points) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) });
  surface().dispatchEvent(event);
}

test('anchored zoom keeps the same point under the cursor at either bed rotation and clamps extreme wheel input', () => {
  for (const rotationDeg of [0, 90]) {
    const view = { xPx: 230, yPx: 80, pixelsPerCm: 2, rotationDeg }, anchor = { x: 300, y: 200 };
    const zoomed = zoomCamera(view, anchor, 1.75, 2);
    assert.equal((anchor.x - zoomed.xPx) / zoomed.pixelsPerCm, (anchor.x - view.xPx) / view.pixelsPerCm);
    assert.equal((anchor.y - zoomed.yPx) / zoomed.pixelsPerCm, (anchor.y - view.yPx) / view.pixelsPerCm);
    assert.equal(zoomCamera(view, anchor, 1e9, 2).pixelsPerCm, 64);
    assert.equal(zoomCamera(view, anchor, 1e-9, 2).pixelsPerCm, 1);
    const area = { xCm: 70, yCm: 40, widthCm: 20, lengthCm: 60 };
    const focused = fitBoundsCamera(area, { width: 600, height: 400 }, view);
    const center = rotationDeg ? { x: -70, y: 80 } : { x: 80, y: 70 };
    assert.equal(focused.xPx + center.x * focused.pixelsPerCm, 300);
    assert.equal(focused.yPx + center.y * focused.pixelsPerCm, 200);
    assert.equal(focused.rotationDeg, rotationDeg);
  }
});

test('inline focus keeps neighbours and selection, edits, resize previews and status headers never refit the camera', async () => {
  globalThis.__focusSize = { width: 1000, height: 600 };
  const root = createRoot(document.getElementById('root'));
  const first = rows({ id: 'first', widthCm: 50, lengthCm: 80 }), second = rows({ id: 'second', xCm: 50, widthCm: 50, lengthCm: 80 });
  const props = { bed, plan: areaPlan(first, second), selectedId: first.id, onSelect() {}, onBounds() {} };
  await act(async () => root.render(createElement(AreaPlanCanvas, props)));
  const infoHeight = surface().previousElementSibling.className;
  const command = { action: 'focus', targetId: first.id, revision: 1 };
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, cameraCommand: command })));
  const focused = cameraSnapshot();
  assert.deepEqual(globalThis.__cameraAreas, ['first', 'second']);
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, selectedId: null, cameraCommand: command })));
  assert.deepEqual(cameraSnapshot(), focused);
  assert.match(infoHeight, /h-12/); assert.match(surface().previousElementSibling.className, /h-12/);
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, plan: areaPlan({ ...first, widthCm: 40 }, second), cameraCommand: command, resizing: true })));
  assert.deepEqual(cameraSnapshot(), focused, 'geometry changes do not recenter a focused area');
  const handle = globalThis.__focusHandles[0];
  await act(async () => handle.onDragStart());
  assert.deepEqual(cameraSnapshot(), focused, 'preview does not refit');
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, cameraCommand: { action: 'fit', revision: 2 } })));
  assert.ok(cameraSnapshot().scale < focused.scale);
  await act(async () => root.unmount());
});

test('wheel and touch zoom and mouse pan change only the camera, including cancelling an area drag before a pinch', async () => {
  globalThis.__focusSize = { width: 1000, height: 600 };
  const root = createRoot(document.getElementById('root')), commits = [], selections = [];
  const props = { bed, plan: areaPlan(rows()), selectedId: 'area-a', resizing: true, onSelect: id => selections.push(id), onBounds: (...args) => commits.push(args) };
  await act(async () => root.render(createElement(AreaPlanCanvas, props)));
  const initial = cameraSnapshot();
  await act(async () => surface().dispatchEvent(new window.WheelEvent('wheel', { clientX: 250, clientY: 200, deltaY: -100, bubbles: true, cancelable: true })));
  const wheel = cameraSnapshot(); assert.ok(wheel.scale > initial.scale);
  assert.ok(Math.abs((250 - wheel.x) / wheel.scale - (250 - initial.x) / initial.scale) < 1e-10);
  const handle = globalThis.__focusHandles.find(item => item.x === 100 && item.y === 200);
  await act(async () => handle.onDragStart());
  const node = { x: () => 100, y: () => 200, position() {} };
  globalThis.__cameraDragNodes = [{ stopDrag: () => handle.onDragEnd({ target: node }) }];
  await act(async () => touch('touchstart', [[200, 200], [300, 200]]));
  globalThis.__cameraDragNodes = [];
  await act(async () => touch('touchmove', [[160, 220], [360, 220]]));
  const pinch = cameraSnapshot();
  assert.ok(Math.abs(pinch.scale - wheel.scale * 2) < 1e-10);
  assert.ok(Math.abs((260 - pinch.x) / pinch.scale - (250 - wheel.x) / wheel.scale) < 1e-10);
  await act(async () => touch('touchend', [[160, 220]]));
  await act(async () => touch('touchmove', [[180, 240]]));
  await act(async () => touch('touchend', []));
  assert.deepEqual(commits, [], 'stopping an area or handle drag must not commit it');
  assert.deepEqual(selections, []);
  await act(async () => root.render(createElement(AreaPlanCanvas, { ...props, panning: true })));
  const beforePan = cameraSnapshot();
  await act(async () => surface().dispatchEvent(new window.MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true })));
  await act(async () => window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 160, clientY: 130 })));
  await act(async () => window.dispatchEvent(new window.MouseEvent('mouseup')));
  assert.equal(cameraSnapshot().x, beforePan.x + 60); assert.equal(cameraSnapshot().y, beforePan.y + 30);
  assert.deepEqual(commits, []); assert.deepEqual(selections, []);
  await act(async () => root.unmount());
});


test('garden handles keep their preview across a drag and resize their areas and stop below minimum planting space', async () => {
  globalThis.__focusSize = { width: 1000, height: 600 };
  const root = createRoot(document.getElementById('root')), commits = [], blocked = [];
  const planted = { ...bed, areaPlan: areaPlan(rows()) };
  await act(async () => root.render(createElement(GardenCanvas, { dimensions: { widthCm: 500, lengthCm: 500 }, beds: [planted], selectedBedId: bed.id, resizing: true,
    onSelectBed() {}, onMoveBed() {}, onResizeBed: (id, bounds) => commits.push(bounds), onResizeBlocked: error => blocked.push(error), onEditBed() {}, onSetup() {} })));
  assert.equal(globalThis.__focusHandles.length, 8);
  const handle = globalThis.__focusHandles.find(item => item.x === 100 && item.y === 200);
  const camera = cameraSnapshot(), node = { value: { x: 30, y: 200 }, x() { return this.value.x; }, y() { return this.value.y; }, position(value) { this.value = value; } };
  await act(async () => { handle.onDragStart(); handle.onDragMove({ target: node }); });
  assert.match(blocked.at(-1), /more space/); assert.equal(globalThis.__focusShown.widthCm, 100); assert.equal(node.x(), 100);
  await act(async () => handle.onDragEnd({ target: node }));
  assert.match(blocked.at(-1), /more space/, 'restoring the handle on drop retains the explanation');
  await act(async () => handle.onDragStart());
  node.position({ x: 120, y: 200 }); await act(async () => handle.onDragMove({ target: node }));
  assert.equal(blocked.at(-1), null); assert.equal(globalThis.__focusShown.widthCm, 120);
  node.position({ x: 130, y: 200 }); await act(async () => handle.onDragMove({ target: node }));
  assert.equal(globalThis.__focusShown.widthCm, 130); assert.deepEqual(cameraSnapshot(), camera);
  await act(async () => handle.onDragEnd({ target: node })); assert.equal(commits.at(-1).widthCm, 130);
  assert.equal(commits.at(-1).areaPlan.areas[0].widthCm, 130);
  await act(async () => root.unmount());
});

test('garden keyboard selection replaces the removed bed list and respects read-only and scoped editing', async () => {
  globalThis.__focusSize = { width: 1000, height: 600 };
  const root = createRoot(document.getElementById('root')), selected = [], opened = [];
  const other = { ...bed, id: 'other', xCm: 150 };
  const props = { dimensions: { widthCm: 500, lengthCm: 500 }, beds: [bed, other], selectedBedId: null,
    onSelectBed: id => selected.push(id), onMoveBed() {}, onResizeBed() {}, onEditBed: id => opened.push(id), onSetup() {} };
  const render = values => act(async () => root.render(createElement(GardenCanvas, { ...props, ...values })));
  const key = async (value, modifiers = {}) => act(async () => document.querySelector('[role="region"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers })));
  await render({}); await key('ArrowRight'); assert.equal(selected.at(-1), bed.id);
  await render({ selectedBedId: bed.id }); await key('ArrowRight'); assert.equal(selected.at(-1), other.id);
  await render({ selectedBedId: other.id }); await key('ArrowRight'); assert.equal(selected.at(-1), bed.id);
  await key('Enter'); assert.equal(opened.at(-1), other.id);
  await render({ selectedBedId: other.id, readOnly: true }); await key('Enter'); assert.equal(opened.length, 1);
  await render({ selectedBedId: other.id, editableBedId: bed.id }); await key('Enter'); assert.equal(opened.length, 1);
  await key('Escape'); assert.equal(selected.at(-1), null);
  const count = selected.length; await key('ArrowRight', { altKey: true }); assert.equal(selected.length, count);
  await act(async () => root.unmount());
});

test('garden focus, zoom and fit retain the chosen bed, stable camera and model geometry in either rotation', async () => {
  for (const size of [{ width: 1000, height: 600 }, { width: 320, height: 600 }]) {
    globalThis.__focusSize = size;
    const root = createRoot(document.getElementById('root')), writes = [];
    const props = { dimensions: { widthCm: 1000, lengthCm: 500 }, beds: [bed], selectedBedId: bed.id,
      onSelectBed: id => writes.push(id), onMoveBed: (...args) => writes.push(args), onResizeBed: (...args) => writes.push(args), onEditBed() {}, onSetup() {} };
    const render = values => act(async () => root.render(createElement(GardenCanvas, { ...props, ...values })));
    await render({}); const fitted = cameraSnapshot();
    const command = { action: 'focus', targetId: bed.id, revision: 1 };
    await render({ cameraCommand: command }); const focused = cameraSnapshot();
    assert.ok(focused.scale > fitted.scale); assert.equal(focused.rotation, fitted.rotation);
    const center = focused.rotation ? { x: -(bed.yCm + bed.lengthCm / 2), y: bed.xCm + bed.widthCm / 2 } : { x: bed.xCm + bed.widthCm / 2, y: bed.yCm + bed.lengthCm / 2 };
    assert.equal(focused.x + center.x * focused.scale, size.width / 2);
    assert.equal(focused.y + center.y * focused.scale, size.height / 2);
    await render({ cameraCommand: command, selectedBedId: null }); assert.deepEqual(cameraSnapshot(), focused);
    await render({ cameraCommand: command, beds: [{ ...bed, widthCm: bed.widthCm + 20 }], resizing: true }); assert.deepEqual(cameraSnapshot(), focused);
    globalThis.__focusSize = { width: size.width + 100, height: size.height + 40 };
    await render({ cameraCommand: command }); assert.equal(cameraSnapshot().x, focused.x + 50); assert.equal(cameraSnapshot().y, focused.y + 20);
    globalThis.__focusSize = size;
    await render({ cameraCommand: { action: 'zoom-out', revision: 2 } }); assert.ok(cameraSnapshot().scale < focused.scale);
    await render({ cameraCommand: { action: 'fit', revision: 3 } }); assert.deepEqual(cameraSnapshot(), fitted);
    assert.deepEqual(writes, []);
    await act(async () => root.unmount());
  }
});

test('garden wheel, pinch and Pan never move or resize beds, including an interrupted handle drag and read-only history', async () => {
  globalThis.__focusSize = { width: 320, height: 600 };
  const root = createRoot(document.getElementById('root')), writes = [];
  const props = { dimensions: { widthCm: 1000, lengthCm: 500 }, beds: [bed], selectedBedId: bed.id, resizing: true,
    onSelectBed: id => writes.push(id), onMoveBed: (...args) => writes.push(args), onResizeBed: (...args) => writes.push(args), onEditBed: id => writes.push(id), onSetup() {} };
  await act(async () => root.render(createElement(GardenCanvas, props)));
  const gardenSurface = () => document.querySelector('[role="region"]');
  const gesture = (type, points) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) }); gardenSurface().dispatchEvent(event);
  };
  const fitted = cameraSnapshot(); assert.equal(fitted.rotation, 90);
  await act(async () => gardenSurface().dispatchEvent(new window.WheelEvent('wheel', { deltaY: -100, clientX: 100, clientY: 200, cancelable: true })));
  const wheel = cameraSnapshot(); assert.ok(wheel.scale > fitted.scale);
  const handle = globalThis.__focusHandles[0]; await act(async () => handle.onDragStart());
  const node = { x: () => bed.xCm, y: () => bed.yCm, position() {} };
  globalThis.__cameraDragNodes = [{ stopDrag: () => handle.onDragEnd({ target: node }) }];
  await act(async () => gesture('touchstart', [[100, 200], [200, 200]])); globalThis.__cameraDragNodes = [];
  await act(async () => gesture('touchmove', [[80, 220], [280, 220]]));
  assert.ok(Math.abs(cameraSnapshot().scale - wheel.scale * 2) < 1e-10);
  await act(async () => gesture('touchend', [])); assert.deepEqual(writes, []);
  await act(async () => root.render(createElement(GardenCanvas, { ...props, panning: true })));
  assert.equal(globalThis.__cameraShape.readOnly, true); assert.equal(globalThis.__focusHandles.length, 0);
  const beforePan = cameraSnapshot();
  await act(async () => gardenSurface().dispatchEvent(new window.MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100, bubbles: true })));
  await act(async () => window.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 140, clientY: 125 })));
  await act(async () => window.dispatchEvent(new window.MouseEvent('mouseup')));
  assert.equal(cameraSnapshot().x, beforePan.x + 40); assert.equal(cameraSnapshot().y, beforePan.y + 25);
  await act(async () => root.render(createElement(GardenCanvas, { ...props, readOnly: true, cameraCommand: { action: 'fit', revision: 1 } })));
  assert.deepEqual(cameraSnapshot(), fitted); assert.equal(globalThis.__focusHandles.length, 0); assert.deepEqual(writes, []);
  await act(async () => root.unmount());
});
