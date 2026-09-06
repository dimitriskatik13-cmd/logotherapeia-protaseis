import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SentenceEngine,Board,sentenceText} from '../src/engine.js';
const data=JSON.parse(readFileSync(new URL('../data/content.json',import.meta.url)));
const engine=new SentenceEngine(data);
const row=id=>data.mode5.find(r=>r.id===id);

test('today describes the reported umbrella event as completed',()=>{
  assert.equal(sentenceText(engine.cards(row('m5-120'),5,'today')),'Σήμερα ο μπαμπάς έκλεισε την ομπρέλα στο σπίτι γιατί σταμάτησε η βροχή.');
  assert.equal(sentenceText(engine.cards(row('m5-155'),5,'today')),'Σήμερα το κορίτσι έκλεισε την ομπρέλα στο σπίτι γιατί σταμάτησε η βροχή.');
});
test('today aligns transient causes, but preserves stable preferences and purposes',()=>{
  assert.equal(sentenceText(engine.cards(row('m5-001'),5,'today')),'Σήμερα το αγόρι έφαγε το μήλο στο σπίτι γιατί πεινούσε.');
  assert.equal(sentenceText(engine.cards(row('m5-108'),5,'today')),'Σήμερα το κορίτσι έκλεισε το βιβλίο στην τάξη γιατί τελείωσε το μάθημα.');
  assert.equal(sentenceText(engine.cards(row('m5-164'),5,'today')),'Σήμερα το κορίτσι διάβασε το βιβλίο στη βιβλιοθήκη γιατί αγαπάει τα βιβλία.');
  assert.equal(sentenceText(engine.cards(row('m5-118'),5,'today')),'Σήμερα το κορίτσι φόρεσε τα παπούτσια στο σπίτι για να βγει έξω.');
});
test('today has explicit reviewed verb and cause forms throughout all four banks',()=>{
  let count=0;
  for(const mode of [2,3,4,5])for(const entry of engine.bank(mode)){
    const cards=engine.cards(entry,mode,'today');
    assert.ok(data.verbForms[entry.verb].today,entry.id);
    assert.equal(cards.find(c=>c.key==='verb').text,data.verbForms[entry.verb].past);
    if(mode===5)assert.ok(data.reasonForms[entry.reason].today,entry.id);
    count++;
  }
  assert.equal(count,521);
});
test('switching time updates both display and partial/full spoken text',()=>{
  const b=new Board(engine.cards(row('m5-120'),5,'tomorrow'));
  for(const c of b.cards)b.place(c.key,c.key);
  b.update(engine.cards(row('m5-120'),5,'today'));
  assert.equal(b.partial,'Σήμερα ο μπαμπάς έκλεισε την ομπρέλα στο σπίτι γιατί σταμάτησε η βροχή.');
  b.remove('reason');assert.equal(b.partial,'Σήμερα ο μπαμπάς έκλεισε την ομπρέλα στο σπίτι.');
  assert.ok(sentenceText(engine.cards(row('m5-120'),5,'none')).startsWith('Ο μπαμπάς κλείνει'));
  assert.ok(sentenceText(engine.cards(row('m5-120'),5,'tomorrow')).startsWith('Αύριο ο μπαμπάς θα κλείσει'));
});
