
/* NOXIS — Tara's decisions, recorded without external execution */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:8765/api/messages';
  const projectId = () =>
    document.getElementById('noxisProjectSelect')?.value || null;
  let busy = false;
  let sequence = 0;

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'taraDecisionsTitle');
  dialog.style.cssText =
    'margin:auto;width:min(760px,94vw);max-height:88vh;overflow:auto;' +
    'padding:22px;background:#100d2b;color:#e5e7eb;' +
    'border:1px solid #63558b;border-radius:16px';
  dialog.innerHTML = `
    <h2 id="taraDecisionsTitle">Tara — Publishing / Selling / Archiving</h2>
    <p data-scope style="margin:10px 0"></p>
    <p>Record a decision for a submitted result.
    Saving does not publish, sell, move or delete files.</p>
    <div data-list style="margin-top:16px"></div>
    <button type="button" data-close>Close</button>`;
  document.body.appendChild(dialog);
  const list = dialog.querySelector('[data-list]');
  const close = dialog.querySelector('[data-close]');

  function style(el) {
    el.style.cssText =
      'padding:9px;background:#17152e;color:#e5e7eb;' +
      'border:1px solid #63558b;border-radius:8px;max-width:100%';
  }
  style(close);
  close.addEventListener('click', () => {
    if (!busy) dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (busy) event.preventDefault();
  });

  async function refresh() {
    const current = ++sequence;
    const selected = projectId();
    dialog.querySelector('[data-scope]').textContent = 'Project: ' +
      (document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent || 'none');
    list.textContent = 'Loading submitted results…';
    try {
      const response = await fetch(API, {cache:'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid message journal');
      if (current !== sequence || selected !== projectId() || !dialog.open) return;

      const items = data.filter(m =>
        m.receiver === 'tara' && (m.project_id || null) === selected);
      items.sort((a,b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')));
      list.replaceChildren();
      if (!items.length) {
        list.textContent = 'No results submitted to Tara in this selection.';
        return;
      }

      for (const item of items) {
        const card = document.createElement('section');
        card.style.cssText =
          'padding:14px;border:1px solid #494078;border-radius:10px;margin-bottom:14px';
        const title = document.createElement('h3');
        title.textContent =
          String(item.sender).toUpperCase() + ' → TARA · ' + item.status;
        const date = document.createElement('p');
        date.textContent = item.created_at || '';

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Read submitted result';
        const content = document.createElement('div');
        content.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0';
        content.textContent = item.content || '';
        details.append(summary, content);

        const currentState = document.createElement('p');
        currentState.style.cssText = 'white-space:pre-wrap;margin:12px 0';
        currentState.textContent =
          ['publishing', 'selling', 'archiving'].map(kind => {
            const entry = item.decisions?.[kind];
            return kind + ': ' + (entry
              ? entry.decision + ' · ' + entry.created_at
              : 'no decision');
          }).join('\n');

        const form = document.createElement('form');
        form.style.cssText = 'display:grid;gap:10px;margin-top:12px';

        const kind = document.createElement('select');
        kind.setAttribute('aria-label', 'Decision category');
        for (const value of ['publishing', 'selling', 'archiving']) {
          kind.add(new Option(value[0].toUpperCase() + value.slice(1), value));
        }
        const decision = document.createElement('select');
        decision.setAttribute('aria-label', 'Decision');
        for (const [label, value] of [
          ['Not approved / On hold', 'withheld'],
          ['Approved', 'approved'],
          ['Revoke previous approval', 'revoked']
        ]) {
          decision.add(new Option(label, value));
        }
        const notes = document.createElement('textarea');
        notes.rows = 3;
        notes.maxLength = 2000;
        notes.placeholder = 'Decision notes and conditions…';
        notes.setAttribute('aria-label', 'Decision notes');
        const save = document.createElement('button');
        save.type = 'submit';
        save.textContent = 'Save decision';
        for (const el of [kind, decision, notes, save]) style(el);

        const feedback = document.createElement('div');
        feedback.setAttribute('role', 'status');
        const hint = document.createElement('p');
        hint.textContent = item.status === 'reviewed'
          ? 'This result has been reviewed.'
          : 'Mark this result reviewed in Review results before approving it.';

        form.append(kind, decision, notes, hint, save, feedback);
        form.addEventListener('submit', async event => {
          event.preventDefault();
          if (busy) return;
          if (decision.value === 'approved' && item.status !== 'reviewed') {
            feedback.textContent = 'Review this result first.';
            return;
          }
          busy = true;
          close.disabled = true;
          for (const el of [kind, decision, notes, save]) el.disabled = true;
          feedback.textContent = 'Saving decision…';
          try {
            const response = await fetch(API + '/decision', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({
                id:item.id, kind:kind.value,
                decision:decision.value, notes:notes.value.trim()
              })
            });
            if (!response.ok) {
              throw new Error(response.status === 409
                ? 'Review required or no active approval to revoke'
                : 'HTTP ' + response.status);
            }
            const saved = await response.json();
            if (saved.id !== item.id ||
                saved.decisions?.[kind.value]?.decision !== decision.value) {
              throw new Error('Unexpected server confirmation');
            }
            document.dispatchEvent(new Event('noxis-messages-updated'));
            await refresh();
          } catch (error) {
            feedback.textContent =
              'Decision not confirmed: ' + error.message +
              '. Check saved decisions before retrying.';
          } finally {
            busy = false;
            close.disabled = false;
            for (const el of [kind, decision, notes, save]) el.disabled = false;
          }
        });

        const audit = document.createElement('details');
        audit.style.marginTop = '12px';
        const auditTitle = document.createElement('summary');
        auditTitle.textContent = 'Decision history';
        const auditText = document.createElement('div');
        auditText.style.whiteSpace = 'pre-wrap';
        auditText.textContent = (item.decision_history || []).map(entry =>
          `${entry.created_at} · ${entry.actor} · ${entry.kind}: ${entry.decision}\n${entry.notes || ''}`
        ).join('\n\n') || 'No decisions recorded.';
        audit.append(auditTitle, auditText);
        card.append(title, date, details, currentState, form, audit);
        list.appendChild(card);
      }
    } catch (error) {
      if (current === sequence) list.textContent = 'Unable to load decisions: ' + error.message;
    }
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    refresh();
  }
  document.getElementById('noxisProjectSelect')?.addEventListener('change', () => {
    if (dialog.open && !busy) refresh();
  });
  window.NoxisDecisions = {open};
})();
