/* NOXIS SOUND LAB LINK V1 — existing card navigation only */
(()=>{
 'use strict';
 const target=new URL('../projects/sound-lab/',document.currentScript.src).href;
 const seenDocs=new WeakSet(),seenFrames=new WeakSet();
 const title=text=>/^(?:the\s+)?sound\s*lab$/i.test(String(text||'').trim());
 function click(event){
  if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  for(const node of event.composedPath()){
   if(node?.nodeType!==1)continue;
   const text=String(node.textContent||'').trim();if(text.length>650)continue;
   const headings=node.querySelectorAll('h1,h2,h3,h4,h5,h6');
   const card=headings.length===1&&title(headings[0].textContent);
   const interactive=node.matches('a,button,[role="button"],[onclick]')&&/\b(?:the\s+)?sound\s*lab\b/i.test(text);
   if(!card&&!interactive)continue;
   event.preventDefault();event.stopImmediatePropagation();window.location.assign(target);return;
  }
 }
 function frame(node){
  if(seenFrames.has(node))return;seenFrames.add(node);
  const read=()=>{try{if(node.contentDocument)attach(node.contentDocument);}catch{}};
  node.addEventListener('load',read);read();
 }
 function scan(node){
  if(node.nodeType===1&&node.matches('iframe'))frame(node);
  node.querySelectorAll?.('iframe').forEach(frame);
 }
 function attach(doc){
  if(seenDocs.has(doc))return;seenDocs.add(doc);doc.addEventListener('click',click,true);scan(doc);
  new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)scan(node);}).observe(doc,{childList:true,subtree:true});
 }
 attach(document);
})();
