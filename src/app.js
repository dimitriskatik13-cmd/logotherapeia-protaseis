import {SentenceEngine,Board,shuffle,sentenceText} from './engine.js?v=20260906-3';
import {Reward,HOLD_MS} from './reward.js?v=20260906-3';
import {GreekSpeech} from './speech.js?v=20260906-3';
import {ImageLoader} from './images.js?v=20260906-3';
import {bindDrag} from './gestures.js?v=20260906-3';

const $=id=>document.getElementById(id);
const roles={subject:{label:'ΠΟΙΟΣ',color:'#8DC63F'},verb:{label:'ΤΙ ΚΑΝΕΙ',color:'#00AEEF'},object:{label:'ΤΙ',color:'#F7941D'},place:{label:'ΠΟΥ',color:'#ED1C24'},reason:{label:'ΓΙΑΤΙ',color:'#58595B'},time:{label:'ΠΟΤΕ',color:'#00AEEF'}};
const timeLabels={none:'Χωρίς',today:'Σήμερα',yesterday:'Χθες',tomorrow:'Αύριο',random:'Τυχαίο'};
const state={mode:5,timeSetting:'none',time:'none',row:null,playing:false,busy:false,order:[],upcoming:null};
const board=new Board(),loader=new ImageLoader();
let engine,request=0,layer=null,cleanupDrag=()=>{},previousFocus=null;
const qa=new URLSearchParams(location.search).has('qa');
function timing(name,start=0){if(qa)document.documentElement.dataset[name]=String(Math.round((performance.now()-start)*10)/10);}
function feedback(message){$('feedback').textContent=message;}
let resultFitFrame=null;
function fitResult(){
  const text=$('result');if(!state.playing||!text.clientWidth)return;
  text.classList.remove('wrap');text.style.fontSize='';
  const width=text.clientWidth,base=parseFloat(getComputedStyle(text).fontSize);
  if(text.scrollWidth>width){
    let size=Math.max(14,Math.floor(base*(width-4)/text.scrollWidth*10)/10);
    text.style.fontSize=size+'px';
    // Leave a little room for per-glyph rounding in different browsers/fonts.
    for(let n=0;n<6&&text.scrollWidth>width&&size>14;n++){
      size=Math.max(14,size-.2);text.style.fontSize=size+'px';
    }
    if(text.scrollWidth>width)text.classList.add('wrap');
  }
}
function scheduleResultFit(){cancelAnimationFrame(resultFitFrame);resultFitFrame=requestAnimationFrame(fitResult);}
const speech=new GreekSpeech(window,{feedback,status:text=>$('voice-status').textContent=text});
const reward=new Reward({ready:()=>state.playing&&!state.busy&&board.complete&&!document.hidden,
  onHold:()=>$('complete').classList.add('holding'),onCancelHold:()=>$('complete').classList.remove('holding'),
  onCelebrate:()=>{cleanupDrag();speech.stop();panel(false);$('play-screen').classList.add('is-celebrating');
    document.querySelectorAll('#play-screen button:not(#home)').forEach(b=>b.disabled=true);feedback('🌟 Μπράβο! Πάμε στην επόμενη πρόταση.');celebrate();},
  onReset:()=>{layer?.remove();layer=null;$('play-screen').classList.remove('is-celebrating');},
  onNext:()=>nextSentence()
});
const locked=()=>state.busy||reward.phase==='celebrating';

function image(card){const img=new Image();img.src=card.image;img.alt='';img.draggable=false;img.decoding='async';if(card.key==='time')img.className='time-image';return img;}
function label(card){const el=document.createElement('span');el.className='label';el.textContent=card.text;return el;}
function renderMenu(){
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=+b.dataset.mode===state.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-time]').forEach(b=>{const active=b.dataset.time===state.timeSetting;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function render({focus=null}={}){
  if(!state.row){for(const id of ['restart','listen','listen-partial','settings','complete'])$(id).disabled=true;return;}
  const slots=document.createDocumentFragment(),tray=document.createDocumentFragment();
  for(const [i,c] of board.cards.entries()){
    const role=roles[c.key],wrap=document.createElement('div');wrap.className='slot';wrap.style.setProperty('--role',role.color);
    const title=document.createElement('div');title.className='role';const dot=document.createElement('span');dot.className='role-dot';dot.setAttribute('aria-hidden','true');title.append(dot,document.createTextNode(role.label));
    const filled=board.filled.has(c.key),drop=document.createElement('button');drop.className='drop'+(filled?' filled':'')+(board.selected?' ready':'');drop.dataset.slot=c.key;
    drop.setAttribute('aria-label',filled?'Αφαίρεση: '+c.text:'Θέση '+role.label);drop.disabled=locked();
    if(filled)drop.append(image(c),label(c));else {const number=document.createElement('span');number.className='slot-number';number.textContent=i+1;number.setAttribute('aria-hidden','true');drop.append(number);}
    const other=document.createElement('button');other.className='alternate';other.dataset.alternate=c.key;other.textContent='🎲 Άλλο';other.setAttribute('aria-label','Άλλο: '+role.label);
    const available=c.key==='time'?state.timeSetting==='random':engine.alternatives(state.mode,state.row,c.key).length>0;
    other.disabled=locked()||!available;other.title=available?'Άλλαξε μόνο αυτό το κομμάτι':'Δεν υπάρχει άλλη επιλογή με τα ίδια υπόλοιπα στοιχεία.';
    wrap.append(title,drop,other);
    if(filled){const zoom=document.createElement('button');zoom.className='zoom';zoom.textContent='⌕';zoom.dataset.zoom=c.key;zoom.setAttribute('aria-label','Μεγέθυνση: '+c.text);zoom.disabled=locked();wrap.append(zoom);}
    slots.append(wrap);
  }
  for(const key of state.order){
    const c=board.cards.find(c=>c.key===key);if(!c)continue;
    const card=document.createElement('button');card.className='card'+(board.selected===key?' selected':'')+(board.filled.has(key)?' placed':'');card.dataset.card=key;card.style.setProperty('--role',roles[key].color);card.setAttribute('aria-label','Κάρτα: '+c.text);card.setAttribute('aria-pressed',String(board.selected===key));card.disabled=locked()||board.filled.has(key);card.append(image(c),label(c));tray.append(card);
  }
  $('slots').replaceChildren(slots);$('tray').replaceChildren(tray);
  for(const row of [$('slots'),$('tray')])row.style.setProperty('--count',board.cards.length);
  $('play-description').textContent=`${state.mode} κομμάτια${state.time==='none'?'':' · '+timeLabels[state.time]}`;
  $('play-screen').dataset.sentenceId=state.row.id;
  const showModel=$('show-model').checked;
  const built=board.cards.map(c=>board.filled.has(c.key)?c.text:'—').join(' ')+(board.complete?'.':'');
  $('result-label').textContent=showModel?'Πλήρης πρόταση':'Η πρότασή σου';$('result').textContent=showModel?sentenceText(board.cards):built;$('built').textContent=built;$('built').hidden=!showModel;
  scheduleResultFit();
  $('complete').disabled=locked()||!board.complete;
  for(const id of ['restart','listen','listen-partial','settings'])$(id).disabled=locked();
  $('listen-partial').disabled=locked()||board.filled.size===0;
  if(focus)document.querySelector(focus)?.focus({preventScroll:true});
}
function reserveNext(){
  if(!engine)return;
  const row=engine.next(state.mode,state.row?.id),time=engine.chooseTime(state.timeSetting);
  const cards=engine.cards(row,state.mode,time);
  state.upcoming={row,time,cards,mode:state.mode,setting:state.timeSetting,promise:loader.preload(cards)};
}
async function nextSentence(){
  const started=performance.now();
  reward.cancel();cleanupDrag();speech.stop();closePicture();
  const ticket=++request;state.busy=true;board.selected=null;
  if(!state.upcoming||state.upcoming.mode!==state.mode||state.upcoming.setting!==state.timeSetting||state.upcoming.row.id===state.row?.id)reserveNext();
  const next=state.upcoming;state.upcoming=null;
  render();feedback('');
  const results=await next.promise;
  if(ticket!==request||!state.playing)return;
  state.row=next.row;state.time=next.time;state.busy=false;board.reset(next.cards);state.order=shuffle(next.cards.map(c=>c.key));render();
  timing('transitionMs',started);
  feedback(results.some(r=>r.status==='rejected')?'Μια εικόνα δεν φορτώθηκε. Έλεγξε τη σύνδεση ή πάτησε «Νέα πρόταση».':'');
  reserveNext();
}
async function alternate(key){
  if(locked())return;reward.cancelHold();cleanupDrag();speech.stop();closePicture();
  let row=state.row,time=state.time;
  if(key==='time'){
    if(state.timeSetting!=='random')return;time=engine.chooseTime('random',time);
  }else{
    row=engine.chooseAlternative(state.mode,row,key);
    if(!row){feedback('Δεν υπάρχει άλλη επιλογή με τα ίδια υπόλοιπα στοιχεία.');return;}
  }
  const cards=engine.cards(row,state.mode,time),ticket=++request;state.busy=true;render();
  const results=await loader.preload(cards);if(ticket!==request||!state.playing)return;
  state.busy=false;state.row=row;state.time=time;board.update(cards);render({focus:`[data-alternate="${key}"]`});
  feedback(results.some(r=>r.status==='rejected')?'Μια εικόνα δεν φορτώθηκε. Έλεγξε τη σύνδεση.':'Άλλαξε το '+roles[key].label+'.');
}
function showHome(){
  request++;reward.cancel();cleanupDrag();speech.stop();closePicture();state.busy=false;state.playing=false;panel(false);
  $('play-screen').hidden=true;$('home-screen').hidden=false;document.body.classList.remove('play');renderMenu();$('start').focus({preventScroll:true});window.scrollTo(0,0);
}
function showPlay(){if(!engine)return;state.playing=true;$('home-screen').hidden=true;$('play-screen').hidden=false;document.body.classList.add('play');window.scrollTo(0,0);nextSentence();}
function place(key,target){
  if(locked())return;reward.cancelHold();
  if(!board.place(key,target)){feedback('Δοκίμασε στο σωστό πλαίσιο.');return;}
  render({focus:board.complete?'#complete':`[data-slot="${target}"]`});
  feedback(board.complete?'Μπράβο! Κράτησε το «Σωστό!» για 1 δευτερόλεπτο.':'Ωραία, συνέχισε.');
}
function positionSettings(){
  const panel=$('settings-panel');if(panel.hidden)return;
  const button=$('settings').getBoundingClientRect();
  panel.style.left=Math.max(12,Math.min(button.left,document.documentElement.clientWidth-panel.offsetWidth-12))+'px';
  panel.style.top=(button.bottom+8)+'px';panel.style.maxHeight=Math.max(140,window.innerHeight-button.bottom-20)+'px';
}
function panel(open){reward.cancelHold();$('settings-panel').hidden=!open;$('settings').setAttribute('aria-expanded',String(open));if(open){positionSettings();$('show-model').focus();}}
function openPicture(key){
  const c=board.cards.find(c=>c.key===key);if(!c)return;reward.cancelHold();cleanupDrag();speech.stop();previousFocus=document.activeElement;
  $('picture-title').textContent=c.text;$('picture-large').src=c.image;$('picture-large').alt=c.text;
  if($('picture-dialog').showModal)$('picture-dialog').showModal();else $('picture-dialog').setAttribute('open','');
}
function closePicture(){const dialog=$('picture-dialog');if(!dialog.open)return;if(dialog.close)dialog.close();else dialog.removeAttribute('open');previousFocus?.isConnected&&previousFocus.focus({preventScroll:true});}
function celebrate(){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;layer=document.createElement('div');layer.className='success-celebration'+(reduced?' reduced':'');layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<div class="success-emblem"><span class="success-ring"></span><span class="success-star star-left"></span><span class="success-star star-right"></span><span class="success-star star-top"></span><span class="success-check">✓</span><strong>Μπράβο!</strong></div>';
  if(!reduced){const colors=['#8DC63F','#ED1C24','#00AEEF','#F7941D'];for(let i=0;i<18;i++){
    const piece=document.createElement('i');piece.className='success-confetti'+(i%3===0?' round':'');const angle=Math.PI*2*i/18,reach=95+(i%4)*32;
    piece.style.setProperty('--dx',Math.round(Math.cos(angle)*reach)+'px');piece.style.setProperty('--dy',Math.round(Math.sin(angle)*reach)+'px');piece.style.setProperty('--turn',(i%2?-1:1)*(140+i*19)+'deg');piece.style.setProperty('--delay',(i%3)*35+'ms');piece.style.background=colors[i%4];layer.append(piece);
  }}document.body.append(layer);
}

cleanupDrag=bindDrag({root:document,canDrag:()=>state.playing&&!locked(),cardFor:key=>board.cards.find(c=>c.key===key),place,feedback,cancelHold:()=>reward.cancelHold()});
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.mode){state.mode=+b.dataset.mode;state.upcoming=null;renderMenu();return;}
  if(b.dataset.time){state.timeSetting=b.dataset.time;state.upcoming=null;renderMenu();return;}
  if(locked()&&b.id!=='home')return;
  if(b.dataset.card){reward.cancelHold();board.select(b.dataset.card);render({focus:`[data-card="${b.dataset.card}"]`});feedback(board.selected?'Πάτησε τώρα το σωστό πλαίσιο.':'');}
  if(b.dataset.slot){reward.cancelHold();if(board.filled.has(b.dataset.slot)){board.remove(b.dataset.slot);render({focus:`[data-card="${b.dataset.slot}"]`});feedback('Η κάρτα επέστρεψε.');}else if(board.selected)place(board.selected,b.dataset.slot);}
  if(b.dataset.alternate)alternate(b.dataset.alternate);
  if(b.dataset.zoom)openPicture(b.dataset.zoom);
});
$('start').onclick=showPlay;$('home').onclick=showHome;$('restart').onclick=()=>nextSentence();
$('listen').onclick=()=>speech.speak(sentenceText(board.cards));$('listen-partial').onclick=()=>speech.speak(board.partial);
$('settings').onclick=()=>panel($('settings-panel').hidden);$('close-settings').onclick=()=>{panel(false);$('settings').focus();};
$('show-model').onchange=()=>{reward.cancelHold();render();};$('show-labels').onchange=()=>document.body.classList.toggle('hide-labels',!$('show-labels').checked);
$('close-picture').onclick=closePicture;
$('picture-dialog').addEventListener('click',e=>{if(e.target===$('picture-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePicture();}});
const correct=$('complete');correct.style.setProperty('--hold-duration',HOLD_MS+'ms');
correct.addEventListener('pointerdown',e=>{if(e.button>0||e.isPrimary===false)return;reward.start({kind:'pointer',id:e.pointerId});});
const endPointer=e=>{if(reward.input?.kind==='pointer'&&reward.input.id===e.pointerId)reward.cancelHold();};
for(const name of ['pointerup','pointercancel','pointerleave','lostpointercapture'])correct.addEventListener(name,endPointer);
document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',endPointer);
document.addEventListener('pointermove',e=>{if(reward.input?.kind!=='pointer'||reward.input.id!==e.pointerId)return;const r=correct.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)reward.cancelHold();});
correct.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();if(!e.repeat)reward.start({kind:'keyboard',key:e.key});});
correct.addEventListener('keyup',e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();if(reward.input?.key===e.key)reward.cancelHold();});
correct.addEventListener('blur',()=>reward.cancelHold());correct.addEventListener('click',e=>e.preventDefault());
window.addEventListener('blur',()=>{reward.cancelHold();cleanupDrag();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){const celebrating=reward.phase==='celebrating';reward.cancel();speech.stop();cleanupDrag();if(celebrating&&state.playing){render();feedback('Η πρόταση είναι έτοιμη. Κράτησε το «Σωστό!» για να συνεχίσεις.');}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){reward.cancelHold();cleanupDrag();board.selected=null;closePicture();panel(false);if(state.playing&&!locked())render();}});
$('slots').addEventListener('error',imageFailure,true);$('tray').addEventListener('error',imageFailure,true);
function imageFailure(e){if(e.target instanceof HTMLImageElement){e.target.alt='Η εικόνα δεν φορτώθηκε';feedback('Μια εικόνα δεν φορτώθηκε. Έλεγξε τη σύνδεση ή πάτησε «Νέα πρόταση».');}}
renderMenu();
window.addEventListener('resize',()=>{scheduleResultFit();positionSettings();});
document.fonts?.ready.then(scheduleResultFit);
try{
  const response=await fetch('data/content.json?v=20260906-3');if(!response.ok)throw new Error('Content unavailable');
  engine=new SentenceEngine(await response.json());$('start').disabled=false;$('loading-note').textContent='';timing('readyMs');reserveNext();
}catch(error){console.error(error);$('loading-note').textContent='Δεν φορτώθηκαν οι προτάσεις. Έλεγξε τη σύνδεση και ανανέωσε τη σελίδα.';}
