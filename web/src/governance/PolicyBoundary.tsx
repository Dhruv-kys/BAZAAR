import type { AuditEvent } from "../audit/useAuditEvents";
import "./PolicyBoundary.css";

interface DiscountPayload {
  requestedPercent?: number;
  requestedAmountInPaise?: number;
  appliedPercent?: number;
  appliedAmountInPaise?: number;
  reasonCode?: string;
}

interface BlockedPayload {
  totalInPaise?: number;
  binding?: { limitInPaise?: number };
}

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function readClamp(event: AuditEvent): { asked: string; allowed: string; rule: string } | null {
  if (event.type === "discount_requested") {
    const p = event.payload as DiscountPayload;
    if (p.requestedPercent != null && p.appliedPercent != null) {
      return { asked: `${p.requestedPercent}%`, allowed: `${p.appliedPercent}%`, rule: "Discount limit" };
    }
    if (p.requestedAmountInPaise != null && p.appliedAmountInPaise != null) {
      return {
        asked: rupees(p.requestedAmountInPaise),
        allowed: rupees(p.appliedAmountInPaise),
        rule: "Discount limit",
      };
    }
    return null;
  }
  if (event.type === "order_blocked") {
    const p = event.payload as BlockedPayload;
    if (p.totalInPaise == null || p.binding?.limitInPaise == null) return null;
    return { asked: rupees(p.totalInPaise), allowed: rupees(p.binding.limitInPaise), rule: "Order limit" };
  }
  return null;
}

export function PolicyBoundary({ events }: { events: AuditEvent[] }) {
  const latest = [...events].reverse().find((e) => e.wasClamped && readClamp(e));
  if (!latest) return null;

  const clamp = readClamp(latest)!;
  const blocked = latest.type === "order_blocked";

  return (
    <section className="pb" aria-labelledby="pb-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="pb-title">
          A limit was just enforced
        </h2>
        <span className="pb-stamp">{blocked ? "Refused" : "Capped"}</span>
      </div>

      <div className="pb-body">
        <div className="pb-step pb-asked">
          <span className="pb-step-label">The agent asked for</span>
          <span className="pb-value">{clamp.asked}</span>
        </div>

        <div className="pb-gate" aria-hidden="true">
          <span className="pb-rule">{clamp.rule}</span>
          <span className="pb-bar" />
        </div>

        <div className="pb-step pb-allowed">
          <span className="pb-step-label">You were given</span>
          <span className="pb-value">{clamp.allowed}</span>
        </div>
      </div>

      <p className="pb-note">
        The agent asked for more than it is allowed. The shop's server cut it back and wrote down both numbers.
        {latest.reasoning ? ` Reason code: ${latest.reasoning}.` : ""}
      </p>
    </section>
  );
}
