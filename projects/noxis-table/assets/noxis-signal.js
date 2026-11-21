/* NOXIS — real recorded messages */
'use strict';

(() => {
  const API = 'http://127.0.0.1:8765/api/messages';
  const KEYS = ['nyxar', 'ar_in', 'nyxin', 'nyxer', 'ar_on', 'aren'];
  const $ = id => document.getElementById(id);

  const veil = $('signalVeil');
  const form = $('signalForm');
  const sender = $('signalSender');
  const receiver = $('signalReceiver');
  const content = $('signalContent');
  const feedback = $('signalFeedback');
  const submit = $('signalSubmit');

  if (!veil || !form) return;

  const names = {
    nyxar: 'NYXAR', ar_in: 'AR_IN', nyxin: 'NYXIN',
    nyxer: 'NYXER', ar_on: 'AR_ON', aren: 'AREN'
  };

  for (const key of KEYS) {
    for (const select of [sender, receiver]) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = names[key];
      select.appendChild(option);
    }
  }


  const modelLabel = document.createElement('label');
  modelLabel.textContent = 'Model / work mode';
  modelLabel.style.cssText = 'display:block;margin:10px 0';
  const modelProfile = document.createElement('select');
  modelProfile.id = 'signalModelProfile';
  modelProfile.setAttribute('aria-label', 'Model and work mode');
  modelProfile.style.cssText =
    'display:block;width:100%;margin-top:6px;padding:9px;background:#17152e;' +
    'color:#e5e7eb;border:1px solid #63558b;border-radius:8px';
  modelLabel.appendChild(modelProfile);
  form.prepend(modelLabel);
  let modelReceiver = null;

  function updateModelChoices() {
    if (modelReceiver === receiver.value) return;
    modelReceiver = receiver.value;
    modelProfile.replaceChildren();
    if (receiver.value === 'nyxar') {
      modelProfile.add(new Option('General — Qwen 2.5 7B', 'general'));
      modelProfile.add(new Option('Code & Security — Qwen 2.5 Coder 7B', 'code_security'));
      modelProfile.disabled = false;
    } else {
      modelProfile.add(new Option(
        receiver.value === 'ar_in'
          ? 'Text & Languages — OpenEuroLLM-Romanian'
          : 'General — Qwen 2.5 7B',
        'general'
      ));
      modelProfile.disabled = true;
    }
  }
  receiver.addEventListener('change', updateModelChoices);

  sender.value = 'nyxar';
  receiver.value = 'ar_in';

  function close() {
    if (submit.disabled) return;
    veil.classList.add('hidden');
  }

  function open() {
    updateModelChoices();
    feedback.textContent = '';
    veil.classList.remove('hidden');
    content.focus();
  }

  $('signalCancel').addEventListener('click', close);

  veil.addEventListener('click', event => {
    if (event.target === veil) close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !veil.classList.contains('hidden')) {
      close();
    }
  });

  // Capture the existing button click before the old placeholder handler.
  $('ubtnSignal').addEventListener('click', event => {
    event.stopImmediatePropagation();
    open();
  }, true);

  form.addEventListener('submit', async event => {
    event.preventDefault();

    if (sender.value === receiver.value) {
      feedback.textContent = 'Sender and receiver must be different.';
      return;
    }

    if (!content.value.trim()) {
      feedback.textContent = 'Write a message first.';
      return;
    }

    submit.disabled = true;
    feedback.textContent = 'Recording message...';

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          sender: sender.value,
          model_profile: modelProfile.value || 'general',
          receiver: receiver.value,
          content: content.value.trim(),
          project_id: $('noxisProjectSelect')?.value || null
        })
      });

      if (response.status !== 201) {
        throw new Error('HTTP ' + response.status);
      }

      const record = await response.json();
      if (record.status !== 'recorded') {
        throw new Error('Unexpected server confirmation');
      }

      feedback.textContent =
        'Message recorded. Receiver has not processed it yet.';

      document.dispatchEvent(new Event('noxis-messages-updated'));
      content.value = '';
      window.NoxisLivePanel?.refreshPanel();

      // Visual confirmation of the actual recorded route.
      for (const key of [record.sender, record.receiver]) {
        const line = $('ul-' + key);
        if (line) {
          line.classList.add('hot');
          setTimeout(() => line.classList.remove('hot'), 1800);
        }
      }

      setTimeout(close, 1400);
    } catch (error) {
      feedback.textContent = 'Message not confirmed: ' + error.message;
    } finally {
      submit.disabled = false;
    }
  });

  window.NoxisSignal = {open};
})();
