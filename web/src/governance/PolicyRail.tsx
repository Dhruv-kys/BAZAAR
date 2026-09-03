import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import "./PolicyRail.css";

interface Guardrails {
  maxDiscountPercent: number;
  maxDiscountFlatPaise: number;
  maxOrderValuePaise: number;
  allowedDiscountReasonCodes: string[];
}

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function PolicyRail() {
  const [guardrails, setGuardrails] = useState<Guardrails>();
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/guardrails"))
      .then(async (res) => {
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.includes("application/json")) throw new Error("not the API");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGuardrails(data);
      })
      .catch(() => {
        if (!cancelled) setUnreachable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    { key: "agent", label: "Can it charge you?", value: "No", tone: "ok" as const },
    { key: "payment", label: "Who approves payment?", value: "You do", tone: "warn" as const },
    {
      key: "discount",
      label: "Biggest discount",
      value: guardrails ? `${guardrails.maxDiscountPercent}%` : null,
      sub: guardrails ? `up to ${rupees(guardrails.maxDiscountFlatPaise)} off` : null,
      tone: "neutral" as const,
    },
    {
      key: "order",
      label: "Largest order",
      value: guardrails ? rupees(guardrails.maxOrderValuePaise) : null,
      tone: "neutral" as const,
    },
  ];

  return (
    <section className="pr" aria-labelledby="pr-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="pr-title">
          What the agent is allowed to do
        </h2>
        <span className="rail-source">set by the shop, not the agent</span>
      </div>

      {unreachable && (
        <p className="rail-offline" role="status">
          Can't reach the shop's server right now, so these limits are unconfirmed.
        </p>
      )}

      <dl className="rail-rows">
        {rows.map((row) => (
          <div key={row.key} className={`rail-row rail-${row.tone}`}>
            <dt>{row.label}</dt>
            <dd>
              {row.value ?? (unreachable ? <span className="rail-unknown">unconfirmed</span> : <span className="rail-pending" aria-label="loading" />)}
              {row.sub && <em>{row.sub}</em>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
