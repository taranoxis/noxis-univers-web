/* ============================================================
   NOXIS TABLE — UNIVERSE VIEW · page logic (website page 1)
   Approved v4.1 universe view: original seal + light animation,
   seven-member constellation, connections, statuses, activity
   panels, drawer, pipeline, demo signal, pan/zoom. Comparison
   controls and Portrait Studio are not part of this page.
   ============================================================ */
'use strict';
/* the NOXIS sigil was replaced by the ORIGINAL seal artwork supplied by Tara
   (assets/img/noxis-seal.png); no SVG stand-in is used anymore. */

/* ============================================================
   UNIVERSE — corrected interactive mock (pan & zoom world canvas)
   The constellation lives in a fixed 1280x800 world that is always
   auto-fitted into the visible stage: nothing can ever be clipped.
   ============================================================ */
const uStage = $('#uStage'), unet = $('#unet'), uAgentsEl = $('#uAgents'), uWorld = $('#uWorld');

const WORLD = { w: 1280, h: 800 };
const HUB = { x: 642, y: 400, r: 150 };
const CARD = { w: 190, h: 212 };   /* approx card box incl. task row (v3: taller 118px art frames) */

function stageSize(){ return { w: uStage.clientWidth, h: uStage.clientHeight }; }

/* anchor where the connection meets the card: the point on the card's
   bounding box facing the hub, pulled 8px outward */
function cardAnchor(key){
  const a = AGENTS[key];
  const cx = a.pos.x, cy = a.pos.y;
  const dx = HUB.x - cx, dy = HUB.y - cy;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const hw = CARD.w / 2 + 8, hh = CARD.h / 2 + 8;
  const t = Math.min(adx > 0 ? hw / adx : Infinity, ady > 0 ? hh / ady : Infinity);
  return { x: cx + dx * t, y: cy + dy * t, cx, cy };
}

function buildUniverse(){
  /* agent cards — fixed world coordinates (px), never screen percentages */
  uAgentsEl.innerHTML = AGENT_KEYS.map(k => {
    const a = AGENTS[k], st = U_STATE.statuses[k], task = U_STATE.tasks[k];
    return `<div class="acard${a.outer ? ' outer' : ''}" id="uc-${k}" style="left:${a.pos.x}px; top:${a.pos.y}px; --ac:${a.accent}; --tint:${a.tint}" data-agent="${k}" tabindex="0" role="button" aria-label="${esc(a.name)} — open details">
      <div class="hd">
        <span class="nm" style="color:${a.accent}">${esc(a.short.toUpperCase())}</span>
        <span class="st ${st}" data-live-status="${k}"><i></i>${a.human ? "HUMAN" : "CHECKING"}</span>
      </div>
      <div class="art"><img src="${PORTRAITS[k]}" alt="${esc(a.name)} — portrait" draggable="false"></div>
      <div class="rl" style="color:${a.accent}cc">${esc(a.tagline)}</div>
      ${a.human ? '' : `<div class="task" data-live-task="${k}">Checking journal...</div>`}
    </div>`;
  }).join('');

  /* sidepanel status */
  $('#uspStatus').innerHTML = AGENT_KEYS.map(k => {
    const st = U_STATE.statuses[k];
    const col = { working:'#67e8f9', waiting:'#f0c75e', online:'#34d399', researching:'#a78bfa', offline:'#6b7280' }[st];
    return `<div class="sp-row"><span class="nm">${esc(AGENTS[k].short)}</span>
      <span style="font-size:9px; color:var(--muted); letter-spacing:.08em; text-transform:uppercase;">${st}</span>
      <span class="dot" style="background:${col}; box-shadow:0 0 6px ${col}"></span></div>`;
  }).join('');

  $('#uspEvents').innerHTML = U_STATE.events.map(e => `<div class="sp-ev"><span class="t">${e.t}</span>${e.x}</div>`).join('');

  drawNet();
}

function drawNet(){
  let lines = '', flows = '', hits = '', pks = '';
  AGENT_KEYS.forEach((k, i) => {
    const a = AGENTS[k], p = cardAnchor(k);
    const vx = p.cx - HUB.x, vy = p.cy - HUB.y, len = Math.hypot(vx, vy) || 1;
    const hx = HUB.x + vx / len * (HUB.r + 4);
    const hy = HUB.y + vy / len * (HUB.r + 4);
    /* gentle S-curve toward the hub */
    const mx = (p.cx + hx) / 2, my = (p.cy + hy) / 2;
    const nx = -(hy - p.y), ny = (hx - p.x);
    const nl = Math.hypot(nx, ny) || 1;
    const bow = Math.min(36, Math.hypot(hx - p.x, hy - p.y) * 0.12);
    const d = `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q ${(mx + nx / nl * bow).toFixed(1)} ${(my + ny / nl * bow).toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`;
    lines += `<path id="ul-${k}" class="line" d="${d}" stroke="${a.accent}" style="color:${a.accent}"/>`;
    flows += `<path class="flow" d="${d}" stroke="${a.accent}"/>`;
    hits += `<path class="hit" data-edge="${k}" d="${d}"/>`;
    if (!reducedMotion) {
      pks += `<circle class="pk2" r="5"><animateMotion dur="${(5 + i * 0.9).toFixed(1)}s" begin="${(i * 0.7).toFixed(1)}s" repeatCount="indefinite"><mpath href="#ul-${k}"/></animateMotion></circle>`;
    }
  });
  unet.innerHTML = lines + flows + hits + pks;
}

/* agent interactions */
uAgentsEl.addEventListener('click', e => {
  if (e.target.closest('.pbtn')) return;   /* Portrait Studio button — handled by the portrait module */
  const card = e.target.closest('.acard'); if (!card) return;
  openDrawer(card.dataset.agent);
});
uAgentsEl.addEventListener('keydown', e => {
  const card = e.target.closest('.acard');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDrawer(card.dataset.agent); }
});


function renderAgentActions(key) {
  const body = document.getElementById('uDBody');
  if (!body) return;

  const section = document.createElement('section');
  section.className = 'd-sec';
  const heading = document.createElement('h5');
  heading.textContent = 'Actions';
  section.appendChild(heading);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px';

  function addButton(label, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'padding:9px 12px;border:1px solid #63558b;border-radius:8px;' +
      'background:#17152e;color:#e5e7eb;cursor:pointer';
    btn.addEventListener('click', handler);
    row.appendChild(btn);
  }

  function closeDetails() {
    document.getElementById('uDClose')?.click();
  }

  function showConversations(first, second) {
    const a = document.getElementById('conversationAgentA');
    const b = document.getElementById('conversationAgentB');
    const open = document.getElementById('ubtnConversations');
    if (!a || !b || !open) {
      window.alert('Conversation controls are unavailable.');
      return;
    }
    a.value = first;
    b.value = second;
    closeDetails();
    open.click();
  }

  if (key === 'tara') {
    addButton('Open Inbox', () => showConversations('tara', '*'));
  } else {
    addButton('Send Message', () => {
      const sender = document.getElementById('signalSender');
      const receiver = document.getElementById('signalReceiver');
      if (!sender || !receiver || !window.NoxisSignal?.open) {
        window.alert('Message controls are unavailable.');
        return;
      }
      receiver.value = key;
      if (!sender.value || sender.value === key) {
        sender.value = key === 'nyxar' ? 'ar_in' : 'nyxar';
      }
      closeDetails();
      window.NoxisSignal.open();
    });
    addButton('Conversations', () => showConversations(key, '*'));
  }

  section.appendChild(row);
  body.prepend(section);
  if (key === 'nyxar') window.NoxisNyxar?.connect(body);
  if (key === 'ar_in') window.NoxisTextStudio?.connect(body);
  if (key === 'nyxin') window.NoxisVisualStudio?.connect(body);
  if (key === 'nyxer') window.NoxisCommercialStudio?.connect(body);
  if (key === 'ar_on') window.NoxisRightsStudio?.connect(body);
  if (key === 'aren') window.NoxisCatalog?.connect(body);
  if (key === 'aren') window.NoxisResearchStudio?.connect(body);
  if (key === 'tara') {
    for (const tag of body.querySelectorAll('span')) {
      if (!['Create projects & goals', 'Review results', 'Approve publishing / selling / archiving'].includes(tag.textContent.trim())) continue;
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = tag.textContent;
      action.style.cssText = tag.style.cssText;
      action.style.cursor = 'pointer';
      action.style.background = '#17152e';
      action.style.color = '#e5e7eb';
      action.addEventListener('click', () => {
        if (action.textContent.trim() === 'Approve publishing / selling / archiving') {
          window.NoxisDecisions?.open();
          return;
        }
        if (action.textContent.trim() === 'Review results') {
          window.NoxisReview?.open();
          return;
        }
        if (window.NoxisProjects?.openCreate) {
          window.NoxisProjects.openCreate();
        } else {
          window.alert('Project controls are unavailable.');
        }
      });
      tag.replaceWith(action);
    }
  }
}


/* drawer */
function openDrawer(key){
  const a = AGENTS[key], st = U_STATE.statuses[key], task = U_STATE.tasks[key];
  const stCol = { working:'#67e8f9', waiting:'#f0c75e', online:'#34d399', researching:'#a78bfa', offline:'#6b7280' }[st];
  $$('#uAgents .acard').forEach(c => c.classList.toggle('sel', c.dataset.agent === key));
  $('#uDrawer').dataset.agent = key;   /* lets the portrait module update the header image on save */
  $('#uDImg').src = PORTRAITS[key];
  $('#uDName').textContent = a.name;
  $('#uDName').style.color = a.accent;
  $('#uDRole').textContent = a.tagline;
  $('#uDBody').innerHTML = `
    <div class="d-sec"><h5>Status</h5><div class="d-task">Loading journal...</div></div>
    <div class="d-sec"><h5>Current task</h5><div class="d-task">Loading journal...</div></div>
    <div class="d-sec"><h5>Recent messages</h5><div class="d-task">Loading journal...</div></div>
    <div class="d-sec"><h5>Latest result</h5><div class="d-task">Loading journal...</div></div>
    <div class="d-sec"><h5>Capabilities</h5>
      <div style="display:flex; flex-wrap:wrap; gap:5px;">${a.caps.map(c => key === 'nyxar' && (c === 'Assign tasks' || c === 'Plan & organize workflows') ? `<button type="button" id="${c === 'Assign tasks' ? 'nyxarAssignShortcut' : 'nyxarWorkflowShortcut'}" style="font-size:9.5px;border:1px solid #5eb0f0;border-radius:99px;padding:2px 9px;background:#173653;color:#e5edff;cursor:pointer;">${esc(c)}</button>` : `<span style="font-size:9.5px; border:1px solid var(--border); border-radius:99px; padding:2px 9px; color:var(--muted);">${esc(c)}</span>`).join('')}</div>
    </div>`;
  $('#uDrawer').classList.add('open');
  window.NoxisLiveStatus?.renderStatus(key);
  renderAgentActions(key);
  if (key === 'nyxar') {
    window.NoxisChat?.renderChat(key);
    window.NoxisTasks?.renderTasks(key);
    window.NoxisJournal?.renderJournal(key);
    window.NoxisWorkflows?.renderWorkflows(key);
    const shortcut = document.getElementById('nyxarAssignShortcut');
    document.querySelectorAll('#nyxarWorkflowShortcut').forEach(button => {
      if (button.textContent.trim() !== 'Plan & organize workflows') return;
      button.addEventListener('click', () => {
        document.getElementById('noxisWorkflows')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    });
    shortcut?.addEventListener('click', () => {
      const form = document.getElementById('noxisAssignTasks');
      form?.scrollIntoView({behavior:'smooth', block:'start'});
      form?.querySelector('textarea')?.focus({preventScroll:true});
    });
  }
}
$('#uDClose').addEventListener('click', () => { $('#uDrawer').classList.remove('open'); $$('#uAgents .acard').forEach(c => c.classList.remove('sel')); });

/* keyboard: Esc closes the drawer; the hub and the stage are keyboard-reachable */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const dr = $('#uDrawer');
  if (dr.classList.contains('open')) { dr.classList.remove('open'); $$('#uAgents .acard').forEach(c => c.classList.remove('sel')); }
});
uStage.addEventListener('keydown', e => {
  const step = e.shiftKey ? 10 : 40;
  const pan = { ArrowLeft:[-step,0], ArrowRight:[step,0], ArrowUp:[0,-step], ArrowDown:[0,step] }[e.key];
  if (pan) { e.preventDefault(); uAutoFit = false; uView.x += pan[0]; uView.y += pan[1]; clampUPan(); return; }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); const s = stageSize(); zoomUAt(1.15, s.w / 2, s.h / 2); clampUPan(); }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); const s = stageSize(); zoomUAt(0.87, s.w / 2, s.h / 2); clampUPan(); }
  if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input, textarea, [contenteditable]')) { e.preventDefault(); fitUniverse(); }
});
$('#uHub').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openActivity(); } });

/* edge inspector */
unet.addEventListener('click', e => {
  if (uPanMoved) return;   /* ignore clicks that were pan drags */
  const hit = e.target.closest('.hit'); if (!hit) return;
  const k = hit.dataset.edge, a = AGENTS[k];
  $$('#unet .line').forEach(l => l.classList.toggle('hot', l.id === 'ul-' + k));
  const tag = $('#uEdgeTag');
  const p = cardAnchor(k);
  tag.style.left = (p.cx + HUB.x) / 2 + 'px';
  tag.style.top = (p.cy + HUB.y) / 2 + 'px';
  tag.classList.add('show');
  setTimeout(() => tag.classList.remove('show'), 1800);
  confirmBox({
    title: 'SIGNAL PATH',
    tone: 'cyan',
    body: `<b style="color:${a.accent}">${esc(a.name)}</b> ⇄ <b style="color:var(--gold)">NOXIS Core</b><br><br>
      All agent communication is routed through the central eclipse hub. The last demo message on this path:<br>
      <i style="color:#c9e9ff">"${esc((U_STATE.messages[k] || [{text:'Task assignment (demo)'}])[0].text)}" — demo</i>`,
    small: 'Click the eclipse to open the full activity stream.',
    yes: 'Open activity',
    onYes: () => openActivity(),
  });
  setTimeout(() => $$('#unet .line').forEach(l => l.classList.remove('hot')), 2200);
});

/* hub interactions */
function openActivity(){
  $('#uSide').classList.remove('hidden');
  $('#ubtnActivity').classList.add('on');
}
$('#uHub').addEventListener('click', openActivity);
$('#ubtnActivity').addEventListener('click', () => {
  const sp = $('#uSide');
  const show = sp.classList.contains('hidden');
  sp.classList.toggle('hidden', !show);
  $('#ubtnActivity').classList.toggle('on', show);
});
$('#ubtnStatus').addEventListener('click', () => {
  const sp = $('#uSide');
  const show = sp.classList.contains('hidden');
  sp.classList.toggle('hidden', !show);
  $('#ubtnStatus').classList.toggle('on', show);
});

/* Network animation helpers */
function pulsePath(key, delay){
  setTimeout(() => {
    const line = $('#ul-' + key); if (!line) return;
    line.classList.add('hot');
    if (!reducedMotion) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      p.setAttribute('r', '4.5'); p.setAttribute('class', 'pk');
      const am = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      am.setAttribute('dur', '1.2s'); am.setAttribute('fill', 'freeze');
      const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
      mp.setAttribute('href', '#ul-' + key);
      am.appendChild(mp); p.appendChild(am);
      unet.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
    setTimeout(() => line.classList.remove('hot'), 1600);
  }, delay);
}
function hubFlash(){
  const f = $('#uHubFlash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

/* pipeline + gated publish */
function setStage(s){ U_STATE.stage = s; $$('#uPipe .stage-i').forEach(el => el.classList.toggle('active', el.dataset.s === s)); }
window.NoxisSetProjectStage = setStage;
$$('#uPipe .stage-i').forEach(el => el.addEventListener('click', () => {
  window.NoxisPipeline?.open(el.dataset.s);
}));
$('#uPub').addEventListener('click', () => {
  window.NoxisPipeline?.open('publish');
});

/* ---------- workspace pan / zoom (nothing can ever be clipped) ---------- */
let uView = { x: 0, y: 0, k: 1 };
let uAutoFit = true;
let uPan = null;
let uPanMoved = false;

function applyUView(){
  uWorld.style.transform = `translate(${uView.x}px, ${uView.y}px) scale(${uView.k})`;
  $('#uzoomPct').textContent = uAutoFit ? 'Fit' : Math.round(uView.k * 100) + '%';
}
function fitUniverse(){
  const { w, h } = stageSize();
  const pad = { t: 52, b: 54, l: 16, r: 16 };   /* top: tools · bottom: pipeline strip */
  const k = Math.min((w - pad.l - pad.r) / WORLD.w, (h - pad.t - pad.b) / WORLD.h, 1.0);
  uView.k = Math.max(k, 0.2);
  uView.x = pad.l + (w - pad.l - pad.r - WORLD.w * uView.k) / 2;
  uView.y = pad.t + (h - pad.t - pad.b - WORLD.h * uView.k) / 2;
  uAutoFit = true;
  applyUView();
}
function clampUPan(){
  /* keep the world reachable after panning: its center must stay inside the
     stage, so the view can never be lost off-screen */
  const { w, h } = stageSize();
  const ww = WORLD.w * uView.k, wh = WORLD.h * uView.k;
  const cx = clamp(uView.x + ww / 2, 0, w);
  const cy = clamp(uView.y + wh / 2, 0, h);
  uView.x = cx - ww / 2;
  uView.y = cy - wh / 2;
  applyUView();
}
function zoomUAt(factor, mx, my){
  const k2 = clamp(uView.k * factor, 0.25, 2.2);
  uView.x = mx - (mx - uView.x) * (k2 / uView.k);
  uView.y = my - (my - uView.y) * (k2 / uView.k);
  uView.k = k2;
  uAutoFit = false;
  applyUView();
}
uStage.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  if (e.target.closest('.acard, .hub, #uSide, .drawer, .stage-tools, .uzoom, .pipe, .edge-tag')) return;
  uPan = { sx: e.clientX, sy: e.clientY, ox: uView.x, oy: uView.y };
  uPanMoved = false;
  uStage.classList.add('panning');
});
window.addEventListener('pointermove', e => {
  if (!uPan) return;
  uPanMoved = Math.hypot(e.clientX - uPan.sx, e.clientY - uPan.sy) > 4 || uPanMoved;
  uView.x = uPan.ox + (e.clientX - uPan.sx);
  uView.y = uPan.oy + (e.clientY - uPan.sy);
  uAutoFit = false;
  applyUView();
});
window.addEventListener('pointerup', () => {
  if (!uPan) return;
  uPan = null;
  uStage.classList.remove('panning');
  clampUPan();
  setTimeout(() => { uPanMoved = false; }, 50);
});
uStage.addEventListener('wheel', e => {
  e.preventDefault();
  const r = uStage.getBoundingClientRect();
  zoomUAt(e.deltaY < 0 ? 1.08 : 0.93, e.clientX - r.left, e.clientY - r.top);
  clampUPan();
}, { passive: false });
$('#uzoomIn').addEventListener('click', () => {
  const { w, h } = stageSize(); zoomUAt(1.15, w / 2, h / 2); clampUPan();
});
$('#uzoomOut').addEventListener('click', () => {
  const { w, h } = stageSize(); zoomUAt(0.87, w / 2, h / 2); clampUPan();
});
$('#uzoomFit').addEventListener('click', fitUniverse);
const uRO = ('ResizeObserver' in window) ? new ResizeObserver(() => { if (uAutoFit) fitUniverse(); }) : null;
if (uRO) uRO.observe(uStage); else window.addEventListener('resize', () => { if (uAutoFit) fitUniverse(); });

/* build universe, then fit it into the visible stage */
buildUniverse();
setStage(U_STATE.stage);
fitUniverse();
setTimeout(fitUniverse, 60);   /* once fonts/images have settled */
