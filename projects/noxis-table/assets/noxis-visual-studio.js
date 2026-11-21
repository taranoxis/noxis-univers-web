
/* NOXIS — Nyxin visual planning; no image/video engine attached */
(() => {
  'use strict';
  const operations = {
    'Covers':
      'Pregateste o singura idee concisa de coperta si un prompt scurt. Restrictiile explicite ale Tarei au prioritate fata de conventiile copertelor. Daca se cere fara text, exclude complet titlul, literele si tipografia din imagine. Nu inventa titluri cand campul de titlu este gol. Respecta exact numele si identitatile furnizate.',
    'Images':
      'Pregateste conceptul unei imagini si un prompt clar: subiect, compozitie, lumina, culori si stil. Diferentiaza cerintele Tarei de propunerile tale.',
    'Videos':
      'Pregateste un storyboard scurt: scene, miscare, tranzitii si durate orientative. Tine cont de calculatorul disponibil. Nu promite randare sau generare efectiva.',
    'Visual assets':
      'Pregateste specificatii pentru materialele vizuale cerute: scop, dimensiuni, compozitie, fundal, variante si denumiri propuse. Nu pretinde ca fisierele exista.'
  };
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let selectedProject = null;
  let busy = false;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'nyxinStudioTitle');
  dialog.style.cssText =
    'margin:auto;width:min(760px,94vw);max-height:88vh;overflow:auto;padding:22px;' +
    'border:1px solid #63558b;border-radius:16px;background:#100d2b;color:#e5e7eb';
  dialog.innerHTML = `
    <form style="display:grid;gap:12px">
      <h2 id="nyxinStudioTitle">NYXIN — Visual studio</h2>
      <p data-project></p>
      <p>Concepts, prompts and storyboards. Image and video generation is not connected.</p>
      <label>Function<select name="operation"></select></label>
      <label>Title / subject<input name="title" maxlength="200"></label>
      <label>Creative brief
        <textarea name="brief" rows="6" maxlength="5000" required
          placeholder="Describe the idea, mood, content and intended use…"></textarea>
      </label>
      <label>Format / dimensions
        <input name="format" maxlength="120"
          placeholder="For example: square cover, 1:1, 1600 × 1600">
      </label>
      <label>Constraints and reference descriptions
        <textarea name="constraints" rows="3" maxlength="1500"
          placeholder="Identity, colours, text, things to preserve or avoid…"></textarea>
      </label>
      <label>Target tool / hardware
        <input name="tool" maxlength="200"
          placeholder="Optional: target program and available hardware">
      </label>
      <label>Prompt language<input name="language" value="English" maxlength="80" required></label>
      <p>Discussion and explanations stay in Romanian unless requested otherwise.
      Describe references here; this form does not upload images.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="submit">Record request</button>
        <button type="button" data-close>Close</button>
      </div>
      <div role="status" data-feedback></div>
    </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const save = form.querySelector('[type="submit"]');
  const close = form.querySelector('[data-close]');
  const feedback = form.querySelector('[data-feedback]');

  for (const name of Object.keys(operations)) {
    field('operation').add(new Option(name, name));
  }
  for (const el of form.querySelectorAll('input,textarea,select')) {
    el.style.cssText =
      'display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:10px;' +
      'background:#17152e;color:#e5e7eb;border:1px solid #63558b;border-radius:8px';
  }
  for (const el of [save,close]) {
    el.style.cssText =
      'padding:10px;background:#17152e;color:#e5e7eb;' +
      'border:1px solid #63558b;border-radius:8px;cursor:pointer';
  }
  close.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });

  function open(name) {
    if (busy) return;
    selectedProject = projectId();
    if (!selectedProject) {
      window.alert('Select an active project first.');
      return;
    }
    field('operation').value = name;
    feedback.textContent = '';
    save.disabled = false;
    save.textContent = 'Record request';
    form.querySelector('[data-project]').textContent = 'Project: ' +
      document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent;
    if (!dialog.open) dialog.showModal();
    field('brief').focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || save.disabled) return;
    if (selectedProject !== projectId()) {
      feedback.textContent = 'Project changed. Close and reopen Visual studio.';
      return;
    }
    const brief = field('brief').value.trim();
    const language = field('language').value.trim();
    if (!brief || !language) {
      feedback.textContent = 'Enter a creative brief and prompt language.';
      return;
    }
    const content =
      'NYXIN VISUAL STUDIO · ' + field('operation').value + '\n' +
      operations[field('operation').value] +
      '\nTitlu / subiect: ' + field('title').value.trim() +
      '\nCerinta creativa:\n' + brief +
      '\nFormat / dimensiuni: ' + field('format').value.trim() +
      '\nRestrictii si descrieri ale referintelor:\n' +
      field('constraints').value.trim() +
      '\nInstrument si hardware tinta: ' + field('tool').value.trim() +
      '\nScrie prompturile in: ' + language +
      '\nFORMAT DE RASPUNS: doua sectiuni separate.'
      + '\n1. Concept: explicatie scurta in romana, fara repetitii.'
      + '\n2. Production prompt: scris integral in limba indicata la Scrie prompturile in.'
      + '\nInainte de raspuns verifica respectarea fiecarei restrictii. Nu adauga elemente interzise.' +
      '\nNu ai primit fisiere de referinta prin acest formular. ' +
      'Nu pretinde ca ai vazut imagini, generat fisiere, randat video ' +
      'sau verificat instrumente online. Cere clarificari daca lipsesc date esentiale. ' +
      'Pastreaza raspunsul concentrat si practic.';
    if (content.length > 12000) {
      feedback.textContent = 'Request too long. Shorten the brief.';
      return;
    }
    busy = true;
    const controls = [...form.querySelectorAll('input,textarea,select,button')];
    controls.forEach(el => el.disabled = true);
    feedback.textContent = 'Recording request…';
    let recorded = false;
    try {
      const response = await fetch('http://127.0.0.1:8765/api/messages', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          sender:'tara',receiver:'nyxin',project_id:selectedProject,content
        })
      });
      if (response.status !== 201) throw new Error('HTTP ' + response.status);
      const saved = await response.json();
      if (saved.status !== 'recorded' || saved.receiver !== 'nyxin' ||
          saved.project_id !== selectedProject) throw new Error('Unexpected confirmation');
      recorded = true;
      save.textContent = 'Request recorded';
      feedback.textContent =
        'Recorded: TARA → NYXIN. Process it in Activity; read the reply in Conversations.';
      document.dispatchEvent(new Event('noxis-messages-updated'));
      window.NoxisLivePanel?.refreshPanel();
    } catch (error) {
      feedback.textContent =
        'Not confirmed: ' + error.message + '. Check Activity before retrying.';
    } finally {
      busy = false;
      controls.forEach(el => el.disabled = false);
      save.disabled = recorded;
    }
  });

  function connect(body) {
    for (const tag of body.querySelectorAll('span')) {
      const name = tag.textContent.trim();
      if (!Object.hasOwn(operations, name)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.style.cssText = tag.style.cssText;
      button.style.background = '#17152e';
      button.style.color = '#e5e7eb';
      button.style.cursor = 'pointer';
      button.addEventListener('click', () => open(name));
      tag.replaceWith(button);
    }
  }
  window.NoxisVisualStudio = {connect};
})();
