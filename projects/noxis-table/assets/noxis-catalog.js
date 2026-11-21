
/* NOXIS — persistent project catalog with backend-generated IDs */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/catalog';
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let selectedProject = null;
  let editing = null;
  let token = null;
  let busy = false;
  let sequence = 0;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'arenCatalogTitle');
  dialog.style.cssText =
    'margin:auto;width:min(800px,94vw);max-height:88vh;overflow:auto;padding:22px;' +
    'border:1px solid #63558b;border-radius:16px;background:#100d2b;color:#e5e7eb';
  dialog.innerHTML = `
    <h2 id="arenCatalogTitle">AREN — Catalog & IDs</h2>
    <p data-project style="margin:10px 0"></p>
    <p>Saved locally in the web backend. Catalog status does not publish or sell anything.</p>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <button type="button" data-new>New entry</button>
      <button type="button" data-refresh>Refresh catalog</button>
      <button type="button" data-close>Close</button>
    </div>
    <form style="display:grid;gap:10px">
      <p data-id>New entry — ID assigned on save.</p>
      <label>Title<input name="title" maxlength="200" required></label>
      <label>Creation type<select name="kind">
        <option value="music">Music</option><option value="book">Book</option>
        <option value="software">Software</option><option value="skill">Skill</option>
        <option value="image">Image</option><option value="video">Video</option>
        <option value="other" selected>Other</option>
      </select></label>
      <label>Author / creator<input name="creator" value="Tara Noxis" maxlength="200" required></label>
      <label>Status<select name="status">
        <option value="undecided">Undecided</option><option value="free">Free</option>
        <option value="for_sale">For sale</option><option value="archived">Archived</option>
      </select></label>
      <label>Price<input name="price" type="number" min="0" max="999999999" step="0.01"></label>
      <label>Currency<input name="currency" value="EUR" pattern="[A-Z]{3}" maxlength="3" required></label>
      <label>File / source reference<input name="reference" maxlength="1000"></label>
      <label>Notes<textarea name="notes" rows="3" maxlength="2000"></textarea></label>
      <button type="submit">Save catalog entry</button>
      <div role="status" data-feedback></div>
    </form>
    <h3 style="margin:20px 0 10px">Project catalog</h3>
    <div data-entries></div>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const feedback = dialog.querySelector('[data-feedback]');
  const idLabel = dialog.querySelector('[data-id]');
  const entries = dialog.querySelector('[data-entries]');
  for (const el of dialog.querySelectorAll('input,textarea,select,button')) {
    el.style.cssText =
      'padding:9px;background:#17152e;color:#e5e7eb;border:1px solid #63558b;border-radius:8px';
    if (el.tagName !== 'BUTTON') {
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.boxSizing = 'border-box';
    }
  }

  function reset() {
    form.reset();
    editing = null;
    token = crypto.randomUUID();
    feedback.textContent = '';
    idLabel.textContent = 'New entry — ID assigned on save.';
  }

  function edit(entry) {
    if (busy) return;
    editing = entry;
    for (const name of ['title','kind','creator','status','price','currency','reference','notes']) {
      field(name).value = entry[name] ?? '';
    }
    idLabel.textContent = entry.id + ' · Version ' + entry.version;
    feedback.textContent = '';
    idLabel.scrollIntoView({block:'nearest'});
  }

  async function load() {
    const request = ++sequence;
    const selected = selectedProject;
    entries.textContent = 'Loading catalog…';
    try {
      const response = await fetch(API, {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid catalog');
      if (request !== sequence || selected !== projectId() || !dialog.open) return;
      const visible = data.filter(e => e.project_id === selected);
      entries.replaceChildren();
      if (!visible.length) entries.textContent = 'No catalog entries in this project.';
      for (const entry of visible) {
        const card = document.createElement('section');
        card.style.cssText =
          'padding:12px;border:1px solid #494078;border-radius:8px;margin:10px 0;overflow-wrap:anywhere';
        const heading = document.createElement('strong');
        heading.textContent = entry.title;
        const info = document.createElement('p');
        info.style.whiteSpace = 'pre-wrap';
        info.textContent =
          `${entry.id}\n${entry.kind} · ${entry.status} · ${entry.creator}\n` +
          (entry.price === null ? 'Price undecided' : `${entry.price} ${entry.currency}`);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tbtn';
        button.textContent = 'Edit entry';
        button.addEventListener('click', () => edit(entry));
        card.append(heading,info,button);
        entries.appendChild(card);
      }
    } catch (error) {
      if (request === sequence) entries.textContent = 'Catalog unavailable: ' + error.message;
    }
  }

  function open() {
    if (busy) return;
    selectedProject = projectId();
    if (!selectedProject) {
      window.alert('Select an active project first.');
      return;
    }
    reset();
    dialog.querySelector('[data-project]').textContent = 'Project: ' +
      document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent;
    if (!dialog.open) dialog.showModal();
    load();
  }
  dialog.querySelector('[data-new]').addEventListener('click', () => { if (!busy) reset(); });
  dialog.querySelector('[data-refresh]').addEventListener('click', () => { if (!busy) load(); });
  dialog.querySelector('[data-close]').addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (selectedProject !== projectId()) {
      feedback.textContent = 'Project changed. Close and reopen Catalog.';
      return;
    }
    const payload = {project_id:selectedProject};
    for (const name of ['title','kind','creator','status','price','currency','reference','notes']) {
      payload[name] = field(name).value.trim();
    }
    if (editing) {
      payload.id = editing.id;
      payload.expected_version = editing.version;
    } else {
      payload.request_id = token;
    }
    busy = true;
    const controls = [...dialog.querySelectorAll('input,textarea,select,button')];
    controls.forEach(el => el.disabled = true);
    feedback.textContent = 'Saving catalog entry…';
    try {
      const response = await fetch(API, {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(
        response.status === 409 ? 'Entry changed; refresh and reopen it'
        : response.status === 400 ? 'Check required fields and price: Free requires 0; For sale requires a positive price'
        : 'HTTP ' + response.status
      );
      const saved = await response.json();
      if (typeof saved.id !== 'string' || saved.project_id !== selectedProject) {
        throw new Error('Unexpected confirmation');
      }
      editing = saved;
      idLabel.textContent = saved.id + ' · Version ' + saved.version;
      feedback.textContent = 'Saved. ID preserved for future edits.';
      await load();
    } catch (error) {
      feedback.textContent = 'Save not confirmed: ' + error.message + '. Check the catalog before retrying.';
    } finally {
      busy = false;
      controls.forEach(el => el.disabled = false);
    }
  });

  function connect(body) {
    for (const tag of body.querySelectorAll('span')) {
      if (!['NOXIS ID assignment','Catalog management'].includes(tag.textContent.trim())) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tag.textContent;
      button.style.cssText = tag.style.cssText;
      button.style.background = '#17152e';
      button.style.color = '#e5e7eb';
      button.style.cursor = 'pointer';
      button.addEventListener('click', open);
      tag.replaceWith(button);
    }
  }
  window.NoxisCatalog = {connect};
})();
