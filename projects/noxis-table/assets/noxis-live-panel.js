/* NOXIS AI LAB — journal-backed side panel */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/activities';
  const KEYS = ['nyxar', 'ar_in', 'nyxin', 'nyxer', 'ar_on', 'aren'];


  async function copyActivityText(text, button) {
    try {
      try {
        await navigator.clipboard.writeText(text);
      } catch (error) {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
        activityDialog.appendChild(field);
        try {
          field.select();
          if (!document.execCommand('copy')) throw error;
        } finally {
          field.remove();
        }
      }
      button.textContent = 'Copied';
    } catch (error) {
      button.textContent = 'Copy failed — select text manually';
    }
  }

  function copyActivityButton(label, text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tbtn';
    button.textContent = label;
    button.style.margin = '8px 8px 8px 0';
    button.addEventListener('click', () => copyActivityText(text, button));
    return button;
  }

  const activityEvents = document.getElementById('uspEvents');
  const activityTrigger = document.getElementById('ubtnActivity');
  const statusTrigger = document.getElementById('ubtnStatus');
  const statusSide = document.getElementById('uSide');
  if (!activityEvents || !activityTrigger || !statusTrigger || !statusSide) return;

  const oldActivityCard = activityEvents.parentElement;
  const activityDialog = document.createElement('dialog');
  activityDialog.setAttribute('aria-labelledby', 'activityDialogTitle');
  activityDialog.style.cssText =
    'margin:auto;width:min(900px,94vw);height:min(800px,88vh);padding:0;' +
    'background:#100d2b;color:#e5e7eb;border:1px solid #63558b;' +
    'border-radius:16px;overflow:hidden;user-select:text;-webkit-user-select:text';

  const activityShell = document.createElement('div');
  activityShell.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0';
  const activityHeader = document.createElement('div');
  activityHeader.style.cssText = 'padding:16px;border-bottom:1px solid #494078;flex-shrink:0';
  const activityTitle = document.createElement('h2');
  activityTitle.id = 'activityDialogTitle';
  activityTitle.textContent = 'NOXIS — Activity';
  const activityNote = document.createElement('p');
  activityNote.textContent = 'Journal across all projects.';
  activityNote.style.margin = '8px 0';

  const activityRefresh = document.createElement('button');
  activityRefresh.type = 'button';
  activityRefresh.className = 'tbtn';
  activityRefresh.textContent = 'Refresh Activity';
  activityRefresh.addEventListener('click', () => refreshPanel());
  const activityClose = document.createElement('button');
  activityClose.type = 'button';
  activityClose.className = 'tbtn';
  activityClose.textContent = 'Close';
  activityClose.style.marginLeft = '10px';
  activityClose.addEventListener('click', () => activityDialog.close());

  activityHeader.append(activityTitle, activityNote, activityRefresh, activityClose);
  activityEvents.style.cssText =
    'flex:1;min-height:0;max-height:none;overflow-y:auto;padding:16px;' +
    'user-select:text;-webkit-user-select:text;overscroll-behavior:contain';
  activityShell.append(activityHeader, activityEvents);
  activityDialog.appendChild(activityShell);
  document.body.appendChild(activityDialog);
  oldActivityCard.style.display = 'none';

  activityTrigger.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!activityDialog.open) activityDialog.showModal();
    refreshPanel();
  }, true);

  statusSide.classList.add('hidden');
  statusTrigger.classList.remove('on');
  statusTrigger.setAttribute('aria-expanded', 'false');
  statusTrigger.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const opening = statusSide.classList.contains('hidden');
    statusSide.classList.toggle('hidden', !opening);
    statusTrigger.classList.toggle('on', opening);
    statusTrigger.setAttribute('aria-expanded', String(opening));
    if (opening) refreshPanel();
  }, true);


  async function refreshPanel() {
    const statusEl = document.getElementById('uspStatus');
    const eventsEl = document.getElementById('uspEvents');
    if (!statusEl || !eventsEl) return;

    statusEl.textContent = 'Loading journal...';
    eventsEl.textContent = 'Loading journal...';

    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const activities = await response.json();
      if (!Array.isArray(activities)) throw new Error('Invalid journal');

      window.NoxisLiveCards?.renderSummary();

      eventsEl.replaceChildren();

      const messagesResponse = await fetch(
        'http://127.0.0.1:8765/api/messages'
      );
      if (!messagesResponse.ok) {
        throw new Error('Message journal HTTP ' + messagesResponse.status);
      }

      const messages = await messagesResponse.json();
      if (!Array.isArray(messages)) {
        throw new Error('Invalid message journal');
      }

      const entries = [
        ...activities.map(a => ({
          type: 'TASK',
          label: `${String(a.agent).toUpperCase()} · ${a.status}`,
          description: a.title || 'Untitled task',
          time: a.created_at || ''
        })),
        ...messages.map(m => ({
          type: 'MESSAGE',
          id: m.id,
          status: m.status,
          label: `${String(m.sender).toUpperCase()} → ${String(m.receiver).toUpperCase()} · ${m.status}`,
          description: m.content || '',
          reply: m.status === 'processed' && typeof m.reply === 'string'
            ? m.reply : '',
          time: m.created_at || ''
        }))
      ];

      entries.sort((a, b) => b.time.localeCompare(a.time));

      if (!entries.length) {
        eventsEl.textContent = 'No recorded activities or messages.';
        return;
      }

      for (const entry of entries) {
        const row = document.createElement('div');
        row.className = 'sp-ev';

        const label = document.createElement('strong');
        label.textContent = `${entry.type} · ${entry.label}`;

        const description = document.createElement('div');
        description.textContent = entry.description;

        row.append(label, description);
        description.style.whiteSpace = 'pre-wrap';
        row.appendChild(copyActivityButton('Copy message', entry.description));

        if (entry.type === 'MESSAGE' && entry.reply) {
          const reply = document.createElement('div');
          reply.style.marginTop = '8px';
          reply.style.paddingLeft = '12px';
          reply.style.borderLeft = '2px solid #c5a35a';
          reply.style.whiteSpace = 'pre-wrap';

          const heading = document.createElement('strong');
          heading.textContent = 'Agent reply: ';

          const content = document.createElement('span');
          content.textContent = entry.reply;

          reply.append(heading, content);
          row.appendChild(reply);
          row.appendChild(copyActivityButton('Copy reply', entry.reply));
        }

        if (entry.type === 'MESSAGE' &&
            entry.status === 'recorded' &&
            typeof entry.id === 'string') {

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tbtn';
          button.textContent = 'Process Message';
          button.style.marginTop = '8px';

          const feedback = document.createElement('div');
          feedback.setAttribute('role', 'status');
          feedback.style.marginTop = '6px';

          button.addEventListener('click', async () => {
            if (button.disabled) return;

            button.disabled = true;
            button.textContent = 'Processing...';
            feedback.textContent = 'Waiting for local Ollama...';

            try {
              const response = await fetch(
                'http://127.0.0.1:8765/api/messages/process',
                {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({id: entry.id})
                }
              );

              if (!response.ok) {
                throw new Error('HTTP ' + response.status);
              }

              const result = await response.json();
              if (result.id !== entry.id ||
                  result.status !== 'processed' ||
                  typeof result.reply !== 'string' ||
                  !result.reply.trim()) {
                throw new Error('Invalid processing result');
              }

              document.dispatchEvent(new Event('noxis-messages-updated'));
              await refreshPanel();
            } catch (error) {
              feedback.textContent =
                'Processing not confirmed: ' + error.message +
                '. Refresh Activity before retrying.';
              button.textContent = 'Check Status Before Retry';
              button.onclick = null;
              button.addEventListener('click', () => refreshPanel(), {once: true});
              button.disabled = false;
            }
          });

          row.append(button, feedback);
        }

        eventsEl.appendChild(row);
      }
    } catch (error) {
      statusEl.textContent = 'Journal unavailable: ' + error.message;
      eventsEl.textContent = 'Journal unavailable.';
    }
  }

  window.NoxisLivePanel = {refreshPanel};
})();
