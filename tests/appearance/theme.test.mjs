import { after, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';

const dom = new JSDOM('<meta name="theme-color"><div id="root"></div>', { url:'http://localhost/' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
mkdirSync('node_modules/.tmp', { recursive:true });
const directory = mkdtempSync(resolve('node_modules/.tmp/myco-theme-'));
const result = await build({ configFile:false, envFile:false, logLevel:'silent',
  build:{ write:false, minify:false, lib:{ entry:'tests/appearance/modules.ts', formats:['es'] },
    rolldownOptions:{ external:['react','react/jsx-runtime'] } } });
const file = join(directory,'theme.mjs');
writeFileSync(file,(Array.isArray(result)?result[0]:result).output.find(item=>item.type==='chunk').code);
let root, version=0;
afterEach(async()=>{ if(root) await act(async()=>root.unmount()); root=null; });
after(()=>{ dom.window.close(); rmSync(directory,{recursive:true,force:true}); });
const fresh = () => import(`${pathToFileURL(file).href}?instance=${version++}`);

function matchMedia(dark) {
  let matches=dark; const listeners=new Set();
  window.matchMedia=()=>({ get matches(){ return matches; }, addEventListener(type,listener){listeners.add(listener);} });
  return async (next) => { matches=next; await act(async()=>listeners.forEach(listener=>listener())); };
}
async function render(module) {
  function CanvasTheme() {
    const dark=module.useDarkMode();
    return createElement('output',{'data-testid':'canvas-theme','data-theme':dark?'dark':'light'},module.canvasPalette(dark).garden);
  }
  root ??= createRoot(document.getElementById('root'));
  await act(async()=>root.render(createElement('div',null,createElement(module.ThemeToggle),createElement(CanvasTheme))));
}
const click = async label => {
  const button=document.querySelector(`button[aria-label="${label}"]`); assert.ok(button);
  await act(async()=>button.click());
};
function expectTheme(theme) {
  assert.equal(document.documentElement.dataset.theme,theme);
  assert.equal(document.documentElement.style.colorScheme,theme);
  assert.equal(document.querySelector('[data-testid="canvas-theme"]').dataset.theme,theme);
}

test('system preference, manual toggle and reload keep the interface and canvas in the same theme',async()=>{
  window.localStorage.clear(); const system=matchMedia(true); let module=await fresh();
  await render(module);expectTheme('dark');
  await system(false);expectTheme('light');
  await click('Switch to dark mode');expectTheme('dark');
  assert.equal(window.localStorage.getItem('myco-theme'),'dark');
  await system(true);await system(false);expectTheme('dark');
  await act(async()=>root.unmount());root=null;
  module=await fresh();await render(module);expectTheme('dark');
  assert.equal(document.querySelector('meta[name="theme-color"]').content,'#28221c');
  await click('Switch to light mode');expectTheme('light');
  assert.equal(window.localStorage.getItem('myco-theme'),'light');
  assert.equal(document.querySelector('meta[name="theme-color"]').content,'#fffcf6');
  await act(async()=>{
    window.localStorage.setItem('myco-theme','dark');
    window.dispatchEvent(new window.StorageEvent('storage',{key:'myco-theme',newValue:'dark'}));
  });
  expectTheme('dark');
});

test('invalid preferences follow the device, and blocked storage still permits toggling',async()=>{
  window.localStorage.setItem('myco-theme','invalid');matchMedia(false);
  const module=await fresh();await render(module);expectTheme('light');
  const prototype=window.Storage.prototype, get=prototype.getItem, set=prototype.setItem;
  try {
    prototype.getItem=()=>{throw Error('Storage unavailable');};
    prototype.setItem=()=>{throw Error('Storage unavailable');};
    const isolated=await fresh();await render(isolated);expectTheme('light');
    await click('Switch to dark mode');expectTheme('dark');
  } finally { prototype.getItem=get;prototype.setItem=set; }
});

test('main natural-palette text and button combinations retain readable contrast in both modes',()=>{
  const css=readFileSync('src/app/styles.css','utf8');
  const colors=Object.fromEntries([...css.matchAll(/--color-([a-z]+(?:-\d+)?): (#[a-f\d]+)/g)].map(match=>[match[1],match[2]]));
  const luminance=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
    .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  for(const [foreground,background] of [['stone-900','white'],['stone-600','white'],['stone-400','stone-900'],
    ['white','green-800'],['green-950','green-500'],['white','red-600'],['red-700','red-50'],['red-400','red-950'],['blue-700','blue-50'],['blue-300','blue-950']]) {
    const [low,high]=[luminance(colors[foreground]),luminance(colors[background])].sort((a,b)=>a-b);
    assert.ok((high+.05)/(low+.05)>=4.5,`${foreground} on ${background}`);
  }
});

test('saved and system palettes are applied by the page before React starts',()=>{
  const html=readFileSync('index.html','utf8');
  for(const [saved,system,expected] of [['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],['invalid',false,'light']]){
    const page=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',beforeParse(window){
      window.matchMedia=()=>({matches:system});
      if(saved)window.localStorage.setItem('myco-theme',saved);
    }});
    assert.equal(page.window.document.documentElement.dataset.theme,expected);
    assert.equal(page.window.document.documentElement.style.colorScheme,expected);
    page.window.close();
  }
});
