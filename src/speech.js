export class GreekSpeech {
  constructor(win,{feedback=()=>{},status=()=>{}}={}){
    this.win=win;this.synth=win.speechSynthesis;this.feedback=feedback;this.status=status;this.current=null;this.watchdog=null;this.generation=0;
    this.refresh=()=>{this.voices=(this.synth?.getVoices()||[]).filter(v=>/^el(?:[-_]|$)/i.test(v.lang)).sort((a,b)=>Number(b.localService)-Number(a.localService));
      this.status(this.voices[0]?`Ελληνική φωνή: ${this.voices[0].name}`:'Η ελληνική φωνή παρέχεται από τη συσκευή.');};
    this.refresh();this.synth?.addEventListener('voiceschanged',this.refresh);
  }
  stop(){this.generation++;clearTimeout(this.watchdog);this.watchdog=null;this.current=null;this.synth?.cancel();}
  speak(text){
    if(!text){this.feedback('Βάλε πρώτα μία κάρτα.');return;}
    if(!this.synth||!this.win.SpeechSynthesisUtterance){this.feedback('Η εκφώνηση δεν είναι διαθέσιμη σε αυτόν τον browser.');return;}
    this.stop();this.refresh();const generation=this.generation;
    // Call speak in the user's gesture, including when a browser initially returns no voices.
    const u=new this.win.SpeechSynthesisUtterance(text);u.lang='el-GR';u.rate=.9;u.pitch=1;
    if(this.voices[0])u.voice=this.voices[0];
    this.current=u;
    const finish=()=>{if(generation!==this.generation)return;clearTimeout(this.watchdog);this.current=null;};
    u.onstart=()=>{if(generation!==this.generation)return;clearTimeout(this.watchdog);this.feedback('🔊 Άκουσε την πρόταση.');};
    u.onend=finish;
    u.onerror=event=>{if(generation!==this.generation)return;finish();if(!['canceled','interrupted'].includes(event.error))this.feedback('Δεν ξεκίνησε η ελληνική εκφώνηση. Έλεγξε την ένταση και την ελληνική φωνή της συσκευής και πάτησε ξανά «Άκουσε».');};
    this.watchdog=setTimeout(()=>{if(this.current!==u)return;this.stop();this.feedback('Η φωνή δεν ξεκίνησε. Ενεργοποίησε ελληνική φωνή στη συσκευή και πάτησε ξανά «Άκουσε».');},6000);
    try{this.synth.resume();this.synth.speak(u);}catch{finish();this.feedback('Η εκφώνηση δεν μπόρεσε να ξεκινήσει. Πάτησε ξανά «Άκουσε».');}
  }
}
