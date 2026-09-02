# Bazaar: Agentic Commerce Product & Security Plan

Updated: 2026-09-02

## Executive read

Bazaar already proves the strongest part of the brief: the language model can sell, but it cannot directly charge. Catalog pricing, discount caps, quote expiry, mandate verification, single-use consumption, payment-link idempotency, audit events, and Razorpay recovery are implemented in deterministic server code.

The next step is to turn the demo into a trustworthy merchant product: durable checkout state, authenticated agent and merchant operations, signed protocol evidence, webhook-first settlement, observable operations, and a UI that makes the proof easy to understand in under ten seconds.

## What exists today

### Frontend

- React 19 + Vite, with a landing page and `/app` workspace.
- Conversation panel with text, browser voice fallback, Deepgram/ElevenLabs adapters, starter prompts, loading, and error states.
- Governance rail showing policy limits, staged order, topology, guarantees, agent discovery, and live audit stream.
- Three.js/R3F coin focal visual and a concise TL;DR block on the landing page.
- Theme tokens are explicit for light and dark modes; no product screenshot is required for the hero.

### Backend

- Express API with rate limiting, CORS, security headers, JSON/raw-body parsing, and feature configuration reporting.
- OpenAI tool loop with Zod-validated tool arguments. The model can search, recommend, cross-sell, upsell, request discounts, and stage an order; it has no payment tool.
- Server-side catalog pricing and discount clamping.
- Human checkout confirmation and an agent checkout path over MCP.
- Ed25519 mandate verification, agent binding, expiry, category scope, single-use storage, and merchant-cap intersection.
- Razorpay Payment Links with unique retry reference IDs, polling, webhook handling, and a shared failure-recovery path.
- SQLite audit events and SSE streaming.

## Important gaps before production

These are not reasons to weaken the current demo; they are the hardening backlog.

1. **State durability.** Pending orders and chat sessions are in memory. A process restart loses quotes, payment attempts, and conversation context. Move quotes/orders, idempotency keys, and session metadata to SQLite/Postgres with explicit status transitions.
2. **Webhook robustness.** Keep the raw-body signature check, but make JSON parsing and event extraction fail closed with a structured 400. Add event-id deduplication and persist the provider event before acknowledging it.
3. **Simulation endpoint.** `simulate-failure` is a useful demo control but must be disabled outside a local/demo environment or protected by an operator credential and an explicit feature flag.
4. **Authentication and tenancy.** MCP credentials are currently environment-mapped bearer keys. Replace with a credential store supporting rotation, revocation, tenant/merchant binding, scopes, and constant-time token verification. Add merchant/operator authentication before exposing audit or order operations publicly.
5. **Mandate model.** The current Ed25519 mandate is a sound local authorization primitive, but an interoperability adapter should add versioned typed claims, a checkout hash, issuer/key identity, merchant binding, and a signed receipt. Never accept a mandate that is not bound to the exact quote and amount.
6. **Proxy and abuse controls.** Configure `trust proxy` deliberately before relying on `req.ip`; add body limits per route, request IDs, structured logs, CSRF/origin checks for browser mutations, and a CSP. Do not expose secrets or full PII in audit payloads.
7. **Inventory and fulfillment.** Pricing is catalog-grounded, but stock, delivery windows, tax, address, cancellation, refund, and fulfillment state are not yet first-class domain objects.
8. **SSE lifecycle.** Authenticate the stream, send a replay cursor/Last-Event-ID, include heartbeat comments, and fetch recent events before subscribing so a reconnect cannot create a misleading gap.
9. **Provider verification.** Keep Razorpay webhooks as the source of truth for asynchronous settlement and use provider fetch only as a bounded reconciliation fallback. Razorpay explicitly recommends webhooks for automation and API fetch for urgent confirmation.
10. **Test coverage.** Add route-level security tests, malformed webhook tests, replay/idempotency tests, quote persistence tests, authorization matrix tests, and property tests for pricing/discount invariants.

## Recommended end-to-end architecture

```text
Trusted UI / shopping agent
          |
          | authenticated request + request id
          v
Commerce API ── Policy engine ── Quote/order state store
     |                 |                 |
     |                 |                 +── inventory / fulfillment
     |                 +── mandate verifier + replay store
     +── audit/event outbox ── SSE/read model
     |
     +── Razorpay adapter ── signed webhook ingest ── settlement state
```

The model should remain an untrusted planner. It may propose actions, but every mutation goes through a deterministic command handler. A quote is immutable and expires. Confirmation re-prices and re-authorizes the quote, then atomically claims payment-link creation. A provider webhook advances the order state; the UI renders that state rather than guessing from a client response.

## Protocol positioning

AP2 is an authorization/payment-evidence layer, not a complete catalog or checkout API. Its specification defines Shopping Agent, Credential Provider, Merchant, Merchant Payment Processor, and Trusted Surface roles, and uses Checkout/Payment Mandates and Receipts. It requires deterministic validation even when a role also uses an LLM. Bazaar's current merchant cap + signed mandate + human confirmation maps cleanly to this model, but the next version should bind a mandate to a canonical closed checkout and emit a receipt.

UCP/ACP-style commerce APIs should own discovery, catalog, cart, checkout, and order semantics; AP2-like evidence should own authorization and payment proof. MCP is a transport/tool surface for the agent, not the trust model. Keep these concerns separate in the codebase.

Razorpay Payment Links are appropriate for the test-mode demo and human settlement rail. The official API creates links with amount, currency, expiry, reference ID, and notes. Razorpay documents a test-mode limit of 30 links per business, requires unique reference IDs, and recommends signed webhook verification and webhook-first automation.

## Build sequence

### Phase 1 — production-shaped core

- Introduce a `Quote`, `Order`, `PaymentAttempt`, `Mandate`, and `ProviderEvent` schema with explicit state machines.
- Add database-backed idempotency for `request_quote`, confirm, retries, and webhook events.
- Add signed closed-quote/check-out evidence and receipt records.
- Disable or protect demo-only failure simulation by environment.

### Phase 2 — merchant operations

- Add authenticated merchant workspace: revenue lift, conversion, accepted offers, refusal reasons, payment recovery, and audit export.
- Add inventory, tax, delivery, cancellation, and refund adapters behind deterministic interfaces.
- Add campaign/offer configuration with approval workflow and versioned policy snapshots.

### Phase 3 — interoperable agent buying

- Version the MCP tool contract and publish a discovery document with auth, capabilities, limits, and protocol versions.
- Add a UCP/ACP adapter for catalog/checkout semantics while retaining the same policy core.
- Add AP2-compatible mandate/receipt mapping; document exactly which claims Bazaar verifies and which it does not.

### Phase 4 — evidence and operations

- Add signed audit export, correlation IDs, redaction, retention policy, and operator review.
- Add metrics/traces for quote-to-payment funnel, policy refusals, provider latency, webhook lag, and recovery success.
- Run adversarial tests: prompt injection, tool argument tampering, quote replay, mandate replay, price drift, duplicate webhook, and concurrent confirmation.

## Acceptance bar

- No model output can alter a price, discount, inventory result, authorization decision, or settlement state.
- Every money action has a correlation ID, actor, policy snapshot, quote ID, reason, and provider evidence.
- A quote cannot be confirmed after expiry, after price drift, after mandate expiry, or twice with the same mandate/idempotency key.
- Webhook retries are safe and duplicate provider events do not duplicate payment or audit outcomes.
- Browser and MCP clients receive the same deterministic quote and policy decisions.
- Secrets never reach the browser, logs, MCP responses, or audit payloads.
- Every privileged route has authentication, authorization, rate limits, validation, and negative tests.

## Sources

- [Google AP2 specification](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/specification.md) — roles, deterministic verification, mandates, receipts, and human-present/autonomous modes.
- [Google AP2 checkout mandate](https://github.com/google-agentic-commerce/AP2/blob/main/docs/ap2/checkout_mandate.md) — closed checkout mandate and checkout binding.
- [Google developer guide to agent protocols](https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/) — AP2 authorization evidence alongside commerce protocols.
- [Razorpay: create a standard Payment Link](https://razorpay.com/docs/api/payments/payment-links/create-standard/) — amount, expiry, reference IDs, test-mode limits, and signature guidance.
- [Razorpay: webhooks](https://razorpay.com/docs/webhooks/) — webhook-first automation, raw verification, and API reconciliation guidance.
- [Razorpay: Payment Link webhook events](https://razorpay.com/docs/webhooks/payment-links/?preferred-country=IN) — payment-link event payloads and duplicate/retry considerations.
