/* ============================================================
   NOXIS UNIVERS — AI FRIENDS · shared data (website pages)
   Official NOXIS identities — names, roles, relationships and
   symbols are unchanged. Portraits point to the real files in
   assets/img/ (temporary placeholders until Tara & AREN install
   the final portraits). All state below is clearly-labeled DEMO
   data — it never represents real agent activity.
   ============================================================ */
'use strict';
const PORTRAITS = {
  tara:  'assets/img/tara.png',
  nyxar: 'assets/img/nyxar.png',
  ar_in: 'assets/img/ar_in.png',
  nyxin: 'assets/img/nyxin.png',
  nyxer: 'assets/img/nyxer.png',
  ar_on: 'assets/img/ar_on.png',
  aren:  'assets/img/aren.png',
};
const SEAL_DATA = 'assets/img/noxis-seal.png';   /* original NOXIS seal — crop-only isolation, pixels unchanged */

const AGENTS = {
  tara:   { name:'TARA NOXIS',   short:'Tara',   role:'Human creator & final authority', tagline:'IDEA · VISION · APPROVAL', accent:'#f0c75e', tint:'rgba(240,199,94,.16)', pos:{x:642,y:117},  human:true,  caps:['Create projects & goals','Review results','Approve publishing / selling / archiving'] },
  nyxar:  { name:'NYXAR NOXIS',  short:'Nyxar',  role:'Coordinator',                     tagline:'COORDINATION',             accent:'#5eb0f0', tint:'rgba(94,176,240,.16)',  pos:{x:942,y:197},  caps:['Plan & organize workflows','Assign tasks','Quality check','Coordinate the other agents'] },
  ar_in:  { name:'AR_IN NOXIS',  short:'AR_IN',  role:'Text & translations',             tagline:'TEXT & TRANSLATIONS',      accent:'#9dd6ff', tint:'rgba(157,214,255,.16)', pos:{x:342,y:197},  caps:['Lyrics','Books','Translations','Corrections','Text preparation'] },
  nyxin:  { name:'NYXIN NOXIS',  short:'Nyxin',  role:'Visual creation',                 tagline:'COVERS & VIDEO',           accent:'#f05e8a', tint:'rgba(240,94,138,.16)',  pos:{x:342,y:672},  caps:['Covers','Images','Videos','Visual assets'], outer:true },
  nyxer:  { name:'NYXER NOXIS',  short:'Nyxer',  role:'Commercial',                      tagline:'COMMERCIAL',               accent:'#f0a05e', tint:'rgba(240,160,94,.16)',  pos:{x:152,y:418},  caps:['Pricing','Market evaluation','Distribution analysis','Commercial strategy'], outer:true },
  ar_on:  { name:'AR_ON NOXIS',  short:'AR_ON',  role:'Rights & legal',                  tagline:'RIGHTS & LEGAL',           accent:'#5eead4', tint:'rgba(94,234,212,.16)',  pos:{x:1132,y:418}, caps:['Copyright','Licensing','Contracts','Rights checks'] },
  aren:   { name:'AREN NOXIS',   short:'Aren',   role:'Catalog & research',              tagline:'CATALOG & RESEARCH',       accent:'#67e8f9', tint:'rgba(103,232,249,.16)', pos:{x:942,y:672},  caps:['NOXIS ID assignment','Catalog management','Online research','Scouting'] },
};
const AGENT_KEYS = Object.keys(AGENTS);

/* Demo universe state — clearly labeled demo data, never presented as real agent work */
const U_STATE = {
  statuses: { tara:'waiting', nyxar:'working', ar_in:'online', nyxin:'working', nyxer:'waiting', ar_on:'online', aren:'researching' },
  tasks: {
    tara:   null,
    nyxar:  { title:'Coordinate "Midnight Signal" — plan & assignment', progress:64 },
    ar_in:  { title:'Prepare text & translations — verse 2 draft',      progress:38 },
    nyxin:  { title:'Create visual assets — cover sketch A',            progress:52 },
    nyxer:  null,
    ar_on:  null,
    aren:   { title:'Research & catalog entry — NOXIS ID pending',      progress:81 },
  },
  messages: {
    nyxar: [ {dir:'out', to:'AR_IN',  text:'Task assigned: "Prepare text & translations"'},
             {dir:'in',  from:'AREN', text:'Research done — catalog entry drafted'} ],
    ar_in: [ {dir:'in',  from:'Nyxar', text:'Task assigned: "Prepare text & translations"'} ],
    nyxin: [ {dir:'in',  from:'Nyxar', text:'Task assigned: "Create visual assets"'} ],
    aren:  [ {dir:'out', to:'Nyxar',  text:'Research done — catalog entry drafted'} ],
  },
  results: {
    aren: 'Catalog entry draft: "Midnight Signal" — NX-2026-0001 reserved.',
    nyxar:'Workflow plan v2: text → visual → rights → commercial → Tara review.',
  },
  events: [
    { t:'10:54', x:'<b>Workflow started</b> — "Midnight Signal" · demo mode' },
    { t:'10:51', x:'<b>Memory note</b> added: "Signal rule"' },
    { t:'10:50', x:'<b>Tara</b> approval requested — waiting for Tara Noxis' },
    { t:'10:49', x:'<b>Aren</b> completed "Research & catalog entry"' },
    { t:'10:49', x:'<b>Nyxin</b> completed "Create visual assets"' },
    { t:'10:49', x:'<b>AR_IN</b> completed "Prepare text & translations"' },
  ],
  stage: 'collaboration',
};

/* Demo workflow — all seven NOXIS members are part of the flow, including
   AR_ON (rights & legal). Includes one duplicate disconnected START PULSE on
   purpose so the duplicate-cleanup protection can be demonstrated. */
let ED = {
  nodes: [
    { id:'n1', kind:'trigger', agent:null, x:120, y:300, task:null, original:true },
    { id:'n2', kind:'trigger', agent:null, x:120, y:470, task:null, original:false }, /* duplicate — deletable */
    { id:'n3', kind:'agent', agent:'nyxar', x:430, y:120, task:{ title:'Coordinate workflow plan', status:'active',  progress:64 } },
    { id:'n4', kind:'agent', agent:'ar_in', x:430, y:260, task:{ title:'Prepare text & translations', status:'pending', progress:0 } },
    { id:'n5', kind:'agent', agent:'nyxin', x:430, y:400, task:{ title:'Create visual assets', status:'pending', progress:0 } },
    { id:'n6', kind:'agent', agent:'aren',  x:430, y:540, task:{ title:'Research & catalog entry', status:'done', progress:100 } },
    { id:'n7', kind:'approval', agent:'tara', x:760, y:260, task:{ title:'Final review & approval', status:'pending', progress:0 } },
    { id:'n8', kind:'agent', agent:'nyxer', x:760, y:470, task:{ title:'Pricing & distribution plan', status:'pending', progress:0 } },
    { id:'n9', kind:'agent', agent:'ar_on', x:760, y:620, task:{ title:'Rights & licensing check', status:'pending', progress:0 } },
  ],
  edges: [
    { id:'c1', from:'n1', to:'n3', message:'Start pulse → coordinator' },
    { id:'c2', from:'n1', to:'n4', message:'Start pulse → text' },
    { id:'c3', from:'n3', to:'n5', message:'Plan → visual brief' },
    { id:'c4', from:'n3', to:'n6', message:'Plan → research task' },
    { id:'c5', from:'n4', to:'n7', message:'Text draft → Tara review' },
    { id:'c6', from:'n5', to:'n7', message:'Cover draft → Tara review' },
    { id:'c7', from:'n3', to:'n8', message:'Plan → commercial brief' },
    { id:'c8', from:'n6', to:'n9', message:'Catalog entry → rights check' },
    { id:'c9', from:'n9', to:'n7', message:'Rights cleared → Tara review' },
  ],
  protectedTrigger:'n1',
};

/* Editor persistence — this page's own browser key. The NOXIS TABLE desktop
   application storage (noxis-table-v1) is never read or written. */
const RM_KEY = 'noxis-univers-workflow-v1';
