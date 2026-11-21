/* NOXIS AI LAB — workflow overview from real journal */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/activities';
  const STATUSES = ['planned', 'working', 'completed', 'error'];

  function renderWorkflows(key) {
    if (key !== 'nyxar') return;

    const body = document.getElementById('uDBody');
    if (!body) return;

    body.querySelector('#noxisWorkflows')?.remove();

    const section = document.createElement('section');
    section.id = 'noxisWorkflows';
    section.className = 'd-sec';

    const heading = document.createElement('h5');
    heading.textContent = 'NYXAR · WORKFLOW OVERVIEW';

    const refresh = document.createElement('button');
    refresh.textContent = 'Refresh Workflows';
    refresh.style.cssText =
      'margin:10px 0;padding:8px 12px;background:#173653;color:#e5edff;border:1px solid #5eb0f0;border-radius:8px;cursor:pointer;';

    const output = document.createElement('div');
    output.style.cssText = 'display:grid;gap:12px;color:#e5edff;';

    section.append(heading, refresh, output);
    body.appendChild(section);

    async function load() {
      const projectId = document.getElementById('noxisProjectSelect')?.value || '';
      if (!projectId) {
        output.textContent = 'Select an active project to view workflows.';
        return;
      }
      refresh.disabled = true;
      output.textContent = 'Loading workflows...';

      try {
        const response = await fetch(API);
        if (!response.ok) throw new Error('HTTP ' + response.status);

        const activities = await response.json();
        if (!Array.isArray(activities)) throw new Error('Invalid journal data');

        if (projectId !== document.getElementById('noxisProjectSelect')?.value) {
          output.textContent = 'Project changed. Refresh Workflows.';
          return;
        }
        output.replaceChildren();

        for (const status of STATUSES) {
          const items = activities.filter(a => a.project_id === projectId && a.status === status);

          const group = document.createElement('div');
          group.style.cssText =
            'padding:10px;background:#10182e;border:1px solid #46516b;border-radius:8px;';

          const title = document.createElement('strong');
          title.textContent = status.toUpperCase() + ' (' + items.length + ')';
          group.appendChild(title);

          for (const activity of items) {
            const item = document.createElement('div');
            item.style.cssText =
              'margin-top:8px;padding-top:8px;border-top:1px solid #46516b;white-space:pre-wrap;overflow-wrap:anywhere;';

            const agent = document.createElement('strong');
            agent.textContent = String(activity.agent || '').toUpperCase() + ': ';

            const description = document.createElement('span');
            description.textContent = activity.title || '';

            item.append(agent, description);
            group.appendChild(item);
          }

          output.appendChild(group);
        }
      } catch (error) {
        output.textContent = 'Workflow unavailable: ' + error.message;
      } finally {
        refresh.disabled = false;
      }
    }

    refresh.addEventListener('click', load);
    load();
  }

  window.NoxisWorkflows = {renderWorkflows};
})();
