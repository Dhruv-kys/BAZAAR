import type { AuditEvent } from "../audit/useAuditEvents";
import { CheckIcon } from "../icons";
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
  const proven = GUARANTEES.filter((g) => g.provenBy(events)).length;

  return (
    <div className="tr" data-reveal data-delay="1">
      <div className="tr-core">
        <header className="tr-head">
          <span className="tr-head-label">Guarantees</span>
          <span className="tr-head-count">
            {proven}<i>/{GUARANTEES.length}</i>
          </span>
        </header>
        <div className="tr-list">
          {GUARANTEES.map((g) => {
            const proof = g.provenBy(events);
            return (
              <div key={g.key} className={`tr-item${proof ? " proven" : ""}`}>
                <span className="tr-orb" aria-hidden="true">
                  <CheckIcon size={11} />
                </span>
                <span className="tr-text">
                  <span className="tr-label">{g.label}</span>
                  <span className="tr-proof">{proof ?? g.idle}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
