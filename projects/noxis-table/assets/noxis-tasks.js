/* NOXIS AI LAB — real task assignment */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/activities';

  const agents = {
    nyxar: 'NYXAR',
    ar_in: 'AR_IN',
    nyxin: 'NYXIN',
    nyxer: 'NYXER',
    ar_on: 'AR_ON',
    aren: 'AREN'
  };

  function renderTasks(key) {
    if (key !== 'nyxar') return;

    const body = document.getElementById('uDBody');
    if (!body) return;

    body.querySelector('#noxisAssignTasks')?.remove();

    const section = document.createElement('section');
    section.id = 'noxisAssignTasks';
    section.className = 'd-sec';

    section.innerHTML = `
      <h5>NYXAR · ASSIGN TASKS</h5>
      <div style="display:grid;gap:9px;margin-top:10px;">
        <select id="noxisTaskAgent"
          style="padding:9px;background:#111827;color:white;border:1px solid #46516b;border-radius:8px;">
          ${Object.entries(agents).map(([id,name]) =>
            `<option value="${id}">${name}</option>`
          ).join('')}
        </select>
        <textarea id="noxisTaskTitle" rows="3" maxlength="200"
          placeholder="Describe the task..."
          style="width:100%;box-sizing:border-box;padding:9px;background:#111827;color:white;border:1px solid #46516b;border-radius:8px;"></textarea>
        <button id="noxisTaskSave"
          style="padding:9px;background:#173653;color:white;border:1px solid #5eb0f0;border-radius:8px;cursor:pointer;">
          Save Task
        </button>
        <div id="noxisTaskFeedback" role="status"
          style="font-size:12px;white-space:pre-wrap;"></div>
      </div>
    `;

    body.appendChild(section);

    const button = section.querySelector('#noxisTaskSave');
    const feedback = section.querySelector('#noxisTaskFeedback');

    button.addEventListener('click', async () => {
      const agent = section.querySelector('#noxisTaskAgent').value;
      const title = section.querySelector('#noxisTaskTitle').value.trim();
      const projectId = document.getElementById('noxisProjectSelect')?.value || '';

      if (!projectId) {
        feedback.textContent = 'Please select an active project first.';
        return;
      }

      if (!title) {
        feedback.textContent = 'Please enter a task description.';
        return;
      }

      button.disabled = true;
      feedback.textContent = 'Saving task...';

      try {
        const response = await fetch(API, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({agent, title, project_id: projectId})
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        feedback.textContent =
          'Task registered for ' + agents[agent] +
          '.\nProject: ' + document.getElementById('noxisProjectSelect')?.selectedOptions[0]?.text +
          '\nID: ' + (data.id || data.activity?.id || 'check journal') +
          '\nStatus: planned — not executed automatically.';

        section.querySelector('#noxisTaskTitle').value = '';
      } catch (error) {
        feedback.textContent = 'Error: ' + error.message;
      } finally {
        button.disabled = false;
      }
    });
  }

  window.NoxisTasks = {renderTasks};
})();
