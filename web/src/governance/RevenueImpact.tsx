import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import type { SessionImpact } from "./metrics";
import { rupees } from "./metrics";
import "./RevenueImpact.css";

export function RevenueImpact({ sessionId, eventCount }: { sessionId: string; eventCount: number }) {
  const [impact, setImpact] = useState<SessionImpact | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl(`/api/audit/impact?sessionId=${encodeURIComponent(sessionId)}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionImpact | null) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, eventCount]);

  if (!impact) return null;

  const lines = [
    { key: "baseline", label: "First recommendation", amount: impact.baselineInPaise },
    { key: "upsell", label: "Upsell accepted", amount: impact.upsellInPaise },
    { key: "cross", label: "Cross-sell accepted", amount: impact.crossSellInPaise },
    { key: "other", label: "Additional items", amount: impact.otherItemsInPaise },
    { key: "discount", label: "Discount applied", amount: -impact.discountInPaise },
  ].filter((line) => line.key === "baseline" || line.amount !== 0);

  const uplift = impact.totalInPaise - impact.baselineInPaise;
  const upliftPercent = impact.baselineInPaise > 0 ? (uplift / impact.baselineInPaise) * 100 : 0;

  return (
    <section className="ri" aria-labelledby="ri-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="ri-title">
          Revenue impact
        </h2>
        <span className={`ri-uplift${uplift > 0 ? " is-up" : ""}`}>
          {uplift > 0 ? "+" : ""}
          {upliftPercent.toFixed(0)}%
        </span>
      </div>

      <ol className="ri-lines">
        {lines.map((line) => (
          <li key={line.key} className={line.amount < 0 ? "is-negative" : undefined}>
            <div>
              <strong>{line.label}</strong>
            </div>
            <b>{rupees(line.amount)}</b>
          </li>
        ))}
      </ol>

      <div className="ri-total">
        <div>
          <span>Order total</span>
          <small>{rupees(impact.baselineInPaise)} at first recommendation</small>
        </div>
        <strong>{rupees(impact.totalInPaise)}</strong>
      </div>

      <p className="ri-note">
        Counted from the audit trail, and only where the customer accepted. A suggestion that was
        declined adds nothing here.
      </p>
    </section>
  );
}
