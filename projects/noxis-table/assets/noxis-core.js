/* ============================================================
   NOXIS UNIVERS — AI FRIENDS · shared core (website pages)
   helpers · reduced motion · toasts · confirm modal · stellar sky
   painter · portrait storage loader. Generated from the approved
   v4.1 code; comparison-view switchers and Portrait Studio UI are
   not part of the visitor pages.
   ============================================================ */
'use strict';
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let reducedMotion = false;
try { reducedMotion = localStorage.getItem('noxis-univers-rm') === '1'; } catch(e){}
const rmToggle = $('#rmToggle');
rmToggle.checked = reducedMotion;
document.body.classList.toggle('reduce-motion', reducedMotion);
rmToggle.addEventListener('change', () => {
  reducedMotion = rmToggle.checked;
  document.body.classList.toggle('reduce-motion', reducedMotion);
  try { localStorage.setItem('noxis-univers-rm', reducedMotion ? '1' : '0'); } catch(e){}
});

/* ---------- CSS kill-switch for reduced motion (dynamic elements) ---------- */
const rmStyle = document.createElement('style');
rmStyle.textContent = '.reduce-motion *{animation:none !important; transition:none !important;} .reduce-motion .net .pk,.reduce-motion .net .pk2{display:none;}';
document.head.appendChild(rmStyle);

/* ---------- toasts ---------- */
function toast(msg, color='#67e8f9') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="d" style="background:${color}; box-shadow:0 0 8px ${color}"></span><span>${msg}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

/* ---------- confirm modal (destructive actions always confirm) ---------- */
let confirmCb = null;
function confirmBox({ title, body, small, yes='Confirm', tone='danger', onYes }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = `${body}${small ? `<small>${small}</small>` : ''}`;
  const btn = $('#modalConfirm');
  btn.textContent = yes;
  btn.className = 'btn ' + (tone === 'danger' ? 'danger' : tone);
  const ic = $('#modalIcon');
  ic.className = 'ic ' + (tone === 'danger' ? 'ic-danger' : tone === 'gold' ? 'ic-gold' : 'ic-cyan');
  ic.innerHTML = tone === 'danger'
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';
  confirmCb = onYes;
  $('#modalVeil').classList.remove('hidden');
}
function closeModal(){ $('#modalVeil').classList.add('hidden'); confirmCb = null; }
$('#modalCancel').addEventListener('click', closeModal);
$('#modalVeil').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
$('#modalConfirm').addEventListener('click', () => { const cb = confirmCb; closeModal(); if (cb) cb(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- living stellar sky (painted ONCE — no per-frame JS) ----------
   Two small star tiles are rendered into offscreen canvases and used as
   repeating background layers. All motion afterwards is CSS opacity/
   transform only (GPU-composited). Reduced Motion freezes everything into
   a still sky (see CSS kill-switches). */
(function paintCosmos(){
  const TINTS = [
    'rgba(255,255,255,A)',      /* white        */
    'rgba(190,214,255,A)',      /* ice blue     */
    'rgba(206,196,255,A)',      /* soft violet  */
    'rgba(255,241,224,A)'       /* warm white   */
  ];
  function starTile(count, rMin, rMax, aMin, aMax){
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 512, y = Math.random() * 512;
      const r = rMin + Math.random() * (rMax - rMin);
      const a = (aMin + Math.random() * (aMax - aMin)).toFixed(2);
      g.fillStyle = TINTS[(Math.random() * TINTS.length) | 0].replace('A', a);
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    return `url(${c.toDataURL('image/png')})`;
  }
  const tileA = starTile(120, 0.4, 1.05, 0.22, 0.80);  /* distant tiny stars  */
  const tileB = starTile(46,  0.7, 1.50, 0.30, 0.95);  /* nearer bright stars */
  $$('.sf-a').forEach(el => { el.style.backgroundImage = tileA; });
  $$('.sf-b').forEach(el => { el.style.backgroundImage = tileB; });

  /* a few brighter stars that breathe on their own (staggered) */
  function sprinkle(hostId, n){
    const host = document.getElementById(hostId); if (!host) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'fstar';
      const sz = (2 + Math.random() * 1.8).toFixed(1);
      s.style.cssText =
        `left:${(Math.random() * 100).toFixed(2)}%; top:${(Math.random() * 100).toFixed(2)}%;` +
        `width:${sz}px; height:${sz}px; opacity:.55;` +
        `animation-delay:-${(Math.random() * 7).toFixed(1)}s;` +
        `animation-duration:${(5.5 + Math.random() * 4).toFixed(1)}s;`;
      host.appendChild(s);
    }
  }
  sprinkle('fstars', 14);    /* whole page backdrop  */
  sprinkle('uFstars', 8);    /* universe stage       */
})();

/* ============================================================
   PORTRAIT STORAGE LOADER — website pages
   The Portrait Studio itself is NOT part of the visitor pages.
   This loader only re-applies portraits that were saved earlier in
   THIS browser (IndexedDB "noxis-univers-portraits"), so portraits
   installed through the approved prototype carry over. Images are
   applied exactly as stored — never cropped, recolored, resized or
   regenerated. Final portraits for every visitor are installed by
   replacing the files in assets/img/ (handled by Tara & AREN).
   ============================================================ */
const PS_MEMBERS = AGENT_KEYS.slice();
const PS_PLACEHOLDER = Object.assign({}, PORTRAITS);
const PS_DB_NAME = 'noxis-univers-portraits';
const PS = { db: null, records: {}, objectUrls: {} };

const PDB = {
  open(){
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB is not supported in this browser')); return; }
      let rq;
      try { rq = indexedDB.open(PS_DB_NAME, 1); } catch (err) { reject(err); return; }
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('portraits')) db.createObjectStore('portraits', { keyPath: 'id' });
      };
      rq.onsuccess = () => { PS.db = rq.result; resolve(rq.result); };
      rq.onerror = () => reject(rq.error || new Error('IndexedDB could not be opened'));
      rq.onblocked = () => reject(new Error('IndexedDB open was blocked (another tab holds the database)'));
    });
  },
  store(mode){ return PS.db.transaction('portraits', mode).objectStore('portraits'); },
  req(request){
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  },
  put(record){
    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const tx = PS.db.transaction('portraits', 'readwrite');
        tx.objectStore('portraits').put(record);
        tx.oncomplete = () => { settled = true; resolve(true); };
        tx.onerror = () => { if (!settled) reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = () => { if (!settled) reject(tx.error || new Error('IndexedDB write aborted — nothing was saved')); };
      } catch (err) { if (!settled) reject(err); }
    });
  },
  getAll(){ return this.req(this.store('readonly').getAll()); },
};

function psRevokeUrl(k){
  if (PS.objectUrls[k]) { try { URL.revokeObjectURL(PS.objectUrls[k]); } catch (e) {} PS.objectUrls[k] = null; }
}
function psRefreshDom(k){
  const src = PORTRAITS[k];
  const cardImg = document.querySelector(`#uc-${k} .art img`);
  if (cardImg) cardImg.src = src;
  const drawer = $('#uDrawer');
  if (drawer && drawer.classList.contains('open') && drawer.dataset.agent === k) { const di = $('#uDImg'); if (di) di.src = src; }
  const palImg = document.querySelector(`#epalAgents .pal-item[data-agent="${k}"] img`);
  if (palImg) palImg.src = src;
  if (typeof renderAll === 'function') { try { renderAll(); } catch (e) {} }
}
function psApplyRecord(k, rec){
  PS.records[k] = rec || null;
  psRevokeUrl(k);
  let src;
  if (rec && rec.cur) {
    src = rec.cur.kind === 'blob' ? (PS.objectUrls[k] = URL.createObjectURL(rec.cur.blob)) : rec.cur.data;
  } else {
    src = PS_PLACEHOLDER[k];
  }
  if (PORTRAITS[k] !== src) PORTRAITS[k] = src;
  psRefreshDom(k);
}

(async function psBoot(){
  try {
    await PDB.open();
    const all = await PDB.getAll();
    (all || []).forEach(rec => {
      if (rec && rec.id && PS_MEMBERS.includes(rec.id) && rec.cur) psApplyRecord(rec.id, rec);
    });
    const n = (all || []).filter(r => r && r.cur && r.cur.kind === 'blob').length;
    if (n > 0) toast(`Portrait storage loaded — <b>${n}</b> saved portrait(s) restored from this browser. <span class="demo-tag" style="margin-left:6px">IndexedDB</span>`, '#67e8f9');
  } catch (err) {
    /* honest degradation: placeholder assets remain */
    console.warn('Portrait storage unavailable:', err);
  }
})();

/* public API for the future NOXIS UNIVERS website integration */
window.NoxisPortraits = {
  isCustom: k => !!(PS.records[k] && PS.records[k].cur && PS.records[k].cur.kind === 'blob'),
  getSrc: k => PORTRAITS[k],
  list: () => PS_MEMBERS.slice(),
  storageName: PS_DB_NAME,
};
