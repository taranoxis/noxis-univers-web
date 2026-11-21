/* NOXIS — real conversation history */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/messages';
  const KEYS = ['nyxar', 'ar_in', 'nyxin', 'nyxer', 'ar_on', 'aren', 'tara'];

  const button = document.getElementById('ubtnConversations');
  const veil = document.getElementById('conversationsVeil');
  const closeButton = document.getElementById('conversationsClose');
  const agentA = document.getElementById('conversationAgentA');
  const agentB = document.getElementById('conversationAgentB');
  const history = document.getElementById('conversationHistory');

  if (!button || !veil || !closeButton || !agentA || !agentB || !history) return;

  function name(key) {
    return window.AGENTS?.[key]?.short || key.toUpperCase();
  }

  for (const select of [agentA, agentB]) {
    for (const key of KEYS) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = name(key);
      select.appendChild(option);
    }
  }

  agentB.appendChild(new Option('All agents', '*'));
  agentA.value = 'nyxar';
  agentB.value = 'ar_in';

  function close() {
    veil.classList.add('hidden');
    button.classList.remove('on');
  }


  function forwardingControls(message) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #494078';

    const label = document.createElement('label');
    label.textContent = 'Forward to… ';
    const target = document.createElement('select');
    target.setAttribute('aria-label', 'Forward response to');
    for (const key of KEYS) {
      if (key !== message.receiver) {
        target.add(new Option(name(key), key));
      }
    }
    label.appendChild(target);

    const instructions = document.createElement('textarea');
    instructions.placeholder = 'Instructions for the recipient…';
    instructions.setAttribute('aria-label', 'Forwarding instructions');
    instructions.maxLength = 2000;
    instructions.rows = 3;

    for (const el of [target, instructions]) {
      el.style.cssText =
        'background:#111127;color:#e5e7eb;border:1px solid #63558b;' +
        'border-radius:8px;padding:8px;max-width:100%;';
    }
    instructions.style.display = 'block';
    instructions.style.width = '100%';
    instructions.style.margin = '10px 0';

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'tbtn';
    send.textContent = 'Forward response';

    const feedback = document.createElement('div');
    feedback.setAttribute('role', 'status');
    feedback.style.marginTop = '8px';

    send.addEventListener('click', async () => {
      const text = instructions.value.trim();
      if (!text) {
        feedback.textContent = 'Enter instructions for the recipient.';
        instructions.focus();
        return;
      }
      const recipient = target.value;
      send.disabled = true;
      target.disabled = true;
      instructions.disabled = true;
      feedback.textContent = 'Recording forwarded response…';

      try {
        const response = await fetch(API, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            sender: message.receiver,
            receiver: recipient,
            content: text,
            project_id: message.project_id || null,
            source_message_id: message.id
          })
        });
        if (response.status !== 201) throw new Error('HTTP ' + response.status);
        const saved = await response.json();
        if (saved.source_message_id !== message.id ||
            saved.receiver !== recipient) {
          throw new Error('Unexpected server confirmation');
        }

        feedback.textContent = recipient === 'tara'
          ? 'Sent to Tara Inbox — awaiting human review.'
          : 'Forwarded to ' + name(recipient) + ' — recorded, not processed.';
        send.textContent = 'Forwarded';
        window.NoxisLivePanel?.refreshPanel();
        document.dispatchEvent(new Event('noxis-messages-updated'));
      } catch (error) {
        feedback.textContent =
          'Forwarding not confirmed: ' + error.message +
          '. Check history before trying again.';
        send.disabled = false;
        target.disabled = false;
        instructions.disabled = false;
      }
    });

    box.append(label, instructions, send, feedback);
    return box;
  }

  const inboxButton = document.createElement('button');
  inboxButton.type = 'button';
  inboxButton.className = button.className;
  inboxButton.textContent = 'Tara Inbox';
  button.after(inboxButton);
  inboxButton.addEventListener('click', () => {
    agentA.value = 'tara';
    agentB.value = '*';
    veil.classList.remove('hidden');
    button.classList.add('on');
    refresh();
  });


  async function refresh() {
    history.textContent = 'Loading recorded conversations...';

    if (agentA.value === agentB.value) {
      history.textContent = 'Select two different agents.';
      return;
    }

    const projectId = document.getElementById('noxisProjectSelect')?.value || null;
    const a = agentA.value;
    const b = agentB.value;

    try {
      const response = await fetch(API, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const records = await response.json();
      if (!Array.isArray(records)) throw new Error('Invalid message journal');

      if (veil.classList.contains('hidden') ||
          a !== agentA.value || b !== agentB.value ||
          projectId !== (document.getElementById('noxisProjectSelect')?.value || null)) return;

      const selected = records.filter(m => (m.project_id || null) === projectId).filter(m =>
        (b === '*' && (m.sender === a || m.receiver === a)) ||
        (m.sender === a && m.receiver === b) ||
        (m.sender === b && m.receiver === a)
      );

      selected.sort((x, y) =>
        String(x.created_at || '').localeCompare(String(y.created_at || ''))
      );

      history.replaceChildren();

      if (!selected.length) {
        history.textContent = `No recorded conversation. Project: ${document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.textContent || 'none'} | ID: ${projectId || 'none'} | Messages loaded: ${records.length} | Agents: ${a} / ${b}`;
        return;
      }

      for (const m of selected) {
        const card = document.createElement('div');
        card.style.cssText =
          'padding:12px;margin:0 0 10px;border:1px solid #494078;' +
          'border-radius:10px;background:#100d2b;';

        const heading = document.createElement('strong');
        heading.textContent =
          `${name(m.sender)} → ${name(m.receiver)} · ${m.status || 'unknown'}`;

        const date = document.createElement('div');
        date.style.cssText = 'font-size:11px;color:#c4b5fd;margin:5px 0;';
        date.textContent = (m.created_at || '') +
          (m.model_used ? ' · Model: ' + m.model_used : '');

        const content = document.createElement('div');
        content.textContent = m.content || '';

        card.append(heading, date, content);

        if (m.status === 'processed' && typeof m.reply === 'string') {
          const reply = document.createElement('div');
          reply.style.cssText =
            'margin-top:12px;padding-left:12px;' +
            'border-left:2px solid #c5a35a;';

          const replyTitle = document.createElement('strong');
          replyTitle.textContent = `${name(m.receiver)} replies:`;

          const replyText = document.createElement('div');
          replyText.textContent = m.reply;

          reply.append(replyTitle, replyText);
          card.appendChild(reply);
          if (KEYS.includes(m.receiver) && m.receiver !== 'tara') {
            card.appendChild(forwardingControls(m));
          }
        }

        history.appendChild(card);
      }
    } catch (error) {
      history.textContent = 'Unable to load conversations: ' + error.message;
    }
  }

  button.addEventListener('click', () => {
    veil.classList.remove('hidden');
    button.classList.add('on');
    refresh();
  });

  document.addEventListener('noxis-messages-updated', () => {
    if (!veil.classList.contains('hidden')) refresh();
  });

  closeButton.addEventListener('click', close);
  agentA.addEventListener('change', refresh);
  agentB.addEventListener('change', refresh);
  document.getElementById('noxisProjectSelect')?.addEventListener('change', () => {
    if (!veil.classList.contains('hidden')) refresh();
  });

  veil.addEventListener('click', event => {
    if (event.target === veil) close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !veil.classList.contains('hidden')) {
      close();
    }
  });
})();
