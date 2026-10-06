import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {watchUpdates,buildUpdateNote} from '../src/updates.js';
function fakes({controller={}}={}){
 const handlers={},winHandlers={},docHandlers={},calls={register:0,update:0};
 const registration={update:async()=>{calls.update++;}};
 const serviceWorker={controller,addEventListener:(t,fn)=>{handlers[t]=fn;},register:async()=>{calls.register++;return registration;}};
 return {handlers,winHandlers,docHandlers,calls,serviceWorker,win:{addEventListener:(t,fn)=>{winHandlers[t]=fn;}},doc:{visibilityState:'visible',addEventListener:(t,fn)=>{docHandlers[t]=fn;}},note:{hidden:true}};
}
test('an update that takes control of an installed app shows the message; the first install does not',async()=>{
 const f=fakes();assert.equal(watchUpdates(f.note,{serviceWorker:f.serviceWorker,hostname:'x.github.io',win:f.win,doc:f.doc}),true);
 await f.winHandlers.load();assert.equal(f.calls.register,1);assert.equal(f.calls.update,1);
 f.handlers.controllerchange();assert.equal(f.note.hidden,false);
 const g=fakes({controller:null});watchUpdates(g.note,{serviceWorker:g.serviceWorker,hostname:'x.github.io',win:g.win,doc:g.doc});
 g.handlers.controllerchange();assert.equal(g.note.hidden,true);g.handlers.controllerchange();assert.equal(g.note.hidden,false);
});
test('returning to the app checks again; localhost and old browsers are left alone; failures are silent',async()=>{
 const f=fakes();watchUpdates(f.note,{serviceWorker:f.serviceWorker,hostname:'x.github.io',win:f.win,doc:f.doc});await f.winHandlers.load();
 f.doc.visibilityState='hidden';f.docHandlers.visibilitychange();f.doc.visibilityState='visible';f.docHandlers.visibilitychange();assert.equal(f.calls.update,2);
 const l=fakes();assert.equal(watchUpdates(l.note,{serviceWorker:l.serviceWorker,hostname:'localhost',win:l.win,doc:l.doc}),false);assert.equal(watchUpdates(l.note,{serviceWorker:undefined,hostname:'x.github.io',win:l.win,doc:l.doc}),false);
 const b=fakes();b.serviceWorker.register=async()=>{throw new Error('no');};watchUpdates(b.note,{serviceWorker:b.serviceWorker,hostname:'x.github.io',win:b.win,doc:b.doc});await assert.doesNotReject(b.winHandlers.load());
});
test('the message has one button that reloads and shows no version number',()=>{
 let reloaded=0;const nodes=[];const doc={createElement:tag=>{const n={tag,children:[],listeners:{},append(...c){this.children.push(...c);},setAttribute(k,v){this[k]=v;},addEventListener(t,fn){this.listeners[t]=fn;}};nodes.push(n);return n;}};
 const note=buildUpdateNote(doc,()=>reloaded++);assert.equal(note.hidden,true);assert.equal(note.children[0].textContent,'Υπάρχει νέα έκδοση.');
 note.children[1].listeners.click();assert.equal(reloaded,1);
 assert.doesNotMatch(readFileSync(new URL('../src/updates.js',import.meta.url),'utf8'),/VERSION|\d{8}/);
});
