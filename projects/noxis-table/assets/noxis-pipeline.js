
/* NOXIS — pipeline navigation; saved progress stays separate */
(() => {
  'use strict';
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let sequence = 0;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'pipelinePanelTitle');
  dialog.style.cssText =
    'margin:auto;width:min(650px,94vw);max-height:88vh;overflow:auto;padding:22px;' +
    'background:#100d2b;color:#e5e7eb;border:1px solid #63558b;border-radius:16px';
  const title = document.createElement('h2');
  title.id = 'pipelinePanelTitle';
  const output = document.createElement('div');
  output.style.cssText = 'display:grid;gap:12px;margin:14px 0';
  const close = makeButton('Close', () => dialog.close());
  dialog.append(title,output,close);
  document.body.appendChild(dialog);

  function makeButton(text, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText =
      'padding:11px;background:#17152e;color:#e5e7eb;' +
      'border:1px solid #63558b;border-radius:8px;cursor:pointer';
    b.addEventListener('click', action);
    return b;
  }

  function openAgent(key, actionLabel) {
    if (!projectId()) return;
    const card = document.querySelector('#uAgents .acard[data-agent="' + key + '"]');
    if (!card) {
      window.alert('Agent card unavailable.');
      return;
    }
    if (dialog.open) dialog.close();
    card.click();
    if (actionLabel) {
      const action = [...document.querySelectorAll('#uDBody button')]
        .find(b => b.textContent.trim() === actionLabel);
      if (action) action.click();
      else window.alert('Agent action unavailable.');
    }
  }

  async function open(stage) {
    const selected = projectId();
    if (!selected) {
      window.alert('Select an active project first.');
      return;
    }

    if (stage === 'review') {
      document.getElementById('uDClose')?.click();
      window.NoxisReview?.open();
      return;
    }
    if (stage === 'publish') {
      document.getElementById('uDClose')?.click();
      window.NoxisDecisions?.open();
      return;
    }
    if (stage === 'collaboration') {
      openAgent('nyxar', 'Coordinate the other agents');
      return;
    }

    const request = ++sequence;
    output.replaceChildren();
    title.textContent = stage === 'creation' ? 'NOXIS — Creation' : 'NOXIS — Project idea';
    if (!dialog.open) dialog.showModal();

    if (stage === 'creation') {
      const note = document.createElement('p');
      note.textContent = 'Choose an agent, then a function in Capabilities.';
      output.append(
        note,
        makeButton('AR_IN — Lyrics, books and translations', () => openAgent('ar_in')),
        makeButton('NYXIN — Visual concepts and storyboards', () => openAgent('nyxin')),
        makeButton('AREN — Catalog & IDs', () => openAgent('aren', 'Catalog management'))
      );
      return;
    }

    output.textContent = 'Loading project…';
    try {
      const response = await fetch('http://127.0.0.1:8765/api/projects', {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const projects = await response.json();
      if (!Array.isArray(projects)) throw new Error('Invalid project registry');
      if (request !== sequence || !dialog.open) return;
      if (selected !== projectId()) {
        output.textContent = 'Project changed. Close and reopen Idea.';
        return;
      }
      const project = projects.find(p => p.id === selected);
      if (!project) throw new Error('Project not found');
      output.replaceChildren();
      for (const [label, value] of [
        ['Name', project.name],
        ['Description', project.description],
        ['Goal', project.goal],
        ['Saved stage', project.stage],
        ['Status', project.status]
      ]) {
        const section = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = label;
        const text = document.createElement('p');
        text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin-top:5px';
        text.textContent = value || 'Not specified';
        section.append(heading,text);
        output.appendChild(section);
      }
    } catch (error) {
      if (request === sequence) output.textContent = 'Project unavailable: ' + error.message;
    }
  }

  for (const item of document.querySelectorAll('#uPipe .stage-i')) {
    item.setAttribute('role', 'button');
    item.tabIndex = 0;
    item.setAttribute('aria-label', 'Open ' + item.dataset.s);
    item.title = 'Open section — does not change saved project progress';
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        open(item.dataset.s);
      }
    });
  }
  const publish = document.getElementById('uPub');
  if (publish) {
    publish.title = 'Open Tara’s saved publishing, selling and archiving decisions';
    publish.setAttribute('aria-label', 'Open publishing decisions');
  }
  window.NoxisPipeline = {open};
})();
