import { Suspense, lazy, useEffect, useState } from "react";
import { Note } from "../Marginalia";
import { FlowerField } from "./FlowerField";
import { Postcard } from "./Postcard";
import { ArrowUpRightIcon, CoinIcon, LockIcon, ShieldIcon } from "../icons";
import { PageShell } from "../pages/PageShell";
import { navigate } from "../router";
import "./Landing.css";

const CoinScene = lazy(() => import("./CoinScene"));

const MONEY = [
  { line: "Money often costs too much.", who: "Ralph Waldo Emerson" },
  { line: "Price is what you pay. Value is what you get.", who: "Warren Buffett" },
  { line: "Beware of little expenses; a small leak will sink a great ship.", who: "Benjamin Franklin" },
  { line: "Wealth consists not in having great possessions, but in having few wants.", who: "Epictetus" },
  { line: "Never spend your money before you have it.", who: "Thomas Jefferson" },
  { line: "An investment in knowledge pays the best interest.", who: "Benjamin Franklin" },
  { line: "A wise person should have money in their head, but not in their heart.", who: "Jonathan Swift" },
];

const ASKS = [
  { icon: CoinIcon, text: "A birthday cake for 15 people" },
  { icon: ShieldIcon, text: "Something chocolate for an anniversary" },
  { icon: LockIcon, text: "First order, can I get 50% off?" },
];

const RULES = [
  {
    n: "01",
    title: "The agent sells",
    body: "It qualifies on occasion, headcount and preference, recommends one best fit, upsells only when the larger option genuinely serves what was asked, and cross-sells once.",
  },
  {
    n: "02",
    title: "The server decides",
    body: "Prices come from the catalog, never from the model. Ask for half off and the server applies fifteen percent, records that it clamped you, and makes the agent quote the real number.",
  },
  {
    n: "03",
    title: "A person approves",
    body: "The model has no tool that charges anyone. Staging an order is all it can do; a human presses confirm, or an agent presents a signed spend mandate the merchant cannot forge.",
  },
];

const PROOF = [
  {
    label: "Explainable",
    line: "Every recommendation, upsell, discount and refusal is written to an audit trail with its reasoning, and streamed to the screen as it happens.",
  },
  {
    label: "Bounded",
    line: "A request for 50% off is applied at 15% and flagged as clamped. An order over the shop's ceiling is refused with the binding limit named.",
  },
  {
    label: "Gated",
    line: "No charge tool exists on the model. Money moves only after a person confirms, or a buying agent presents a single-use Ed25519 mandate.",
  },
  {
    label: "Resilient",
    line: "A declined payment issues a fresh link with a new reference, logs the recovery, and carries on. Nothing crashes and nothing is silently retried.",
  },
];

function detectField() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function OpenAgent({ large }: { large?: boolean }) {
  return (
    <a className={`lp-cta${large ? " is-lg" : ""}`} href="/app" onClick={navigate("/app")}>
      <span>Open the agent</span>
      <ArrowUpRightIcon size={large ? 15 : 13} />
    </a>
  );
}

export function Landing() {
  const [field] = useState(detectField);
  const [painting, setPainting] = useState(false);
  const [saying, setSaying] = useState(() => Math.floor(Math.random() * MONEY.length));

  // The shell is what fades, so the flag rides on the root rather than on any
  // element inside it.
  useEffect(() => {
    document.documentElement.classList.toggle("lp-ghosted", painting);
    return () => document.documentElement.classList.remove("lp-ghosted");
  }, [painting]);

  return (
    <>
      <FlowerField painting={painting} />
      <button
        type="button"
        className={`lp-paint${painting ? " is-open" : ""}`}
        aria-pressed={painting}
        onClick={() => {
          setPainting((on) => {
            if (!on) setSaying((i) => (i + 1 + Math.floor(Math.random() * (MONEY.length - 1))) % MONEY.length);
            return !on;
          });
        }}
      >
        {painting ? "Wisdom" : "tap to see magic"}
      </button>

      {painting && (
        <figure className="lp-saying" key={saying}>
          <blockquote>{MONEY[saying].line}</blockquote>
          <figcaption>{MONEY[saying].who}</figcaption>
        </figure>
      )}

      <PageShell slug="" width={940}>
      <section className="lp-hero" data-reveal>
        <div className="lp-coin" aria-hidden="true">
          {field ? (
            <Suspense fallback={<span className="lp-coin-static">₹</span>}>
              <CoinScene />
            </Suspense>
          ) : (
            <span className="lp-coin-static">₹</span>
          )}
        </div>

        <h1 className="lp-head">
          An agent that sells
          <br />
          <em>and knows when to stop</em>
        </h1>

        <p className="lp-feats">
          <span>Server-enforced limits</span>
          <span>Human confirmation</span>
          <span>Full audit trail</span>
          <span>Voice or text</span>
          <span>Agent-to-agent</span>
        </p>

        <ul className="lp-asks">
          {ASKS.map(({ icon: Icon, text }) => {
            const to = `/app?ask=${encodeURIComponent(text)}`;
            return (
              <li key={text}>
                <a href={to} onClick={navigate(to)}>
                  <Icon size={15} />
                  <span>{text}</span>
                  <ArrowUpRightIcon size={13} />
                </a>
              </li>
            );
          })}
        </ul>

        <div className="lp-cta-row">
          <OpenAgent large />
          <a className="lp-link" href="/mcp" onClick={navigate("/mcp")}>
            Or connect an AI buyer
          </a>
        </div>
      </section>

      <section className="pg-section" data-reveal>
        <h2>Three rules, and the whole thing is legible</h2>
        <ol className="lp-rules">
          {RULES.map((rule) => (
            <li key={rule.n}>
              <span>{rule.n}</span>
              <div>
                <strong>{rule.title}</strong>
                <p>{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Note>the model proposes — the server is what actually decides</Note>
      </section>

      <section className="pg-section" data-reveal>
        <h2>What the bar asks for, and where it is met</h2>
        <p className="pg-lede">
          Every claim below is a thing the running system does, not a thing it intends to do. The
          audit trail on the agent screen is the evidence.
        </p>
        <ul className="lp-proof">
          {PROOF.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong>
              <p>{item.line}</p>
            </li>
          ))}
        </ul>
        <Note>every one of these is checked by a test, not by a promise</Note>
      </section>

      <section className="pg-section lp-close" data-reveal>
        <h2>Try talking it past the cap</h2>
        <p className="pg-lede">
          Ask for half off and watch the log refuse you. It runs on Razorpay test mode, so a real
          payment link is created and no real money moves.
        </p>
        <div className="lp-cta-row">
          <OpenAgent large />
          <span className="lp-safe">
            <LockIcon size={13} />
            No real money moves
          </span>
        </div>
      </section>

      <footer className="lp-foot">
        <span>Bazaar. Track 01, AI Growth and Agentic Commerce.</span>
        <a href="https://github.com/Dhruv-kys/BAZAAR" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
        <Postcard />
      </PageShell>
    </>
  );
}
