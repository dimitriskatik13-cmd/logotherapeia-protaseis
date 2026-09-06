import test from 'node:test';import assert from 'node:assert/strict';import {GreekSpeech} from '../src/speech.js';
test('Greek voice is selected, full/partial strings preserved and old speech cancelled',()=>{
  const spoken=[],feedback=[];let cancels=0;
  const greek={name:'Greek',lang:'el-GR',localService:true};
  const win={SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[{name:'English',lang:'en-US'},greek],addEventListener(){},cancel(){cancels++;},resume(){},speak(u){spoken.push(u);u.onstart();}}};
  const speech=new GreekSpeech(win,{feedback:s=>feedback.push(s)});speech.speak('Αύριο το αγόρι θα φάει το μήλο.');assert.equal(spoken[0].voice,greek);assert.equal(spoken[0].lang,'el-GR');assert.equal(spoken[0].rate,.9);
  speech.speak('Το αγόρι.');assert.equal(spoken[1].text,'Το αγόρι.');assert.equal(cancels,2);speech.stop();assert.equal(cancels,3);
});
test('missing API has a clear message, not a thrown exception',()=>{const messages=[];const speech=new GreekSpeech({},{feedback:s=>messages.push(s)});speech.speak('Δοκιμή');assert.match(messages[0],/δεν είναι διαθέσιμη/);});
