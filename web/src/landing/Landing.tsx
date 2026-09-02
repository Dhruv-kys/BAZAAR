import { Children, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRightIcon, CoinIcon, GitHubIcon, LockIcon, MoonIcon, ShieldIcon, SunIcon } from "../icons";
import { navigate } from "../router";
import { useReveal } from "./useReveal";
import { useTheme } from "../useTheme";
import "./Landing.css";

const CoinScene = lazy(() => import("./CoinScene"));

const HERO_ASKS = [
  { icon: CoinIcon, text: "A birthday cake for 15 people" },
  { icon: ShieldIcon, text: "Something chocolate for an anniversary" },
  { icon: LockIcon, text: "First order, can I get 50% off?" },
];

function StoryDeck({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const movingRef = useRef(false);
  const settle = useCallback(() => {
    if (!movingRef.current) return;
    movingRef.current = false;
    wrapRef.current?.dispatchEvent(new CustomEvent("bazaar:story-settled", { bubbles: true }));
  }, []);
  const move = useCallback((direction: number) => {
    if (movingRef.current) return;
    const next = Math.max(0, Math.min(slides.length - 1, activeRef.current + direction));
    if (next === activeRef.current) return;
    activeRef.current = next;
    movingRef.current = true;
    setActive(next);
  }, [slides.length]);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onStep = (event: Event) => move((event as CustomEvent<number>).detail);
    wrap.addEventListener("bazaar:story-step", onStep);
    return () => wrap.removeEventListener("bazaar:story-step", onStep);
  }, [move]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);
  useEffect(() => {
    if (!movingRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(settle);
      return () => cancelAnimationFrame(frame);
    }
    const fallback = window.setTimeout(settle, 1400);
    return () => window.clearTimeout(fallback);
  }, [active, settle]);
  return (
    <div className="lp-mac-story" ref={wrapRef} data-story-active={active} data-story-count={slides.length}>
      <div className="lp-mac-viewport" aria-live="polite">
        <div
          className="lp-mac-track"
          ref={trackRef}
          onTransitionEnd={(event) => { if (event.propertyName === "transform") settle(); }}
          onTransitionCancel={settle}
          style={{ width: `${slides.length * 100}%`, transform: `translate3d(${-active * (100 / slides.length)}%, 0, 0)` }}
        >
          {slides.map((slide, index) => <div className="lp-mac-slide" key={index} style={{ flex: `0 0 ${100 / slides.length}%`, width: `${100 / slides.length}%` }}>{slide}</div>)}
        </div>
      </div>
      <div className="lp-mac-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / slides.length})` }} /></div>
    </div>
  );
}

function PaymentNetwork() {
  return (
    <svg className="lp-payment-network" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="lp-rail-a" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset=".5" stopColor="currentColor" stopOpacity=".75" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lp-rail-b" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset=".5" stopColor="currentColor" stopOpacity=".6" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="lp-rail lp-rail-a" d="M-30 442 C220 210 350 220 550 338 S930 466 1230 120" pathLength="1" />
      <path className="lp-rail lp-rail-b" d="M-30 104 C210 326 370 340 600 212 S940 38 1230 376" pathLength="1" />
      <path className="lp-rail lp-rail-c" d="M80 590 C260 410 450 412 610 452 S920 510 1120 -20" pathLength="1" />
      <g className="lp-network-nodes">
        <circle cx="192" cy="278" r="3" />
        <circle cx="550" cy="338" r="3" />
        <circle cx="860" cy="402" r="3" />
        <circle cx="1004" cy="166" r="3" />
        <circle cx="602" cy="212" r="3" />
      </g>
      <circle className="lp-rail-packet packet-a" r="4">
        <animateMotion dur="3.8s" repeatCount="indefinite" path="M-30 442 C220 210 350 220 550 338 S930 466 1230 120" />
      </circle>
      <circle className="lp-rail-packet packet-b" r="3">
        <animateMotion dur="4.6s" begin="-1.8s" repeatCount="indefinite" path="M-30 104 C210 326 370 340 600 212 S940 38 1230 376" />
      </circle>
    </svg>
  );
}

function MacScreen({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLElement>(null);
  const wheelLocked = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isBumping, setIsBumping] = useState(false);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setIsOpen(entry.isIntersecting && entry.intersectionRatio >= 0.42), { threshold: [0, 0.42, 1] });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onSettled = () => {
      wheelLocked.current = false;
      setIsBumping(false);
    };
    stage.addEventListener("bazaar:story-settled", onSettled);
    const onWheel = (event: WheelEvent) => {
      if (!isOpen || Math.abs(event.deltaY) < 2) return;
      const story = stage.querySelector<HTMLElement>("[data-story-active]");
      if (!story) return;
      const active = Number(story.dataset.storyActive ?? 0);
      const count = Number(story.dataset.storyCount ?? 0);
      const direction = event.deltaY > 0 ? 1 : -1;
      const next = active + direction;
      if (next < 0 || next >= count) return;
      event.preventDefault();
      if (wheelLocked.current) return;
      wheelLocked.current = true;
      setIsBumping(true);
      story.dispatchEvent(new CustomEvent("bazaar:story-step", { detail: direction, bubbles: true }));
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", onWheel, true);
      stage.removeEventListener("bazaar:story-settled", onSettled);
    };
  }, [isOpen]);
  return (
    <section className="lp-mac-stage" ref={stageRef} aria-label="Bazaar proof screens">
      <PaymentNetwork />
      <div className="lp-payment-aura" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className={`lp-mac-device${isOpen ? " is-open" : ""}${isBumping ? " is-bumping" : ""}`}>
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
    const onPointerOver = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest("a, button, [role='button']");
      const state = target?.matches(".lp-cta, .lp-mac-confirm") ? "cta" : target ? "interactive" : "normal";
      ghostRef.current?.setAttribute("data-state", state);
    };
    const tick = () => {
      const ghost = ghostRef.current;
      if (ghost) {
        const scale = ghost.dataset.state === "cta" ? 1.6 : ghost.dataset.state === "interactive" ? 1.3 : 1;
        ghost.style.transform = `translate3d(${x + 12}px, ${y + 12}px, 0) scale(${scale})`;
        ghost.style.setProperty("--ghost-rgb", "90, 87, 212");
      }
      frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onPointerOver);
    };
  }, []);
  return <div className="lp-cursor-ghost" ref={ghostRef} aria-hidden="true"><i /></div>;
}

function MacStory() {
  return (
    <StoryDeck>
      <article className="lp-mac-page lp-mac-page-problem">
        <div className="lp-mac-kicker"><span className="lp-mac-index">01</span><span>THE PROBLEM</span><i /></div>
        <h2>AI can sell.<br /><em>Should it spend?</em></h2>
        <p className="lp-mac-lede">Execution is easy. Proving an agent cannot invent discounts, exceed limits, or charge without consent is the product.</p>
        <div className="lp-mac-question"><span>THE QUESTION</span><strong>Can revenue grow without turning the agent into a liability?</strong></div>
        <div className="lp-mac-signal-row"><span>UNBOUNDED MODEL</span><i /> <span>SERVER GUARDRAIL</span><i /> <span>HUMAN GATE</span></div>
      </article>

      <article className="lp-mac-page lp-mac-page-agent">
        <div className="lp-mac-kicker"><span className="lp-mac-index">02</span><span>INTENT RESOLVED</span><i /></div>
        <div className="lp-mac-chat"><span className="lp-mac-chat-label">CUSTOMER</span><strong>“Birthday for 15.<br />Chocolate. First order.”</strong></div>
        <div className="lp-mac-route" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-mac-intent"><div><span>BAZAAR AGENT</span><b>reading context</b></div><dl><dt>occasion</dt><dd>birthday</dd><dt>guests</dt><dd>15</dd><dt>preference</dt><dd>chocolate</dd><dt>customer</dt><dd>first order</dd></dl></div>
        <div className="lp-mac-resolved"><i /> INTENT RESOLVED <span>catalog ready</span></div>
      </article>

      <article className="lp-mac-page lp-mac-page-sell">
        <div className="lp-mac-kicker"><span className="lp-mac-index">03</span><span>REVENUE PATH</span><i /></div>
        <div className="lp-mac-product"><div><span>RECOMMENDATION</span><h2>Chocolate Celebration Cake</h2><p>BEST FIT · birthday · 15 guests</p></div><strong>₹1,499</strong></div>
        <div className="lp-mac-offers"><div><span>CROSS-SELL</span><b>+ Edible topper</b><strong>₹199</strong></div><div><span>UPSELL</span><b>1.5 kg cake</b><strong>₹1,799</strong><small>reason: 15 guests</small></div></div>
        <div className="lp-mac-actions"><span>AGENT ACTIONS</span><b>✓ recommend</b><b>✓ cross-sell</b><b>✓ upsell</b></div>
      </article>

      <article className="lp-mac-page lp-mac-page-brake">
        <div className="lp-mac-kicker"><span className="lp-mac-index">04</span><span>SERVER GUARDRAIL</span><i /></div>
        <div className="lp-mac-brake-head"><span>AGENT REQUEST</span><strong>Discount <em>50%</em></strong></div>
        <div className="lp-mac-brake-meter"><i /><i /><i /><i /><i /><b /></div>
        <div className="lp-mac-brake-result"><div><span>MAXIMUM ALLOWED</span><strong>15%</strong></div><div className="lp-mac-denied"><s>50%</s><em>×</em><small>rejected</small></div><div className="lp-mac-accepted"><strong>15%</strong><em>✓</em><small>clamped</small></div></div>
        <p className="lp-mac-brake-note">The model asked.<br /><b>The server decided.</b></p>
      </article>

      <article className="lp-mac-page lp-mac-page-gate">
        <div className="lp-mac-kicker"><span className="lp-mac-index">05</span><span>HUMAN GATE</span><i /></div>
        <div className="lp-mac-order-head"><span>ORDER READY</span><i>staged · not charged</i></div>
        <div className="lp-mac-order"><strong>Chocolate Celebration Cake</strong><span>1.5 kg</span><div><b>Cake</b><em>₹1,799</em></div><div><b>Topper</b><em>₹199</em></div><div className="lp-mac-total"><b>TOTAL</b><strong>₹1,998</strong></div></div>
        <div className="lp-mac-no-tool"><i /> AI HAS NO CHARGE TOOL <span>human confirmation required</span></div>
        <button className="lp-mac-confirm" type="button">CONFIRM PAYMENT <span>↗</span></button>
      </article>

      <article className="lp-mac-page lp-mac-page-proof">
        <div className="lp-mac-kicker"><span className="lp-mac-index">06</span><span>AGENT → AGENT / AUDIT</span><i /></div>
        <div className="lp-mac-flow"><span>buyer-agent</span><i>↓</i><strong>BAZAAR</strong><i>↓</i><span>catalog → order → payment link</span><i>↓</i><b>RAZORPAY</b></div>
        <div className="lp-mac-log"><div><span>audit.log</span><i>ALL ACTIONS ACCOUNTED FOR</i></div><p><b>16:56:03</b> recommend</p><p><b>16:56:04</b> cross_sell</p><p><b>16:56:15</b> discount <em>50% → 15%</em></p><p><b>16:57:00</b> payment declined</p><p><b>16:57:01</b> retry link issued</p></div>
      </article>
    </StoryDeck>
  );
}

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
          <div className="lp-hero-coin" aria-hidden="true">
            {field ? (
              <Suspense fallback={null}>
                <CoinScene />
              </Suspense>
            ) : (
              <span className="lp-hero-coin-static">₹</span>
            )}
          </div>

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

          <ul className="lp-asks">
            {HERO_ASKS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <a href={`/app?ask=${encodeURIComponent(text)}`} onClick={navigate(`/app?ask=${encodeURIComponent(text)}`)}>
                  <Icon size={15} />
                  <span>{text}</span>
                  <ArrowUpRightIcon size={13} />
                </a>
              </li>
            ))}
          </ul>

          <div className="lp-cta-row">
            <OpenAgent large />
            <a className="lp-link" href="#how" onClick={(e) => {
              e.preventDefault();
              document.querySelector("#how")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See how it works
            </a>
          </div>
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
      <MacStory />
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
