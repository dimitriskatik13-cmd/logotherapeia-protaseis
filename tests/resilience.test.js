import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {PicturePreview} from '../src/picture-preview.js';

function clock(){
  let now=0,id=0;const timers=new Map();
  return {setTimeout(fn,ms){const key=++id;timers.set(key,{fn,at:now+ms});return key;},clearTimeout(key){timers.delete(key);},
    tick(ms){now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}},timers};
}
function preview(){
  const time=clock(),images=[],states=[];
  const env={...time,Image:class {constructor(){images.push(this);this.naturalWidth=640;}}};
  return {...time,images,states,p:new PicturePreview({env,show:s=>states.push(s)})};
}
const a={text:'Το αγόρι',small:'small-a.webp',large:'large-a.webp'};
const b={text:'Το κορίτσι',small:'small-b.webp',large:'large-b.webp'};

test('zoom shows thumbnail immediately then full image only after load',()=>{
  const c=preview();c.p.open(a);assert.equal(c.states.at(-1).src,a.small);
  c.images[0].onload();assert.equal(c.states.at(-1).src,a.large);
  assert.equal(c.states.at(-1).status,'');assert.equal(c.timers.size,0);
});
test('zoom network failure keeps thumbnail and exposes retry; retry can succeed',()=>{
  const c=preview();c.p.open(a);c.images[0].onerror();
  assert.equal(c.states.at(-1).src,a.small);assert.equal(c.states.at(-1).retry,true);
  c.p.retry();assert.match(c.images[1].src,/zoomRetry=/);c.images[1].onload();
  assert.equal(c.states.at(-1).retry,false);assert.match(c.states.at(-1).src,/large-a/);
});
test('stalled zoom reaches failure after eight seconds with no pending timer',()=>{
  const c=preview();c.p.open(a);c.tick(7999);assert.equal(c.states.at(-1).busy,true);
  c.tick(1);assert.equal(c.states.at(-1).retry,true);assert.equal(c.timers.size,0);
});
test('old zoom response cannot replace another card or mutate a closed dialog',()=>{
  const c=preview();c.p.open(a);const old=c.images[0].onload;
  c.p.open(b);old();assert.equal(c.states.at(-1).src,b.small);
  const late=c.images[1].onload;c.p.close();const count=c.states.length;late();
  assert.equal(c.states.length,count);assert.equal(c.timers.size,0);
});
test('old attempt cannot overwrite retry and failed decode remains a thumbnail',()=>{
  const c=preview();c.p.open(a);const old=c.images[0].onload;c.p.retry();old();
  assert.equal(c.states.at(-1).busy,true);c.images[1].naturalWidth=0;c.images[1].onload();
  assert.equal(c.states.at(-1).src,a.small);assert.equal(c.states.at(-1).retry,true);
});
function startup(){
  const time=clock(),handlers={},nodes={'loading-note':{textContent:'Ετοιμάζουμε τις κάρτες…'},'reload-app':{hidden:true}};
  let reloads=0;
  const window={...time,location:{reload(){reloads++;}},addEventListener(name,fn){handlers[name]=fn;}};
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const code=html.match(/<script id="startup-watchdog">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(code,{window,document:{getElementById:id=>nodes[id]}});
  return {...time,window,nodes,handlers,reloads:()=>reloads};
}
test('startup slow notice after 15s permits late success and hides reload',()=>{
  const c=startup();c.tick(14999);assert.equal(c.nodes['reload-app'].hidden,true);
  c.tick(1);assert.match(c.nodes['loading-note'].textContent,/αργεί/);
  c.window.synoidaStartup.ready();assert.equal(c.nodes['loading-note'].textContent,'');
  assert.equal(c.nodes['reload-app'].hidden,true);assert.equal(c.timers.size,0);
});
test('missing module gives immediate failure; reload button works',()=>{
  const c=startup();c.handlers.error({target:{id:'app-module'}});
  assert.match(c.nodes['loading-note'].textContent,/δεν ξεκίνησε/);
  assert.equal(c.nodes['reload-app'].hidden,false);assert.equal(c.timers.size,0);
  c.nodes['reload-app'].onclick();assert.equal(c.reloads(),1);
});
test('startup ignores image failures and errors after successful startup',()=>{
  const c=startup();c.handlers.error({target:{id:'logo'}});
  assert.equal(c.nodes['reload-app'].hidden,true);
  c.window.synoidaStartup.ready();c.handlers.error({filename:'http://local/src/app.js'});
  c.tick(20000);assert.equal(c.nodes['loading-note'].textContent,'');
});
test('startup catches script runtime errors and preserves explicit content failure',()=>{
  const c=startup();c.handlers.error({filename:'http://local/src/app.js'});
  assert.equal(c.nodes['reload-app'].hidden,false);
  c.window.synoidaStartup.fail('Δεν φορτώθηκαν οι προτάσεις.');c.tick(20000);
  assert.equal(c.nodes['loading-note'].textContent,'Δεν φορτώθηκαν οι προτάσεις.');
});
