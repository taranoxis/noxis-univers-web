
/* NOXIS — Nyxar's project coordination and textual quality review */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/';
  const keys = ['nyxar','ar_in','nyxin','nyxer','ar_on','aren'];
  let busy = false;
  let request = 0;
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;

  function styled(el) {
    el.style.cssText =
      'padding:9px;background:#17152e;color:#e5e7eb;border:1px solid #63558b;' +
      'border-radius:8px;max-width:100%';
    return el;
  }
  function button(text, action) {
    const el = styled(document.createElement('button'));
    el.type = 'button';
    el.textContent = text;
    el.addEventListener('click', action);
    return el;
  }
  const dialog = document.createElement('dialog');
  dialog.style.cssText =
    'margin:auto;padding:22px;width:min(740px,94vw);max-height:88vh;overflow:auto;' +
    'background:#100d2b;color:#e5e7eb;border:1px solid #63558b;border-radius:16px';
  const heading = document.createElement('h2');
  heading.id = 'nyxarToolsTitle';
  dialog.setAttribute('aria-labelledby', heading.id);
  const scope = document.createElement('p');
  scope.style.margin = '12px 0';
  const output = document.createElement('div');
  const close = button('Close', () => { if (!busy) dialog.close(); });
  close.style.marginTop = '14px';
  dialog.append(heading, scope, output, close);
  document.body.appendChild(dialog);
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });

  async function get(path) {
    const response = await fetch(API + path, {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid ' + path + ' registry');
    return data;
  }

  function conversations(agent) {
    dialog.close();
    document.getElementById('conversationAgentA').value = agent;
    document.getElementById('conversationAgentB').value = '*';
    document.getElementById('uDClose')?.click();
    document.getElementById('ubtnConversations')?.click();
  }

  async function open(mode) {
    if (busy) return;
    const seq = ++request;
    const selected = projectId();
    heading.textContent = mode === 'quality'
      ? 'NYXAR — Quality check' : 'NYXAR — Team coordination';
    scope.textContent = 'Project: ' +
      (document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent || 'none');
    if (!dialog.open) dialog.showModal();
    output.textContent = 'Loading…';
    if (!selected) {
      output.textContent = 'Select an active project first.';
      return;
    }
    try {
      const [messages, activities] = await Promise.all([
        get('messages'), get('activities')
      ]);
      if (seq !== request || !dialog.open || selected !== projectId()) return;
      const records = messages.filter(m => m.project_id === selected);
      const tasks = activities.filter(a => a.project_id === selected);
      output.replaceChildren();

      if (mode === 'quality') {
        const results = records.filter(m =>
          m.status === 'processed' &&
          keys.includes(m.receiver) && m.receiver !== 'nyxar' &&
          typeof m.reply === 'string' && m.reply.trim()
        ).reverse();
        if (!results.length) {
          output.textContent = 'No processed responses from other agents in this project.';
          return;
        }

        const intro = document.createElement('p');
        intro.textContent =
          'Choose a saved response. The review request is recorded for Nyxar; process it in Activity.';
        const label = document.createElement('label');
        label.textContent = 'Result to review';
        const select = styled(document.createElement('select'));
        select.style.display = 'block';
        select.style.width = '100%';
        select.setAttribute('aria-label', 'Result to review');
        for (const m of results) {
          select.add(new Option(
            `${m.receiver.toUpperCase()} · ${m.created_at || ''} · ${m.reply.slice(0,70)}`,
            m.id
          ));
        }
        const preview = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Read selected response';
        const text = document.createElement('div');
        text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0';
        preview.append(summary, text);
        const show = () => {
          text.textContent = results.find(m => m.id === select.value)?.reply || '';
        };
        select.addEventListener('change', show);
        show();

        const notes = styled(document.createElement('textarea'));
        notes.rows = 3;
        notes.maxLength = 2000;
        notes.placeholder = 'Optional review criteria…';
        notes.setAttribute('aria-label', 'Quality review criteria');
        notes.style.display = 'block';
        notes.style.width = '100%';
        notes.style.boxSizing = 'border-box';
        notes.style.margin = '12px 0';
        const feedback = document.createElement('div');
        feedback.setAttribute('role', 'status');

        const send = button('Record quality-check request', async () => {
          if (busy) return;
          if (selected !== projectId()) {
            feedback.textContent = 'Project changed. Reopen Quality check.';
            return;
          }
          const source = results.find(m => m.id === select.value);
          busy = true;
          close.disabled = send.disabled = select.disabled = notes.disabled = true;
          feedback.textContent = 'Recording request…';
          try {
            const response = await fetch(API + 'messages', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({
                sender:source.receiver,
                receiver:'nyxar',
                project_id:selected,
                source_message_id:source.id,
                content:
                  'Review this response for clarity, internal consistency, relevance, ' +
                  'unsupported claims and fit with the stated brief. ' +
                  'Give strengths, issues and concrete improvements. Reply in Romanian unless Tara explicitly requests another output language. ' +
                  'Distinguish textual assessment from checks requiring external tools. ' +
                  'Do not claim tests, file changes or external verification.\n' +
                  notes.value.trim()
              })
            });
            if (response.status !== 201) throw new Error('HTTP ' + response.status);
            const saved = await response.json();
            if (saved.status !== 'recorded' || saved.source_message_id !== source.id) {
              throw new Error('Unexpected confirmation');
            }
            feedback.textContent = 'Request recorded. Process the message to NYXAR in Activity.';
            send.textContent = 'Request recorded';
            document.dispatchEvent(new Event('noxis-messages-updated'));
            window.NoxisLivePanel?.refreshPanel();
          } catch (error) {
            feedback.textContent =
              'Not confirmed: ' + error.message + '. Check Activity before retrying.';
            send.disabled = false;
          } finally {
            busy = false;
            close.disabled = select.disabled = notes.disabled = false;
          }
        });
        label.appendChild(select);
        output.append(intro, label, preview, notes, send, feedback);
      } else {
        output.appendChild(button('Refresh overview', () => open('coordination')));
        const intro = document.createElement('p');
        intro.textContent =
          'Recorded task statuses and pending messages for this project.';
        intro.style.margin = '12px 0';
        output.appendChild(intro);
        for (const key of keys) {
          const card = document.createElement('section');
          card.style.cssText =
            'padding:12px;margin:10px 0;border:1px solid #494078;border-radius:10px';
          const title = document.createElement('h3');
          title.textContent = key.toUpperCase();
          const owned = tasks.filter(a => a.agent === key);
          const info = document.createElement('p');
          info.style.cssText = 'white-space:pre-wrap;margin:8px 0';
          info.textContent =
            `Planned: ${owned.filter(a => a.status === 'planned').length} · ` +
            `Marked working: ${owned.filter(a => a.status === 'working').length} · ` +
            `Completed: ${owned.filter(a => a.status === 'completed').length}\n` +
            `Messages awaiting processing: ${records.filter(m => m.receiver === key && m.status === 'recorded').length} · ` +
            `Processing: ${records.filter(m => m.receiver === key && m.status === 'processing').length}`;
          const list = document.createElement('div');
          list.style.whiteSpace = 'pre-wrap';
          list.textContent = owned.length
            ? owned.map(a => `${a.status}: ${a.title}`).join('\n')
            : 'No tasks in this project.';
          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
          actions.append(
            button('Conversations', () => conversations(key)),
            button('Assign task', () => {
              dialog.close();
              const form = document.getElementById('noxisAssignTasks');
              const target = document.getElementById('noxisTaskAgent');
              if (!form || !target) return;
              target.value = key;
              form.scrollIntoView({behavior:'smooth',block:'start'});
              form.querySelector('textarea')?.focus({preventScroll:true});
            })
          );
          card.append(title, info, list, actions);
          output.appendChild(card);
        }
      }
    } catch (error) {
      if (seq === request) output.textContent = 'Unable to load: ' + error.message;
    }
  }

  function connect(body) {
    for (const tag of body.querySelectorAll('span')) {
      const text = tag.textContent.trim();
      const mode = text === 'Quality check' ? 'quality'
        : text === 'Coordinate the other agents' ? 'coordination' : null;
      if (!mode) continue;
      const action = button(text, () => open(mode));
      action.style.fontSize = '10px';
      tag.replaceWith(action);
    }
  }
  document.getElementById('noxisProjectSelect')?.addEventListener('change', () => {
    if (dialog.open && !busy) {
      ++request;
      output.textContent = 'Project changed. Close and reopen this panel.';
    }
  });
  window.NoxisNyxar = {connect};
})();
