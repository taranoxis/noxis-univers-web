
/* NOXIS — Tara's human review */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/messages';
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let busy = false;
  let request = 0;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'taraReviewTitle');
  dialog.style.cssText =
    'margin:auto;width:min(760px,94vw);max-height:88vh;overflow:auto;' +
    'padding:22px;background:#100d2b;color:#e5e7eb;' +
    'border:1px solid #63558b;border-radius:16px';
  dialog.innerHTML = `
    <h2 id="taraReviewTitle">Tara — Review results</h2>
    <p data-scope style="margin:10px 0"></p>
    <p>Review records your decision. It does not publish or sell anything.</p>
    <div data-list style="margin-top:16px"></div>
    <button type="button" data-close>Close</button>`;
  document.body.appendChild(dialog);
  const list = dialog.querySelector('[data-list]');
  const scope = dialog.querySelector('[data-scope]');
  const close = dialog.querySelector('[data-close]');

  function styleButton(button) {
    button.style.cssText =
      'padding:9px 12px;background:#17152e;color:#e5e7eb;' +
      'border:1px solid #63558b;border-radius:8px;cursor:pointer';
  }
  styleButton(close);
  close.addEventListener('click', () => {
    if (!busy) dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });

  async function records() {
    const response = await fetch(API, {cache:'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid message journal');
    return data;
  }

  async function renderTaraStatus() {
    const body = document.getElementById('uDBody');
    const selected = projectId();
    if (document.getElementById('uDrawer')?.dataset.agent !== 'tara') return;
    function set(heading, text) {
      for (const section of body.querySelectorAll(':scope > .d-sec')) {
        if (section.querySelector('h5')?.textContent.trim() === heading) {
          const target = section.querySelector('.d-task');
          if (target) {
            target.style.whiteSpace = 'pre-wrap';
            target.textContent = text;
          }
        }
      }
    }
    try {
      const data = await records();
      if (document.getElementById('uDrawer')?.dataset.agent !== 'tara' ||
          body !== document.getElementById('uDBody') ||
          selected !== projectId()) return;
      const inbox = data.filter(m =>
        m.receiver === 'tara' && (m.project_id || null) === selected);
      inbox.sort((a,b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const pending = inbox.filter(m => m.status === 'awaiting_review');
      set('Current task', pending.length
        ? `${pending.length} item(s) awaiting your review.`
        : 'No items awaiting review in this selection.');
      set('Recent messages', inbox.length
        ? inbox.slice(0,3).map(m =>
          `${String(m.sender).toUpperCase()} → TARA · ${m.status}`).join('\n\n')
        : 'No inbox messages in this project selection.');
      set('Latest result', inbox.length
        ? `${String(inbox[0].sender).toUpperCase()} · ${inbox[0].status}\n` +
          String(inbox[0].content || '').slice(0,500) +
          '\n\nOpen Review results for the full text.'
        : 'No results submitted to Tara in this selection.');
    } catch (error) {
      if (body === document.getElementById('uDBody') &&
          document.getElementById('uDrawer')?.dataset.agent === 'tara' &&
          selected === projectId()) {
        set('Recent messages', 'Inbox unavailable: ' + error.message);
      }
    }
  }

  async function refresh() {
    const sequence = ++request;
    const selected = projectId();
    scope.textContent = 'Project: ' +
      (document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent || 'none');
    list.textContent = 'Loading submitted results…';
    try {
      const data = await records();
      if (sequence !== request || selected !== projectId() || !dialog.open) return;
      const inbox = data.filter(m =>
        m.receiver === 'tara' && (m.project_id || null) === selected);
      inbox.sort((a,b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')));
      list.replaceChildren();
      if (!inbox.length) {
        list.textContent = 'No results submitted to Tara in this selection.';
        return;
      }
      for (const item of inbox) {
        const card = document.createElement('section');
        card.style.cssText =
          'border:1px solid #494078;border-radius:10px;padding:14px;margin-bottom:14px';
        const title = document.createElement('h3');
        title.textContent = String(item.sender).toUpperCase() + ' → TARA · ' + item.status;
        const text = document.createElement('div');
        text.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0';
        text.textContent = item.content || '';
        const previous = document.createElement('div');
        previous.textContent = item.review
          ? 'Last review: ' + item.review.action + ' · ' +
            item.review.created_at + '\n' + item.review.notes
          : 'Awaiting your review.';
        previous.style.whiteSpace = 'pre-wrap';
        const notes = document.createElement('textarea');
        notes.rows = 3;
        notes.maxLength = 2000;
        notes.placeholder = 'Review notes or requested changes…';
        notes.setAttribute('aria-label', 'Review notes');
        notes.style.cssText =
          'display:block;width:100%;box-sizing:border-box;margin:12px 0;' +
          'background:#17152e;color:#e5e7eb;border:1px solid #63558b;padding:10px';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
        const feedback = document.createElement('div');
        feedback.setAttribute('role', 'status');
        const buttons = [];
        for (const [label, action] of [
          ['Mark reviewed', 'reviewed'],
          ['Request changes', 'changes_requested']
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          styleButton(button);
          buttons.push(button);
          button.addEventListener('click', async () => {
            if (busy) return;
            if (action === 'changes_requested' && !notes.value.trim()) {
              feedback.textContent = 'Describe the changes you want.';
              notes.focus();
              return;
            }
            busy = true;
            close.disabled = true;
            buttons.forEach(b => b.disabled = true);
            feedback.textContent = 'Saving your review…';
            try {
              const response = await fetch(API + '/review', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id:item.id, action, notes:notes.value.trim()})
              });
              if (!response.ok) throw new Error('HTTP ' + response.status);
              const saved = await response.json();
              if (saved.id !== item.id || saved.status !== action) {
                throw new Error('Unexpected server confirmation');
              }
              document.dispatchEvent(new Event('noxis-messages-updated'));
              window.NoxisLivePanel?.refreshPanel();
              await refresh();
            } catch (error) {
              feedback.textContent =
                'Review not confirmed: ' + error.message +
                '. Check the inbox before retrying.';
            } finally {
              busy = false;
              close.disabled = false;
              buttons.forEach(b => b.disabled = false);
            }
          });
          row.appendChild(button);
        }
        card.append(title, text, previous, notes, row, feedback);
        list.appendChild(card);
      }
    } catch (error) {
      if (sequence === request) list.textContent = 'Unable to load results: ' + error.message;
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    refresh();
  }
  document.addEventListener('noxis-messages-updated', renderTaraStatus);
  document.getElementById('noxisProjectSelect')?.addEventListener('change', () => {
    renderTaraStatus();
    if (dialog.open && !busy) refresh();
  });
  window.NoxisReview = {open, renderTaraStatus};
})();
