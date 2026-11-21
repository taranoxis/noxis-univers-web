/* ============================================================
   INTELLIGENT COLLABORATION — WORKFLOW EDITOR · page logic (website page 2)
   Approved v4.1 editor: START PULSE protection, free drag with
   live-following connections, Inspector, Run/Pause/Resume/Stop
   (clearly-labeled demo execution), zoom, Save/Load/Import/Export,
   Tara's approval role. Keyboard support added for the website.
   ============================================================ */
'use strict';
/* ============================================================
   WORKFLOW EDITOR — corrected interactive mock
   Delete controls · START PULSE protection · free drag ·
   connections follow live · confirmations · isolated persistence
   ============================================================ */
const ED_W = 204;                 /* node width */
const ED_DEFAULTS = JSON.parse(JSON.stringify(ED));
const edMain = $('#edMain'), edWorld = $('#edWorld'), edNodesEl = $('#edNodes'),
      edEdgesG = $('#edEdges'), edGhostG = $('#edGhost'), insBody = $('#einsBody');

let edView = { x: 40, y: 16, k: 0.9 };
let edSel = null;                 /* {type:'node'|'edge', id} */
let edRun = { running:false, paused:false, timer:null };
let nodeH = {};                   /* measured node heights */

/* ---------- persistence (isolated preview key; app data untouched) ---------- */
let saveTimer = null;

function edFeedback(message, error=false) {
  let box = document.getElementById('edActionStatus');
  if (!box) {
    box = document.createElement('div');
    box.id = 'edActionStatus';
    box.setAttribute('role', 'status');
    box.style.cssText =
      'padding:8px 12px;margin:6px 0;border:1px solid #63558b;border-radius:8px;' +
      'background:#100d2b;font-size:12px;white-space:normal;overflow-wrap:anywhere';
    const anchor = document.getElementById('edPersistTag');
    if (anchor) anchor.after(box);
    else document.getElementById('edMain')?.before(box);
  }
  box.style.color = error ? '#fca5a5' : '#a7f3d0';
  box.textContent = 'Last action: ' + message +
    ' · ' + new Date().toLocaleTimeString();
}

function updatePersistTag(){
  const tag = $('#edPersistTag');
  if (!tag) return;
  let when = '';
  try { when = new Date(parseInt(localStorage.getItem(RM_KEY + ':savedAt') || '0', 10) || Date.now()).toLocaleTimeString(); } catch(e){}
  tag.innerHTML = tag.innerHTML.replace(/·.*$/, '· last saved ' + when);
}
function persistEd(){
  /* real storage write — returns true only if the operation actually succeeded */
  try {
    localStorage.setItem(RM_KEY, JSON.stringify({
      nodes: ED.nodes, edges: ED.edges, view: edView, savedAt: Date.now(),
    }));
    try { localStorage.setItem(RM_KEY + ':savedAt', String(Date.now())); } catch(e){}
    updatePersistTag();
    edFeedback('Workflow saved in this browser.');
    return true;
  } catch(err) {
    edFeedback('Save failed — browser storage unavailable.', true);
    toast('Save failed — browser storage is unavailable: ' + esc(err.message), '#f43f5e');
    return false;
  }
}
function saveEd(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistEd, 250);
}
function ensureOriginalTrigger(){
  const hasOriginal = ED.nodes.some(n => n.kind === 'trigger' && n.original);
  if (!hasOriginal) {
    const anyTrigger = ED.nodes.find(n => n.kind === 'trigger');
    if (anyTrigger) anyTrigger.original = true;
  }
}

function validateEdData(data) {
  const fail = message => { throw new Error(message); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (!object(data) || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    fail('Expected nodes and edges arrays');
  }
  if (data.nodes.length > 500 || data.edges.length > 2500) fail('Workflow too large');
  if (data.format !== undefined && data.format !== 'noxis-univers-workflow') {
    fail('Unknown workflow format');
  }
  if (data.version !== undefined && data.version !== 1) fail('Unsupported workflow version');

  const copy = JSON.parse(JSON.stringify(data));
  const ids = new Set();
  const statuses = new Set([
    'pending','active','correcting','waiting_approval','done','paused','error'
  ]);
  for (const node of copy.nodes) {
    if (!object(node) || !safeId(node.id) || ids.has(node.id)) fail('Invalid or duplicate node ID');
    ids.add(node.id);
    if (!['agent','trigger','approval'].includes(node.kind)) fail('Unknown node type');
    if (!finite(node.x) || !finite(node.y)) fail('Invalid node position');
    if (Math.abs(node.x) > 1000000 || Math.abs(node.y) > 1000000) fail('Node position out of range');
    if (node.kind === 'agent' && !Object.hasOwn(AGENTS, node.agent)) fail('Unknown agent');
    if (node.original !== undefined && typeof node.original !== 'boolean') fail('Invalid trigger flag');
    if (node.task != null) {
      if (!object(node.task) ||
          typeof node.task.title !== 'string' || node.task.title.length > 4000 ||
          !statuses.has(node.task.status) ||
          !finite(node.task.progress) || node.task.progress < 0 || node.task.progress > 100) {
        fail('Invalid task data');
      }
    }
  }

  const triggers = copy.nodes.filter(n => n.kind === 'trigger');
  if (!triggers.length) fail('A workflow needs a Start pulse');
  if (triggers.filter(n => n.original).length > 1) fail('Multiple original Start pulses');
  if (!triggers.some(n => n.original)) triggers[0].original = true;

  const edgeIds = new Set();
  for (const edge of copy.edges) {
    if (!object(edge) || !safeId(edge.id) || edgeIds.has(edge.id)) fail('Invalid or duplicate connection ID');
    edgeIds.add(edge.id);
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      fail('Connection has invalid endpoints');
    }
  }
  if (copy.view !== undefined) {
    const view = copy.view;
    if (!object(view) || !finite(view.x) || !finite(view.y) ||
        !finite(view.k) || view.k < 0.1 || view.k > 4) fail('Invalid canvas view');
  }
  return copy;
}

function applyEdData(data) {
  const next = validateEdData(data);
  const previous = {nodes:ED.nodes, edges:ED.edges, view:edView, selection:edSel};
  clearTimeout(saveTimer);
  stopTimer();
  try {
    ED.nodes = next.nodes;
    ED.edges = next.edges;
    if (next.view) edView = next.view;
    ensureOriginalTrigger();
    edSel = null;
    renderAll();
    renderInspector();
  } catch (error) {
    ED.nodes = previous.nodes;
    ED.edges = previous.edges;
    edView = previous.view;
    edSel = previous.selection;
    renderAll();
    renderInspector();
    throw error;
  }
  return next;
}

function loadEd(){
  try {
    const raw = localStorage.getItem(RM_KEY);
    if (!raw) return;
    const data = validateEdData(JSON.parse(raw));
    ED.nodes = data.nodes;
    ED.edges = data.edges;
    if (data.view) edView = data.view;
    ensureOriginalTrigger();
  } catch(error) {
    console.warn('Saved workflow was not loaded:', error.message);
    toast('Saved workflow could not be loaded. Defaults retained; stored data preserved.', '#f0c75e');
  }
}
loadEd();

/* ---------- helpers (clamp provided by noxis-core.js) ---------- */
function edAgent(key){ return key ? AGENTS[key] : null; }
function nodeById(id){ return ED.nodes.find(n => n.id === id); }
function triggerCount(){ return ED.nodes.filter(n => n.kind === 'trigger').length; }
function isProtected(n){ return n.kind === 'trigger' && (n.original || triggerCount() <= 1); }
function chipFor(status, disc){
  if (disc) return { l:'Disconnected', s:'color:#94a3b8; border-color:rgba(148,163,184,.4); background:rgba(148,163,184,.08)' };
  switch(status){
    case 'active':           return { l:'Running',    s:'color:#67e8f9; border-color:rgba(103,232,249,.45); background:rgba(103,232,249,.1)' };
    case 'correcting':       return { l:'Correcting', s:'color:#67e8f9; border-color:rgba(103,232,249,.45); background:rgba(103,232,249,.1)' };
    case 'waiting_approval': return { l:'Awaiting Tara', s:'color:#f0c75e; border-color:rgba(240,199,94,.5); background:rgba(240,199,94,.1)' };
    case 'done':             return { l:'Completed',  s:'color:#6ee7b7; border-color:rgba(52,211,153,.45); background:rgba(52,211,153,.09)' };
    case 'paused':           return { l:'Paused',     s:'color:#cbd5e1; border-color:rgba(148,163,184,.4); background:rgba(148,163,184,.08)' };
    case 'error':            return { l:'Error',      s:'color:#fda4af; border-color:rgba(244,63,94,.55); background:rgba(244,63,94,.12)' };
    default:                 return { l:'Pending',    s:'color:#c4b5fd; border-color:rgba(167,139,250,.4); background:rgba(167,139,250,.08)' };
  }
}

/* ---------- palette (agents) ---------- */
$('#epalAgents').innerHTML = AGENT_KEYS.map(k => `
  <div class="pal-item" data-add="agent" data-agent="${k}" style="cursor:grab;" tabindex="0" role="button" aria-label="Add ${esc(AGENTS[k].short)} node to the canvas">
    <img src="${PORTRAITS[k]}" alt="${esc(AGENTS[k].name)} original portrait" draggable="false">
    <span>${esc(AGENTS[k].short)}<small>${esc(AGENTS[k].role)}</small></span>
  </div>`).join('');

/* ---------- rendering ---------- */
function renderNodes(){
  edNodesEl.innerHTML = ED.nodes.map(n => {
    const a = edAgent(n.agent);
    const isTrig = n.kind === 'trigger', isAppr = n.kind === 'approval';
    const name = isTrig ? 'START PULSE' : isAppr ? 'TARA APPROVAL' : a.short.toUpperCase();
    const role = isTrig ? 'Trigger' : isAppr ? 'Approval gate · publish blocker' : a.role;
    const accent = isTrig ? '#67e8f9' : isAppr ? '#f0c75e' : a.accent;
    const prot = isProtected(n);
    const disc = isTrig && !prot;
    const t = n.task;
    const chip = chipFor(t && t.status, disc);
    const sel = edSel && edSel.type === 'node' && edSel.id === n.id;
    const img = isTrig
      ? `<span class="wic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>`
      : isAppr
        ? `<span class="wimg" style="--tint:rgba(240,199,94,.12)"><img src="assets/img/tara.png" alt="Tara official portrait" draggable="false"></span>`
        : `<span class="wimg" style="--tint:${a.tint}"><img src="${PORTRAITS[n.agent]}" alt="${esc(a.name)} original portrait" draggable="false"></span>`;
    return `<div class="wnode${isTrig ? ' trigger' : ''}${sel ? ' selected' : ''}" id="wn-${n.id}" data-node="${n.id}"
        style="left:${n.x}px; top:${n.y}px; --ac:${accent}; --tint:${a ? a.tint : 'rgba(103,232,249,.12)'}">
      ${prot ? `<span class="wlock" title="Protected — original connected start node"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>` : ''}
      <button class="wdel${prot ? ' lock' : ''}" title="${prot ? 'Protected — the original connected start node cannot be deleted. Duplicate or disconnected triggers can be removed.' : 'Delete node (asks for confirmation)'}" data-del="${n.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div class="whd" data-drag="${n.id}" tabindex="0" role="button" aria-label="${esc(name)} node — Enter selects, arrow keys move, Delete removes">
        ${img}
        <span style="min-width:0;">
          <span class="wnm" style="color:${accent}; display:block;">${esc(name)}</span>
          <span class="wrl" style="display:block;">${esc(role)}</span>
          <span class="wchip" style="${chip.s}">${chip.l}</span>
        </span>
      </div>
      ${t ? `<div class="wtask" title="${esc(t.title)}">${esc(t.title)}</div>
             <div class="wprog"><b style="width:${t.progress}%"></b></div>` : ''}
      ${!isTrig ? `<span class="port in" data-portin="${n.id}" title="Input"></span>` : ''}
      <span class="port out" data-portout="${n.id}" title="Drag to another node to connect"></span>
    </div>`;
  }).join('');
  /* measure heights for edge anchors */
  nodeH = {};
  $$('#edNodes .wnode').forEach(el => { nodeH[el.dataset.node] = el.offsetHeight || 84; });
}

function edgeGeometry(e){
  const a = nodeById(e.from), b = nodeById(e.to);
  if (!a || !b) return null;
  const ha = (nodeH[a.id] || 84) / 2, hb = (nodeH[b.id] || 84) / 2;
  const x1 = a.x + ED_W, y1 = a.y + ha, x2 = b.x, y2 = b.y + hb;
  const dxT = x2 - x1, dyT = y2 - y1;
  const dx = clamp(Math.abs(dxT) * 0.5, 42, 150);
  const dmp = dyT * 0.18;
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1 + dmp}, ${x2 - dx} ${y2 - dmp}, ${x2} ${y2}`;
  return { a, b, x1, y1, x2, y2, d };
}

function renderEdges(){
  let out = '';
  ED.edges.forEach(e => {
    const g = edgeGeometry(e); if (!g) return;
    const sel = edSel && edSel.type === 'edge' && edSel.id === e.id;
    out += `<g data-edgeg="${e.id}">
      <path class="edge${sel ? ' sel' : ''}${e._pulse ? ' pulsing' : ''}" data-edge="${e.id}" d="${g.d}" marker-end="url(#edArrow)"/>
      <path class="edgehit" data-edgehit="${e.id}" d="${g.d}"/>
    </g>`;
  });
  edEdgesG.innerHTML = out;
  /* midpoint delete buttons (on-hover via CSS) */
  $$('#edEdges g[data-edgeg]').forEach(grp => {
    const id = grp.dataset.edgeg;
    const p = grp.querySelector('path.edge'); if (!p || !p.getTotalLength) return;
    try {
      const mid = p.getPointAtLength(p.getTotalLength() / 2);
      const del = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      del.setAttribute('class', 'edel'); del.setAttribute('data-edgedel', id);
      del.setAttribute('transform', `translate(${mid.x},${mid.y})`);
      del.innerHTML = `<circle r="7"/><path d="M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6"/>`;
      grp.appendChild(del);
    } catch(err){}
  });
  /* pulse overlay for active transfer */
  $$('#edEdges path.edge.pulsing').forEach(p => {
    if (reducedMotion) return;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4'); dot.setAttribute('fill', '#fff');
    dot.style.filter = 'drop-shadow(0 0 6px rgba(255,255,255,.9))';
    const am = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
    am.setAttribute('dur', '1.3s'); am.setAttribute('fill', 'freeze');
    const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
    mp.setAttribute('href', '#' + p.getAttribute('data-edge')); /* fallback: needs id */
    am.appendChild(mp); dot.appendChild(am);
    p.parentNode.appendChild(dot);
    setTimeout(() => dot.remove(), 1500);
  });
  edEdgesG.querySelectorAll('path.edge').forEach((p, i) => { if (ED.edges[i]) p.id = ED.edges[i].id; });
}

function applyView(){
  edWorld.style.transform = `translate(${edView.x}px, ${edView.y}px) scale(${edView.k})`;
  $('#ezoomPct').textContent = Math.round(edView.k * 100) + '%';
}
function renderAll(){ renderNodes(); renderEdges(); applyView(); }

/* ---------- selection & inspector ---------- */
function select(type, id){ edSel = { type, id }; renderAll(); renderInspector(); }
function deselect(){ edSel = null; renderAll(); renderInspector(); }

function renderInspector(){
  if(window.NoxisWorkflowLive) return window.NoxisWorkflowLive.renderInspector();
  insBody.textContent='Loading live workflow controls…';
}

/* inspector buttons (delegated) */
insBody.addEventListener('click', e => {
  const ap = e.target.closest('[data-ins-approve]');
  const co = e.target.closest('[data-ins-correct]');
  const dn = e.target.closest('[data-ins-del]');
  const de = e.target.closest('[data-ins-deledge]');
  const rt = e.target.closest('[data-ins-retry]');
  if (ap) approveGate(ap.dataset.insApprove);
  if (co) requestCorrection(co.dataset.insCorrect);
  if (dn) askDeleteNode(dn.dataset.insDel);
  if (de) askDeleteEdge(de.dataset.insDeledge);
  if (rt) retryTask(rt.dataset.insRetry);
});

/* retry after an error — the task returns to Pending and re-queues */
function retryTask(id){ window.NoxisWorkflowLive?.retry(id); }

/* ---------- destructive actions — all with confirmation ---------- */
function askDeleteNode(id){
  const n = nodeById(id); if (!n) return;
  if (isProtected(n)) {
    toast('The original connected START PULSE is protected. Duplicates and disconnected triggers can be removed.', '#f0c75e');
    return;
  }
  const nm = n.kind === 'trigger' ? 'duplicate START PULSE' : n.kind === 'approval' ? 'TARA APPROVAL gate' : (AGENTS[n.agent] || {}).name || 'node';
  const links = ED.edges.filter(e => e.from === id || e.to === id).length;
  confirmBox({
    title: 'DELETE NODE',
    tone: 'danger', yes: 'Delete node',
    body: `Delete the <b>${esc(nm)}</b> node?${links ? `<br><br>${links} connection${links > 1 ? 's' : ''} will also be removed.` : ''}`,
    small: 'You can re-add nodes from the palette at any time.',
    onYes: () => {
      ED.nodes = ED.nodes.filter(x => x.id !== id);
      ED.edges = ED.edges.filter(e => e.from !== id && e.to !== id);
      if (edSel && edSel.id === id) deselect(); else renderAll();
      persistEd();
      toast('Node deleted', '#fda4af');
    },
  });
}
function askDeleteEdge(id){
  const e = ED.edges.find(x => x.id === id); if (!e) return;
  confirmBox({
    title: 'REMOVE CONNECTION', tone: 'danger', yes: 'Remove',
    body: `Remove this connection?<br><br><b style="color:#67e8f9">${esc(e.message || 'Task handoff')}</b>`,
    small: 'Tasks downstream of this path will no longer receive handoffs.',
    onYes: () => {
      ED.edges = ED.edges.filter(x => x.id !== id);
      if (edSel && edSel.id === id) deselect(); else renderAll();
      persistEd();
      toast('Connection removed', '#fda4af');
    },
  });
}
/* ---------- real Save / Load (no simulated success) ---------- */
$('#ebtnSave').addEventListener('click', () => {
  if (persistEd()) {
    toast(`Saved to browser storage (${RM_KEY}) · ${ED.nodes.length} nodes · ${ED.edges.length} connections`, '#6ee7b7');
  }
});

$('#ebtnLoad').addEventListener('click', () => {
  try {
    const raw = localStorage.getItem(RM_KEY);
    if (!raw) {
      toast('No saved workflow found.', '#f0c75e');
      return;
    }
    const data = applyEdData(JSON.parse(raw));
    const when = data.savedAt
      ? new Date(data.savedAt).toLocaleTimeString() : 'unknown time';
    edFeedback('Saved workflow loaded.');
    toast(`Loaded saved workflow · ${ED.nodes.length} nodes · ${ED.edges.length} connections · ${when}`, '#6ee7b7');
  } catch(error) {
    edFeedback('Load failed: ' + error.message, true);
    toast('Load failed: ' + esc(error.message), '#f43f5e');
  }
});

/* ---------- error-state demo (how a real backend failure is shown) ---------- */


$('#ebtnReset').addEventListener('click', () => {
  confirmBox({
    title: 'RESET WORKFLOW', tone: 'danger', yes: 'Reset everything',
    body: `Reset <b>all nodes, connections and task progress</b> in this preview workflow back to the demo starting point?<br><br>Your custom layout and added nodes will be replaced.`,
    small: 'This affects only the workflow draft — the NOXIS TABLE app and its saved projects are untouched.',
    onYes: () => {
      stopTimer();
      ED = JSON.parse(JSON.stringify(ED_DEFAULTS));
      edSel = null;
      renderAll(); renderInspector(); persistEd();
      toast('Workflow reset to demo starting point', '#f0c75e');
    },
  });
});
$('.ed-persist').addEventListener('click', () => {
  confirmBox({
    title: 'RESET PREVIEW DATA', tone: 'danger', yes: 'Reset preview data',
    body: `Clear this preview's saved canvas (browser key <b>noxis-preview-v1</b>) and restore the default layout?`,
    small: 'The NOXIS TABLE app storage (noxis-table-v1) is never touched.',
    onYes: () => {
      stopTimer();
      try { localStorage.removeItem(RM_KEY); } catch(e){}
      ED = JSON.parse(JSON.stringify(ED_DEFAULTS));
      edView = { x: 40, y: 16, k: 0.9 };
      edSel = null;
      renderAll(); renderInspector(); persistEd();
      toast('Preview data reset (app data untouched)', '#6ee7b7');
    },
  });
});

/* cleanup duplicate triggers */
$('#ebtnClean').addEventListener('click', () => {
  const dups = ED.nodes.filter(n => n.kind === 'trigger' && !isProtected(n));
  if (!dups.length) { toast('No duplicate triggers found — the flow is clean.', '#6ee7b7'); return; }
  confirmBox({
    title: 'CLEAN DUPLICATE TRIGGERS', tone: 'gold', yes: `Delete ${dups.length} duplicate${dups.length > 1 ? 's' : ''}`,
    body: `Delete <b>${dups.length}</b> duplicate / disconnected START PULSE node${dups.length > 1 ? 's' : ''}? The <b style="color:var(--gold)">original connected trigger stays protected</b>.`,
    onYes: () => {
      const ids = dups.map(d => d.id);
      ED.nodes = ED.nodes.filter(n => !ids.includes(n.id));
      ED.edges = ED.edges.filter(e => !ids.includes(e.from) && !ids.includes(e.to));
      renderAll(); saveEd();
      toast(`${ids.length} duplicate trigger${ids.length > 1 ? 's' : ''} removed — original protected`, '#6ee7b7');
    },
  });
});

/* node delete button on the card */
edNodesEl.addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { e.stopPropagation(); askDeleteNode(del.dataset.del); }
});

/* ---------- pan / zoom / node drag / port links ---------- */
let drag = null; /* {kind:'pan'|'node'|'link', ...} */
function toWorld(cx, cy){
  const r = edMain.getBoundingClientRect();
  return { x: (cx - r.left - edView.x) / edView.k, y: (cy - r.top - edView.y) / edView.k };
}
edMain.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const out = e.target.closest('[data-portout]');
  const inn = e.target.closest('[data-portin]');
  const hdr = e.target.closest('[data-drag]');
  if (out) {
    e.stopPropagation();
    drag = { kind:'link', from: out.dataset.portout };
  } else if (inn && drag && drag.kind === 'link') {
    /* handled on pointerup */
  } else if (hdr) {
    const n = nodeById(hdr.dataset.drag);
    const gw = toWorld(e.clientX, e.clientY);   /* grab point in world coords */
    drag = { kind:'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y,
             gx: gw.x, gy: gw.y, moved:false };  /* keep the grab offset — no jump on first move */
    edNodesEl.querySelector(`#wn-${n.id}`).classList.add('ghosting');
  } else if (e.target.closest('.wnode')) {
    /* card body click = select */
  } else {
    drag = { kind:'pan', sx: e.clientX, sy: e.clientY, ox: edView.x, oy: edView.y, moved:false };
  }
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'pan') {
    drag.moved = true;
    edView.x = drag.ox + (e.clientX - drag.sx);
    edView.y = drag.oy + (e.clientY - drag.sy);
    applyView();
  } else if (drag.kind === 'node') {
    drag.moved = true;
    const w = toWorld(e.clientX, e.clientY);
    const n = nodeById(drag.id); if (!n) return;
    /* move relative to the grab point — the card stays exactly where you took it */
    n.x = Math.max(0, Math.round(drag.ox + (w.x - drag.gx)));
    n.y = Math.max(0, Math.round(drag.oy + (w.y - drag.gy)));
    const el = edNodesEl.querySelector(`#wn-${n.id}`);
    if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    renderEdges();               /* lines follow the cards live */
  } else if (drag.kind === 'link') {
    const n = nodeById(drag.from); if (!n) return;
    const w = toWorld(e.clientX, e.clientY);
    const ha = (nodeH[n.id] || 84) / 2;
    edGhostG.innerHTML = `<path d="M ${n.x + ED_W} ${n.y + ha} C ${n.x + ED_W + 60} ${n.y + ha}, ${w.x - 60} ${w.y}, ${w.x} ${w.y}"
      fill="none" stroke="#f0c75e" stroke-width="2" stroke-dasharray="6 6"/>`;
  }
});
window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  edGhostG.innerHTML = '';
  if (d.kind === 'link') {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const host = el && el.closest('.wnode');
    if (host) connectNodes(d.from, host.dataset.node);
    return;
  }
  if (d.kind === 'node') {
    const el = edNodesEl.querySelector(`#wn-${d.id}`);
    if (el) el.classList.remove('ghosting');
    if (!d.moved) select('node', d.id);
    else saveEd();
    return;
  }
  if (d.kind === 'pan' && !d.moved) deselect();
});
edMain.addEventListener('click', e => {
  const hit = e.target.closest('[data-edgehit]');
  const edge = e.target.closest('[data-edge]');
  const delE = e.target.closest('[data-edgedel]');
  if (delE) { askDeleteEdge(delE.dataset.edgedel); return; }
  if (hit || edge) { select('edge', (hit || edge).dataset.edgehit || (edge ? edge.dataset.edge : hit.dataset.edge)); }
});

function connectNodes(fromId, toId){
  if (fromId === toId) return;
  if (ED.edges.some(e => e.from === fromId && e.to === toId)) { toast('These nodes are already connected.', '#f0c75e'); return; }
  if (createsCycle(fromId, toId)) { toast('Blocked — this would create a circular dependency.', '#f43f5e'); return; }
  const a = nodeById(fromId), b = nodeById(toId);
  ED.edges.push({ id: 'e' + Date.now().toString(36), from: fromId, to: toId, message: 'Task handoff' });
  renderAll(); saveEd();
  toast(`Connected ${label(a)} → ${label(b)}`, '#6ee7b7');
}
function label(n){ return !n ? '?' : n.kind === 'trigger' ? 'START PULSE' : n.kind === 'approval' ? 'TARA APPROVAL' : AGENTS[n.agent].short; }
function createsCycle(fromId, toId){
  const adj = {};
  ED.edges.forEach(e => (adj[e.from] = adj[e.from] || []).push(e.to));
  (adj[fromId] = adj[fromId] || []).push(toId);
  const seen = {};
  const stack = [[toId, 0]];
  while (stack.length) {
    const [cur] = stack.pop();
    if (cur === fromId) return true;
    if (seen[cur]) continue;
    seen[cur] = 1;
    (adj[cur] || []).forEach(nx => stack.push([nx, 0]));
  }
  return false;
}

/* wheel zoom */
edMain.addEventListener('wheel', e => {
  e.preventDefault();
  const r = edMain.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const k2 = clamp(edView.k * (e.deltaY < 0 ? 1.08 : 0.93), 0.35, 1.6);
  edView.x = mx - (mx - edView.x) * (k2 / edView.k);
  edView.y = my - (my - edView.y) * (k2 / edView.k);
  edView.k = k2;
  applyView(); renderEdges(); saveEd();
}, { passive: false });
$('#ezoomIn').addEventListener('click', () => { edView.k = clamp(edView.k + 0.12, 0.35, 1.6); applyView(); saveEd(); });
$('#ezoomOut').addEventListener('click', () => { edView.k = clamp(edView.k - 0.12, 0.35, 1.6); applyView(); saveEd(); });
$('#ezoomReset').addEventListener('click', () => { edView = { x: 40, y: 16, k: 0.9 }; applyView(); saveEd(); });

/* keyboard delete */
document.addEventListener('keydown', e => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
  if (!edSel || !$('#ePaneFix').offsetParent) return;
  if (edSel.type === 'node') askDeleteNode(edSel.id); else askDeleteEdge(edSel.id);
});

/* keyboard: focused node header — arrows move the node, Enter selects it */
edNodesEl.addEventListener('keydown', e => {
  const hdr = e.target.closest('[data-drag]'); if (!hdr) return;
  const n = nodeById(hdr.dataset.drag); if (!n) return;
  const step = e.shiftKey ? 1 : 10;
  const mv = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[e.key];
  if (mv) {
    e.preventDefault();
    n.x = Math.max(0, n.x + mv[0]); n.y = Math.max(0, n.y + mv[1]);
    const el = edNodesEl.querySelector(`#wn-${n.id}`);
    if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    renderEdges(); saveEd();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select('node', n.id); }
});

/* keyboard: palette items are activatable without a pointer */
$('#epalette').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.pal-item'); if (!item) return;
  e.preventDefault(); addFlowNode(item.dataset.add, item.dataset.agent || null, null, null);
});

/* ---------- palette: drag into canvas or click to place ---------- */
let palGhost = null, palStart = null;
$('#epalette').addEventListener('pointerdown', e => {
  const item = e.target.closest('.pal-item'); if (!item) return;
  e.preventDefault();
  palStart = { item, x: e.clientX, y: e.clientY, moved: false };
});
window.addEventListener('pointermove', e => {
  if (!palStart) return;
  if (!palStart.moved && Math.hypot(e.clientX - palStart.x, e.clientY - palStart.y) > 6) {
    palStart.moved = true;
    palGhost = palStart.item.cloneNode(true);
    palGhost.style.cssText = 'position:fixed; z-index:99; width:170px; pointer-events:none; opacity:.9; box-shadow:0 10px 30px rgba(0,0,0,.5);';
    document.body.appendChild(palGhost);
  }
  if (palGhost) { palGhost.style.left = (e.clientX + 8) + 'px'; palGhost.style.top = (e.clientY + 8) + 'px'; }
});
window.addEventListener('pointerup', e => {
  if (!palStart) return;
  const ps = palStart; palStart = null;
  if (palGhost) { palGhost.remove(); palGhost = null; }
  const kind = ps.item.dataset.add;
  const agent = ps.item.dataset.agent || null;
  const r = edMain.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!ps.moved) { addFlowNode(kind, agent, null, null); return; }          /* click → auto place */
  if (!inside) return;
  const w = toWorld(e.clientX, e.clientY);
  addFlowNode(kind, agent, Math.round(w.x - ED_W / 2), Math.round(w.y - 40));
});
function addFlowNode(kind, agent, wx, wy){
  if (kind === 'trigger') {
    confirmBox({
      title: 'ADD START PULSE', tone: 'gold', yes: 'Add anyway',
      body: `The flow already has a <b style="color:var(--gold)">protected original START PULSE</b>.<br><br>Adding another creates a <b>duplicate</b> — duplicates are disconnected and deletable. This exists so you can test the duplicate-cleanup correction.`,
      small: 'Recommended: keep one trigger per flow.',
      onYes: () => placeNode(kind, agent, wx, wy),
    });
    return;
  }
  placeNode(kind, agent, wx, wy);
}
function placeNode(kind, agent, wx, wy){
  const n = { id: 'n' + Date.now().toString(36), kind, agent: kind === 'agent' ? agent : (kind === 'approval' ? 'tara' : null),
    x: wx != null ? Math.max(0, wx) : 420 + Math.round(Math.random() * 60),
    y: wy != null ? Math.max(0, wy) : 240 + Math.round(Math.random() * 120),
    task: kind === 'agent' ? { title: 'New task — assign in the app', status: 'pending', progress: 0 } : null, original: false };
  ED.nodes.push(n);
  select('node', n.id); saveEd();
  toast(`${label(n)} added — drag to position`, '#6ee7b7');
}

/* ---------- demo execution (clearly labeled — not real AI work) ---------- */
/* Live execution belongs to workflow_engine.py. */
function setBtns(){ window.NoxisWorkflowLive?.sync(); }
function stopTimer(){
  if(edRun.timer) clearInterval(edRun.timer);
  edRun.timer=null; edRun.running=false; edRun.paused=false; setBtns();
}
function approveGate(id){ window.NoxisWorkflowLive?.approve(id); }
function requestCorrection(id){ window.NoxisWorkflowLive?.correct(id); }
/* ---------- export / import ---------- */
$('#ebtnExport').addEventListener('click', () => {
  const data = { format:'noxis-univers-workflow', version:1, exportedAt:new Date().toISOString(), ...window.NoxisWorkflowLive?.exportMeta(), nodes:ED.nodes, edges:ED.edges };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const aEl = document.createElement('a');
  aEl.href = URL.createObjectURL(blob);
  aEl.download = 'noxis-univers-workflow.json';
  aEl.click();
  setTimeout(() => URL.revokeObjectURL(aEl.href), 4000);
  toast('Workflow JSON exported', '#6ee7b7');
});
$('#ebtnImport').addEventListener('click', () => $('#eImportFile').click());

$('#eImportFile').addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('Import failed: maximum file size is 2 MB.', '#f43f5e');
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => toast('Import failed: unable to read file.', '#f43f5e');
  reader.onload = () => {
    try {
      applyEdData(JSON.parse(String(reader.result)));
      if (persistEd()) {
        edFeedback('Workflow imported and saved.');
        toast('Workflow imported and saved.', '#6ee7b7');
      } else {
        edFeedback('Workflow opened, but saving failed. Export a copy.', true);
        toast('Workflow opened, but browser saving failed. Export a copy.', '#f0c75e');
      }
    } catch(error) {
      edFeedback('Import failed: ' + error.message, true);
      toast('Import failed: ' + esc(error.message), '#f43f5e');
    }
  };
  reader.readAsText(file);
});

/* initial paint */
renderAll();
renderInspector();

/* first-paint honesty note (replaces the preview-only welcome toast) */


/* Backend results are restored by noxis-workflow-live.js. */
