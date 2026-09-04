import { useEffect, useRef, useState } from "react";
import { apiOrigin, apiUrl } from "../api";
import { Note } from "../Marginalia";
import { AgentPresence } from "./AgentPresence";
import { PageShell } from "../pages/PageShell";
import "./McpDoor.css";

interface Discovery {
  protocol: string;
  merchant: { name: string; currency: string };
  transport: { mcp: string; auth: string };
  authorization: { scheme: string; required_for: string[]; claims: string[]; single_use: boolean };
  policy: { maxOrderValuePaise: number; maxDiscountPercent: number; quoteTtlMs: number; bounds: string };
  settlement: { model: string; rail: string };
  tools?: { name: string; writes: boolean; purpose: string }[];
  not_exposed?: Record<string, string>;
  refusal_codes?: string[];
}

const REFUSALS_SHOWN = [
  {
    code: "MANDATE_SIGNATURE_INVALID",
    what: "The mandate was altered after signing, or signed by a principal we do not know.",
    proves: "an agent cannot raise its own ceiling",
  },
  {
    code: "CEILING_EXCEEDED",
    what: "The order costs more than the mandate authorizes. The refusal names the binding constraint.",
    proves: "the tighter of mandate and merchant cap always binds",
  },
  {
    code: "MANDATE_ALREADY_CONSUMED",
    what: "That mandate id was spent. Consumed ids live in SQLite, not memory.",
    proves: "replay protection survives a restart",
  },
  {
    code: "AGENT_UNAUTHENTICATED",
    what: "No recognised agent credential was presented.",
    proves: "with no credentials set, nobody gets in",
  },
];

const PRINCIPLES = [
  {
    tag: "I5",
    title: "Asymmetric, not shared",
    body: "The buyer's wallet holds the private key; the merchant holds only MANDATE_PUBLIC_KEY. A merchant that could compute the signature could forge the consent, and the gate would be decoration.",
  },
  {
    tag: "I4",
    title: "Single use, durably",
    body: "Spent mandate ids are inserted into a SQLite table with a primary key. The atomic compare-and-set is the constraint violation. In memory, every spent mandate would be replayable after a restart.",
  },
  {
    tag: "I2",
    title: "Bounds intersect, never union",
    body: "",
  },
  {
    tag: "I8",
    title: "Fails closed, stays quiet",
    body: "With AGENT_CREDENTIALS unset no agent can authenticate, and no counterparty text ever becomes merchant audit reasoning. There is no default credential and no tool that writes our record.",
  },
];

interface DemoStep {
  n: number;
  title: string;
  status: "ok" | "refused" | "info";
  detail: string;
  code?: string;
  data?: string[];
}

function LiveRun() {
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [running, setRunning] = useState(false);
  const [broke, setBroke] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => sourceRef.current?.close(), []);

  function run() {
    sourceRef.current?.close();
    setSteps([]);
    setBroke(false);
    setRunning(true);
    const source = new EventSource(apiUrl("/api/agents/demo"));
    sourceRef.current = source;
    source.addEventListener("step", (event) => {
      setSteps((prev) => [...prev, JSON.parse((event as MessageEvent).data) as DemoStep]);
    });
    source.addEventListener("done", () => {
      setRunning(false);
      source.close();
    });
    source.onerror = () => {
      setRunning(false);
      setBroke(true);
      source.close();
    };
  }

  return (
    <div>
      <div className="mcp-run-head">
        <div>
          <p>
            This opens a real Model Context Protocol session against this merchant, right now.
            Nothing is simulated, and no payment link is created.
          </p>
        </div>
        <button className="mcp-go" type="button" onClick={run} disabled={running}>
          {running ? "Running…" : steps.length ? "Run again" : "Run a buyer agent"}
        </button>
      </div>

      {broke && (
        <p className="mcp-broke" role="status">
          The run could not reach the merchant server. The MCP endpoint itself may still be up —
          this page needs the server reachable from your browser.
        </p>
      )}

      {steps.length > 0 && (
        <ol className="mcp-tape">
          {steps.map((step) => (
            <li key={step.n} className={`is-${step.status}`}>
              <div className="mcp-beat-top">
                <strong>{step.title}</strong>
                {step.code && <span className="mcp-code">{step.code}</span>}
              </div>
              <p>{step.detail}</p>
              {step.data && step.data.length > 0 && (
                <ul>
                  {step.data.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function McpDoor() {
  const [doc, setDoc] = useState<Discovery>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(apiUrl("/.well-known/bazaar-commerce"))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("unavailable"))))
      .then(setDoc)
      .catch(() => setFailed(true));
  }, []);

  const origin = apiOrigin();

  return (
    <PageShell slug="mcp">
      <div className="mcp">
        <section className="pg-intro" data-reveal>
          <span className="pg-eyebrow">The other door</span>
          <h1>
            This shop is callable
            <br />
            <em>by another agent</em>
          </h1>
          <p>
            The same pricing, guardrails and audit trail that serve the chat also answer a machine.
            Where a person presses a confirm button, a buying agent presents a signed spend mandate.
            No screen, no browser, no human in the loop.
          </p>
          <Note>one policy core — two doors onto it</Note>
        </section>

        {!doc && !failed && (
          <p className="mcp-empty" role="status">
            Fetching the merchant&rsquo;s live contract&hellip;
          </p>
        )}

        {failed && (
          <p className="mcp-empty" data-reveal>
            The merchant server is not responding, so its live contract cannot be shown.
          </p>
        )}

        {doc && (
          <>
            <section className="pg-section" data-reveal>
              <h2 data-index="01">What an agent finds first</h2>
              <p className="mcp-source">
                <b>read live</b>
                <span>
                  {origin}
                  /.well-known/bazaar-commerce
                </span>
              </p>
              <dl className="mcp-facts">
                <div>
                  <dt>Protocol</dt>
                  <dd>{doc.protocol}</dd>
                </div>
                <div>
                  <dt>Transport</dt>
                  <dd>MCP over {doc.transport.mcp}</dd>
                </div>
                <div>
                  <dt>Authorization</dt>
                  <dd>{doc.authorization.scheme}</dd>
                </div>
                <div>
                  <dt>Settlement</dt>
                  <dd>
                    <em>{doc.settlement.model}</em> &middot; {doc.settlement.rail}
                  </dd>
                </div>
                <div>
                  <dt>Order cap</dt>
                  <dd>₹{(doc.policy.maxOrderValuePaise / 100).toLocaleString("en-IN")}</dd>
                </div>
                <div>
                  <dt>Quote validity</dt>
                  <dd>{Math.round(doc.policy.quoteTtlMs / 60000)} minutes</dd>
                </div>
              </dl>
              <Note>fetched at page load, so it cannot drift from the server</Note>
            </section>

            <section className="pg-section" data-reveal>
              <h2 data-index="02">Four tools, one of which spends</h2>
              <ul className="mcp-tools">
                {(doc.tools ?? []).map((tool) => (
                  <li key={tool.name}>
                    <code>{tool.name}</code>
                    <span className={`mcp-chip${tool.writes ? " is-write" : ""}`}>
                      {tool.writes ? "spends" : "reads"}
                    </span>
                    <p>{tool.purpose}</p>
                  </li>
                ))}
                {doc.not_exposed?.apply_discount && (
                  <li className="is-absent">
                    <code>apply_discount</code>
                    <span className="mcp-chip is-absent">not built</span>
                    <p>{doc.not_exposed.apply_discount}</p>
                  </li>
                )}
              </ul>
              <Note>a discount is offered by the shop, never requested by the buyer</Note>
            </section>

            <section className="pg-section" data-reveal>
              <h2 data-index="03">See it happen</h2>
              <AgentPresence />
              <LiveRun />
            </section>

            <section className="pg-section" data-reveal>
              <h2 data-index="04">When an agent misbehaves</h2>
              <p className="pg-lede">
                The buyer in our own demo tries to cheat. These are the refusals it meets, each
                named in the contract so a counterparty can handle them.
              </p>
              <ul className="mcp-refusals">
                {REFUSALS_SHOWN.map((refusal) => (
                  <li key={refusal.code}>
                    <code>{refusal.code}</code>
                    <p>{refusal.what}</p>
                    <small>{refusal.proves}</small>
                  </li>
                ))}
              </ul>
              {doc.refusal_codes && (
                <p className="pg-note">
                  {doc.refusal_codes.length} refusal codes are published in the contract. A refusal
                  is an audit event with a code, never a bare HTTP error.
                </p>
              )}
            </section>

            <section className="pg-section" data-reveal>
              <h2 data-index="05">Why the merchant cannot forge your consent</h2>
              <ul className="mcp-principles">
                {PRINCIPLES.map((principle) => (
                  <li key={principle.tag}>
                    <h3 data-tag={principle.tag}>{principle.title}</h3>
                    <p>{principle.body || doc.policy.bounds}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="pg-section" data-reveal>
              <h2 data-index="06">Connect an agent</h2>
              <p className="pg-lede">
                Any MCP client can call this merchant. Reading the catalog and pricing a basket need
                only a credential; spending also needs a mandate signed by the buyer&rsquo;s wallet.
              </p>
              <pre className="mcp-wire">
                <code>
                  {`endpoint  ${origin}${doc.transport.mcp}
header    ${doc.transport.auth}
mandate   ${doc.authorization.claims.join(", ")}
signed    ${doc.authorization.scheme}, single use`}
                </code>
              </pre>
              <p className="pg-lede">Or drive it with the reference buyer in this repository:</p>
              <pre className="mcp-wire">
                <code>{`MERCHANT_MCP_URL=${origin}${doc.transport.mcp} npm run buyer`}</code>
              </pre>
              <p className="pg-lede">
                And to check the door rather than take its word for it &mdash; {doc.refusal_codes?.length ?? 19}{" "}
                published refusal codes, fail-closed authentication, bounds intersecting, all
                asserted against the running server:
              </p>
              <pre className="mcp-wire">
                <code>npm run verify:mcp</code>
              </pre>
              <p className="pg-note">
                Every confirm it attempts is one the merchant must refuse, so the run never reaches
                payment link creation and costs the demo account nothing.
              </p>
              <Note>credentials are issued by the merchant, not self-served</Note>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
