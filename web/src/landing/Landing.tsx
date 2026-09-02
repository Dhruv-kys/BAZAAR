import { Suspense, lazy, useEffect, useState } from "react";
import { ArrowUpRightIcon, GitHubIcon, LockIcon, MoonIcon, SunIcon } from "../icons";
import { navigate } from "../router";
import { useReveal } from "./useReveal";
import { useTheme } from "../useTheme";
import "./Landing.css";

const CoinScene = lazy(() => import("./CoinScene"));

const AUDIT_REPLAY = [
  { time: "16:56:03", type: "recommend", tone: "l-blue", text: "1 kg suits a birthday for fifteen guests" },
  { time: "16:56:04", type: "cross_sell", tone: "l-cyan", text: "Edible topper matches the occasion" },
  { time: "16:56:15", type: "discount !", tone: "l-warn", text: "FIRST_ORDER · guardrail 50% → 15% · CAPPED" },
  { time: "16:57:00", type: "result", tone: "l-stop", text: "Simulated failure (demo trigger)" },
  { time: "16:57:01", type: "retry", tone: "l-warn", text: "Fresh payment link issued after the decline" },
] as const;

function AuditReplay() {
  const [visible, setVisible] = useState<number>(AUDIT_REPLAY.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || visible >= AUDIT_REPLAY.length) return;
    const timer = window.setTimeout(() => setVisible((count) => Math.min(count + 1, AUDIT_REPLAY.length)), 680);
    return () => window.clearTimeout(timer);
  }, [playing, visible]);

  useEffect(() => {
    if (visible >= AUDIT_REPLAY.length) setPlaying(false);
  }, [visible]);

  return (
    <div className="lp-replay">
      <div className="lp-replay-controls">
        <span><i className="is-live" /> LIVE EVIDENCE</span>
        <div>
          <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Replay"}</button>
          <button type="button" onClick={() => { setVisible(0); setPlaying(true); }}>Reset</button>
        </div>
      </div>
      <div className="lp-replay-progress"><b style={{ width: `${(visible / AUDIT_REPLAY.length) * 100}%` }} /></div>
      <div className="lp-replay-events" aria-live="polite">
        {AUDIT_REPLAY.slice(0, visible).map((event) => (
          <div className="lp-replay-event" key={event.time}>
            <span className="l-time">{event.time}</span>
            <span className={event.tone}>{event.type}</span>
            <p><span className="l-dim">▸</span> {event.text}</p>
          </div>
        ))}
        {!visible && <p className="lp-replay-empty">Press replay to watch the guardrail in motion.</p>}
      </div>
    </div>
  );
}

function TextRail() {
  const lines = ["SELL WITH A BRAKE PEDAL", "EXPLAIN EVERY DECISION", "LET THE SERVER HOLD THE LINE"];
  return (
    <div className="lp-marquee" aria-label="Bazaar principles" tabIndex={0}>
      <div className="lp-marquee-track">
        {[...lines, ...lines].map((line, index) => (
          <span key={`${line}-${index}`}><i />{line}</span>
        ))}
      </div>
      <span className="lp-marquee-hint">scroll sideways →</span>
    </div>
  );
}


const GUARANTEES = [
  {
    n: "01",
    label: "Explainable",
    claim: "Every decision is logged with its reason",
    detail:
      "Each recommendation, cross-sell, upsell and discount is written to an audit log with the reasoning behind it, streamed to the screen as it happens rather than buried in a server file.",
  },
  {
    n: "02",
    label: "Bounded",
    claim: "Caps the agent cannot talk its way past",
    detail:
      "Discount and order limits live in server code. Ask for 50% off and the request is clamped to the real ceiling before it touches a total. The log records both numbers.",
  },
  {
    n: "03",
    label: "Gated",
    claim: "The model has no tool that can charge you",
    detail:
      "There is deliberately no charge function exposed to the agent. It can only stage a summary. A payment link exists only after a human presses confirm.",
  },
  {
    n: "04",
    label: "Resilient",
    claim: "A declined payment recovers, not crashes",
    detail:
      "Declines, expiries and upstream rate limits are handled on one shared path that logs the failure and issues a fresh payment link.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Reads the occasion",
    body: "Birthday for fifteen, chocolate, first order. The agent turns plain language into catalog filters.",
  },
  {
    n: "02",
    title: "Sells, within limits",
    body: "Recommends a fit, cross-sells an add-on, upsells only with a stated reason. Discounts get clamped server-side.",
  },
  {
    n: "03",
    title: "Stops at the gate",
    body: "An itemised summary appears with the real total. Nothing moves until you confirm it yourself.",
    gate: true,
  },
  {
    n: "04",
    title: "Charges on Razorpay",
    body: "Confirming creates a Razorpay payment link. Card details are entered there, never on this site.",
  },
];

function OpenAgent({ large }: { large?: boolean }) {
  return (
    <a className={`lp-cta${large ? " lp-cta-lg" : ""}`} href="/app" onClick={navigate("/app")}>
      <span>Open the agent</span>
      <span className="lp-cta-orb" aria-hidden="true">
        <ArrowUpRightIcon size={large ? 15 : 13} />
      </span>
    </a>
  );
}

function detectField() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [field] = useState(detectField);
  useReveal();

  return (
    <div className="lp">
      <div className="lp-progress" aria-hidden="true" />
      <nav className="lp-nav">
        <a className="lp-brand" href="/" onClick={navigate("/")}>
          <span className="lp-brand-mark" aria-hidden="true">
            ❖
          </span>
          <span className="lp-brand-name">Bazaar</span>
          <span className="lp-brand-slash">/agent</span>
        </a>
        <div className="lp-nav-right">
          <a
            className="lp-nav-icon"
            href="https://github.com/Dhruv-kys/BAZAAR"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <GitHubIcon />
          </a>
          <button
            className="app-theme"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>
          <OpenAgent />
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-stage">
          <h1 className="lp-head">
            <span className="lp-head-a">An agent that sells</span>
            <span className="lp-head-b">and knows when to stop</span>
          </h1>
          <p className="lp-feats">
            <span>Server-enforced limits</span>
            <span>Human confirmation</span>
            <span>Full audit trail</span>
            <span>Agent-to-agent</span>
          </p>
          <div className="lp-cta-row">
            <OpenAgent large />
            <a className="lp-link" href="#how" onClick={(e) => {
              e.preventDefault();
              document.querySelector("#how")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See how it works
            </a>
          </div>
          <p className="lp-brief">
            An AI agent runs the stall. It <mark>recommends</mark>, <mark>cross-sells</mark> and <mark>upsells</mark>,
            then stops. It has <mark>no tool that can charge you</mark>, it cannot discount past a{" "}
            <mark>server-enforced limit</mark>, and a <mark>human confirms</mark> before any money moves. Another agent
            can buy here too, over <mark>agent-to-agent</mark> payment.
          </p>
        </div>

        <div className="lp-scene" aria-hidden="true">
          {field && (
            <Suspense fallback={null}>
              <CoinScene />
            </Suspense>
          )}
        </div>

        <div className="lp-continue">
          <span className="lp-continue-text">scroll to continue</span>
          <span className="lp-continue-line" aria-hidden="true" />
        </div>
      </header>

      <section className="lp-tldr" aria-labelledby="tldr-title" data-reveal>
        <div className="lp-tldr-intro">
          <span className="eyebrow">TL;DR</span>
          <h2 id="tldr-title">Commerce with a brake pedal.</h2>
          <p>Three rules make the whole system legible.</p>
        </div>
        <ol className="lp-tldr-grid">
          <li><span>01</span><strong>The agent sells</strong><p>It searches, recommends, and builds the basket.</p></li>
          <li><span>02</span><strong>The server decides</strong><p>Prices, discounts, and limits are checked in code.</p></li>
          <li><span>03</span><strong>You approve</strong><p>Nothing charges until a person confirms the total.</p></li>
        </ol>
      </section>

      <TextRail />

      <section className="lp-station lp-statement band-tint" data-reveal>
        <p className="lp-statement-quote">
          An agent that can spend is a <em>liability</em> until it can be audited.
        </p>
        <p className="lp-statement-body">
          Handing a language model a payments API is the easy part. The hard part is proving, to a customer, to a
          merchant, to a reviewer, that it cannot quietly invent a discount, exceed a limit, or charge someone without
          being asked. Bazaar treats those four properties as structural constraints, not prompt instructions.
        </p>
      </section>

      <section className="lp-station lp-section band-plain" id="how" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">Four guarantees</span>
          <h2 className="lp-h2">Enforced in code. Visible while you use it.</h2>
        </div>
        <ul
          className="lp-ledger"
          onPointerMove={(event) => {
            const row = (event.target as HTMLElement).closest<HTMLElement>(".lp-row");
            if (!row) return;
            const rect = row.getBoundingClientRect();
            row.style.setProperty("--mx", `${event.clientX - rect.left}px`);
            row.style.setProperty("--my", `${event.clientY - rect.top}px`);
          }}
        >
          {GUARANTEES.map((g) => (
            <li key={g.n} className="lp-row" data-reveal>
              <span className="lp-row-n" aria-hidden="true">
                {g.n}
              </span>
              <div className="lp-row-lead">
                <span className="lp-row-label">{g.label}</span>
                <h3 className="lp-row-claim">{g.claim}</h3>
              </div>
              <p className="lp-row-detail">{g.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-station lp-section band-tint" data-reveal>
        <div className="lp-section-head">
          <h2 className="lp-h2">Four steps, one of which is a full stop.</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className={`lp-step${s.gate ? " lp-step-gate" : ""}`} data-reveal>
              {s.gate ? <span className="lp-step-flag">The gate</span> : null}
              <span className="lp-step-n">{s.n}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-station lp-section lp-doorway band-deep" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">The second door</span>
          <h2 className="lp-h2">When the buyer is not a person.</h2>
        </div>
        <p className="lp-doorway-lede">
          <mark>Agent-to-agent payment</mark>: a shopping agent buys here with no human in the conversation. Same
          pricing, same limits, same audit log, reached over <mark>MCP</mark> instead of a chat box.
        </p>

        <ul className="lp-doorway-grid">
          <li data-reveal>
            <h3>The gate becomes a signature</h3>
            <p>
              Authorisation is an <mark>Ed25519-signed mandate</mark> with a ceiling and an expiry. The merchant holds
              only the public key: it can verify one, never mint one.
            </p>
          </li>
          <li data-reveal>
            <h3>Bounds intersect, never union</h3>
            <p>
              The tighter of the mandate ceiling and the shop&rsquo;s cap wins. A mandate can never raise a merchant
              limit.
            </p>
          </li>
          <li data-reveal>
            <h3>A mandate spends once</h3>
            <p>
              Spent mandate ids live in a durable table. In memory, every spent mandate would be replayable after a
              restart.
            </p>
          </li>
          <li data-reveal>
            <h3>Authorisation is agentic, settlement stays human</h3>
            <p>
              A hosted checkout cannot be completed by a machine. The mandate is the authorisation gate; the card
              step stays <mark>human</mark>.
            </p>
          </li>
        </ul>
      </section>

      <section className="lp-station lp-receipt band-plain" data-reveal>
        <div className="lp-receipt-inner">
          <div className="lp-section-head">
            <span className="eyebrow">The receipt</span>
            <h2 className="lp-h2">What the log recorded while that happened.</h2>
          </div>
          <p className="lp-receipt-body">
            Ask for half off. The model requests it, the server refuses it, and the log records both numbers side by
            side. That is the difference between claiming a guardrail exists and showing one working.
          </p>
          <div className="lp-term">
            <div className="lp-term-bar">
              <span className="lp-term-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="lp-term-title">audit.log</span>
            </div>
            <AuditReplay />
          </div>
        </div>
      </section>

      <section className="lp-station lp-final band-deep" data-reveal>
        <h2 className="lp-final-head">Try talking it past the cap.</h2>
        <p className="lp-final-note">
          Ask for half off and watch the log refuse you. Runs on Razorpay test mode: a real payment link is created, but
          no real money moves.
        </p>
        <div className="lp-final-actions">
          <OpenAgent large />
          <span className="lp-final-safe">
            <LockIcon size={13} />
            No real money moves
          </span>
        </div>
        <span className="lp-ghost" aria-hidden="true">
          BAAZAR
        </span>
      </section>

      <footer className="lp-foot">
        <span>Bazaar. Track 01, AI Growth and Agentic Commerce.</span>
        <a href="https://github.com/Dhruv-kys/BAZAAR" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
