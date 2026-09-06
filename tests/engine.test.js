import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {SentenceEngine,Board,keysForMode,signature,sentenceText} from '../src/engine.js';
const data=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));
const engine=new SentenceEngine(data);

test('all approved banks have unique valid entries, all times and exact pictures',()=>{
  const counts={2:50,3:150,4:157,5:164};let combinations=0;
  for(const mode of [2,3,4,5]){
    const bank=engine.bank(mode),keys=keysForMode(mode);
    assert.equal(bank.length,counts[mode]);assert.equal(new Set(bank.map(r=>r.id)).size,bank.length);
    assert.equal(new Set(bank.map(r=>signature(r,keys))).size,bank.length);
    for(const row of bank)for(const time of ['none','today','yesterday','tomorrow']){
      const cards=engine.cards(row,mode,time);assert.equal(cards.length,mode+(time==='none'?0:1));
      for(const c of cards){assert.ok(c.text);assert.ok(existsSync(new URL('../'+c.image,import.meta.url)),c.image);assert.ok(!/undefined|null|γιατί για να/.test(c.text));}
      const text=sentenceText(cards);assert.ok(text.endsWith('.'));if(time!=='none')assert.match(text,/^(Σήμερα|Χθες|Αύριο) (το|ο|η) /);
      combinations++;
    }
  }
  assert.equal(combinations,2084);
});
test('new accepted vocabulary has exact time forms and retains the accepted purpose',()=>{
  const row=data.mode5.find(r=>r.id==='m5-096');
  assert.match(sentenceText(engine.cards(row,5,'yesterday')),/βούρτσισε τα δόντια στο μπάνιο γιατί ήθελε να έχει καθαρά δόντια/);
  assert.match(sentenceText(engine.cards(row,5,'tomorrow')),/θα βουρτσίσει τα δόντια στο μπάνιο γιατί θέλει να έχει καθαρά δόντια/);
  for(const id of ['m5-118','m5-154'])for(const time of ['none','today','yesterday','tomorrow'])assert.ok(sentenceText(engine.cards(data.mode5.find(r=>r.id===id),5,time)).endsWith('για να βγει έξω.'));
});
test('all alternatives change exactly one ID and belong to the curated bank',()=>{
  let total=0;
  for(const mode of [2,3,4,5])for(const row of engine.bank(mode))for(const key of keysForMode(mode)){
    const alternatives=engine.alternatives(mode,row,key);
    for(const other of alternatives){
      assert.ok(engine.bank(mode).includes(other));assert.notEqual(row[key],other[key]);
      for(const otherKey of keysForMode(mode).filter(k=>k!==key))assert.equal(row[otherKey],other[otherKey]);
      for(const time of ['none','today','yesterday','tomorrow'])assert.equal(engine.cards(other,mode,time).length,mode+(time==='none'?0:1));
      total++;
    }
  }
  assert.ok(total>0);
});
test('changing subject/object refreshes dependent action and reason images',()=>{
  const boy=data.mode5.find(r=>r.id==='m5-001');
  const girl=engine.alternatives(5,boy,'subject').find(r=>r.subject==='girl');assert.ok(girl);
  assert.notEqual(girl.images.verb,boy.images.verb);assert.notEqual(girl.images.reason,boy.images.reason);
  const banana=engine.alternatives(5,boy,'object').find(r=>r.object==='banana');assert.ok(banana);assert.notEqual(banana.images.verb,boy.images.verb);assert.notEqual(banana.images.reason,boy.images.reason);
  const board=new Board(engine.cards(boy,5,'none'));board.place('subject','subject');board.place('reason','reason');board.update(engine.cards(girl,5,'none'));
  assert.ok(board.filled.has('reason'));assert.equal(board.cards.find(c=>c.key==='reason').image,girl.images.reason);
});
test('deck visits each sentence once before reshuffling and avoids immediate repeat',()=>{
  for(const mode of [2,3,4,5]){
    const e=new SentenceEngine(data,()=>.3),ids=[];let previous=null;
    for(let i=0;i<e.bank(mode).length;i++){const row=e.next(mode,previous);assert.notEqual(row.id,previous);ids.push(row.id);previous=row.id;}
    assert.equal(new Set(ids).size,e.bank(mode).length);assert.notEqual(e.next(mode,previous).id,previous);
  }
});
test('board rejects incorrect roles, supports removal, partial audio and clearing',()=>{
  const b=new Board(engine.cards(data.mode5[0],5,'tomorrow'));
  assert.equal(b.place('verb','subject'),false);assert.equal(b.filled.size,0);b.select('verb');assert.equal(b.selected,'verb');b.select('verb');assert.equal(b.selected,null);
  b.place('subject','subject');assert.equal(b.partial,'Το αγόρι.');b.place('time','time');assert.equal(b.partial,'Αύριο το αγόρι.');
  for(const c of b.cards)b.place(c.key,c.key);assert.ok(b.complete);b.remove('reason');assert.equal(b.complete,false);b.clear();assert.equal(b.partial,'');
});
test('new writing/drawing references use corrected orientation versions',()=>{
  for(const row of data.mode5.filter(r=>['write','draw'].includes(r.verb)))assert.match(row.images.verb,/-orientation-v\d+\.webp$/);
});
