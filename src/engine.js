export const ROLES = ['subject','verb','object','place','reason'];
export const TIME_IDS = ['today','yesterday','tomorrow'];
export function keysForMode(mode) {
  if (![2,3,4,5].includes(mode)) throw new Error('Invalid mode');
  return ROLES.slice(0, mode);
}
export const signature = (row, keys) => keys.map(k=>row[k]).join('|');
export function shuffle(items, random=Math.random) {
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export class SentenceEngine {
  constructor(data, random=Math.random) {
    this.data=data;this.random=random;this.banks=new Map([[2,data.mode2],[5,data.mode5]]);this.decks=new Map();this.index=new Map();
    for(const mode of [3,4]){
      const seen=new Set(), keys=keysForMode(mode), rows=[];
      for(const row of data.mode5){const sig=signature(row,keys);if(seen.has(sig))continue;seen.add(sig);
        rows.push({id:row.id.replace('m5-',`m${mode}-`),...Object.fromEntries(keys.map(k=>[k,row[k]])),images:Object.fromEntries(keys.map(k=>[k,row.images[k]]))});
      }
      this.banks.set(mode,rows);
    }
    for(const [mode,rows] of this.banks){
      const keys=keysForMode(mode), byKey=new Map();
      for(const key of keys){const map=new Map(), rest=keys.filter(k=>k!==key);
        for(const row of rows){const sig=signature(row,rest);if(!map.has(sig))map.set(sig,[]);map.get(sig).push(row);}
        byKey.set(key,{map,rest});
      }
      this.index.set(mode,byKey);
    }
  }
  bank(mode){keysForMode(mode);return this.banks.get(mode);}
  next(mode, previousId=null){
    let deck=this.decks.get(mode);
    if(!deck?.length){deck=shuffle(this.bank(mode),this.random);this.decks.set(mode,deck);}
    if(deck[deck.length-1]?.id===previousId && deck.length>1)[deck[0],deck[deck.length-1]]=[deck[deck.length-1],deck[0]];
    let row=deck.pop();
    if(row.id===previousId && this.bank(mode).length>1){
      deck=shuffle(this.bank(mode).filter(r=>r.id!==previousId),this.random);this.decks.set(mode,deck);row=deck.pop();
    }
    return row;
  }
  alternatives(mode,row,key){
    const index=this.index.get(mode)?.get(key);if(!index)return [];
    return (index.map.get(signature(row,index.rest))||[]).filter(r=>r[key]!==row[key]);
  }
  chooseAlternative(mode,row,key){const options=this.alternatives(mode,row,key);return options.length?options[Math.floor(this.random()*options.length)]:null;}
  chooseTime(setting,previous=null){
    if(setting==='none')return 'none';
    if(setting==='random'){const times=TIME_IDS.filter(t=>t!==previous);return times[Math.floor(this.random()*times.length)];}
    if(!TIME_IDS.includes(setting))throw new Error('Invalid time');return setting;
  }
  cards(row,mode,time='none'){
    // Today is an explicit narrative choice: events completed earlier in this day.
    // Separate forms keep this distinct from the ongoing action shown without a time card.
    const tense=time==='today'?'today':time==='yesterday'?'past':time==='tomorrow'?'future':null;
    const result=keysForMode(mode).map(key=>{
      const id=row[key];let text=this.data.labels[key+'s'][id];
      if(tense && (key==='verb'||key==='reason')){
        text=this.data[key+'Forms'][id]?.[tense];if(!text)throw new Error(`Missing ${tense}: ${key}/${id}`);
      }
      if(!text||!row.images[key])throw new Error(`Missing card ${row.id}/${key}`);
      return {key,id,text,image:row.images[key]};
    });
    if(time!=='none'){
      const t=this.data.times.find(t=>t.id===time);if(!t)throw new Error('Invalid time');
      result[0]={...result[0],text:result[0].text.charAt(0).toLocaleLowerCase('el')+result[0].text.slice(1)};
      result.unshift({key:'time',id:time,text:t.text,image:t.image});
    }
    return result;
  }
}
export function sentenceText(cards){
  if(!cards.length)return '';
  const text=cards.map(c=>c.text).join(' ');return text.charAt(0).toLocaleUpperCase('el')+text.slice(1)+'.';
}
export class Board {
  constructor(cards=[]){this.reset(cards);}
  reset(cards){this.cards=cards;this.filled=new Set();this.selected=null;}
  select(key){if(this.filled.has(key)||!this.cards.some(c=>c.key===key))return;this.selected=this.selected===key?null:key;}
  place(key,target){if(key!==target||!this.cards.some(c=>c.key===key))return false;this.filled.add(key);this.selected=null;return true;}
  remove(key){this.filled.delete(key);this.selected=null;}
  clear(){this.filled.clear();this.selected=null;}
  update(cards){this.cards=cards;this.filled=new Set([...this.filled].filter(k=>cards.some(c=>c.key===k)));this.selected=null;}
  get complete(){return this.cards.length>0&&this.cards.every(c=>this.filled.has(c.key));}
  get partial(){return sentenceText(this.cards.filter(c=>this.filled.has(c.key)));}
}
