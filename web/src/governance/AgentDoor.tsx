import { useEffect, useState } from "react";
import { ApiUnavailableError, apiJson } from "../api";
import "./AgentDoor.css";

interface Discovery {
  protocol: string;
  merchant: { name: string; currency: string };
  transport: { mcp: string; auth: string };
  authorization: { scheme: string; required_for: string[]; single_use: boolean };
  policy: { bounds: string };
  settlement: { model: string; rail: string };
}

const TOOLS = ["search_catalog", "get_product", "request_quote", "confirm_order"];

/**
 * Part B: the same policy core, reached by another agent instead of a person.
 * Everything shown here is read from the merchant's own discovery document.
 */
export function AgentDoor() {
  const [doc, setDoc] = useState<Discovery>();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiJson<Discovery>("/.well-known/bazaar-commerce")
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) setDoc(data);
        else setOffline(true);
      })
      .catch((err) => {
        if (!cancelled) setOffline(err instanceof ApiUnavailableError);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="ad" aria-labelledby="ad-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="ad-title">
          Other agents can buy here
        </h2>
        <span className="ad-tag">{doc?.protocol ?? "bazaar-commerce"}</span>
      </div>

      {offline && (
        <p className="ad-offline" role="status">
          Can&rsquo;t reach the shop&rsquo;s server, so the agent door can&rsquo;t be described right now.
        </p>
      )}

      <p className="ad-lede">
        A shopping agent with no human present can browse and buy through the same rules. It talks over MCP, and the
        limits it meets are the ones on this page.
      </p>

      <dl className="ad-rows">
        <div className="ad-row">
          <dt>Door</dt>
          <dd>
            <code>{doc?.transport.mcp ?? "/mcp"}</code>
          </dd>
        </div>
        <div className="ad-row">
          <dt>Who approves</dt>
          <dd>
            {doc ? "A signed spend mandate" : <span className="ad-pending" />}
            <em>{doc?.authorization.scheme ?? ""}</em>
          </dd>
        </div>
        <div className="ad-row">
          <dt>Reusable?</dt>
          <dd className="ad-strong">{doc ? (doc.authorization.single_use ? "No, single use" : "Yes") : "—"}</dd>
        </div>
        <div className="ad-row">
          <dt>Settlement</dt>
          <dd>
            {doc?.settlement.rail ?? "—"}
            <em>{doc?.settlement.model ?? ""}</em>
          </dd>
        </div>
      </dl>

      <div className="ad-tools">
        <span className="ad-tools-label">What an agent may call</span>
        <ul>
          {TOOLS.map((t) => (
            <li key={t}>
              <code>{t}</code>
              {t === "confirm_order" && <span className="ad-gate">needs a mandate</span>}
            </li>
          ))}
        </ul>
      </div>

      <p className="ad-note">{doc?.policy.bounds ?? "Mandate ceiling and shop caps intersect; the tighter one binds."}</p>
    </section>
  );
}
