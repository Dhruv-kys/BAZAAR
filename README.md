# BAZAAR

A sales agent for a merchant, on Razorpay test-mode APIs. Built for Razorpay Buildathon
**Track 01 — AI Growth & Agentic Commerce**.

**Live:** the agent at <https://bazaar-agent.vercel.app> · the API at <https://bazaar-demo.duckdns.org>

Two front doors sit on one policy core:

- **Human ↔ agent** — a voice-and-text sales conversation that recommends, cross-sells and upsells,
  then stops at an order summary. Nothing is charged until a person presses confirm.
- **Agent ↔ agent** — the same catalog and the same limits exposed over MCP, where the confirm
  button is replaced by an Ed25519-signed spend mandate.

Pricing, guardrail arithmetic, mandate verification and the single charge path live in
`server/src/commerce/`. Both doors are thin callers of it; neither reimplements policy.

## Money invariants

Enforced in server code, never in a prompt. The full list is at the top of
`server/src/commerce/policy.ts`.

| Requirement | How |
| --- | --- |
| **Explainable** | Every recommendation, upsell, discount, charge and failure is written to SQLite with its reasoning and streamed to the browser over SSE. |
| **Bounded** | Caps come from the active merchant profile (bakery: 15% / ₹200 / ₹5,000 order ceiling). A model asking for 50% off gets 15% applied and both values recorded with `wasClamped: true`. Totals are recomputed from the catalog, never taken from the model. |
| **Gated** | No tool can charge. `POST /api/orders/:id/confirm` is the only route that mints a payment link, and it re-checks limits first. On the agent door the gate is a signed, single-use mandate. |
| **Bounds intersect** | `effective = min(mandate ceiling, merchant cap)`. A mandate never raises a merchant limit; a merchant limit is never waived by presenting one. Refusals name the binding constraint, so the caller can self-correct. |
| **Resilient** | Declines, expiries and upstream 429s go through one handler that logs the failure and issues a replacement link under a new reference id. `POST /api/payments/:id/simulate-failure` triggers the same path without spending a real payment link. |

## Quickstart

Node ≥ 22.12.

```bash
npm install
npm run dev               # API :3001, web :5173 (proxies /api)
```

Keys go in a root `.env` (see below). Nothing is required to boot: the server prints which
features are disabled at startup, and routes for unconfigured providers return 503 with a readable
message rather than failing at request time.

| Command | |
| --- | --- |
| `npm run dev` | server + web together |
| `npm test` | server suite, 85 tests |
| `npm run typecheck` | both workspaces |
| `npm run lint -w web` | oxlint |
| `npm run build -w server` | `server/dist/` |
| `npm run wallet -- keygen` | mint the buyer keypair for the agent door |
| `npm run buyer` | drive the merchant over real MCP |
| `npm run verify:mcp` | 21 assertions against the running agent door; spends no payment links |

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | chat and realtime voice |
| `OPENAI_MODEL` | default `gpt-4o-mini` |
| `OPENAI_REALTIME_MODEL` / `OPENAI_REALTIME_VOICE` | default `gpt-realtime-2.1` / `cedar` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | test-mode payment links |
| `RAZORPAY_WEBHOOK_SECRET` | optional; the server also polls link status |
| `MANDATE_PUBLIC_KEY` | verifies spend mandates (public half only) |
| `AGENT_CREDENTIALS` | `key:agentId` pairs for the MCP door; unset means no agent can authenticate |
| `MERCHANT_PROFILE` | `bakery` (default), `clothing`, `dealer` |
| `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY` | typed-mode STT/TTS fallback; browser speech APIs cover it when absent |
| `APP_ORIGIN` | comma-separated CORS allowlist; localhost:5173 is always allowed |
| `PORT` | default 3001 |
| `VITE_API_BASE_URL` | web build only; leave empty in dev so the Vite proxy handles `/api` |

The merchant is configuration. `MERCHANT_PROFILE` selects the catalog, the caps, the trade and what
the agent qualifies on, from `server/src/merchant/*.json`. The dealer profile exists to prove the
order cap is real config — its cars cost far more than the bakery's ceiling.

## API

| Endpoint | |
| --- | --- |
| `POST /api/chat` | one conversation turn |
| `POST /api/orders/:summaryId/confirm` | the only route that creates a payment link |
| `GET /api/orders/:summaryId/status` | paid / pending |
| `POST /api/payments/webhook` | Razorpay webhook, signature verified on raw bytes |
| `POST /api/payments/:summaryId/simulate-failure` | force the decline path |
| `GET /api/audit`, `/api/audit/stream`, `/api/audit/metrics`, `/api/audit/impact` | history, SSE, dashboard aggregates |
| `GET /api/guardrails` | the active limits |
| `POST /api/realtime/session`, `/api/realtime/tool` | WebRTC client secret; tool relay back into the same handlers |
| `GET /api/voice/config`, `POST /api/voice/transcribe`, `/api/voice/speak` | typed-mode voice |
| `GET /.well-known/bazaar-commerce` | machine-readable policy, tools and refusal codes |
| `POST /mcp` | agent door, `Authorization: Bearer <agent credential>` |
| `GET /api/agents/demo` | runs a live MCP session against this server and streams the steps to the `/mcp` page |

Rate limits are per-IP sliding windows: chat 20/min, orders 30/min, agents 10/min, the rest 60/min.

Model tools: `search_catalog`, `get_product_details`, `recommend_product`, `suggest_addon`,
`suggest_upsell`, `apply_discount`, `present_order_summary`. Agent tools: `search_catalog`,
`get_product`, `request_quote`, `confirm_order`. `apply_discount` is deliberately absent from the
agent door — discounts are merchant-offered, and no counterparty text is ever written into the
merchant's audit record.

## Agent-to-agent flow

```bash
npm run wallet -- keygen                              # writes server/.wallet/principal.key, prints MANDATE_PUBLIC_KEY
# .env: MANDATE_PUBLIC_KEY=...  AGENT_CREDENTIALS=demo-agent-key:agent-alpha
npm run dev
npm run buyer                                         # a real MCP client, as agent-alpha
```

The merchant holds only the public key; the private half never leaves the buyer wallet. HMAC would
have made the gate theatre — a merchant able to compute the signature could forge the
authorization. Mandate ids are consumed in a `consumed_mandates` table, so replay protection
survives a process restart.

Settlement is deliberately split, and declared as `authorization-agentic/settlement-human`: the
mandate is the authorization gate, and Razorpay's hosted Payment Link stays the settlement gate.

## Connect a third-party MCP client

Any client that speaks stdio — Claude Desktop, Cursor, and most others — reaches this
merchant through the standard remote shim. Verified against the deployed endpoint:

```json
{
  "mcpServers": {
    "bazaar": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://bazaar-demo.duckdns.org/mcp",
        "--header", "Authorization: Bearer <your agent credential>"
      ]
    }
  }
}
```

Credentials are issued by the merchant, never self-served: `AGENT_CREDENTIALS` maps a bearer
token to an agent id, and with it unset nobody authenticates at all. Rate limits are per
credential, so one busy agent cannot starve another.

## Verify the agent door yourself

```bash
npm run dev
npm run verify:mcp        # 21 assertions against the running merchant, over real MCP
```

It drives the live endpoint as a real MCP client and asserts what unit tests cannot reach: that an
unknown or missing credential is turned away over HTTP, that a tool-calling model's explicit nulls
survive the wire, that every mandate failure is refused with the code the contract publishes, that
bounds intersect and the binding constraint is handed back, and that an agent's quote cannot be
confirmed through the human route.

**Every confirm it makes is one the merchant must refuse, so the run cannot reach payment link
creation.** It is safe to run repeatedly against the demo account.

## Payment testing

Test mode; no money moves.

- Card `4111 1111 1111 1111`, any future expiry, any CVV. OTP of 4–10 digits pays.
- OTP under 4 digits, or UPI `failure@razorpay`, declines.

**Razorpay test mode caps Payment Links at 30 for the lifetime of the account, with no reset.**
Cancelling old links does not free slots — creation is what counts. Conversation, clamping and the
whole MCP flow cost nothing; only `confirm` consumes one. Do not burn links rehearsing.

A decline costs **two** links, not one: the original, plus the replacement the retry mints. Budget
accordingly — thirty links is roughly a dozen complete run-throughs.

When the cap is reached the order is still staged, priced and authorized; only settlement is
unavailable. The refusal says so, with the code `PAYMENT_PROVIDER_LIMIT`, rather than inviting a
retry that can never succeed.

## Deployment

Frontend and backend are hosted separately.

- **Web** — static build on Vercel from `main`. `vercel.json` builds only the web workspace and
  rewrites all paths to `index.html` so deep links survive the history router. Vite, the React
  plugin, TypeScript and `@types/*` sit in `dependencies`, not `devDependencies`: Vercel installs
  with `NODE_ENV=production`, which would otherwise prune exactly the toolchain the build needs.
- **API** — EC2, Caddy terminating TLS, pm2 running `server/dist/index.js`. Deploy is
  `git pull && npm run build -w server && pm2 restart bazaar-server`.

The API must be a persistent process, not Lambda: better-sqlite3 writes a real file, the session and
order stores are in-memory, and the payment watcher polls on `setTimeout`. All three break under
serverless isolation.

Every browser call goes through `apiUrl()` in `web/src/api.ts`. A bare `/api/...` string works in dev
and breaks only in production.

## Layout

```
server/src/
  agent/       tool-calling loop, schemas, handlers, session state
  commerce/    pricing, policy, mandates, quotes, the single charge path
  mcp/         agent door and /.well-known descriptor
  merchant/    profiles (catalog + caps + persona) as JSON
  payments/    Razorpay links, failure handling, status polling
  audit/       SQLite log, SSE emitter, revenue attribution
  routes/      chat, orders, payments, audit, voice, realtime
  wallet/      buyer-side keygen, mandate minting, MCP client
web/src/
  chat/ order/ audit/ voice/    the workspace at /app
  dashboard/ governance/        merchant revenue view
  landing/ mcp/ pages/          /, /mcp, /protocols
```

Web routes: `/` landing, `/app` the agent, `/dashboard` revenue, `/mcp` the agent door,
`/protocols` where this sits against UAP / AP2 / ACP / x402.

## Stack

Node and TypeScript throughout, npm workspaces. Express, better-sqlite3, MCP SDK 1.30 on the server;
Vite and React 19 on the web. OpenAI `gpt-4o-mini` for tool calling and Realtime over WebRTC for
voice, with Deepgram/ElevenLabs as the typed-mode fallback. Razorpay REST for payment links; the
Node SDK is used only for webhook signature verification.
