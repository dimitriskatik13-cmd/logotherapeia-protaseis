export function bindDrag({root,canDrag,cardFor,place,feedback,cancelHold}){
  let drag=null,suppressUntil=0,frame=null;
  const cleanup=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;drag?.ghost?.remove();const old=drag;drag=null;
    if(old?.source.hasPointerCapture?.(old.id))old.source.releasePointerCapture(old.id);
    document.querySelectorAll('.drop.hovered').forEach(el=>el.classList.remove('hovered'));
  };
  root.addEventListener('pointerdown',e=>{
    // A fresh press is a new intentional interaction, not the trailing drag click.
    suppressUntil=0;
    const source=e.target.closest('[data-card]');
    if(!source||source.disabled||e.button>0||!e.isPrimary||!canDrag())return;
    cleanup();cancelHold();drag={key:source.dataset.card,id:e.pointerId,source,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,ghost:null};
    source.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    drag.x=e.clientX;drag.y=e.clientY;
    if(!drag.moved && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>8){
      drag.moved=true;const card=cardFor(drag.key);drag.ghost=document.createElement('img');drag.ghost.className='ghost';drag.ghost.src=card.image;drag.ghost.alt='';drag.ghost.draggable=false;document.body.append(drag.ghost);
    }
    if(!drag.moved)return;e.preventDefault();
    if(frame===null)frame=requestAnimationFrame(()=>{frame=null;if(!drag)return;
      drag.ghost.style.left=drag.x+'px';drag.ghost.style.top=drag.y+'px';
      const slot=document.elementFromPoint(drag.x,drag.y)?.closest('[data-slot]');
      document.querySelectorAll('.drop.hovered').forEach(el=>el.classList.remove('hovered'));slot?.classList.add('hovered');
    });
  },{passive:false});
  root.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;const key=drag.key,moved=drag.moved;
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');cleanup();
    if(moved){e.preventDefault();suppressUntil=performance.now()+400;
      if(target)place(key,target.dataset.slot);else feedback('Άφησε την κάρτα μέσα σε ένα πλαίσιο.');}
  });
  root.addEventListener('pointercancel',cleanup);
  root.addEventListener('lostpointercapture',()=>{if(drag)cleanup();});
  root.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  root.addEventListener('contextmenu',e=>{if(e.target.closest('[data-card]'))e.preventDefault();});
  window.addEventListener('blur',cleanup);return cleanup;
}
