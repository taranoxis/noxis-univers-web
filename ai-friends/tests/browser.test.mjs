import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import worker from "../worker/index.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = "https://taranoxis.github.io";
const prefix = "/noxis-univers-web/";
const chat = origin + "/test-chat";
const root = new URL("../../", import.meta.url);
const mockedWidget = `
  let widgetOptions;
  let counter = 0;
  window.turnstile = {
    render(container, options) {
      widgetOptions = options;
      queueMicrotask(() => this.reset());
      return "test-widget";
    },
    reset() { widgetOptions.callback("verified-" + ++counter); }
  };
`;

test("desktop and mobile can open AI Friends, chat and return to the original portal", async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  t.after(() => browser.close());
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(new URL(url).hostname, "challenges.cloudflare.com");
    return Response.json({ success: true, hostname: "taranoxis.github.io", action: "noxis_chat" });
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const calls = [];
    let unavailable = false;
    const env = {
      SITE_ORIGIN: origin,
      TURNSTILE_SECRET: "test-only",
      CHAT_LIMIT: { limit: async () => ({ success: true }) },
      AI: { run: async (_model, options) => {
        calls.push(options.messages);
        if (unavailable) throw new Error("Provider unavailable");
        return { choices: [{ message: { content: "Răspuns <b>de test</b>." } }] };
      } },
    };
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname === "challenges.cloudflare.com") {
        await route.fulfill({ contentType: "text/javascript", body: mockedWidget });
      } else if (url.href === chat) {
        const response = await worker.fetch(new Request("https://worker.example/chat", {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10" },
          body: route.request().postData(),
        }), env);
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers),
          body: await response.text() });
      } else if (url.origin === origin && url.pathname === prefix + "ai-friends/config.js") {
        await route.fulfill({ contentType: "text/javascript", body:
          `export const endpoint = ${JSON.stringify(chat)}; export const siteKey = "test-only";` });
      } else if (url.origin === origin && url.pathname.startsWith(prefix)) {
        const path = decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html";
        const types = { html: "text/html", js: "text/javascript", css: "text/css",
          png: "image/png", webp: "image/webp", svg: "image/svg+xml" };
        const type = types[path.split(".").at(-1)];
        if (!type) return route.abort();
        let body;
        try { body = await readFile(new URL(path, root)); } catch { return route.abort(); }
        await route.fulfill({ contentType: type, body });
      } else {
        await route.abort();
      }
    });
    await page.goto(origin + prefix, { waitUntil: "domcontentloaded" });
    await page.locator("#biggerButton").click();
    await page.getByRole("button", { name: "Open AI Friends chat" }).click();
    const picker = page.locator("#friendsAgent");
    const save = page.getByRole("button", { name: "Save chat" });
    const dialog = await page.locator("#ai-friends").boundingBox();
    assert.ok(dialog.width > viewport.width * (viewport.width > 500 ? 0.6 : 0.9));
    assert.equal(await picker.locator("option").count(), 8);
    await picker.selectOption("NX-20260919-AREN");
    assert.equal(await page.locator("#friendsPortrait").getAttribute("alt"), "AREN Noxis");
    assert.equal(await save.isEnabled(), false);
    await page.locator("#friendsMessage").fill("De unde vine un gând?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator("#friendsMessages p").nth(1).waitFor();
    assert.match(await page.locator("#friendsMessages").textContent(), /AREN Noxis\s+Răspuns <b>de test<\/b>/);
    assert.equal(await page.locator("#friendsMessages b").count(), 0);
    const downloadEvent = page.waitForEvent("download");
    await save.click();
    const download = await downloadEvent;
    assert.match(download.suggestedFilename(), /^noxis-chat-aren-noxis-\d{4}-\d{2}-\d{2}\.txt$/);
    const transcript = await readFile(await download.path(), "utf-8");
    assert.match(transcript, /You\nDe unde vine un gând\?/);
    assert.match(transcript, /AREN Noxis\nRăspuns <b>de test<\/b>\./);

    await picker.selectOption("NX-ID-NYRA");
    assert.equal(await save.isEnabled(), false);
    assert.equal(await page.locator("#friendsMessages p").count(), 0);
    await page.locator("#friendsMessage").fill("Salut Nyra!");
    unavailable = true;
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("Your message is ready to retry.", { exact: false }).waitFor();
    assert.equal(await page.locator("#friendsMessage").inputValue(), "Salut Nyra!");
    unavailable = false;
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator("#friendsMessages p").nth(1).waitFor();
    assert.match(calls.at(-1)[0].content, /^You are Nyra Noxis/);
    await page.getByRole("button", { name: "Clear chat" }).click();
    assert.equal(await page.locator("#friendsMessages p").count(), 0);
    await picker.selectOption("NX-20260919-AREN");
    assert.equal(await page.locator("#friendsMessages p").count(), 2);
    await page.locator("#friendsMessage").fill("Un exemplu?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator("#friendsMessages p").nth(3).waitFor();
    assert.equal(calls.at(-1).at(-3).content, "De unde vine un gând?");

    await page.keyboard.press("Escape");
    await page.locator("#ai-friends").waitFor({ state: "hidden" });
    assert.ok(await page.locator("#universe").evaluate(element => element.classList.contains("open")));
    assert.ok(await page.locator("#booksHotspot").isVisible());
    assert.ok(await page.locator("#discoverHotspot").isVisible());
    await page.close();
  }
});
