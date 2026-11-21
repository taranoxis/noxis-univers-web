/* NOXIS AI LAB — local Ollama chat, independent of demo activity */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/chat';
  const history = {};
  const busy = new Set();

  function renderChat(key) {
    const body = document.getElementById('uDBody');
    if (!body || key !== 'nyxar') return;

    const section = document.createElement('section');
    section.className = 'd-sec';
    section.id = 'noxisRealChat';

    const heading = document.createElement('h5');
    heading.textContent = 'LOCAL AI · REAL CONVERSATION';
    section.appendChild(heading);

    const messages = document.createElement('div');
    messages.style.cssText =
      'max-height:220px;overflow-y:auto;display:grid;gap:8px;margin:10px 0;';

    for (const item of history[key] || []) {
      const line = document.createElement('div');
      line.style.cssText =
        'white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;border:1px solid #46516b;border-radius:8px;font-size:12px;';
      const label = document.createElement('strong');
      label.textContent = item.who === 'user' ? 'TARA: ' : 'NYXAR: ';
      line.appendChild(label);
      line.appendChild(document.createTextNode(item.text));
      messages.appendChild(line);
    }
    section.appendChild(messages);

    const input = document.createElement('textarea');
    input.placeholder = 'Write your message to Nyxar...';
    input.rows = 3;
    input.style.cssText =
      'width:100%;box-sizing:border-box;border-radius:8px;padding:9px;background:#111827;color:white;border:1px solid #46516b;';
    section.appendChild(input);

    const send = document.createElement('button');
    send.textContent = busy.has(key) ? 'Nyxar is thinking...' : 'Send to Nyxar';
    send.disabled = busy.has(key);
    send.style.cssText =
      'margin-top:8px;padding:9px 12px;border:1px solid #5eb0f0;border-radius:8px;color:white;background:#173653;cursor:pointer;';
    section.appendChild(send);

    send.addEventListener('click', async () => {
      const message = input.value.trim();
      if (!message || busy.has(key)) return;

      (history[key] ||= []).push({who:'user', text:message});
      busy.add(key);
      renderChat(key);

      try {
        const response = await fetch(API, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({agent:key,message})
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        history[key].push({who:'agent',text:data.response});
      } catch (error) {
        history[key].push({who:'agent',text:'Connection unavailable: ' + error.message});
      } finally {
        busy.delete(key);
        if (document.getElementById('uDrawer')?.dataset.agent === key) renderChat(key);
      }
    });

    body.querySelector('#noxisRealChat')?.remove();
    body.prepend(section);
  }

  window.NoxisChat = { renderChat };
})();
