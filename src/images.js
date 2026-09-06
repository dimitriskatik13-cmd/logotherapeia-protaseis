export class ImageLoader {
  constructor(ImageClass=globalThis.Image){this.ImageClass=ImageClass;this.entries=new Map();}
  load(url){
    if(this.entries.has(url))return this.entries.get(url);
    const pending=new Promise((resolve,reject)=>{
      const image=new this.ImageClass();let settled=false;
      const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>finish(new Error('Image timeout: '+url)),8000);
      image.onload=()=>{if(image.decode)image.decode().then(()=>finish(),()=>finish());else finish();};
      image.onerror=()=>finish(new Error('Image unavailable: '+url));image.src=url;
    }).catch(error=>{this.entries.delete(url);throw error;});
    this.entries.set(url,pending);
    if(this.entries.size>64)this.entries.delete(this.entries.keys().next().value);
    return pending;
  }
  preload(cards){return Promise.allSettled([...new Set(cards.map(c=>c.image))].map(url=>this.load(url)));}
}
