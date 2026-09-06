import test from 'node:test';import assert from 'node:assert/strict';import {Reward} from '../src/reward.js';
function fixture(){let now=0,id=0,ready=true;const timers=new Map(),events=[];const clock={setTimeout(fn,delay){timers.set(++id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}};
  const tick=ms=>{const end=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
  const reward=new Reward({ready:()=>ready,clock,onCelebrate:()=>events.push(['celebrate',now]),onNext:()=>events.push(['next',now])});
  return {reward,tick,events,setReady:v=>ready=v};
}
test('continuous 1000 ms hold then exactly 2000 ms reward',()=>{const f=fixture();f.reward.start({kind:'pointer',id:1});f.tick(999);assert.deepEqual(f.events,[]);f.tick(1);assert.deepEqual(f.events,[['celebrate',1000]]);f.tick(1999);assert.equal(f.events.length,1);f.tick(1);assert.deepEqual(f.events,[['celebrate',1000],['next',3000]]);});
test('short/repeated holds never accumulate',()=>{const f=fixture();for(let i=0;i<5;i++){f.reward.start({kind:'pointer',id:1});f.tick(800);f.reward.cancelHold();}f.tick(5000);assert.deepEqual(f.events,[]);});
test('hold cannot start when incomplete or be extended by key repeat',()=>{const f=fixture();f.setReady(false);assert.equal(f.reward.start({kind:'keyboard',key:'Enter'}),false);f.setReady(true);f.reward.start({kind:'keyboard',key:'Enter'});f.tick(700);assert.equal(f.reward.start({kind:'keyboard',key:'Enter'}),false);f.tick(300);assert.deepEqual(f.events,[['celebrate',1000]]);});
test('home or hidden tab cancels pending next sentence',()=>{const f=fixture();f.reward.start({kind:'pointer',id:1});f.tick(1000);f.reward.cancel();f.tick(10000);assert.equal(f.events.length,1);assert.equal(f.reward.phase,'idle');});
test('loss of readiness cancels the hold at threshold',()=>{const f=fixture();f.reward.start({kind:'pointer',id:1});f.setReady(false);f.tick(3000);assert.deepEqual(f.events,[]);assert.equal(f.reward.phase,'idle');});
