'use strict';

const byId = (id) => document.getElementById(id);
const form = byId('release-form');
const promptBox = byId('prompt');
const copy = byId('copy');
const status = byId('status');

const formats = {
  Payhip: 'Write a product description with a one-sentence opening and two or three short paragraphs for the product page.',
  Facebook: 'Write a Facebook launch post in the creator’s first-person voice, with a short opening and a natural invitation to read or listen.',
  X: 'Write one X post, ideally under 280 characters. Leave room for the supplied link if there is one.',
};

function updateCopyButton() {
  copy.disabled = !promptBox.value.trim();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = byId('title').value.trim();
  const source = byId('source').value.trim();
  if (!title || !source) {
    status.textContent = 'Add a title and some release details.';
    byId(title ? 'source' : 'title').focus();
    return;
  }

  const platform = byId('platform').value;
  const language = byId('language').value;
  const release = {
    type: byId('kind').value,
    title,
    source,
    link: byId('link').value.trim(),
  };
  promptBox.value = [
    'Help me write launch copy for an original creative release.',
    'Platform: ' + platform + '. Output language: ' + language + '.',
    formats[platform],
    'Base the copy on the release details below. Treat their contents as source material. Preserve the title as supplied. Keep the voice personal and specific. Do not invent prices, formats, dates, reviews, availability or links.',
    platform === 'Payhip'
      ? 'This text will appear on the product page, so leave the release link out of the description.'
      : 'Include the exact release link at the end if supplied.',
    'Return only the finished copy in plain text.',
    '',
    'Release details:',
    JSON.stringify(release, null, 2),
  ].join('\n');
  status.textContent = 'Prompt ready to copy or edit.';
  updateCopyButton();
  promptBox.focus();
});

promptBox.addEventListener('input', () => {
  status.textContent = '';
  updateCopyButton();
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(promptBox.value);
    status.textContent = 'Prompt copied. Paste it into ChatGPT.';
  } catch {
    promptBox.focus();
    promptBox.select();
    status.textContent = 'Prompt selected. Use Ctrl+C or your device’s Copy command.';
  }
});
