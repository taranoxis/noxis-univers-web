(() => {
const makeNav=(title,items)=>{
 const nav=document.createElement('nav');nav.className='noxis-mobile-nav';nav.setAttribute('aria-label',title);
 const heading=document.createElement('h2');heading.textContent=title;nav.append(heading);
 const grid=document.createElement('div');grid.className='noxis-mobile-grid';nav.append(grid);
 for(const [label,url,target,openUniverse] of items){
 const el=document.createElement(url?'a':'button');el.textContent=label;
 if(url){el.href=url;if(url.startsWith('https:')){el.target='_blank';el.rel='noopener';}}
 else{el.type='button';el.addEventListener('click',()=>{if(openUniverse)document.getElementById('universe')?.classList.add('open');document.getElementById(target)?.click();});}
 grid.append(el);
 }return nav;
};
const init=()=>{
 if(document.querySelector('.noxis-mobile-nav'))return;
 const world=document.querySelector('.world'),shell=document.querySelector('.universe-shell');if(!world||!shell)return;
 world.append(makeNav('NOXIS UNIVERS',[
 ['Choose your path',null,'biggerButton'],['NOXIS Entities',null,'galleryButton'],['NOXIS TV','noxis-tv/'],['AI Friends','ai-friends/'],['Books / Archive','books/'],['Create','create/'],['AI Tools','ai-tools/'],['Questions to the Universe',null,'questionsGalaxyButton'],['Discover',null,'discoverHotspot',true],['Learn more',null,'learnButton'],['Get the App','https://taranoxis.gumroad.com/l/mswit?wanted=true']]));
 shell.prepend(makeNav('CHOOSE YOUR PATH',[['Books','books/'],['AI Friends','ai-friends/'],['Create','create/'],['Discover',null,'discoverHotspot'],['Back',null,'universeClose']]));
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();