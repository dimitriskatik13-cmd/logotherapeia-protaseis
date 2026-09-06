export const HOLD_MS=1000;
export const NEXT_MS=2000;
// Timer state is independent of rendering and can be tested with a deterministic clock.
export class Reward {
  constructor({ready,onHold=()=>{},onCancelHold=()=>{},onCelebrate,onNext,onReset=()=>{},clock=globalThis}) {
    Object.assign(this,{ready,onHold,onCancelHold,onCelebrate,onNext,onReset,clock});this.phase='idle';this.timer=null;this.input=null;
  }
  start(input){if(this.phase!=='idle'||!this.ready())return false;this.phase='holding';this.input=input;this.onHold();this.timer=this.clock.setTimeout(()=>{
    this.timer=null;if(!this.ready()){this.cancel();return;}this.phase='celebrating';this.input=null;this.onCancelHold();this.onCelebrate();
    this.timer=this.clock.setTimeout(()=>{this.timer=null;this.phase='idle';this.onReset();this.onNext();},NEXT_MS);
  },HOLD_MS);return true;}
  cancelHold(){if(this.phase==='holding')this.cancel();}
  cancel(){this.clock.clearTimeout(this.timer);this.timer=null;this.phase='idle';this.input=null;this.onCancelHold();this.onReset();}
}
