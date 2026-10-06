import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync,statSync,readdirSync} from 'node:fs';
import {collectAssets,missingFiles,renderList} from '../scripts/update-sw.mjs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('sw.js',root),'utf8');
// Στον browser τα σχετικά URL λύνονται ως προς το scope του worker· εδώ ένα απλό αντίγραφο του Request.
class FakeRequest{constructor(url,init={}){this.url=url.startsWith('http')?url:'https://example.test/'+url.replace(/^\.\//,'');this.method='GET';this.mode=init.mode||'cors';this.cache=init.cache||'default';}}
const req=(url,init)=>new FakeRequest(url,init);
function load(caches,fetchImpl){const events={};const context=vm.createContext({self:{addEventListener:(n,cb)=>events[n]=cb,skipWaiting:async()=>{},clients:{claim:async()=>{}},location:{origin:'https://example.test'}},caches,Request:FakeRequest,URL,fetch:fetchImpl,setTimeout,Error});vm.runInContext(source,context);return {events,context};}

test('the asset list is generated, complete and every file exists',()=>{
 const assets=collectAssets();
 assert.deepEqual(missingFiles(assets),[]);
 assert.ok(source.includes(renderList(assets)),'sw.js out of date: run node scripts/update-sw.mjs');
 for(const path of assets){if(path==='./')continue;const url=new URL(path.split('?')[0],root);assert.ok(existsSync(url)&&statSync(url).size>0,path);}
});
test('every versioned reference in the page and the code is precached with its exact query',()=>{
 const assets=new Set(collectAssets());const refs=[];
 const index=readFileSync(new URL('index.html',root),'utf8');
 for(const m of index.matchAll(/(?:href|src)="([^"]+\?v=[^"]+)"/g))refs.push(m[1].replace('https://dimitriskatik13-cmd.github.io/logotherapeia-protaseis/',''));
 for(const file of readdirSync(new URL('src/',root)))for(const m of readFileSync(new URL('src/'+file,root),'utf8').matchAll(/['"](\.\/)?([a-z/-]+\.(?:js|json)\?v=[^'"]+)['"]/g))refs.push(m[1]?'src/'+m[2]:m[2]);
 assert.ok(refs.length>=8);for(const ref of refs)assert.ok(assets.has(ref),ref);
});
test('all small card pictures are precached and the large ones are not',()=>{
 const assets=collectAssets();const small=readdirSync(new URL('assets/pictures-320/',root)).filter(f=>f.endsWith('.webp'));
 assert.equal(assets.filter(a=>a.startsWith('assets/pictures-320/')).length,small.length);assert.equal(small.length,450);
 assert.equal(assets.filter(a=>a.startsWith('assets/pictures/')).length,0);
});
test('install precaches with revalidation, activation keeps only the current and runtime caches',async()=>{
 const added=[];let opened=[];const caches={open:async name=>{opened.push(name);return {addAll:async reqs=>{added.push(...reqs);}};},keys:async()=>['synoida-protasi-protasi-v0','synoida-protasi-runtime','synoida-protasi-protasi-v1','synoida-other','x'],delete:async k=>{removed.push(k);}};const removed=[];
 const {events,context}=load(caches);let p;events.install({waitUntil:x=>p=x});await p;
 assert.equal(added.length,vm.runInContext('ASSETS.length',context));assert.ok(added.every(r=>r.cache==='no-cache'));
 events.activate({waitUntil:x=>p=x});await p;assert.deepEqual(removed,['synoida-protasi-protasi-v0']);
 assert.equal(vm.runInContext('CACHE',context),'synoida-protasi-protasi-v1');
});
test('a page load tries the network first and falls back to the cached page offline',async()=>{
 const hits={'index.html':'cached-page'};const caches={match:async req=>hits[typeof req==='string'?req:new URL(req.url).pathname.slice(1)]||undefined,open:async()=>({put:async()=>{}})};
 const {events}=load(caches,async()=>{throw new Error('offline');});
 let response;events.fetch({request:req('https://example.test/index.html?homescreen=2',{mode:'navigate'}),respondWith:p=>response=p});
 assert.equal(await response,'cached-page');
});
test('assets come from the cache, uncached same-origin files are fetched and kept, foreign origins are left alone',async()=>{
 const stored=[];const caches={match:async req=>req.url.endsWith('app.css?v=20261006-1')?'cached-css':undefined,open:async()=>({put:async(req,res)=>{stored.push(req.url);}})};
 const {events}=load(caches,async req=>({status:200,type:'basic',url:req.url,clone(){return this;}}));
 let r1,r2,handled=false;
 events.fetch({request:req('https://example.test/styles/app.css?v=20261006-1'),respondWith:p=>r1=p});assert.equal(await r1,'cached-css');
 events.fetch({request:req('https://example.test/assets/pictures/big.webp'),respondWith:p=>r2=p});assert.equal((await r2).url,'https://example.test/assets/pictures/big.webp');
 await new Promise(r=>setTimeout(r,0));assert.deepEqual(stored,['https://example.test/assets/pictures/big.webp']);
 events.fetch({request:req('https://fonts.googleapis.com/x.css'),respondWith:()=>{handled=true;}});assert.equal(handled,false);
 events.fetch({request:req('https://example.test/version.json',{cache:'no-store'}),respondWith:()=>{handled=true;}});assert.equal(handled,false);
});
