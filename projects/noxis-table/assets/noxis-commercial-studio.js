
/* NOXIS — Nyxer commercial planning using supplied information */
(() => {
  'use strict';
  const operations = {
    'Pricing':
      'Analizeaza pretul sau costul produsului descris. Arata ipotezele, costurile incluse si formulele folosite. Nu confunda venitul cu profitul. Daca lipsesc date esentiale, cere-le; nu inventa sume.',
    'Market evaluation':
      'Evalueaza publicul, nevoia, alternativele si diferentierea pe baza datelor furnizate. Separa faptele de ipoteze. Identifica ce trebuie cercetat ulterior.',
    'Distribution analysis':
      'Analizeaza optiunile de distributie descrise: formate, public, costuri cunoscute, efort si limite. Nu inventa comisioane, conditii sau disponibilitatea platformelor.',
    'Commercial strategy':
      'Propune pasi comerciali mici, ordonati si masurabili, adaptati obiectivului si resurselor date. Nu promite vanzari sau profit. Precizeaza ipotezele si datele lipsa.'
  };
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let selectedProject = null;
  let busy = false;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'nyxerStudioTitle');
  dialog.style.cssText =
    'margin:auto;width:min(760px,94vw);max-height:88vh;overflow:auto;padding:22px;' +
    'border:1px solid #63558b;border-radius:16px;background:#100d2b;color:#e5e7eb';
  dialog.innerHTML = `
    <form style="display:grid;gap:12px">
      <h2 id="nyxerStudioTitle">NYXER — Commercial studio</h2>
      <p data-project></p>
      <p>Analysis of information you supply. Live market search is not connected.</p>
      <label>Function<select name="operation"></select></label>
      <label>Product / service / purchase
        <input name="subject" maxlength="200" required
          placeholder="What are we evaluating, buying or selling?">
      </label>
      <label>Goal and question
        <textarea name="brief" rows="4" maxlength="2500" required
          placeholder="Explain what you want Nyxer to assess…"></textarea>
      </label>
      <label>Known facts and figures
        <textarea name="facts" rows="5" maxlength="3000"
          placeholder="Prices, quantities, formats, audience, alternatives…"></textarea>
      </label>
      <label>Costs, budget and constraints
        <textarea name="resources" rows="3" maxlength="1500"
          placeholder="Available budget, time, hardware and limits. Mark estimates clearly."></textarea>
      </label>
      <label>Currency<input name="currency" value="EUR" maxlength="40"></label>
      <label>Source excerpts, links and dates
        <textarea name="sources" rows="3" maxlength="1500"
          placeholder="Paste relevant source information. Links alone are not fetched."></textarea>
      </label>
      <p>The reply is in Romanian unless you request another language.
      No purchases, payments or publications are performed.</p>
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
    field('subject').focus();
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || save.disabled) return;
    if (selectedProject !== projectId()) {
      feedback.textContent = 'Project changed. Close and reopen Commercial studio.';
      return;
    }
    if (!field('subject').value.trim() || !field('brief').value.trim()) {
      feedback.textContent = 'Enter the subject and your question.';
      return;
    }
    const operation = field('operation').value;
    const content =
      'NYXER COMMERCIAL STUDIO · ' + operation + '\n' +
      operations[operation] +
      '\nSubiect: ' + field('subject').value.trim() +
      '\nObiectiv si intrebare:\n' + field('brief').value.trim() +
      '\nDate furnizate de Tara, nu verificate independent:\n' +
      field('facts').value.trim() +
      '\nCosturi, buget si restrictii:\n' + field('resources').value.trim() +
      '\nMoneda: ' + field('currency').value.trim() +
      '\nSurse furnizate, fragmente si date:\n' + field('sources').value.trim() +
      '\nRaspunde in romana daca Tara nu cere explicit alta limba. ' +
      'Aceasta este o cerere independenta; nu importa cifre din alte sarcini. ' +
      'Nu ai instrument de cautare online in acest flux. Nu pretinde ca ai accesat linkuri. ' +
      'In NOXIS, skill software inseamna un pachet reutilizabil de instructiuni, ' +
      'eventual scripturi si resurse pentru un agent AI, nu o calificare profesionala. ' +
      'Pastreaza clara diferenta dintre cumparare si vanzare. ' +
      'Da o concluzie scurta, calculele necesare si informatiile lipsa. ' +
      'Nu inventa fonduri, preturi, surse sau actiuni efectuate.';
    if (content.length > 12000) {
      feedback.textContent = 'Request too long. Shorten the supplied material.';
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
          sender:'tara',receiver:'nyxer',project_id:selectedProject,content
        })
      });
      if (response.status !== 201) throw new Error('HTTP ' + response.status);
      const saved = await response.json();
      if (saved.status !== 'recorded' || saved.receiver !== 'nyxer' ||
          saved.project_id !== selectedProject) throw new Error('Unexpected confirmation');
      recorded = true;
      save.textContent = 'Request recorded';
      feedback.textContent =
        'Recorded: TARA → NYXER. Process it in Activity; read the reply in Conversations.';
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
  window.NoxisCommercialStudio = {connect};
})();
