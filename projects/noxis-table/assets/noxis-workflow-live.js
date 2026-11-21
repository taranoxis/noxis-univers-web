/* NOXIS live workflow controls. The backend owns execution and results. */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/';
  const storageKey = 'noxis-live-workflow-ui-v1';
  const activeStates = new Set(['running','pausing','paused','stopping','awaiting_approval']);
  let run = null, busy = false, projectsReady = false, loadingRun = false;
  let requestId = crypto.randomUUID();
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
  const notes = {};
  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function style(node) {
    node.style.cssText = 'padding:9px;background:#11142c;color:#e5e7eb;border:1px solid #63558b;border-radius:8px;max-width:100%;box-sizing:border-box';
    return node;
  }
  function button(text, action) {
    const node = style(el('button', text)); node.type = 'button';
    node.addEventListener('click', action); return node;
  }
  const panel = el('section');
  panel.style.cssText = 'padding:14px;border:1px solid #63558b;border-radius:12px;margin:12px 0;display:grid;gap:10px';
  const project = style(el('select')); project.id = 'liveWorkflowProject';
  project.setAttribute('aria-label','Workflow project');
  project.add(new Option('Loading projects…',''));
  const runs = style(el('select')); runs.setAttribute('aria-label','Saved workflow run');
  runs.add(new Option('New workflow / draft',''));
  const brief = style(el('textarea')); brief.rows = 3; brief.maxLength = 6000;
  brief.placeholder = 'Describe the actual work and desired result. Romanian is the default conversation language.';
  brief.setAttribute('aria-label','Workflow brief');
  brief.value = stored.brief || '';
  const controls = el('div'); controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const refresh = button('Refresh projects & runs', () => loadProjects());
  const draft = button('New draft from canvas', newDraft);
  const resultButton = button('View run results', showResults);
  controls.append(refresh,draft,resultButton);
  const status = el('div','Connecting to the workflow backend…');
  status.setAttribute('role','status'); status.style.whiteSpace = 'pre-wrap';
  const info = el('p','Run executes text tasks sequentially through Ollama. Pause and Stop take effect after an in-flight request finishes. Tara gates require a human decision. No automatic publishing or image/video generation.');
  info.style.cssText = 'font-size:12px;color:#c4b5fd';
  panel.append(el('strong','PROJECT & LIVE EXECUTION'),project,runs,brief,controls,info,status);
  document.querySelector('.ed-toolbar').before(panel);

  const resultsDialog = el('dialog');
  resultsDialog.style.cssText = 'margin:auto;width:min(900px,94vw);max-height:88vh;overflow:auto;padding:22px;background:#100d2b;color:#e5e7eb;border:1px solid #63558b;border-radius:16px';
  resultsDialog.setAttribute('aria-label','Workflow results');
  document.body.appendChild(resultsDialog);
  function showResults() {
    resultsDialog.replaceChildren(el('h2','Workflow results'));
    if (!run) resultsDialog.append(el('p','Select a saved run first.'));
    else {
      resultsDialog.append(el('p',run.project_name + ' · ' + run.status));
      for (const node of Object.values(run.nodes)) {
        if (node.kind === 'trigger') continue;
        const card = el('section'); card.style.cssText = 'padding:12px;border:1px solid #494078;margin:12px 0;border-radius:8px';
        card.append(el('h3',(node.agent || 'TARA').toUpperCase() + ' · ' + node.status));
        if (node.model_used) card.append(el('p','Model: ' + node.model_used));
        const text = el('div',node.result || node.error || 'No completed result.');
        text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
        card.append(text);
        if (node.result) card.append(button('Copy result', () => copy(node.result)));
        resultsDialog.append(card);
      }
      const audit = el('details'), summary = el('summary','Tara decision history');
      const text = el('div',run.approval_history.map(x => `${x.created_at} · ${x.node_id} · ${x.action}\n${x.notes}`).join('\n\n') || 'No decisions yet.');
      text.style.whiteSpace = 'pre-wrap'; audit.append(summary,text); resultsDialog.append(audit);
    }
    resultsDialog.append(button('Close', () => resultsDialog.close()));
    if (!resultsDialog.open) resultsDialog.showModal();
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); tell('Result copied.'); }
    catch { tell('Copy unavailable. Select the result text and press Ctrl+C.',true); }
  }
  function tell(text,error=false) {
    status.textContent = text; status.style.color = error ? '#fca5a5' : '#a7f3d0';
  }
  function remember() {
    try { localStorage.setItem(storageKey,JSON.stringify({project_id:project.value,run_id:run?.id || '',brief:brief.value})); } catch {}
  }
  async function api(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetch(API + path, payload === undefined
        ? {cache:'no-store',signal:controller.signal}
        : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      if (!response.ok) {
        const raw = await response.text();
        const doc = new DOMParser().parseFromString(raw,'text/html');
        const message = [...doc.querySelectorAll('p')].map(p => p.textContent).find(t => t.startsWith('Message:'));
        throw new Error(message || 'HTTP ' + response.status);
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function locked() { return busy || !!run; }
  function sync() {
    const active = run && activeStates.has(run.status);
    document.getElementById('ebtnRun').disabled = busy || !projectsReady || !project.value || !!run;
    document.getElementById('ebtnPause').disabled = busy || !run || !['running','awaiting_approval'].includes(run.status);
    document.getElementById('ebtnResume').disabled = busy || !run || !['paused','interrupted'].includes(run.status) || Object.values(run.nodes).some(n => n.status === 'error');
    document.getElementById('ebtnStop').disabled = busy || !run || ['completed','stopped','stopping'].includes(run.status);
    project.disabled = busy || !!active;
    runs.disabled = busy || !!active;
    brief.disabled = locked();
    draft.disabled = busy || !!active;
    resultButton.disabled = !run;
    for (const id of ['ebtnLoad','ebtnImport','ebtnReset','ebtnClean']) {
      const control = document.getElementById(id); if (control) control.disabled = locked();
    }
  }
  function clearStatuses() {
    for (const node of ED.nodes) {
      if (node.task) {
        node.task.status = 'pending'; node.task.progress = 0;
        delete node.task.result; delete node.task.error;
      }
    }
  }
  function newDraft() {
    if (busy || (run && activeStates.has(run.status))) return;
    run = null; runs.value = ''; requestId = crypto.randomUUID();
    clearStatuses(); renderAll(); renderInspector(); remember(); sync();
    tell('Draft ready. Edit each agent task in Inspector, enter a brief, then Run.');
  }
  function paint(incoming, attach=false) {
    if (incoming.project_id !== project.value) return;
    if (run?.id === incoming.id && incoming.updated_at < run.updated_at) return;
    if (attach || !run || run.id !== incoming.id) {
      const plan = validateEdData(incoming.plan);
      ED.nodes = plan.nodes; ED.edges = plan.edges;
      edSel = null;
    }
    run = incoming;
    brief.value = run.brief;
    for (const node of ED.nodes) {
      const state = run.nodes[node.id]; if (!state) continue;
      if (state.status === 'disconnected') { node.task = null; continue; }
      node.task = {...(node.task || {}),title:state.instructions || 'Start pulse',
        status:state.status,progress:state.status === 'done' ? 100 : 0,
        error:state.error || '',result:state.result || '',model_profile:state.model_profile || 'general'};
    }
    renderAll(); renderInspector();
    const current = run.current_node ? ' · Node ' + run.current_node : '';
    tell('Run ' + run.id + '\nState: ' + run.status + current +
      (run.error ? '\n' + run.error : '') +
      (run.status === 'awaiting_approval' ? '\nSelect the Tara approval node to review results and decide.' : '') +
      (['pausing','stopping'].includes(run.status) ? '\nThe current Ollama request is finishing; no next task will start.' : ''),
      ['error','interrupted'].includes(run.status));
    if (![...runs.options].some(o => o.value === run.id)) runs.add(new Option(run.created_at + ' · ' + run.status,run.id));
    runs.value = run.id;
    remember(); sync();
  }
  async function loadRun(id,attach=false) {
    if (!id || loadingRun) return;
    loadingRun = true;
    const selected = project.value;
    try {
      const data = await api('workflows?project_id=' + encodeURIComponent(selected) + '&run_id=' + encodeURIComponent(id));
      if (project.value === selected && (attach || run?.id === id)) paint(data,attach);
    } catch(error) { tell('Run state unavailable: ' + error.message,true); }
    finally { loadingRun = false; }
  }
  async function loadRuns(preferred='') {
    const selected = project.value;
    const data = await api('workflows?project_id=' + encodeURIComponent(selected));
    if (selected !== project.value) return;
    if (!Array.isArray(data)) throw new Error('Invalid run registry');
    runs.replaceChildren(new Option('New workflow / draft',''));
    for (const item of data) runs.add(new Option(item.created_at + ' · ' + item.status,item.id));
    if (preferred && data.some(r => r.id === preferred)) await loadRun(preferred,true);
  }
  async function loadProjects() {
    if (busy) return;
    const selected = project.value || stored.project_id || '';
    try {
      const data = await api('projects');
      if (!Array.isArray(data)) throw new Error('Invalid project registry');
      project.replaceChildren(new Option('Select project…',''));
      for (const item of data) project.add(new Option(item.name,item.id));
      project.value = data.some(p => p.id === selected) ? selected : '';
      projectsReady = true;
      if (project.value) await loadRuns(run?.id || (stored.project_id === project.value ? stored.run_id : ''));
      if (!run) tell('Choose a project, enter a brief and edit the node tasks.');
    } catch(error) { projectsReady = false; tell('Backend unavailable: ' + error.message,true); }
    sync();
  }
  project.addEventListener('change', async () => {
    if (busy) return;
    run = null; clearStatuses(); renderAll(); renderInspector(); remember(); sync();
    try { if (project.value) await loadRuns(); } catch(error) { tell(error.message,true); }
  });
  runs.addEventListener('change', () => {
    if (runs.value) loadRun(runs.value,true); else newDraft();
  });
  brief.addEventListener('input',remember);

  async function start() {
    if (busy || run) return;
    if (!project.value || !brief.value.trim()) { tell('Select a project and enter the workflow brief.',true); return; }
    let plan;
    try { plan = validateEdData({nodes:ED.nodes,edges:ED.edges}); }
    catch(error) { tell(error.message,true); return; }
    busy = true; sync(); tell('Submitting real workflow…');
    try {
      const data = await api('workflows/run',{project_id:project.value,brief:brief.value.trim(),plan,request_id:requestId});
      paint(data,true);
    } catch(error) { tell('Run not confirmed: ' + error.message + '\nRefresh runs before trying again. No execution result was substituted.',true); }
    finally { busy = false; sync(); }
  }
  async function action(name,extra={}) {
    if (busy || !run) return;
    busy = true; sync();
    try { paint(await api('workflows/action',{run_id:run.id,action:name,...extra})); }
    catch(error) { tell('Action not confirmed: ' + error.message,true); }
    finally { busy = false; sync(); }
  }
  for (const [id,fn] of [
    ['ebtnRun',start],['ebtnPause',()=>action('pause')],
    ['ebtnResume',()=>action('resume')],['ebtnStop',()=>action('stop')]
  ]) {
    document.getElementById(id).addEventListener('click',event => {
      event.preventDefault(); event.stopImmediatePropagation(); fn();
    },true);
  }

  function inspector() {
    if (insBody.contains(document.activeElement) && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    insBody.replaceChildren();
    if (!edSel) { insBody.append(el('p','Select a node to edit its task or read its real result.')); return; }
    if (edSel.type === 'edge') {
      const edge = ED.edges.find(e => e.id === edSel.id); if (!edge) return;
      insBody.append(el('strong','Connection: ' + edge.from + ' → ' + edge.to));
      const input = style(el('textarea')); input.value = edge.message || ''; input.maxLength = 2000; input.rows = 3; input.disabled = locked();
      input.setAttribute('aria-label','Handoff description');
      input.addEventListener('input',()=>{edge.message=input.value; saveEd();});
      insBody.append(input);
      if (!locked()) insBody.append(button('Remove connection',()=>askDeleteEdge(edge.id)));
      return;
    }
    const node = nodeById(edSel.id); if (!node) return;
    const state = run?.nodes[node.id];
    insBody.append(el('h3',node.kind === 'trigger' ? 'START PULSE' : node.kind === 'approval' ? 'TARA APPROVAL' : AGENTS[node.agent].name));
    insBody.append(el('p','State: ' + (state?.status || 'Draft — not executed')));
    if (node.kind === 'agent') {
      const input = style(el('textarea')); input.rows = 5; input.maxLength = 4000;
      input.value = node.task?.title || ''; input.disabled = locked();
      input.setAttribute('aria-label','Task instructions'); input.style.width = '100%';
      input.addEventListener('input',()=>{
        node.task ||= {status:'pending',progress:0}; node.task.title=input.value; saveEd();
      });
      insBody.append(el('p','Task instructions'),input);
      if (node.agent === 'nyxar') {
        const profile = style(el('select'));
        profile.add(new Option('General — Qwen','general'));
        profile.add(new Option('Code & Security — Qwen Coder','code_security'));
        profile.value = node.task?.model_profile || 'general'; profile.disabled = locked();
        profile.setAttribute('aria-label','Nyxar model profile');
        profile.addEventListener('change',()=>{node.task ||= {title:'',status:'pending',progress:0}; node.task.model_profile=profile.value; saveEd();});
        insBody.append(profile);
      }
      if (state?.model_used) insBody.append(el('p','Model: ' + state.model_used));
    }
    if (state?.error) { const error=el('p',state.error); error.style.color='#fca5a5'; insBody.append(error); }
    if (state?.result) {
      const text=el('div',state.result); text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0';
      insBody.append(text,button('Copy result',()=>copy(state.result)));
    }
    if (state?.status === 'error') insBody.append(button('Retry real task',()=>action('retry',{node_id:node.id})));
    if (node.kind === 'approval' && state?.status === 'waiting_approval') {
      // NOXIS_UPSTREAM_REVIEW_V1
      const ancestors = new Set(), pending = [node.id];
      while (pending.length) {
        const current = pending.pop();
        for (const edge of run.plan.edges) {
          if (edge.to === current && !ancestors.has(edge.from)) {
            ancestors.add(edge.from);
            pending.push(edge.from);
          }
        }
      }
      const parents = [...ancestors].map(id=>run.nodes[id])
        .filter(n=>n && n.kind==='agent' && n.status==='done');
      for (const parent of parents) {
        const details=el('details'), summary=el('summary',(parent.agent || parent.id).toUpperCase() + ' result');
        const text=el('div',parent.result || 'No text result'); text.style.whiteSpace='pre-wrap';
        details.append(summary,text); insBody.append(details);
      }
      const input=style(el('textarea')); input.rows=3; input.maxLength=2000; input.placeholder='Review notes / correction instructions'; input.value=notes[node.id] || '';
      input.setAttribute('aria-label','Tara review notes'); input.addEventListener('input',()=>{notes[node.id]=input.value;});
      const target=style(el('select')); target.setAttribute('aria-label','Agent to correct');
      for (const parent of parents.filter(n=>n.kind==='agent')) target.add(new Option(parent.agent.toUpperCase() + ' · ' + parent.id,parent.id));
      insBody.append(input,
        button('Approve this gate',()=>action('approve',{node_id:node.id,notes:input.value})),target,
        button('Request correction',()=>action('correct',{node_id:node.id,target_id:target.value,notes:input.value})),
        el('p','Approval continues this workflow. It does not publish or sell content.'));
    }
    if (!locked() && !isProtected(node)) insBody.append(button('Remove node',()=>askDeleteNode(node.id)));
  }
  function guard(event) {
    if (!locked()) return;
    if (event.target.closest('#epalette, [data-del], [data-ins-del], [data-ins-deledge], .edel, .port')) {
      event.preventDefault(); event.stopImmediatePropagation();
      tell('This run uses a saved plan. Start a new draft after it finishes or is stopped.',true);
    }
  }
  document.addEventListener('pointerdown',guard,true);
  document.addEventListener('click',guard,true);
  document.addEventListener('keydown',event=>{
    if (locked() && ['Delete','Backspace'].includes(event.key) && !event.target.closest('input,textarea')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
    if (event.target.closest('#einsBody input,#einsBody textarea,#einsBody select,#liveWorkflowProject') || panel.contains(event.target)) event.stopPropagation();
  },true);

  window.NoxisWorkflowLive = {renderInspector:inspector,sync,
    approve:id=>action('approve',{node_id:id}),
    retry:id=>action('retry',{node_id:id}),
    correct:id=>{edSel={type:'node',id}; inspector();},
    exportMeta:()=>({project_id:project.value,brief:brief.value}),
    importMeta:data=>{if (typeof data.brief === 'string') brief.value=data.brief; remember();}
  };
  for (const node of ED_DEFAULTS.nodes) {
    if (node.task) { node.task.status='pending'; node.task.progress=0; delete node.task.result; delete node.task.error; }
  }
  stopTimer(); clearStatuses(); renderAll(); renderInspector(); sync(); loadProjects();
  setInterval(()=>{if (!document.hidden && run && !busy) loadRun(run.id);},2500);
})();
