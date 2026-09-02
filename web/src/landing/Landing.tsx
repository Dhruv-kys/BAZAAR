import { Children, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";
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

function StoryDeck({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => Math.max(0, Math.min(slides.length - 1, current + direction)));
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  return (
    <div className="lp-story-wrap">
      <div className="lp-story-controls">
        <span><i /> PROOF SCREEN {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        <div>
          <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous story screen">←</button>
          <button type="button" onClick={() => move(1)} disabled={active === slides.length - 1} aria-label="Next story screen">→</button>
        </div>
      </div>
      <div className="lp-story-deck" aria-live="polite">
        <div className="lp-story-slide" key={active}>{slides[active]}</div>
      </div>
      <div className="lp-story-dots" role="tablist" aria-label="Proof screens">
        {slides.map((_, index) => <button key={index} type="button" role="tab" aria-selected={index === active} aria-label={`Go to proof screen ${index + 1}`} className={index === active ? "is-active" : ""} onClick={() => setActive(index)} />)}
      </div>
    </div>
  );
}

function MacScreen({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLElement>(null);
  const wheelLocked = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setIsOpen(entry.isIntersecting), { threshold: 0.28 });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (!isOpen || Math.abs(event.deltaY) < 2) return;
      const dots = Array.from(stage.querySelectorAll<HTMLButtonElement>(".lp-story-dots button"));
      const active = dots.findIndex((dot) => dot.getAttribute("aria-selected") === "true");
      if (active < 0) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      const next = active + direction;
      if (next < 0 || next >= dots.length) return;
      event.preventDefault();
      if (wheelLocked.current) return;
      wheelLocked.current = true;
      dots[next]?.click();
      window.setTimeout(() => { wheelLocked.current = false; }, 520);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [isOpen]);
  return (
    <section className="lp-mac-stage" ref={stageRef} aria-label="Bazaar proof screens">
      <div className="lp-payment-aura" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className={`lp-mac-device${isOpen ? " is-open" : ""}`}>
        <div className="lp-mac-screen">{children}</div>
        <img className="lp-mac-art" src="/macbook-mockup.png" alt="" aria-hidden="true" />
      </div>
    </section>
  );
}

function CursorGhost() {
  const ghostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = window.innerWidth * 0.5;
    let y = window.innerHeight * 0.5;
    const onMove = (event: PointerEvent) => { x = event.clientX; y = event.clientY; };
    const tick = (time: number) => {
      const hue = (time * 0.035 + x * 0.08 + y * 0.04) % 360;
      const red = Math.round(128 + Math.sin(hue * 0.017) * 70);
      const green = Math.round(128 + Math.sin((hue + 120) * 0.017) * 70);
      const blue = Math.round(128 + Math.sin((hue + 240) * 0.017) * 70);
      const code = 33 + Math.floor((time / 120) % 94);
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
        ghost.style.setProperty("--ghost-rgb", `${red}, ${green}, ${blue}`);
        const value = ghost.querySelector<HTMLElement>("[data-ascii]");
        if (value) value.textContent = `0x${code.toString(16).toUpperCase().padStart(2, "0")} · ${String.fromCharCode(code)} · ${red}/${green}/${blue}`;
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", onMove); };
  }, []);
  return <div className="lp-cursor-ghost" ref={ghostRef} aria-hidden="true"><i /><span data-ascii>0x41 · A · 128/128/128</span></div>;
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

function GuardrailPulse() {
  const [armed, setArmed] = useState(false);
  return (
    <button className={`lp-guardrail-pulse${armed ? " is-armed" : ""}`} type="button" onClick={() => setArmed((value) => !value)}>
      <span className="lp-pulse-orb" aria-hidden="true"><i /><i /><i /></span>
      <span className="lp-pulse-copy">
        <small>BAZAAR / CONTROL</small>
        <strong>{armed ? "Guardrail engaged" : "Inspect the brake pedal"}</strong>
      </span>
      <span className="lp-pulse-state">{armed ? "ON" : "↗"}</span>
    </button>
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
      <CursorGhost />
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

      <MacScreen>
      <StoryDeck>
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

      </StoryDeck>
      </MacScreen>

      <section className="lp-station lp-final lp-bazaar-screen band-deep" data-reveal>
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
        <GuardrailPulse />
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
