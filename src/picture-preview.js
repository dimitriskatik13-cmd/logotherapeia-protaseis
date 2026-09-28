// Keep the available thumbnail visible while a separate full-size request loads.
export class PicturePreview {
  constructor({env=window, show, timeout=8000}) {
    this.env=env;this.show=show;this.timeout=timeout;
    this.sequence=0;this.pending=null;this.current=null;
  }
  cancelPending() {
    if(!this.pending)return;
    this.env.clearTimeout(this.pending.timer);
    this.pending.image.onload=null;this.pending.image.onerror=null;
    this.pending=null;
  }
  close() { this.sequence++;this.cancelPending();this.current=null; }
  open(card) { this.close();this.current=card;this.load(false); }
  retry() { if(this.current)this.load(true); }
  load(retry) {
    this.cancelPending();const ticket=++this.sequence,card=this.current;
    const image=new this.env.Image();
    const url=retry?card.large+(card.large.includes('?')?'&':'?')+'zoomRetry='+ticket+'-'+Date.now():card.large;
    this.show({src:card.small,text:card.text,status:'Φορτώνεται η εικόνα υψηλής ανάλυσης…',retry:false,busy:true});
    const finish=ok=>{
      if(ticket!==this.sequence||!this.current)return;
      this.cancelPending();
      this.show({src:ok?url:card.small,text:card.text,
        status:ok?'':'Δεν φορτώθηκε η εικόνα υψηλής ανάλυσης. Μπορείς να δοκιμάσεις ξανά.',
        retry:!ok,busy:false});
    };
    this.pending={image,timer:this.env.setTimeout(()=>finish(false),this.timeout)};
    image.onload=()=>finish(image.naturalWidth>0);
    image.onerror=()=>finish(false);
    image.src=url;
  }
}
