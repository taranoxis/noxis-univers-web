
/* NOXIS — backend message states, separate from manually marked tasks */
'use strict';
(() => {
  const keys = ['nyxar','ar_in','nyxin','nyxer','ar_on','aren'];
  let loading = false;
  let states = {};

  function renderSummary() {
    const target = document.getElementById('uspStatus');
    if (!target) return;
    target.replaceChildren();
    const note = document.createElement('p');
    note.textContent = 'Message states across all projects.';
    note.style.cssText = 'font-size:10px;margin-bottom:10px;color:#c4b5fd';
    target.appendChild(note);
    for (const key of keys) {
      const state = states[key];
      const row = document.createElement('div');
      row.className = 'sp-row';
      const name = document.createElement('strong');
      name.textContent = key.toUpperCase();
      const info = document.createElement('span');
      info.textContent = state
        ? state.label + ' · ' + state.description
        : 'Checking backend…';
      info.style.cssText = 'font-size:11px;white-space:pre-wrap';
      row.append(name, info);
      target.appendChild(row);
    }
  }

  async function refreshCards() {
    if (loading || document.hidden) return;
    loading = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        'http://127.0.0.1:8765/api/messages',
        {cache:'no-store', signal:controller.signal}
      );
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const messages = await response.json();
      if (!Array.isArray(messages)) throw new Error('Invalid message journal');
      const updated = {};
      for (const key of keys) {
        const incoming = messages.filter(m => m.receiver === key);
        const processing = incoming.filter(m => m.status === 'processing').length;
        const waiting = incoming.filter(m => m.status === 'recorded').length;
        updated[key] = {
          label: processing ? 'PROCESSING' : waiting ? 'WAITING' : 'IDLE',
          description: processing
            ? `${processing} processing · ${waiting} waiting`
            : waiting ? `${waiting} message(s) waiting`
            : 'No active or waiting messages'
        };
      }
      states = updated;
    } catch (error) {
      for (const key of keys) {
        states[key] = {label:'UNAVAILABLE', description:'Backend not reachable'};
      }
    } finally {
      clearTimeout(timer);
      for (const key of keys) {
        const state = states[key];
        const badge = document.querySelector(`[data-live-status="${key}"]`);
        const text = document.querySelector(`[data-live-task="${key}"]`);
        const colour = {
          PROCESSING:'#67e8f9', WAITING:'#f0c75e',
          IDLE:'#a7b3ca', UNAVAILABLE:'#fca5a5'
        }[state.label];
        if (badge) {
          badge.textContent = '● ' + state.label;
          badge.style.color = colour;
          badge.title =
            'Backend message state across projects. Task status is recorded separately.';
        }
        if (text) {
          text.textContent = state.description;
          text.title = state.description;
        }
      }
      renderSummary();
      loading = false;
    }
  }

  window.NoxisLiveCards = {refreshCards, renderSummary};
  setInterval(refreshCards, 3000);
  document.addEventListener('visibilitychange', refreshCards);
  document.addEventListener('noxis-messages-updated', refreshCards);
  refreshCards();
})();
