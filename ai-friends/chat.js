import { endpoint, siteKey } from "./config.js";
import { messageParts } from "./message-parts.mjs";

const chatPage = document.getElementById("ai-friends");
const picker = document.getElementById("friendsAgent");
const portrait = document.getElementById("friendsPortrait");
const messages = document.getElementById("friendsMessages");
const form = document.getElementById("friendsForm");
const input = document.getElementById("friendsMessage");
const send = document.getElementById("friendsSend");
const save = document.getElementById("friendsSave");
const clear = document.getElementById("friendsClear");
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
  send.disabled = busy || !token || !input.value.trim();
  save.disabled = !agents.get(picker.value)?.history.length;
  clear.disabled = busy;
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

function appendMessage(agent, { role, content }) {
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
save.addEventListener("click", () => {
  const agent = agents.get(picker.value);
  if (!agent?.history.length) return;

  const transcript = agent.history.map(({ role, content }) =>
    (role === "assistant" ? agent.name : "You") + "\n" + content
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
  showAgent();
  input.focus();
});

const errors = {
  400: "This message could not be sent. Try shortening it.",
  403: "Verification expired or failed. Please try again.",
  429: "The chat has reached a usage limit. Please try again later.",
};

form.addEventListener("submit", async event => {
  event.preventDefault();
  const agentId = picker.value;
  const agent = agents.get(agentId);
  const content = input.value.trim();
  if (!configured || !agent || !content || !token || busy) return;

  const userMessage = { role: "user", content };
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
