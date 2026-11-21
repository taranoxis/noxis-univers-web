/* NOXIS AI LAB — real activity journal */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/activities';

  function renderJournal(key) {
    if (key !== 'nyxar') return;

    const body = document.getElementById('uDBody');
    if (!body) return;

    body.querySelector('#noxisLiveJournal')?.remove();

    const section = document.createElement('section');
    section.id = 'noxisLiveJournal';
    section.className = 'd-sec';

    const heading = document.createElement('h5');
    heading.textContent = 'NYXAR · LIVE ACTIVITY JOURNAL';

    const refresh = document.createElement('button');
    refresh.textContent = 'Refresh Journal';
    refresh.style.cssText =
      'margin:10px 0;padding:8px 12px;background:#173653;color:white;border:1px solid #5eb0f0;border-radius:8px;cursor:pointer;';

    const output = document.createElement('div');
    output.style.cssText = 'display:grid;gap:8px;font-size:12px;';

    const filter = document.createElement('select');
    filter.id = 'noxisJournalFilter';
    filter.style.cssText =
      'margin:10px 8px 10px 0;padding:8px;background:#111827;color:white;border:1px solid #46516b;border-radius:8px;';
    filter.add(new Option('Active Project', 'project'));
    filter.add(new Option('All Activities', 'all'));

    section.append(heading, filter, refresh, output);
    body.appendChild(section);

    async function load() {
      output.textContent = 'Loading journal...';
      refresh.disabled = true;

      try {
        const response = await fetch(API);
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const activities = await response.json();
        if (!Array.isArray(activities)) throw new Error('Format invalid');

        output.replaceChildren();

        const projectId = document.getElementById('noxisProjectSelect')?.value || '';
        const visible = filter.value === 'all'
          ? activities
          : activities.filter(activity => projectId && activity.project_id === projectId);

        if (!visible.length) {
          output.textContent = filter.value === 'all'
            ? 'No tasks registered.'
            : projectId
              ? 'No tasks registered for this project.'
              : 'Select an active project to view its journal.';
          return;
        }

        for (const activity of [...visible].reverse()) {
          const card = document.createElement('div');
          card.style.cssText =
            'padding:10px;border:1px solid #46516b;border-radius:8px;background:#10182e;color:#e5edff;white-space:pre-wrap;overflow-wrap:anywhere;';

          const agent = document.createElement('strong');
          agent.textContent = String(activity.agent || '').toUpperCase();

          const title = document.createElement('div');
          title.textContent = activity.title || '';

          const status = document.createElement('div');
          status.textContent = 'Journal status: ' + (activity.status || 'unknown');
          status.style.marginTop = '6px';

          card.append(agent, title, status);
          output.appendChild(card);
        }
      } catch (error) {
        output.textContent = 'Journal unavailable: ' + error.message;
      } finally {
        refresh.disabled = false;
      }
    }

    refresh.addEventListener('click', load);
    filter.addEventListener('change', load);
    document.getElementById('noxisProjectSelect')?.addEventListener('change', load);
    load();
  }

  window.NoxisJournal = {renderJournal};
})();
