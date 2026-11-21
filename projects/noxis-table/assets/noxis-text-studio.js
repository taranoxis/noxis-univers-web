
/* NOXIS — AR_IN text studio */
(() => {
  'use strict';
  const operations = {
    'Lyrics':'Creeaza sau revizuieste versuri dupa cerinta Tarei. Pastreaza sensul si vocea autoarei. Nu pretinde ca ai generat muzica.',
    'Books':'Lucreaza editorial pe fragmentul, planul sau cerinta furnizata. Nu inventa continut despre restul cartii.',
    'Translations':'Tradu textul in limba tinta ceruta. Pastreaza sensul, tonul si numele. Respecta alegerea dintre traducere fidela si adaptare cantabila.',
    'Corrections':'Corecteaza ortografia, gramatica si punctuatia. Pastreaza sensul si stilul autoarei. Returneaza textul corectat si explica pe scurt modificarile.',
    'Text preparation':'Structureaza si pregateste textul conform cerintei. Nu adauga fapte sau continut lipsa fara sa le marchezi ca propuneri.'
  };
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let project = null;
  let busy = false;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'arInStudioTitle');
  dialog.style.cssText =
    'margin:auto;width:min(760px,94vw);max-height:88vh;overflow:auto;padding:22px;' +
    'border:1px solid #63558b;border-radius:16px;background:#100d2b;color:#e5e7eb';
  dialog.innerHTML = `
    <form style="display:grid;gap:12px">
      <h2 id="arInStudioTitle">AR_IN — Text studio</h2>
      <p data-project></p>
      <label>Function<select name="operation"></select></label>
      <label>Source language<input name="sourceLanguage" value="Romanian" maxlength="80" required></label>
      <label>Output / target language<input name="targetLanguage" value="Romanian" maxlength="80" required></label>
      <label>Text or brief
        <textarea name="source" rows="8" maxlength="8000" required
          placeholder="Paste your text or describe your request…"></textarea>
      </label>
      <label>Additional instructions
        <textarea name="instructions" rows="3" maxlength="1000"
          placeholder="Tone, structure, faithful translation or singable adaptation…"></textarea>
      </label>
      <p>Records a request. Process it in Activity; read the saved reply in Conversations.</p>
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
      'padding:10px;background:#17152e;color:#e5e7eb;border:1px solid #63558b;' +
      'border-radius:8px;cursor:pointer';
  }
  close.addEventListener('click', () => { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });

  function open(operation) {
    if (busy) return;
    project = projectId();
    if (!project) {
      window.alert('Select an active project first.');
      return;
    }
    field('operation').value = operation;
    feedback.textContent = '';
    save.disabled = false;
    save.textContent = 'Record request';
    form.querySelector('[data-project]').textContent = 'Project: ' +
      document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent;
    if (!dialog.open) dialog.showModal();
    field('source').focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || save.disabled) return;
    if (project !== projectId()) {
      feedback.textContent = 'Project changed. Close and reopen Text studio.';
      return;
    }
    const operation = field('operation').value;
    const source = field('source').value.trim();
    const sourceLanguage = field('sourceLanguage').value.trim();
    const targetLanguage = field('targetLanguage').value.trim();
    if (!source || !sourceLanguage || !targetLanguage) {
      feedback.textContent = 'Enter your text and both languages.';
      return;
    }
    const content =
      'AR_IN TEXT STUDIO · ' + operation + '\n' + operations[operation] +
      '\nLimba sursa: ' + sourceLanguage +
      '\nLimba materialului rezultat: ' + targetLanguage +
      '\nExplicatiile raman in romana, daca Tara nu cere explicit altfel.' +
      '\n\nText sau cerinta:\n' + source +
      '\n\nInstructiuni suplimentare de la Tara:\n' +
      field('instructions').value.trim() +
      '\n\nPastreaza explicatiile scurte. Nu pretinde actiuni neefectuate.';
    if (content.length > 12000) {
      feedback.textContent = 'Use a shorter text excerpt.';
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
          sender:'tara',receiver:'ar_in',project_id:project,content
        })
      });
      if (response.status !== 201) throw new Error('HTTP ' + response.status);
      const saved = await response.json();
      if (saved.status !== 'recorded' || saved.receiver !== 'ar_in' ||
          saved.project_id !== project) throw new Error('Unexpected confirmation');
      recorded = true;
      save.textContent = 'Request recorded';
      feedback.textContent =
        'Recorded: TARA → AR_IN. Process this message in Activity.';
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
  window.NoxisTextStudio = {connect};
})();
