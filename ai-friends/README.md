# NOXIS AI Friends

The existing AI Friends card opens a dedicated chat page. Its selector uses the same agent names, portraits and IDs as the existing Gallery. The Worker uses a fixed list of those IDs and uses conversation profiles based on the existing NOXIS Family configurations for Nyxar, Nyxin, Nyxer, AR_IN, AREN and AR_ON, and the Gallery profile for Nyra. The Worker uses hosted Gemma for inference. It does not call the local Ollama models or load NOXIS TABLE conversations, workspaces or tools. There is no Archive access from the chat.

The site uses the public configuration in `config.js`. Empty values disable sending. The frontend holds each conversation in memory until the page is reloaded or the visitor clears the chat. Each request sends at most two previous exchanges and the new message to the Worker. The Worker validates Cloudflare Turnstile tokens, checks the site origin and applies per-IP rate limiting. It returns text only and does not store chat messages.

## Local verification

From the repository root, with Node.js 22 or later:

```sh
node --test ai-friends/tests/worker.test.mjs
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.166.0 deploy --dry-run --config ai-friends/worker/wrangler.toml
```

The browser test uses Playwright and Chromium. With both installed, run `node --test ai-friends/tests/browser.test.mjs`. To use an existing installation outside the checkout, point `PLAYWRIGHT_MODULE` at the package and optionally set `CHROMIUM_PATH` to the browser executable. The tests intercept Turnstile and Workers AI, so they make no external inference calls.

## After Tara approves deployment

1. Use a Cloudflare **Workers Free** account and a free Managed Turnstile widget. Keep the account on Workers Free so exhaustion of the daily AI allocation stops inference instead of incurring usage charges.
2. Set the allowed website origin in `worker/wrangler.toml` and register the matching hostname in Turnstile. The planned production origin is `https://taranoxis.github.io`. An HTTPS staging origin needs its own Worker configuration and Turnstile widget.
3. Authenticate Wrangler for the approved account. Deploy the Worker with `npx wrangler@4.166.0 deploy --config ai-friends/worker/wrangler.toml` and set the secret with `npx wrangler@4.166.0 secret put TURNSTILE_SECRET --config ai-friends/worker/wrangler.toml`. The chat endpoint rejects requests until the secret is present. Keep the secret out of Git and the frontend.
4. In the approved site environment, set `endpoint` in `config.js` to the Worker HTTPS URL ending in `/chat` and `siteKey` to the widget's public site key. Smoke-test a real reply in Romanian or English, a follow-up, switching agents and an expired challenge on the authorized staging origin before publishing the production configuration.

Workers AI is hosted independently of Z230. The free daily allowance is a capacity limit. Visitors see a temporary-unavailable message and keep their unsent text when the provider fails.
