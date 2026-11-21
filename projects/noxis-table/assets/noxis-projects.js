/* NOXIS — projects and goals */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/projects';
  const select = document.getElementById('noxisProjectSelect');
  if (!select) return;

  let projects = [];
  let stageRequest = 0;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'projectFormTitle');
  dialog.style.cssText =
    'margin:auto;width:min(560px,92vw);max-height:90vh;overflow:auto;' +
    'padding:24px;border:1px solid #63558b;border-radius:16px;' +
    'background:#100d2b;color:#e5e7eb;';
  dialog.innerHTML = `
    <form id="noxisProjectForm" style="display:grid;gap:14px">
      <h2 id="projectFormTitle">Create project & goals</h2>
      <label>Name
        <input name="name" required maxlength="200"
          style="display:block;width:100%;box-sizing:border-box">
      </label>
      <label>Description
        <textarea name="description" maxlength="4000" rows="4"
          style="display:block;width:100%;box-sizing:border-box"></textarea>
      </label>
      <label>Goal
        <textarea name="goal" maxlength="2000" rows="3"
          style="display:block;width:100%;box-sizing:border-box"></textarea>
      </label>
      <div style="display:flex;gap:10px">
        <button type="submit">Create project</button>
        <button type="button" data-cancel>Cancel</button>
      </div>
      <div role="status" data-feedback></div>
    </form>`;
  document.body.appendChild(dialog);

  for (const el of dialog.querySelectorAll('input, textarea, button')) {
    Object.assign(el.style, {
      background:'#17152e', color:'#e5e7eb',
      border:'1px solid #63558b', borderRadius:'8px', padding:'10px'
    });
  }

  const form = dialog.querySelector('form');
  const save = form.querySelector('[type="submit"]');
  const cancel = form.querySelector('[data-cancel]');
  const feedback = form.querySelector('[data-feedback]');
  let saving = false;

  function applyStage() {
    const project = projects.find(p => p.id === select.value);
    window.NoxisSetProjectStage?.(project?.stage || null);
  }

  async function loadProjects(preferred = select.value) {
    select.disabled = true;
    try {
      const response = await fetch(API, {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid project registry');
      projects = data.filter(p =>
        typeof p.id === 'string' && typeof p.name === 'string');
      select.replaceChildren(new Option('No project selected', ''));
      for (const project of projects) {
        select.add(new Option(project.name, project.id));
      }
      select.value = projects.some(p => p.id === preferred) ? preferred : '';
      select.disabled = false;
      select.dispatchEvent(new Event('change'));
      return true;
    } catch (error) {
      select.replaceChildren(new Option('Projects unavailable', ''));
      feedback.textContent = 'Unable to load projects: ' + error.message;
      window.NoxisSetProjectStage?.(null);
      return false;
    }
  }

  select.addEventListener('change', async () => {
    const request = ++stageRequest;
    const id = select.value;
    applyStage();
    if (!id) return;
    try {
      const response = await fetch(API, {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid project registry');
      if (request !== stageRequest || select.value !== id) return;
      projects = data;
      applyStage();
    } catch (error) {
      if (request === stageRequest) {
        window.NoxisSetProjectStage?.(null);
      }
      console.error('NOXIS project stage:', error);
    }
  });

  function openCreate() {
    if (dialog.open) return;
    form.reset();
    feedback.textContent = '';
    dialog.showModal();
    form.elements.namedItem('name').focus();
  }

  cancel.addEventListener('click', () => {
    if (!saving) dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (saving) event.preventDefault();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const name = form.elements.namedItem('name').value.trim();
    if (!name) {
      feedback.textContent = 'Enter a project name.';
      return;
    }
    const payload = {
      name,
      description: form.elements.namedItem('description').value.trim(),
      goal: form.elements.namedItem('goal').value.trim()
    };
    saving = true;
    save.disabled = cancel.disabled = true;
    feedback.textContent = 'Creating project…';
    try {
      const response = await fetch(API, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if (response.status !== 201) throw new Error('HTTP ' + response.status);
      const project = await response.json();
      if (typeof project.id !== 'string') {
        throw new Error('Invalid server confirmation');
      }
      if (!await loadProjects(project.id)) {
        feedback.textContent =
          'Project saved, but the list could not refresh. Reload the page; do not create it again.';
        return;
      }
      dialog.close();
    } catch (error) {
      feedback.textContent =
        'Creation not confirmed: ' + error.message +
        '. Check the project list before trying again.';
    } finally {
      saving = false;
      save.disabled = cancel.disabled = false;
    }
  });

  document.getElementById('noxisNewProject')?.addEventListener('click', openCreate);
  window.NoxisProjects = {openCreate, refresh:loadProjects};
  loadProjects();
})();
