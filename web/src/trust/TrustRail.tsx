import type { AuditEvent } from "../audit/useAuditEvents";
import "./TrustRail.css";

interface Guarantee {
  key: string;
  label: string;
  idle: string;
  provenBy: (events: AuditEvent[]) => string | null;
}

const GUARANTEES: Guarantee[] = [
  {
    key: "explainable",
    label: "Explainable",
    idle: "Awaiting first decision",
    provenBy: (events) => {
      const reasoned = events.filter((e) => e.reasoning);
      return reasoned.length ? `${reasoned.length} decisions logged with reasons` : null;
    },
  },
  {
    key: "bounded",
    label: "Bounded",
    idle: "No limit reached yet",
    provenBy: (events) => {
      const clamped = events.filter((e) => e.wasClamped);
      if (!clamped.length) return null;
      const blocked = clamped.some((e) => e.type === "order_blocked");
      return blocked ? "Order blocked over spend cap" : "Discount capped below request";
    },
  },
  {
    key: "gated",
    label: "Gated",
    idle: "No order staged yet",
    provenBy: (events) => {
      if (events.some((e) => e.type === "payment_link_created")) return "Charged only after you confirmed";
      if (events.some((e) => e.type === "order_summary")) return "Summary staged, awaiting your confirm";
      return null;
    },
  },
  {
    key: "resilient",
    label: "Resilient",
    idle: "No failures encountered",
    provenBy: (events) => {
      if (events.some((e) => e.type === "payment_retry")) return "Declined payment recovered with retry";
      if (events.some((e) => e.type === "payment_result")) return "Payment outcome recorded";
      return null;
    },
  },
];

export function TrustRail({ events }: { events: AuditEvent[] }) {
  return (
    <div className="tr">
      {GUARANTEES.map((g) => {
        const proof = g.provenBy(events);
        return (
          <div key={g.key} className={`tr-item${proof ? " proven" : ""}`}>
            <span className="tr-dot" aria-hidden="true" />
            <span className="tr-text">
              <span className="tr-label">{g.label}</span>
              <span className="tr-proof">{proof ?? g.idle}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
