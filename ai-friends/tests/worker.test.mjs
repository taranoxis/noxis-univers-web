import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.mjs";
import { agents } from "../worker/agents.mjs";

const origin = "https://taranoxis.github.io";
const valid = {
  agentId: "NX-20260919-AREN",
  messages: [{ role: "user", content: "De unde vine un gând?" }],
  token: "test-token",
};

function request(data = valid, { path = "/chat", method = "POST", ...overrides } = {}) {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.10",
      ...overrides,
    },
    ...(method === "POST" && { body: typeof data === "string" ? data : JSON.stringify(data) }),
  });
}

function setup(t) {
  const verify = t.mock.method(globalThis, "fetch", async () => Response.json({
    success: true, hostname: "taranoxis.github.io", action: "noxis_chat",
  }));
  const run = t.mock.fn(async () => ({
    choices: [{ message: { content: "Hai să urmărim cum apare un gând." } }],
  }));
  const limit = t.mock.fn(async () => ({ success: true }));
  return {
    verify, run, limit,
    env: { SITE_ORIGIN: origin, TURNSTILE_SECRET: "test-only", AI: { run }, CHAT_LIMIT: { limit } },
  };
}

test("all seven agents match Gallery names, portrait files and existing Archive IDs", async () => {
  const root = new URL("../../", import.meta.url);
  const html = await readFile(new URL("index.html", root), "utf-8");
  const entries = [...html.matchAll(/data-agent-id="([^"]+)"\s+data-name="([^"]+)"\s+data-role="[^"]+"\s+data-img="([^"]+)"/g)];
  assert.equal(entries.length, 7);
  assert.equal(agents.size, 7);
  const archivePages = await Promise.all(["", "nyra/", "nyxin/", "nyxer/", "ar-in/", "ar-on/", "aren/"]
    .map(path => readFile(new URL("archives/" + path + "index.html", root), "utf-8")));
  for (const [, id, name, image] of entries) {
    assert.equal(agents.get(id)[0], name);
    assert.ok(archivePages.some(page => page.includes("<code>" + id + "</code>")));
    assert.ok((await readFile(new URL(image, root))).length > 0);
  }
});

test("website preflight is allowed and an unrelated origin is denied", async t => {
  const { env, run, verify } = setup(t);
  const response = await worker.fetch(request(null, {
    method: "OPTIONS", "Access-Control-Request-Method": "POST",
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  const denied = await worker.fetch(request(valid, { Origin: "https://unrelated.example" }), env);
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(run.mock.callCount(), 0);
  assert.equal(verify.mock.callCount(), 0);
});

test("every agent passes bounded context to the online model with its own persona", async t => {
  const { env, run, verify } = setup(t);
  const messages = [
    ...valid.messages,
    { role: "assistant", content: "Putem analiza cum se formează." },
    { role: "user", content: "Dă-mi un exemplu." },
  ];
  for (const [agentId, [name]] of agents) {
    const response = await worker.fetch(request({ ...valid, agentId, messages }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { reply: "Hai să urmărim cum apare un gând." });
    const [model, params] = run.mock.calls.at(-1).arguments;
    assert.equal(model, "@cf/google/gemma-4-26b-a4b-it");
    assert.equal(params.messages[0].role, "system");
    assert.ok(params.messages[0].content.startsWith("You are " + name));
    assert.deepEqual(params.messages.slice(1), messages);
    assert.equal(params.max_completion_tokens, 420);
    assert.deepEqual(params.chat_template_kwargs, { enable_thinking: false });
    assert.equal(params.store, false);
  }
  const [verifyUrl, options] = verify.mock.calls[0].arguments;
  assert.equal(new URL(verifyUrl).hostname, "challenges.cloudflare.com");
  assert.equal(options.body.get("response"), valid.token);
});

test("malformed or over-limit input never reaches the online services", async t => {
  const { env, run, verify, limit } = setup(t);
  for (const data of ["{", null, [], { ...valid, agentId: "__proto__" },
    { ...valid, token: "" },
    { ...valid, messages: [{ role: "system", content: "Other role" }] },
    { ...valid, messages: [{ role: "user", content: "x".repeat(801) }] },
    { ...valid, messages: Array(7).fill(valid.messages[0]) }]) {
    assert.equal((await worker.fetch(request(data), env)).status, 400);
  }
  assert.equal((await worker.fetch(request(" ".repeat(37_001)), env)).status, 413);
  assert.equal((await worker.fetch(request(valid, { "Content-Type": "text/plain" }), env)).status, 415);
  assert.equal((await worker.fetch(request(null, { method: "GET" }), env)).status, 405);
  assert.equal((await worker.fetch(request(null, { method: "GET", path: "/archives" }), env)).status, 404);
  assert.equal(run.mock.callCount(), 0);
  assert.equal(verify.mock.callCount(), 0);
  assert.equal(limit.mock.callCount(), 0);
});

test("abuse limit and failed verification deny inference", async t => {
  const { env, run, verify, limit } = setup(t);
  limit.mock.mockImplementationOnce(async () => ({ success: false }));
  assert.equal((await worker.fetch(request(), env)).status, 429);
  assert.equal(verify.mock.callCount(), 0);
  for (const result of [
    { success: false },
    { success: true, hostname: "different.example", action: "noxis_chat" },
    { success: true, hostname: "taranoxis.github.io", action: "other_action" },
  ]) {
    verify.mock.mockImplementationOnce(async () => Response.json(result));
    assert.equal((await worker.fetch(request(), env)).status, 403);
  }
  assert.equal(run.mock.callCount(), 0);
});

test("missing bindings, empty inference and provider failures return unavailable", async t => {
  const { env, run } = setup(t);
  assert.equal((await worker.fetch(request(), { ...env, TURNSTILE_SECRET: "" })).status, 503);
  run.mock.mockImplementationOnce(async () => ({
    choices: [{ message: { reasoning_content: "internal output only" } }],
  }));
  assert.equal((await worker.fetch(request(), env)).status, 503);
  run.mock.mockImplementationOnce(async () => { throw new Error("internal provider output"); });
  const error = await worker.fetch(request(), env);
  assert.equal(error.status, 503);
  assert.deepEqual(await error.json(), { error: "Chat temporarily unavailable" });
});
