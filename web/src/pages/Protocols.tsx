import { PageShell } from "./PageShell";
import "./Protocols.css";

interface Protocol {
  id: string;
  name: string;
  steward: string;
  status: string;
  primitive: string;
  what: string;
  relation: string;
  stance: "aligned" | "converging" | "out-of-scope";
  source: { label: string; href: string };
}

const PROTOCOLS: Protocol[] = [
  {
    id: "uap",
    name: "UAP",
    steward: "NPCI",
    status: "Unveiling at Global Fintech Fest; awaiting RBI approval",
    primitive: "Delegated payment authority within a pre-set limit",
    what:
      "Lets AI agents transact over UPI without changing the existing rails, authenticating the agent and defining what it may spend. It leans on UPI Circle and Reserve Pay so a user can delegate authority to an agent up to a ceiling. Razorpay and NPCI shipped agentic UPI payments on Claude in February 2026 with Zomato, Swiggy and Zepto.",
    relation:
      "“Delegate authority within a pre-set limit” is ceilingInPaise on a signed mandate. Our authorization-agentic / settlement-human split is the shape UAP takes today: the agent authorizes, UPI settles.",
    stance: "aligned",
    source: {
      label: "Business Standard",
      href: "https://www.business-standard.com/finance/news/india-may-allow-agentic-ai-led-upi-transactions-under-new-npci-protocol-126070801343_1.html",
    },
  },
  {
    id: "ap2",
    name: "AP2",
    steward: "Google, donated to the FIDO Alliance",
    status: "v0.2.0, April 2026",
    primitive: "Three signed mandates as W3C Verifiable Credentials",
    what:
      "Announced with 60+ partners including Mastercard, PayPal and Amex. It carries Intent, Cart and Payment mandates, each signed by the user's wallet or the agent's key and passed between parties as verifiable JSON. It exists to answer who is liable, what was consented to, and whether the amount charged was the amount agreed.",
    relation:
      "We built the same primitive independently: a signed, bounded, single-use spend mandate, with the merchant holding only the public key. The honest gap is arity — we use one mandate where AP2 uses three. Splitting ours into Intent, Cart and Payment is the upgrade path, not a rewrite.",
    stance: "aligned",
    source: {
      label: "Google Cloud",
      href: "https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol",
    },
  },
  {
    id: "acp",
    name: "ACP",
    steward: "OpenAI and Stripe",
    status: "Beta, snapshot 2026-04-17",
    primitive: "Agentic checkout: cart, feed, orders, delegated auth",
    what:
      "An open standard for connecting buyers, their agents and businesses, Apache 2.0 and date-versioned. The 2026-04-17 snapshot added cart, feed, orders, authentication and Model Context Protocol compatibility. The live consumer surface is Instant Checkout in ChatGPT.",
    relation:
      "Our door is MCP, and ACP moved toward MCP compatibility in its latest snapshot. Catalog, quote and confirm are the same building blocks as its cart and checkout. The transports are converging rather than diverging.",
    stance: "converging",
    source: {
      label: "ACP specification",
      href: "https://github.com/agentic-commerce-protocol/agentic-commerce-protocol",
    },
  },
  {
    id: "x402",
    name: "x402",
    steward: "Coinbase and Cloudflare",
    status: "Live on Base, Ethereum, Solana and others",
    primitive: "HTTP 402 plus a signed stablecoin transfer",
    what:
      "Turns any endpoint into a machine-navigable paywall. The server answers 402 with payment terms, the client signs a token transfer authorization and retries with the signed payload in a header. Coinbase reported roughly 165 million transactions by late April 2026, with zero protocol fees.",
    relation:
      "It does not apply to us, and we would rather say so than imply support. x402 settles in USDC onchain. This merchant settles in rupees on Razorpay, under Indian payment regulation. Wrong currency, wrong rail, wrong jurisdiction.",
    stance: "out-of-scope",
    source: {
      label: "Coinbase",
      href: "https://www.coinbase.com/developer-platform/discover/launches/x402",
    },
  },
];

const STANCE_LABEL: Record<Protocol["stance"], string> = {
  aligned: "same primitive",
  converging: "converging transport",
  "out-of-scope": "out of scope",
};

const FLOW = [
  { step: "Intent", who: "Buyer", detail: "Occasion, headcount, budget. Stated in words, by a person or an agent." },
  { step: "Quote", who: "Merchant", detail: "Priced server-side from the catalog. No caller-supplied amount is trusted." },
  {
    step: "Authorization",
    who: "Human button, or a signed mandate",
    detail: "The gate. A person confirms, or an agent presents an Ed25519 mandate the merchant cannot forge.",
    gate: "agentic",
  },
  {
    step: "Settlement",
    who: "Razorpay",
    detail: "A hosted checkout a person completes. Authorization is agentic; settlement is not, and today that is honest.",
    gate: "human",
  },
];

export function Protocols() {
  return (
    <PageShell slug="protocols" width={940}>
      <section className="pg-intro" data-reveal>
        <span className="pg-eyebrow">Where this sits</span>
        <h1>
          Four protocols are racing
          <br />
          <em>to authorize a machine</em>
        </h1>
        <p>
          None of them is finished. Rather than adopt a draft, we implemented the primitive they
          share &mdash; a signed, bounded, single-use spend mandate &mdash; and exposed it over MCP,
          which exists today and real clients already speak.
        </p>
      </section>

      <section className="pg-section" data-reveal>
        <h2>The primitive they agree on</h2>
        <p className="pg-lede">
          Strip the wire formats away and every serious proposal answers the same question: how does
          a merchant know a human authorized this specific spend, and for how much? The answer is
          always a signed artifact with a limit, verified by someone who cannot produce it
          themselves.
        </p>
        <div className="pr-primitive">
          <div>
            <span>What we sign</span>
            <code>mandateId · principalId · agentId · ceilingInPaise · scope · issuedAt · expiresAt</code>
          </div>
          <div>
            <span>Who holds what</span>
            <p>
              The buyer&rsquo;s wallet holds the private key. The merchant holds only the public
              half, so it cannot forge the consent it is checking. HMAC here would have made the
              gate decoration.
            </p>
          </div>
        </div>
      </section>

      <section className="pg-section" data-reveal>
        <h2>The four, and where we stand against each</h2>
        <ul className="pr-list">
          {PROTOCOLS.map((protocol) => (
            <li key={protocol.id} className={`pr-item is-${protocol.stance}`}>
              <div className="pr-item-head">
                <h3>{protocol.name}</h3>
                <span className="pr-steward">{protocol.steward}</span>
                <span className={`pr-stance is-${protocol.stance}`}>{STANCE_LABEL[protocol.stance]}</span>
              </div>
              <dl className="pr-meta">
                <div>
                  <dt>Status</dt>
                  <dd>{protocol.status}</dd>
                </div>
                <div>
                  <dt>Primitive</dt>
                  <dd>{protocol.primitive}</dd>
                </div>
              </dl>
              <p className="pr-what">{protocol.what}</p>
              <p className="pr-relation">
                <strong>How BAZAAR relates.</strong> {protocol.relation}
              </p>
              <a className="pr-source" href={protocol.source.href} target="_blank" rel="noreferrer">
                {protocol.source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="pg-section" data-reveal>
        <h2>Where the money actually moves</h2>
        <p className="pg-lede">
          Four steps, and only two of them are gates. Marking which gate a machine may pass is the
          whole design.
        </p>
        <ol className="pr-flow">
          {FLOW.map((stage) => (
            <li key={stage.step} className={stage.gate ? `is-gate is-${stage.gate}` : undefined}>
              <span className="pr-flow-step">{stage.step}</span>
              <span className="pr-flow-who">{stage.who}</span>
              <p>{stage.detail}</p>
              {stage.gate && (
                <span className="pr-flow-tag">
                  {stage.gate === "agentic" ? "a machine may pass this" : "a person must pass this"}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="pg-section" data-reveal>
        <h2>The position, stated plainly</h2>
        <div className="pr-stance-block">
          <p>
            We do not claim compliance with a specification we have not implemented. Claiming AP2
            conformance because we also sign a mandate would be the easiest thing on this page to
            disprove.
          </p>
          <p>
            What is true is narrower and sturdier: the authorization gate is cryptographic and the
            merchant cannot forge it; bounds intersect and never union, so a mandate can never raise
            a merchant cap; and settlement stays human because a hosted checkout page is where the
            Indian rails actually are today. That last one is a position, not a gap &mdash; it is
            what the UAP pilots look like right now.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
