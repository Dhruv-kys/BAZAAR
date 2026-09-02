import type { AuditEvent } from "../audit/useAuditEvents";
import "./Guarantees.css";

interface Guarantee {
  key: string;
  label: string;
  idle: string;
  proof: (events: AuditEvent[]) => string | null;
}

const GUARANTEES: Guarantee[] = [
  {
    key: "explainable",
    label: "Every choice is explained",
    idle: "Nothing decided yet",
    proof: (events) => {
      const reasoned = events.filter((e) => e.reasoning);
      return reasoned.length ? `${reasoned.length} decisions came with a reason` : null;
    },
  },
  {
    key: "bounded",
    label: "Limits are enforced",
    idle: "No limit reached yet",
    proof: (events) => {
      const clamped = events.filter((e) => e.wasClamped);
      if (!clamped.length) return null;
      return clamped.some((e) => e.type === "order_blocked")
        ? "An order over the limit was refused"
        : "A discount was cut back to the limit";
    },
  },
  {
    key: "gated",
    label: "You approve the payment",
    idle: "No order ready yet",
    proof: (events) => {
      if (events.some((e) => e.type === "payment_result")) return "Charged only after you confirmed";
      if (events.some((e) => e.type === "order_summary")) return "Ready, waiting for your confirmation";
      return null;
    },
  },
  {
    key: "resilient",
    label: "Failures recover",
    idle: "Nothing has gone wrong",
    proof: (events) => {
      if (events.some((e) => e.type === "payment_retry")) return "A declined payment recovered";
      if (events.some((e) => e.type === "payment_result")) return "Payment outcome recorded";
      return null;
    },
  },
];

export function Guarantees({ events }: { events: AuditEvent[] }) {
  const proven = GUARANTEES.filter((g) => g.proof(events)).length;

  return (
    <section className="gt" aria-labelledby="gt-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="gt-title">
          Safety checks
        </h2>
        <span className="gt-count">
          {proven}<i>/{GUARANTEES.length}</i> confirmed
        </span>
      </div>

      <ul className="gt-list">
        {GUARANTEES.map((g) => {
          const proof = g.proof(events);
          return (
            <li key={g.key} className={`gt-item${proof ? " is-proven" : ""}`}>
              <span className="gt-state" aria-hidden="true">
                {proof ? "✓" : "–"}
              </span>
              <span className="gt-body">
                <span className="gt-label">{g.label}</span>
                <span className="gt-proof">{proof ?? g.idle}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
