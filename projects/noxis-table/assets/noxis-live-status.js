/* NOXIS AI LAB — journal-backed agent status */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/activities';

  async function renderStatus(key) {
    if (key === 'tara') {
      window.NoxisReview?.renderTaraStatus();
      const sections = [...document.querySelectorAll('#uDBody > .d-sec')];
      const content = {
        'Status': 'Human creator — final authority.',
        'Current task': 'No task assigned automatically.',
        'Recent messages': 'No verified messages available.',
        'Latest result': 'No verified result available.'
      };
      sections.forEach(section => {
        const heading = section.querySelector('h5')?.textContent.trim();
        const target = section.querySelector('.d-task');
        if (target && Object.hasOwn(content, heading)) {
          target.textContent = content[heading];
        }
      });
      return;
    }
    if (!['nyxar', 'ar_in', 'nyxin', 'nyxer', 'ar_on', 'aren'].includes(key)) return;

    const body = document.getElementById('uDBody');
    if (!body) return;

    const sections = [...body.querySelectorAll(':scope > .d-sec')];
    const headings = ['Status', 'Current task', 'Recent messages', 'Latest result'];

    const targets = sections.filter(section =>
      headings.includes(section.querySelector('h5')?.textContent.trim())
    );

    if (targets.length !== 4) return;

    for (const section of targets) {
      const heading = section.querySelector('h5');
      section.replaceChildren(heading);
      const message = document.createElement('div');
      message.className = 'd-task';
      message.style.cssText = 'padding:10px;color:#e5edff;white-space:pre-wrap;overflow-wrap:anywhere;';
      message.textContent = 'Loading journal data...';
      section.appendChild(message);
    }

    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const activities = await response.json();
      if (!Array.isArray(activities)) throw new Error('Invalid journal data');

      if (document.getElementById('uDBody') !== body ||
          document.getElementById('uDrawer')?.dataset.agent !== key) return;

      const agentActivities = activities.filter(a => a.agent === key);
      const planned = agentActivities.filter(a => a.status === 'planned');
      const working = agentActivities.filter(a => a.status === 'working');
      const completed = agentActivities.filter(a => a.status === 'completed');
      const latest = [...agentActivities].reverse().slice(0, 3);

      const content = [
        `Agent journal records: ${agentActivities.length}
Planned: ${planned.length} · Marked working: ${working.length}
Completed: ${completed.length}
Execution is not verified by journal status.`,

        working.length
          ? working.map(a => `${String(a.agent).toUpperCase()}: ${a.title}
Marked working — execution not verified.`).join('\n\n')
          : 'No tasks marked working in the journal.',

        latest.length
          ? latest.map(a => `${String(a.agent).toUpperCase()} · ${a.status}
${a.title}`).join('\n\n')
          : 'No journal activities recorded.',

        completed.length
          ? completed.map(a => a.result
              ? `${String(a.agent).toUpperCase()}: ${a.result}`
              : `${String(a.agent).toUpperCase()}: Completed status recorded; no result available.`
            ).join('\n\n')
          : 'No completed results recorded.'
      ];

      targets.forEach((section, index) => {
        section.querySelector('.d-task').textContent = content[index];
      });

    } catch (error) {
      targets.forEach(section => {
        section.querySelector('.d-task').textContent =
          'Journal unavailable: ' + error.message;
      });
    }
  }

  window.NoxisLiveStatus = {renderStatus};
})();
