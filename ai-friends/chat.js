import { endpoint, siteKey } from "./config.js";
import { messageParts } from "./message-parts.mjs";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_TEXT_BYTES, MAX_TEXT_CHARS } from "./attachments.mjs";

const chatPage = document.getElementById("ai-friends");
const picker = document.getElementById("friendsAgent");
const portrait = document.getElementById("friendsPortrait");
const messages = document.getElementById("friendsMessages");
const form = document.getElementById("friendsForm");
const input = document.getElementById("friendsMessage");
const send = document.getElementById("friendsSend");
const save = document.getElementById("friendsSave");
const clear = document.getElementById("friendsClear");
const attach = document.getElementById("friendsAttach");
const fileInput = document.getElementById("friendsFile");
const attachmentRow = document.getElementById("friendsAttachment");
const fileName = document.getElementById("friendsFilename");
const removeFile = document.getElementById("friendsRemoveFile");
const fileStatus = document.getElementById("friendsFileStatus");
const verification = document.getElementById("friendsVerification");
const status = document.getElementById("friendsStatus");
const agents = new Map();
const configured = Boolean(endpoint && siteKey);
let challengeLoad;
let widget;
let token;
let busy = false;

for (const { dataset } of document.querySelectorAll("#friendsRoster [data-agent-id]")) {
  const { agentId, name, img } = dataset;
  agents.set(agentId, { name, img, history: [], draft: "", notice: "" });
  picker.add(new Option(name, agentId));
}

function updateControls() {
  const agent = agents.get(picker.value);
  send.disabled = busy || !token || agent?.readingFile || (!input.value.trim() && !agent?.attachment);
  save.disabled = !agent?.history.length;
  clear.disabled = busy;
  attach.disabled = removeFile.disabled = busy || Boolean(agent?.readingFile);
  attachmentRow.hidden = !agent?.attachment;
  fileName.textContent = agent?.attachment?.name || "";
  fileStatus.textContent = agent?.readingFile ? "Reading attachment…" : agent?.fileError || "";
}

async function readAttachment(file) {
  const name = file.name.slice(0, 120);
  if (!file.size) throw new Error("This file is empty.");
  if (Object.hasOwn(IMAGE_TYPES, file.type)) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Choose an image under 1 MB.");
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("This image could not be read."));
      reader.readAsDataURL(file);
    });
    if (!url.startsWith(`data:${file.type};base64,${IMAGE_TYPES[file.type]}`)) {
      throw new Error("This file does not match its image format.");
    }
    return { name, kind: "image", data: url };
  }
  if (!/\.(txt|md|csv|tsv|json)$/i.test(file.name)) {
    throw new Error("Choose PNG, JPG, WebP, TXT, MD, CSV, TSV or JSON.");
  }
  if (file.size > MAX_TEXT_BYTES) throw new Error("Choose a text file under 12,000 characters.");
  let data;
  try {
    data = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new Error("Choose a UTF-8 text file.");
  }
  if (!data.trim() || data.includes("\0")) throw new Error("Choose a non-empty text file.");
  if (data.length > MAX_TEXT_CHARS) throw new Error("Choose a text file under 12,000 characters.");
  return { name, kind: "text", data };
}

const codeFormats = new Map([
  ["html", ["HTML", "html"]], ["css", ["CSS", "css"]],
  ["js", ["JavaScript", "js"]], ["javascript", ["JavaScript", "js"]],
  ["ts", ["TypeScript", "ts"]], ["typescript", ["TypeScript", "ts"]],
  ["py", ["Python", "py"]], ["python", ["Python", "py"]],
  ["json", ["JSON", "json"]], ["sql", ["SQL", "sql"]],
  ["sh", ["Shell", "sh"]], ["bash", ["Bash", "sh"]],
  ["xml", ["XML", "xml"]], ["svg", ["SVG", "svg"]],
]);

function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  chatPage.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function codeBlock({ code, language }) {
  const [label, extension] = codeFormats.get(language) ?? [language.slice(0, 32) || "Code", "txt"];
  const block = document.createElement("div");
  block.className = "friends-code";
  const toolbar = document.createElement("div");
  toolbar.className = "friends-code-toolbar";
  const title = document.createElement("span");
  title.textContent = label;
  const actions = document.createElement("div");
  actions.className = "friends-code-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy Code";
  const feedback = document.createElement("span");
  feedback.className = "friends-code-feedback";
  feedback.setAttribute("role", "status");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      feedback.textContent = "Copied";
    } catch {
      feedback.textContent = "Copy unavailable. Select the code or download it.";
    }
  });
  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Download";
  download.addEventListener("click", () => downloadText("noxis-code." + extension, code));
  const pre = document.createElement("pre");
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", label + " source code");
  const source = document.createElement("code");
  source.textContent = code;
  pre.append(source);
  actions.append(copy, download, feedback);
  toolbar.append(title, actions);
  block.append(toolbar, pre);
  return block;
}

function appendMessage(agent, { role, content, attachment }) {
  const line = document.createElement("article");
  line.className = "friends-message friends-message-" + role;
  const name = document.createElement("strong");
  name.textContent = role === "assistant" ? agent.name : "You";
  line.append(name);
  const parts = role === "assistant" ? messageParts(content) : [{ text: content }];
  for (const part of parts) {
    if (part.text === undefined) line.append(codeBlock(part));
    else if (part.text.trim()) {
      const prose = document.createElement("p");
      prose.textContent = part.text.trim();
      line.append(prose);
    }
  }
  if (attachment) {
    const label = document.createElement("p");
    label.textContent = "Attachment: " + attachment.name;
    line.append(label);
    if (attachment.kind === "image") {
      const image = document.createElement("img");
      image.className = "friends-image";
      image.src = attachment.data;
      image.alt = attachment.name;
      line.append(image);
    }
  }
  messages.append(line);
  messages.scrollTop = messages.scrollHeight;
}

function showAgent() {
  const agent = agents.get(picker.value);
  portrait.hidden = !agent;
  messages.hidden = !agent;
  form.hidden = !agent || !configured;
  messages.replaceChildren();
  input.value = agent?.draft ?? "";
  if (agent) {
    portrait.src = agent.img;
    portrait.alt = agent.name;
    for (const message of agent.history) appendMessage(agent, message);
  }
  status.textContent = !configured ? "Online chat is not available yet."
    : agent?.notice || "";
  updateControls();
  if (agent && configured) prepareChallenge();
}

function loadChallenge() {
  if (!challengeLoad) {
    challengeLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      const timeout = setTimeout(() => fail(), 15_000);
      function fail() {
        clearTimeout(timeout);
        script.remove();
        reject(new Error("Verification unavailable"));
      }
      script.addEventListener("error", fail);
      script.addEventListener("load", () => {
        clearTimeout(timeout);
        if (window.turnstile) resolve(window.turnstile);
        else fail();
      });
      document.head.append(script);
    }).catch(error => {
      challengeLoad = undefined;
      throw error;
    });
  }
  return challengeLoad;
}

async function prepareChallenge() {
  try {
    const turnstile = await loadChallenge();
    if (widget !== undefined || form.hidden) return;
    widget = turnstile.render(verification, {
      sitekey: siteKey,
      action: "noxis_chat",
      size: "flexible",
      appearance: "interaction-only",
      callback(value) {
        token = value;
        if (!agents.get(picker.value)?.notice) status.textContent = "";
        updateControls();
      },
      "expired-callback"() {
        token = undefined;
        updateControls();
      },
      "error-callback"() {
        token = undefined;
        status.textContent = "Verification failed. Check your connection and try again.";
        updateControls();
        return true;
      },
    });
  } catch {
    status.textContent = "Verification is unavailable. Reload this page to retry.";
  }
}

showAgent();
picker.addEventListener("change", showAgent);
input.addEventListener("input", () => {
  const agent = agents.get(picker.value);
  if (agent) agent.draft = input.value;
  updateControls();
});
attach.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const agent = agents.get(picker.value);
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!agent || !file || busy) return;
  const reading = readAttachment(file);
  agent.readingFile = reading;
  agent.fileError = "";
  updateControls();
  try {
    const attachment = await reading;
    if (agent.readingFile === reading) agent.attachment = attachment;
  } catch (error) {
    if (agent.readingFile === reading) agent.fileError = error.message || "This file could not be read.";
  } finally {
    if (agent.readingFile === reading) agent.readingFile = undefined;
    updateControls();
  }
});
removeFile.addEventListener("click", () => {
  const agent = agents.get(picker.value);
  if (!agent) return;
  agent.attachment = undefined;
  agent.fileError = "";
  updateControls();
  attach.focus();
});
save.addEventListener("click", () => {
  const agent = agents.get(picker.value);
  if (!agent?.history.length) return;

  const transcript = agent.history.map(({ role, content, attachment }) =>
    (role === "assistant" ? agent.name : "You") + "\n" + content
      + (attachment ? "\n[Attachment: " + attachment.name + "]" : "")
  ).join("\n\n");
  const agentName = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = "noxis-chat-" + agentName + "-" + new Date().toISOString().slice(0, 10) + ".txt";
  downloadText(filename, agent.name + "\n\n" + transcript + "\n");
});
clear.addEventListener("click", () => {
  const agent = agents.get(picker.value);
  agent.history = [];
  agent.draft = "";
  agent.notice = "";
  agent.attachment = agent.readingFile = undefined;
  agent.fileError = "";
  showAgent();
  input.focus();
});

const errors = {
  400: "This message could not be sent. Try shortening it.",
  403: "Verification expired or failed. Please try again.",
  413: "Message and attachments are too large. Try a smaller file.",
  429: "The chat has reached a usage limit. Please try again later.",
};

form.addEventListener("submit", async event => {
  event.preventDefault();
  const agentId = picker.value;
  const agent = agents.get(agentId);
  const content = input.value.trim();
  if (!configured || !agent || (!content && !agent.attachment) || agent.readingFile || !token || busy) return;

  const attachment = agent.attachment;
  const userMessage = { role: "user", content, ...(attachment && { attachment }) };
  const challenge = token;
  const draft = agent.draft;
  token = undefined;
  busy = true;
  input.readOnly = true;
  agent.notice = agent.name + " is replying…";
  status.textContent = agent.notice;
  updateControls();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        messages: [...agent.history.slice(-4), userMessage],
        token: challenge,
      }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!response.ok) throw new Error(errors[response.status] || "");
    const { reply } = await response.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error();
    agent.history.push(userMessage, { role: "assistant", content: reply });
    if (agent.draft === draft) agent.draft = "";
    if (agent.attachment === attachment) agent.attachment = undefined;
    agent.fileError = "";
    agent.notice = "";
  } catch (error) {
    agent.notice = Object.values(errors).includes(error.message) ? error.message
      : "AI Friends is temporarily unavailable. Your message is ready to retry.";
  } finally {
    busy = false;
    input.readOnly = false;
    window.turnstile.reset(widget);
    if (picker.value === agentId) {
      showAgent();
      input.focus();
    } else {
      updateControls();
    }
  }
});
