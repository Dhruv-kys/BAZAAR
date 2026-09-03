import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
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
    proves: "An agent cannot raise its own ceiling.",
  },
  {
    code: "CEILING_EXCEEDED",
    what: "The order costs more than the mandate authorizes. The refusal names the binding constraint.",
    proves: "The tighter of mandate and merchant cap always binds.",
  },
  {
    code: "MANDATE_ALREADY_CONSUMED",
    what: "That mandate id was spent. Consumed ids live in SQLite, not memory.",
    proves: "Replay protection survives a process restart.",
  },
  {
    code: "AGENT_UNAUTHENTICATED",
    what: "No recognised agent credential was presented.",
    proves: "With no credentials configured, nobody gets in. It fails closed.",
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
    <div className="ad-run">
      <div className="ad-run-head">
        <div>
          <h3>Watch an agent connect</h3>
          <p>
            This runs a real MCP session against this merchant, right now. Nothing is simulated and
            no payment link is created.
          </p>
        </div>
        <button className="ad-run-go" type="button" onClick={run} disabled={running}>
          {running ? "Running…" : steps.length ? "Run again" : "Run a buyer agent"}
        </button>
      </div>

      {broke && (
        <p className="ad-run-broke" role="status">
          The run could not reach the merchant server. The MCP endpoint itself may still be up &mdash;
          this page needs the server to be reachable from your browser.
        </p>
      )}

      {steps.length > 0 && (
        <ol className="ad-run-steps">
          {steps.map((step) => (
            <li key={step.n} className={`is-${step.status}`}>
              <span className="ad-run-n">{String(step.n).padStart(2, "0")}</span>
              <div>
                <strong>
                  {step.title}
                  {step.code && <code>{step.code}</code>}
                </strong>
                <p>{step.detail}</p>
                {step.data && step.data.length > 0 && (
                  <ul>
                    {step.data.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
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

  const origin = doc ? new URL(apiUrl("/.well-known/bazaar-commerce")).origin : "";

  return (
    <PageShell slug="mcp">
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
        </section>

        {!doc && !failed && (
          <p className="ad-empty" role="status">
            Fetching the merchant&rsquo;s live contract&hellip;
          </p>
        )}

        {failed && (
          <p className="ad-empty" data-reveal>
            The merchant server is not responding, so its live contract cannot be shown.
          </p>
        )}

        {doc && (
          <>
            <section className="pg-section" data-reveal>
              <h2>What an agent finds first</h2>
              <p className="pg-lede">
                Everything below is read from <code>{origin}/.well-known/bazaar-commerce</code> at
                page load, so it cannot drift from what the server actually publishes.
              </p>
              <dl className="ad-facts">
                <div>
                  <dt>Protocol</dt>
                  <dd>{doc.protocol}</dd>
                </div>
                <div>
                  <dt>Transport</dt>
                  <dd>
                    MCP over <code>{doc.transport.mcp}</code>
                  </dd>
                </div>
                <div>
                  <dt>Authorization</dt>
                  <dd>{doc.authorization.scheme}</dd>
                </div>
                <div>
                  <dt>Settlement</dt>
                  <dd>{doc.settlement.model}</dd>
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
            </section>

            <section className="pg-section" data-reveal>
              <h2>Four tools, one of which spends</h2>
              <ul className="ad-tools">
                {(doc.tools ?? []).map((tool) => (
                  <li key={tool.name}>
                    <code>{tool.name}</code>
                    <span className={`ad-tag${tool.writes ? " is-write" : ""}`}>
                      {tool.writes ? "spends" : "reads"}
                    </span>
                    <p>{tool.purpose}</p>
                  </li>
                ))}
              </ul>
              {doc.not_exposed?.apply_discount && (
                <div className="ad-absent">
                  <h3>
                    <code>apply_discount</code> is deliberately absent
                  </h3>
                  <p>{doc.not_exposed.apply_discount}</p>
                </div>
              )}
            </section>

            <section className="pg-section" data-reveal>
              <h2>See it happen</h2>
              <LiveRun />
            </section>

            <section className="pg-section" data-reveal>
              <h2>What happens when an agent misbehaves</h2>
              <p className="pg-lede">
                The buyer in our own demo tries to cheat. These are the refusals it meets, named in
                the contract so a counterparty can handle them.
              </p>
              <ul className="ad-refusals">
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
              <h2>Why the merchant cannot forge your authorization</h2>
              <ul className="ad-security">
                <li>
                  <h3>Asymmetric, not shared</h3>
                  <p>
                    The buyer&rsquo;s wallet holds the private key. The merchant holds only
                    <code> MANDATE_PUBLIC_KEY</code>. A merchant that could compute the signature
                    could forge the consent, so the gate would be decoration.
                  </p>
                </li>
                <li>
                  <h3>Single use, durably</h3>
                  <p>
                    Spent mandate ids are inserted into a SQLite table with a primary key. The
                    atomic compare-and-set is the constraint violation. In memory, every spent
                    mandate would be replayable after a restart.
                  </p>
                </li>
                <li>
                  <h3>Bounds intersect, never union</h3>
                  <p>{doc.policy.bounds}</p>
                </li>
                <li>
                  <h3>Fails closed</h3>
                  <p>
                    With <code>AGENT_CREDENTIALS</code> unset, no agent can authenticate. There is
                    no default credential, because that would make this an unauthenticated charge
                    path.
                  </p>
                </li>
              </ul>
            </section>

            <section className="pg-section" data-reveal>
              <h2>Connect an agent</h2>
              <p className="pg-lede">
                Any MCP client can call this merchant. Reading the catalog and pricing a basket need
                only a credential; spending also needs a mandate signed by the buyer&rsquo;s wallet.
              </p>
              <pre className="pg-code">
                <code>{`endpoint  ${origin}${doc.transport.mcp}
header    ${doc.transport.auth}
mandate   ${doc.authorization.claims.join(", ")}
signed    ${doc.authorization.scheme}, single use`}</code>
              </pre>
              <p className="pg-lede">Or drive it with the reference buyer in this repository:</p>
              <pre className="pg-code">
                <code>{`MERCHANT_MCP_URL=${origin}${doc.transport.mcp} npm run buyer`}</code>
              </pre>
              <p className="pg-note">
                Credentials are issued by the merchant, not self-served. That is deliberate on a
                path that can move money.
              </p>
            </section>
          </>
        )}
    </PageShell>
  );
}
