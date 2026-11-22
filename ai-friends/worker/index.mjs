import { agents, persona } from "./agents.mjs";

const MAX_BODY = 37_000;
const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function headers(origin) {
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
}

function json(status, data, origin) {
  return Response.json(data, { status, headers: headers(origin) });
}

async function readJson(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY) throw new RangeError();
  if (!request.body) throw new SyntaxError();

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new RangeError();
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function validMessages(messages) {
  return Array.isArray(messages) && [1, 3, 5].includes(messages.length)
    && messages.every((message, index) => {
      const role = index % 2 ? "assistant" : "user";
      return message?.role === role && typeof message.content === "string"
        && message.content.trim().length > 0
        && message.content.length <= (role === "user" ? 800 : 1_600);
    });
}

async function verify(env, origin, ip, token) {
  const response = await fetch(VERIFY_URL, {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Verification unavailable");
  const result = await response.json();
  return result.success === true && result.action === "noxis_chat"
    && result.hostname === new URL(origin).hostname;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = origin && origin === env.SITE_ORIGIN;
    if (url.pathname !== "/chat") return json(404, { error: "Not found" }, allowed ? origin : null);
    if (!allowed) return json(403, { error: "Origin denied" });
    if (request.method === "OPTIONS") {
      if (request.headers.get("Access-Control-Request-Method") !== "POST") {
        return json(405, { error: "Method not allowed" }, origin);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...headers(origin),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        },
      });
    }
    if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
    if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json(415, { error: "JSON required" }, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP");
    if (!env.TURNSTILE_SECRET || !env.AI || !env.CHAT_LIMIT || !ip) {
      return json(503, { error: "Chat unavailable" }, origin);
    }

    let data;
    try {
      data = await readJson(request);
    } catch (error) {
      return error instanceof RangeError
        ? json(413, { error: "Message too large" }, origin)
        : json(400, { error: "Invalid JSON" }, origin);
    }

    const agent = agents.get(data?.agentId);
    if (!agent || !validMessages(data.messages)
        || typeof data.token !== "string" || !data.token.trim() || data.token.length > 2_048) {
      return json(400, { error: "Invalid chat request" }, origin);
    }

    try {
      if (!(await env.CHAT_LIMIT.limit({ key: ip })).success) {
        return json(429, { error: "Usage limit reached" }, origin);
      }
      if (!await verify(env, origin, ip, data.token)) {
        return json(403, { error: "Verification failed" }, origin);
      }
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: persona(agent) },
          ...data.messages.map(({ role, content }) => ({ role, content })),
        ],
        max_completion_tokens: 420,
        store: false,
        stream: false,
      });
      const content = result?.choices?.[0]?.message?.content ?? result?.response;
      const reply = typeof content === "string" ? content.trim().slice(0, 1_600) : "";
      if (!reply) return json(503, { error: "AI unavailable" }, origin);
      return json(200, { reply }, origin);
    } catch {
      return json(503, { error: "Chat temporarily unavailable" }, origin);
    }
  },
};
