import { GitHubIcon, LockIcon, ShieldIcon } from "../icons";
import { navigate } from "../router";
import { LiveLog } from "./Live";
import { useReveal } from "./useReveal";
import { useTheme } from "../useTheme";
import "./Landing.css";

const GUARANTEES = [
  {
    key: "explainable",
    label: "Explainable",
    claim: "Every decision is logged with its reason",
    detail:
      "Each recommendation, cross-sell, upsell and discount is written to an audit log with the reasoning behind it — streamed to the screen as it happens, not buried in a server file.",
  },
  {
    key: "bounded",
    label: "Bounded",
    claim: "Caps the agent cannot talk its way past",
    detail:
      "Discount and order limits live in server code. Ask for 50% off and the request is clamped to the real ceiling before it touches a total — the log shows both numbers.",
  },
  {
    key: "gated",
    label: "Gated",
    claim: "The model has no tool that can charge you",
    detail:
      "There is deliberately no charge function exposed to the agent. It can only stage a summary; a payment link exists only after a human presses confirm.",
  },
  {
    key: "resilient",
    label: "Resilient",
    claim: "A declined payment recovers, not crashes",
    detail:
      "Declines, expiries and upstream rate limits are handled on one shared path that logs the failure and issues a fresh payment link.",
  },
];

const STEPS = [
  { n: "01", title: "Reads the occasion", body: "Birthday for fifteen, chocolate, first order — the agent turns plain language into catalog filters." },
  { n: "02", title: "Sells, within limits", body: "Recommends a fit, cross-sells an add-on, upsells only with a stated reason. Discounts get clamped server-side." },
  { n: "03", title: "Stops at the gate", body: "An itemised summary appears with the real total. Nothing moves until you confirm it yourself." },
  { n: "04", title: "Charges on Razorpay", body: "Confirming creates a Razorpay payment link. Card details are entered there — never on this site." },
];

export function Landing() {
  const { theme, toggleTheme } = useTheme();
  useReveal();

  return (
    <div className="lp">
      <nav className="lp-nav">
        <a className="app-brand" href="/" onClick={navigate("/")}>
          <span className="app-mark" aria-hidden="true">
            ❖
          </span>
          <span className="app-name">Bazaar</span>
          <span className="app-slash">/agent</span>
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
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <a className="lp-cta" href="/app" onClick={navigate("/app")}>
            Open the agent →
          </a>
        </div>
      </nav>

      <header className="lp-hero" data-reveal>
        <div className="lp-hero-grid">
        <div className="lp-hero-copy">
          <span className="eyebrow">Track 01 · Agentic commerce</span>
          <h1 className="lp-head">
            A sales agent you can
            <br />
            <em>actually let near money.</em>
          </h1>
          <p className="lp-lede">
            Most merchant bots take orders. This one sells — recommending, cross-selling and upselling a real catalog —
            and then stops dead at a confirmation step, because every rupee it can move is fenced in by server-side code
            rather than good intentions.
          </p>
          <div className="lp-actions">
            <a className="lp-cta lp-cta-lg" href="/app" onClick={navigate("/app")}>
              Open the agent →
            </a>
            <span className="lp-actions-note">
              <LockIcon size={13} />
              Razorpay test mode · no real money moves
            </span>
          </div>
        </div>
        <div className="lp-hero-aside">
          <LiveLog />
        </div>
        </div>
      </header>

      <section className="lp-section lp-split" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">The problem</span>
          <h2 className="lp-h2">An agent that can spend is a liability until it can be audited.</h2>
        </div>
        <div className="lp-split-body">
          <p className="lp-body">
            Handing a language model a payments API is the easy part. The hard part is proving — to a customer, to a
            merchant, to a reviewer — that it cannot quietly invent a discount, exceed a limit, or charge someone
            without being asked. Bazaar treats those four properties as structural constraints, not prompt
            instructions.
          </p>
        </div>
      </section>

      <section className="lp-section" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">Four guarantees</span>
          <h2 className="lp-h2">Enforced in code. Visible while you use it.</h2>
        </div>
        <div className="lp-grid">
          {GUARANTEES.map((g) => (
            <article key={g.key} className="lp-card" data-reveal>
              <div className="lp-card-head">
                <ShieldIcon size={14} />
                <span className="lp-card-label">{g.label}</span>
              </div>
              <h3 className="lp-card-claim">{g.claim}</h3>
              <p className="lp-card-detail">{g.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">How a sale runs</span>
          <h2 className="lp-h2">Four steps, one of which is a full stop.</h2>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-step" data-reveal>
              <span className="lp-step-n">{s.n}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-clamp" data-reveal>
        <div className="lp-clamp-inner">
          <span className="eyebrow">The moment that matters</span>
          <p className="lp-clamp-said">The agent asked for</p>
          <p className="lp-clamp-big">
            <span className="lp-clamp-was">50%</span>
            <span className="lp-clamp-rule" aria-hidden="true" />
            <span className="lp-clamp-got">15%</span>
          </p>
          <p className="lp-clamp-note">
            It got fifteen — the ceiling written in server code. The customer was told fifteen, the log recorded both
            numbers, and no prompt was asked to police itself.
          </p>
        </div>
      </section>

      <section className="lp-section" data-reveal>
        <div className="lp-section-head">
          <span className="eyebrow">The differentiator</span>
          <h2 className="lp-h2">Watch it clamp itself in real time.</h2>
        </div>
        <p className="lp-body">
          Ask for half off. The model requests it, the server refuses it, and the log records both numbers side by side —
          which is the difference between claiming a guardrail exists and showing one working.
        </p>
        <div className="lp-term" data-reveal>
          <div className="lp-term-bar">
            <span className="lp-term-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="lp-term-title">audit.log — agent decisions</span>
          </div>
          <pre className="lp-term-body">
            <code>
              <span className="l-time">16:56:03</span> <span className="l-blue">recommend</span>
              {"\n"}
              <span className="l-dim">▸</span> 1 kg suits a birthday for fifteen guests{"\n\n"}
              <span className="l-time">16:56:04</span> <span className="l-cyan">cross_sell</span>
              {"\n"}
              <span className="l-dim">▸</span> Edible topper matches the occasion{"\n\n"}
              <span className="l-time">16:56:15</span> <span className="l-warn">discount</span>{" "}
              <span className="l-warn">!</span>
              {"\n"}
              <span className="l-dim">▸</span> FIRST_ORDER{"\n"}
              {"  "}
              <span className="l-dim">guardrail</span> <span className="l-strike">50%</span>{" "}
              <span className="l-dim">→</span> <span className="l-warn">15%</span>{" "}
              <span className="l-dim">CAPPED</span>
              {"\n\n"}
              <span className="l-time">16:57:00</span> <span className="l-stop">result</span>
              {"\n"}
              <span className="l-dim">▸</span> Simulated failure (demo trigger){"\n\n"}
              <span className="l-time">16:57:01</span> <span className="l-warn">retry</span>
              {"\n"}
              <span className="l-dim">▸</span> Fresh payment link issued after the decline
            </code>
          </pre>
        </div>
      </section>

      <section className="lp-final" data-reveal>
        <h2 className="lp-final-head">See it sell, then stop.</h2>
        <p className="lp-final-note">
          Runs on Razorpay test mode — a real payment link is created, but no real money moves.
        </p>
        <a className="lp-cta lp-cta-lg" href="/app" onClick={navigate("/app")}>
          Open the agent →
        </a>
      </section>

      <footer className="lp-foot">
        <span>Bazaar · Track 01 — AI Growth &amp; Agentic Commerce</span>
        <a href="https://github.com/Dhruv-kys/BAZAAR" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
