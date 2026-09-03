# WIN.md — What to build, what to cut, and why

Written 2026-09-03. Submission 2026-09-05. **~48 hours, solo, part-time.**

This document is a plan, not a wish list. Every item carries a real cost estimate and a
verdict. The section that matters most is [§7 The 48-hour cut](#7-the-48-hour-cut).

---

## 1. Where the build actually stands

| Track-01 clause | Status | Evidence |
|---|---|---|
| Grow the merchant's revenue | Partial | Per-basket uplift proven (₹999 → ₹1753, +75%). **Not proven per merchant.** |
| Make them sellable to AI buyers | Built, **invisible** | MCP + Ed25519 mandates, verified live. Zero UI surface. |
| Conversational in-app checkout | Done | Realtime voice + text, both live |
| Agent-readable catalog | Done | `/.well-known/bazaar-commerce` + 4 MCP tools |
| Upsell & cross-sell agent | Done | `suggest_upsell` / `suggest_addon`, audited |
| Campaign orchestrator | Not built | — |
| Explainable | Done | Every decision logged with reasoning, streamed over SSE |
| Bounded | Done | 80% discount request → 15% applied, `wasClamped: true` |
| Gated | Done | Model has no charge tool; human confirms; agent needs a signed mandate |
| Resilient | Done | Decline → fresh retry link, unique reference, no crash |

**The bar is already met.** Everything below is about margin, not survival.

### The one thing that can still sink the demo

Razorpay test mode caps payment links at **30 lifetime, no reset**. The account is at 30.
Verified: links span 2026-08-24 → 2026-09-02 and a new creation returns
`RATE_LIMIT_EXCEEDED`. Confirm currently fails end to end.

**This outranks every feature in this document.** A judge who cannot watch money move
will discount everything else. Fix by (a) asking Razorpay support to raise the test-mode
limit, and/or (b) a second test account — 30 fresh links, one `.env` change, zero code.

---

## 2. Protocol research (for the comparison page)

Researched 2026-09-03. Sources at the end of each row.

### AP2 — Agent Payments Protocol (Google)

Announced Sept 2025 with 60+ partners (Mastercard, PayPal, Amex, Coinbase). **v0.2.0
shipped April 2026 and was donated to the FIDO Alliance on 2026-04-28.** Its core
primitive is three signed **Mandates** — Intent, Cart, Payment — each a W3C Verifiable
Credential signed by the user's wallet or the agent's key, passed between parties as
verifiable JSON. It exists to answer: who is liable, what was consented to, and was the
charged amount the agreed amount.

> **How BAZAAR relates:** we independently built the same primitive — a signed, bounded,
> single-use spend mandate — and we hold only the public key, so the merchant cannot forge
> authorization. **We use one mandate where AP2 uses three.** That is the honest gap and
> the obvious upgrade path: split ours into Intent (occasion/budget), Cart (this exact
> quote), Payment (the settlement instruction).

### ACP — Agentic Commerce Protocol (OpenAI + Stripe, now with Meta)

Released 2025-09-29, Apache 2.0, still **beta**, date-versioned. Latest snapshot
**2026-04-17 added cart, feed, orders, authentication, and — critically — Model Context
Protocol compatibility.** Live consumer surface is Instant Checkout in ChatGPT (Etsy, with
Shopify merchants rolling out).

> **How BAZAAR relates:** ACP moving toward MCP compatibility means our transport choice is
> converging with theirs, not diverging. We expose catalog → quote → confirm over MCP,
> which is the same shape as ACP's cart/checkout building blocks. This is the strongest
> "we picked the right rail" argument available.

### UAP — Unified Agent Protocol (NPCI)

**The most important one for this judging panel.** NPCI is building UAP so AI agents can
transact over UPI without changing existing rails, authenticating and authorizing agents
and defining transaction permissions. It leans on **UPI Circle and Reserve Pay to let a
user delegate payment authority to an agent within a pre-set limit.** It needs RBI
approval, and **is being unveiled at Global Fintech Fest in Mumbai this week.**
**Razorpay and NPCI announced agentic UPI payments on Claude in February 2026**, with
Zomato, Swiggy and Zepto as launch partners.

> **How BAZAAR relates:** "delegate payment authority within a pre-set limit" *is*
> `ceilingInPaise` on a signed mandate. Our `authorization-agentic/settlement-human` split
> is precisely the shape UAP takes today. Say this out loud in the demo — the judges work
> at the company that shipped the pilot.

### x402 (Coinbase + Cloudflare)

HTTP 402 + stablecoins over Base/Solana. Server answers `402` with payment terms, client
signs a transfer authorization and retries. Real volume (Coinbase reported ~165M
transactions by late April 2026), zero protocol fees, x402 Foundation governance.

> **How BAZAAR relates:** **it does not, and we should say so.** x402 settles in USDC
> onchain. We settle in INR on Razorpay. Naming it and explaining why it is out of scope
> demonstrates more literacy than pretending to support it.

**Sources:** [AP2 (Google Cloud)](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol) ·
[ACP spec](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) ·
[Stripe on ACP](https://stripe.com/blog/developing-an-open-standard-for-agentic-commerce) ·
[NPCI UAP](https://www.business-standard.com/finance/news/india-may-allow-agentic-ai-led-upi-transactions-under-new-npci-protocol-126070801343_1.html) ·
[UAP at GFF](https://www.outlookbusiness.com/news/india-plans-ai-powered-upi-payments-framework-through-unified-agent-protocol) ·
[x402 (Coinbase)](https://www.coinbase.com/developer-platform/discover/launches/x402)

---

## 3. The proposals, assessed

### P1 — Merchant dashboard + multi-vertical (bakery / clothing / car dealer)

**Two ideas in one. They deserve separate verdicts.**

**P1a — Merchant growth dashboard. Verdict: BUILD FIRST. ~3h.**
The statement says grow the *merchant's* revenue. We prove one basket. A merchant asks a
different question: across every conversation, what did this agent earn me? AOV, attach
rate, upsell acceptance rate, discount cost vs revenue gained, net uplift over baseline.
All of it is already in the SQLite audit table (`getRecentAuditEvents` exists, events
survive restarts). Real numbers, no mockup. This is the single strongest remaining answer
to the headline.

*Risk:* the numbers will be small and mostly from testing. **Show honest counts.** A judge
who catches padded metrics discounts the whole page.

**P1b — Multi-vertical. Verdict: BUILD, BUT AS CONFIG. ~3h.**
Strong instinct — it converts "cute bakery demo" into "platform". The catalog is already
JSON and guardrails are already config, so the honest version is a **merchant profile**:
catalog + guardrail caps + persona + cross-sell rules, selected at runtime. Clothing (size
and fit questions, bundle upsell) and a car dealer (huge order values, so the ₹5000 cap
must move — which incidentally *proves* the caps are real config, not decoration) are good
foils.

*Risk:* three hardcoded demos read as padding. One abstraction with three configs reads as
architecture. Only do the latter. *Also:* a car dealer's order value blowing past
`maxOrderValuePaise` is a **feature** — it shows the bound binding on a different vertical.

---

### P2 — Part B visible in the UI

**Verdict: BUILD. ~2h. Best value per hour in this document.**
Half the problem statement is built well and currently invisible unless you open a
terminal. A panel that reads `/.well-known`, lists the four MCP tools, and shows the
refusal codes an AI buyer actually hits (`MANDATE_SIGNATURE_INVALID`, `CEILING_EXCEEDED`)
closes the gap. Live buyer session streamed into the page if time allows; static evidence
from a recorded run if not.

*Note:* my earlier advice to delete `AgentDoor` caused this gap. That was a mistake given
the framing.

---

### P3 — Campaign orchestrator

**Verdict: ONLY IF TIME REMAINS. ~2h for the honest version.**
It is one of four *example* directions, not a requirement, and three are already done
properly. A thin fourth invites "did you finish any of these?"

If built, the only defensible version is **grounded in the audit data you already have**:
scan recorded sessions, surface real patterns ("6 of 9 sessions asked for chocolate";
"attach rate is 41% — a bundled topper offer would lift it"), and propose a campaign the
merchant approves. That reuses P1a's aggregation and stays inside the explainable/bounded/
gated frame. A fake scheduler with invented numbers actively damages the submission.

---

### P4 — MCP connector for third parties

**Verdict: BUILD THE DOCS, NOT THE PLATFORM. ~1.5h.**
Mostly already true: any MCP client can connect today. What is missing is *onboarding* — a
page with the endpoint, a copy-paste client config, the auth header shape, the mandate
format, and a demo credential.

**Do not build self-serve credential issuance.** `AGENT_CREDENTIALS` fails closed by
design; a rushed signup endpoint on a money path is exactly the kind of thing that turns a
security story into a security incident. Documented onboarding gets the same credit at a
fraction of the risk.

---

### P5 — Demote voice from headline to support

**Verdict: AGREE. ~1h.**
Correct instinct. Voice is a *channel*, and leading with it framed the build as a voice
demo rather than a commerce-governance platform. The thesis — an agent that can spend money
is a liability until it is auditable — is the headline. Voice is evidence of reach.

The realtime work is not wasted; it stays as a differentiator that most submissions will
not have. It just stops being the first thing on the page. Cost is layout and copy, not
architecture.

---

### P6 — Expanded multi-page site

**Verdict: BUILD THREE PAGES, NOT SIX. ~4h for three; ~10h+ for six.**
This is the highest risk item in the document. Six thin pages look worse than three
finished ones, and half-built navigation is the most visible kind of unfinished.

Ranked by judge impact:

1. **`/protocols`** — the UAP/ACP/AP2/x402 comparison from §2. Nobody else will have this,
   and UAP launching at GFF this week makes it timely. **Build this.**
2. **`/dashboard`** — P1a lives here. **Build this.**
3. **`/agents`** — P2 + P4 together: the MCP door, tools, refusals, connection docs.
   **Build this.**
4. *Payments / money-flow page* — largely duplicates the audit trail and order sheet. Fold
   the diagram into `/protocols` instead.
5. *Security page* — fold into `/agents`. The security story **is** the mandate story:
   asymmetric keys, single-use nonces in SQLite, fail-closed credentials, no charge tool
   on the model, counterparty text never entering merchant audit reasoning.

---

## 4. Honest review of the six points

**What is right:**

- **P1a is the best idea in the list** and neither of us named it until now. It reframes
  the build from sales toy to revenue instrument.
- **P5 is a mature call.** Cutting your own most recent, most impressive feature down to
  supporting-cast because it distorts the story is the correct instinct, and rare.
- **P2 is right and urgent.** Half the statement is currently invisible.
- **P1b's instinct about reach is right** — judges do ask "does this only work for cakes?"

**Where I would push back:**

- **The total is 4–6 days of work. You have about two.** Building all six half-way is
  strictly worse than building three completely. This is the main risk, and it is not a
  motivation problem — it is arithmetic.
- **P3 is the weakest per hour.** Three example directions are done well; the fourth adds
  breadth where you are already strong and steals hours from depth.
- **P6 as specified (six pages) is the second-biggest risk.** Three pages, finished.
- **None of this matters if payment links stay capped.** Ranking a dashboard above a
  working confirm button would be a mistake.

**The uncomfortable one:** more surface area is the most common way hackathon projects
lose. Judges score depth of proof, not count of pages. Your build already clears the bar —
the remaining work should make what exists *legible*, not add new things to explain in a
five-minute demo.

---

## 5. What would actually change a judge's mind

Ranked, from what has been verified live:

1. **Ask for 50% off and watch the server refuse.** `requestedPercent: 80 →
   appliedPercent: 15, wasClamped: true`. Bounded, on screen, from real code.
2. **The AI buyer tampering with its own mandate and being refused.**
   `MANDATE_SIGNATURE_INVALID`, then `CEILING_EXCEEDED` with the binding constraint handed
   back, then the agent self-correcting to an affordable basket. Nobody expects this.
3. **The merchant selling to the machine.** Quote returns machine-readable offers; the
   buyer computes that upgrading unlocks a bulk discount inside its ceiling and accepts.
   ₹999 → ₹1619 without a human. That is the whole thesis in one screen.
4. **Aggregate uplift** (P1a) — the number that says *merchant*, not *basket*.
5. **The UAP alignment sentence**, delivered to the people who shipped the pilot.

---

## 6. Deliberate non-goals

State these as positions, not gaps:

- **Settlement stays human.** Payment Links are a hosted human checkout page, so an
  autonomous agent cannot complete one. The mandate is the authorization gate; UPI/card
  remains the settlement gate. **That is exactly where UAP is today.**
- **No x402 / stablecoins.** Wrong currency, wrong rail, wrong jurisdiction.
- **No self-serve agent credentials.** Fails closed on purpose.
- **Discounts are merchant-offered, never counterparty-requested.** An external agent has
  no `apply_discount` tool and cannot write into the merchant's audit record.

---

## 7. The 48-hour cut

Ordered. Stop when time runs out; everything above the line is coherent on its own.

| # | Task | Cost | Owner |
|---|---|---|---|
| 0 | **Razorpay limit** — email support **and** stand up a second test account | 30m | Dhruv |
| 1 | Merchant dashboard, real aggregates (P1a) → `/dashboard` | 3h | Claude |
| 2 | Part B visible: MCP door, tools, refusals, connect docs (P2+P4) → `/agents` | 3h | Claude |
| 3 | Protocol comparison page from §2 (P6.1) → `/protocols` | 2h | Claude |
| 4 | Demote voice to supporting role (P5) | 1h | Claude |
| 5 | Merchant profiles: bakery / clothing / dealer as config (P1b) | 3h | Claude |
| 6 | Docs truth pass: PLAN.md, CLAUDE.md, README + live URLs | 1h | Claude |
| 7 | **Rehearse on the demo laptop**, including a decline | 1h | Dhruv |
| — | *— line: everything below is optional —* | | |
| 8 | Campaign orchestrator, grounded in audit data (P3) | 2h | Claude |
| 9 | Split mandate into AP2-shaped Intent/Cart/Payment | 3h | Claude |

**Above the line: ~13h of build + 1.5h of your time.** That is achievable in two days and
leaves the submission coherent. Items 8 and 9 are genuinely optional; 9 is the more
impressive of the two if a choice must be made, because it converts "inspired by AP2" into
"structurally compatible with AP2".

---

## 8. Things that are true and worth repeating in the demo

- The model **has no tool that moves money.** Not a policy — an absence.
- **Bounds intersect, never union.** A mandate cannot raise a merchant cap; a merchant cap
  is never waived by presenting a mandate. The tighter always binds, and the refusal says
  which one bound.
- **Nonce durability is a security property.** Spent mandate ids live in SQLite, so replay
  protection survives a restart. In-memory would have made it a lie.
- **HMAC would have made the gate theatre.** A merchant able to compute the signature can
  forge the authorization. The merchant holds only the public key.
- **Counterparty text never becomes merchant audit reasoning.** The human tools take a free
  text reason because the caller is ours; the agent tools deliberately do not.
