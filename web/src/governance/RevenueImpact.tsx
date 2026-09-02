import type { AuditEvent } from "../audit/useAuditEvents";
import { computeImpact } from "./revenueModel";
import "./RevenueImpact.css";

function rupees(paise: number) {
  const sign = paise < 0 ? "−" : "";
  return `${sign}₹${(Math.abs(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function RevenueImpact({ events }: { events: AuditEvent[] }) {
  const impact = computeImpact(events);
  if (!impact) return null;

  const gained = impact.upliftInPaise > 0;

  return (
    <section className="ri" aria-labelledby="ri-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="ri-title">
          Revenue impact
        </h2>
        <span className={`ri-uplift${gained ? " is-up" : ""}`}>
          {gained ? "+" : ""}
          {impact.upliftPercent.toFixed(0)}%
        </span>
      </div>

      <ol className="ri-lines">
        {impact.lines.map((line) => (
          <li key={line.key} className={line.amountInPaise < 0 ? "is-negative" : undefined}>
            <div>
              <strong>{line.label}</strong>
              <span>{line.detail}</span>
            </div>
            <b>{rupees(line.amountInPaise)}</b>
          </li>
        ))}
      </ol>

      <div className="ri-total">
        <div>
          <span>Order total</span>
          <small>
            {rupees(impact.baselineInPaise)} at first recommendation
          </small>
        </div>
        <strong>{rupees(impact.finalInPaise)}</strong>
      </div>

      <p className="ri-note">
        Counted from the audit trail, and only where the customer actually accepted. A suggestion that was
        declined adds nothing here.
      </p>
    </section>
  );
}
