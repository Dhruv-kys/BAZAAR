import { PageShell } from "./PageShell";
import { Note } from "../Marginalia";
import { navigate } from "../router";
import "./Help.css";

interface Feature {
  n: string;
  title: string;
  what: string;
  why: string;
  see: { label: string; href: string };
}

const FEATURES: Feature[] = [
  {
    n: "01",
    title: "It sells, in your own words",
    what: "Type or talk. The agent qualifies on the occasion, the headcount, any dietary need and your budget, then recommends one best fit rather than a wall of options. It cross-sells once and upsells only when the larger size genuinely serves what you asked for.",
    why: "Recommendation quality is the revenue. A shop that lists everything sells nothing.",
    see: { label: "Open the agent", href: "/app" },
  },
  {
    n: "02",
    title: "Voice, when typing is the slower way",
    what: "Speech to speech over WebRTC, not a transcribe-then-answer pipeline, so it interrupts and responds like a conversation. The model's tool calls come back to the same server code the typed path uses.",
    why: "Pricing and limits cannot live in the model. Both channels route through one policy core, so voice cannot be the loose one.",
    see: { label: "Tap the coin", href: "/app" },
  },
  {
    n: "03",
    title: "A budget it has to work inside",
    what: "Set a budget and it becomes a bound the server holds, alongside the shop's own order cap. Ask for a bigger discount than the shop allows and the request is clamped on the way through, with the clamp written into the record.",
    why: "The tighter bound always binds, and the refusal names which one it was. That is what makes a limit real rather than a suggestion.",
    see: { label: "Try talking past it", href: "/app" },
  },
  {
    n: "04",
    title: "Every decision, written down",
    what: "Each recommendation, upsell, cross-sell, discount and refusal is logged with its reasoning and streamed to the screen as it happens. The merchant view totals only what a customer actually accepted.",
    why: "An agent that can spend money is a liability until it can be audited.",
    see: { label: "See what it earned", href: "/dashboard" },
  },
  {
    n: "05",
    title: "A door for other agents",
    what: "The same catalog, pricing and limits answer an AI buyer over MCP. Four tools, one of which can spend, and it needs a spend mandate signed by the buyer's own wallet. The merchant holds only the public key.",
    why: "A merchant that is only reachable by a human is invisible to the agents about to do the shopping.",
    see: { label: "Watch an agent connect", href: "/mcp" },
  },
  {
    n: "06",
    title: "It fails without falling over",
    what: "Force a decline and the order recovers with a fresh link under a new reference. When the test account runs out of payment links, it says exactly that instead of inviting a retry that cannot work.",
    why: "The interesting question is never the happy path.",
    see: { label: "Force a decline", href: "/app" },
  },
];

export function Help() {
  return (
    <PageShell slug="help">
      <section className="pg-intro" data-reveal>
        <span className="pg-eyebrow">What this does</span>
        <h1>
          Six things,
          <br />
          <em>and where to see each</em>
        </h1>
        <p>
          A sales agent that grows a shop&rsquo;s revenue, and the same shop made callable by
          another agent. Everything below is running, not planned &mdash; each one links to the
          screen where you can watch it happen.
        </p>
        <Note>every link here goes to the running thing, not a description of it</Note>
      </section>

      <ol className="hp-list">
        {FEATURES.map((feature) => (
          <li key={feature.n} data-reveal>
            <span className="hp-n">{feature.n}</span>
            <div>
              <h2>{feature.title}</h2>
              <p>{feature.what}</p>
              <p className="hp-why">{feature.why}</p>
              <a href={feature.see.href} onClick={navigate(feature.see.href)}>
                {feature.see.label}
              </a>
            </div>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
