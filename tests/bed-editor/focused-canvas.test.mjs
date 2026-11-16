import { after,test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { bed,areaV2,planV5 } from '../planting/fixtures.mjs';

mkdirSync('node_modules/.tmp',{recursive:true});
const directory=mkdtempSync(resolve('node_modules/.tmp/myco-focused-'));
const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react');const {createRoot}=await import('react-dom/client');
const stub=join(directory,'surfaces.mjs');
writeFileSync(stub,`import {createElement} from 'react';
  export const Stage=({children})=>createElement('div',null,children);
  export const Layer=(props)=>{globalThis.__focusLayer=props;return createElement('div',null,props.children)};
  export const Rect=()=>null;
  export const Circle=(props)=>{globalThis.__focusHandles.push(props);return null};
  export const BedShape=({bed,onOpen})=>{globalThis.__focusOpen=onOpen;globalThis.__focusShown=bed;globalThis.__focusHandles=[];return null};
  export const useElementSize=()=>({ref:()=>{},sizePx:globalThis.__focusSize});
  export const useDarkMode=()=>false;
  export const GardenGrid=()=>null;export const MulchMarks=()=>null;
  export const PlantingMarks=()=>null;export const AreaRowDistanceGuides=()=>null;
  export const BedAlignmentGuides=()=>null;export const BedDistanceGuides=()=>null;
  export const BedLabel=()=>null;
`);
const result=await build({configFile:false,envFile:false,logLevel:'silent',plugins:[{name:'focus-surfaces',enforce:'pre',resolveId(source){
  if(source==='react-konva'||['/BedShape','/BedLabel','/useElementSize','/useDarkMode','/GardenGrid','/MulchMarks','/PlantingMarks','/AreaRowDistanceGuides','/BedAlignmentGuides','/BedDistanceGuides'].some(suffix=>source.endsWith(suffix)))return stub;
}}],build:{write:false,minify:false,lib:{entry:'src/features/planting/BedPlanCanvas.tsx',formats:['es']},rolldownOptions:{external:['react','react/jsx-runtime']}}});
writeFileSync(join(directory,'canvas.mjs'),(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code);
const {BedPlanCanvas}=await import(pathToFileURL(join(directory,'canvas.mjs')).href);
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
