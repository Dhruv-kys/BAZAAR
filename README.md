# Bazaar

A voice-and-text sales agent for a merchant, built on Razorpay test-mode APIs.

Submission for Razorpay Buildathon **Track 01 — AI Growth & Agentic Commerce**.

The agent talks to a customer, works out what they want, recommends a product, cross-sells an
add-on and upsells a bigger variant when there's a reason to. It then stops and shows an order
summary. Nothing is charged until a human presses confirm. Every decision it makes is written to
an audit log that streams to the screen while you use it.

The demo merchant is a bakery with 3 products and 3 add-ons.

## How the four requirements are met

The brief requires every money action to be explainable, bounded, gated, and resilient.

**Explainable.** Every recommendation, cross-sell, upsell, discount, order summary, payment result
and retry is written to a SQLite audit log with the reasoning behind it, and pushed to the browser
over Server-Sent Events as it happens.

**Bounded.** Limits live in `server/src/guardrails/config.ts` and are enforced in server code, not
in the prompt: 15% maximum discount, ₹200 maximum flat discount, ₹5,000 maximum order value.
If the model asks for 50% off, the server applies 15% and records both the requested and applied
values with `wasClamped: true`. Order totals are recomputed from the catalog rather than trusting
arithmetic from the model.

**Gated.** The model has no tool that can charge anyone. Its `present_order_summary` tool only
stages an order. The only way a payment link comes into existence is
`POST /api/orders/:summaryId/confirm`, which runs when a person clicks the confirm button and
re-checks the limits first. The retry path can issue a replacement link, but only for an order a
human already confirmed.

**Resilient.** Declines, expiries and upstream rate limits go through one shared handler that logs
the failure and issues a fresh payment link. Retries use a new reference id (`{summaryId}-r1`)
because Razorpay requires those to be globally unique. There is also a button in the UI that
triggers the same failure path directly, so the decline can be demonstrated without depending on
the venue's wifi.

## Running it

Requires Node 22.12 or newer.

```bash
npm install
npm run dev
```

That starts the API on `:3001` and the web app on `:5173`, which proxies `/api` to the server.

Other commands:

```bash
npm test                 # server test suite (43 tests)
npm run typecheck        # both workspaces
npm run lint -w web
```

## Environment variables

Create a `.env` in the repo root. Nothing here is required to boot — the server prints which
features are disabled on startup and the affected routes return a readable 503.

| Variable | Needed for |
| --- | --- |
| `OPENAI_API_KEY` | the agent conversation |
| `OPENAI_MODEL` | optional, defaults to `gpt-4o-mini` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | creating test-mode payment links |
| `RAZORPAY_WEBHOOK_SECRET` | optional, see note below |
| `DEEPGRAM_API_KEY` | speech-to-text, falls back to the browser |
| `ELEVENLABS_API_KEY` | text-to-speech, falls back to the browser |
| `APP_ORIGIN` | comma-separated CORS allowlist for deployment |
| `PORT` | defaults to 3001 |

Webhooks are optional because the server also polls `GET /v1/payment_links/:id` after creating a
link, so a completed or expired payment is picked up either way. If both are enabled the paid path
de-duplicates, so nothing is logged twice.

Voice works without any keys — the browser's own `SpeechRecognition` and `speechSynthesis` are used
when Deepgram and ElevenLabs are not configured.

## Testing a payment

Razorpay test mode, so no real money moves.

- Card `4111 1111 1111 1111`, any future expiry, any CVV.
- OTP of 4–10 digits completes the payment.
- OTP under 4 digits, or UPI ID `failure@razorpay`, triggers a decline.

The decline is the case worth watching: the agent recovers, logs the failure, and issues a new
payment link rather than crashing.

## Layout

```
server/
  src/
    agent/          tool-calling loop, tool schemas and handlers, session state
    audit/          SQLite audit log and its event emitter
    catalog/        products, variants and add-ons as JSON
    guardrails/     the limits, in one file
    payments/       Razorpay payment links, failure handling, status polling
    routes/         chat, orders, payments, audit, guardrails, voice
    voice/          Deepgram and ElevenLabs clients
web/
  src/
    chat/           conversation panel
    order/          order summary and the confirm button
    audit/          live audit trail
    landing/        landing page
    voice/          microphone and playback
```

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | one conversation turn |
| `GET /api/guardrails` | the active limits, for the UI badge |
| `GET /api/audit?sessionId=` | full audit history for a session |
| `GET /api/audit/stream` | live audit events over SSE |
| `POST /api/orders/:summaryId/confirm` | the only route that creates a payment link |
| `GET /api/orders/:summaryId/status` | whether an order has been paid |
| `POST /api/payments/:summaryId/simulate-failure` | trigger the decline path on demand |
| `POST /api/payments/webhook` | Razorpay webhook, signature verified |
| `GET /api/voice/config` | which voice providers are configured |
| `POST /api/voice/transcribe` | audio in, transcript out |
| `POST /api/voice/speak` | text in, audio out |

## The tools the model can call

`search_catalog`, `get_product_details`, `recommend_product`, `suggest_addon`, `suggest_upsell`,
`apply_discount`, `present_order_summary`.

Arguments are validated with zod before any handler runs. There is deliberately no tool for taking
payment.

## Deployment

The frontend is a static build and the backend is a normal long-running Node process, so they can
be hosted separately. The web app reads `VITE_API_BASE_URL` at build time; leave it unset for local
development and the Vite proxy handles it. Set `APP_ORIGIN` on the server to the frontend's origin
so CORS allows it.

The backend needs a persistent process rather than serverless functions: it writes a SQLite file,
keeps sessions in memory, and polls payment links on a timer.

## Stack

Node and TypeScript throughout, npm workspaces. Express on the server, Vite and React 19 on the
web. OpenAI `gpt-4o-mini` for tool calling, better-sqlite3 for the audit log, Deepgram and
ElevenLabs for voice, and the Razorpay REST API for payment links.
