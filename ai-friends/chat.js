import { endpoint, siteKey } from "./config.js";

const dialog = document.getElementById("ai-friends");
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

for (const { dataset } of document.querySelectorAll("#gallery [data-agent-id]")) {
  const { agentId, name, img } = dataset;
  agents.set(agentId, { name, img, history: [], draft: "", notice: "" });
  picker.add(new Option(name, agentId));
}

function updateControls() {
  send.disabled = busy || !token || !input.value.trim();
  save.disabled = !agents.get(picker.value)?.history.length;
  clear.disabled = busy;
}

function appendMessage(agent, { role, content }) {
  const line = document.createElement("p");
  const name = document.createElement("strong");
  name.textContent = role === "assistant" ? agent.name : "You";
  line.append(name, document.createTextNode("\n" + content));
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
    status.textContent = "Verification is unavailable. Reopen AI Friends to retry.";
  }
}

for (const trigger of [document.getElementById("friendsHotspot"), document.getElementById("friendsPortal")]) {
  trigger.addEventListener("click", event => {
    event.preventDefault();
    dialog.showModal();
    showAgent();
  });
}

document.getElementById("friendsClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("keydown", event => {
  if (event.key === "Escape") event.stopPropagation();
});
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
  const blob = new Blob([agent.name, "\n\n", transcript, "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const agentName = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  link.href = url;
  link.download = "noxis-chat-" + agentName + "-" + new Date().toISOString().slice(0, 10) + ".txt";
  dialog.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
      if (dialog.open) input.focus();
    } else {
      updateControls();
    }
  }
});
