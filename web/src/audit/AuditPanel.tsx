import type { AuditEvent } from "./useAuditEvents";
import "./AuditPanel.css";

const TYPE_META: Record<string, { label: string; tone: string }> = {
  recommendation: { label: "Recommended", tone: "blue" },
  cross_sell: { label: "Cross-sell", tone: "cyan" },
  upsell: { label: "Upsell", tone: "cyan" },
  discount_requested: { label: "Discount", tone: "warn" },
  order_blocked: { label: "Blocked", tone: "stop" },
  order_summary: { label: "Summary staged", tone: "ink" },
  payment_link_created: { label: "Payment link", tone: "go" },
  payment_result: { label: "Payment result", tone: "stop" },
  payment_retry: { label: "Retry issued", tone: "warn" },
};

interface DiscountPayload {
  requestedPercent?: number;
  requestedAmountInPaise?: number;
  appliedPercent?: number;
  appliedAmountInPaise?: number;
}

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ClampDetail({ payload }: { payload: DiscountPayload }) {
  const requested =
    payload.requestedPercent != null
      ? `${payload.requestedPercent}%`
      : payload.requestedAmountInPaise != null
        ? rupees(payload.requestedAmountInPaise)
        : null;
  const applied =
    payload.appliedPercent != null
      ? `${payload.appliedPercent}%`
      : payload.appliedAmountInPaise != null
        ? rupees(payload.appliedAmountInPaise)
        : null;

  if (!requested || !applied) return null;

  return (
    <div className="ap-clamp">
      <span className="ap-clamp-was">{requested}</span>
      <span className="ap-clamp-arrow" aria-hidden="true">
        →
      </span>
      <span className="ap-clamp-now">{applied}</span>
      <span className="ap-clamp-tag">capped by policy</span>
    </div>
  );
}

function timeOf(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AuditPanel({ events }: { events: AuditEvent[] }) {
  return (
    <aside className="ap">
      <header className="ap-head">
        <span className="eyebrow">Audit trail</span>
        <p className="ap-sub">Every decision the agent made, and why.</p>
      </header>

      {events.length === 0 ? (
        <div className="ap-empty">
          <span className="ap-empty-mark" aria-hidden="true">
            ◍
          </span>
          <p>Nothing logged yet. Start a conversation and each recommendation, cap and charge will appear here in real time.</p>
        </div>
      ) : (
        <ol className="ap-list">
          {events.map((event) => {
            const meta = TYPE_META[event.type] ?? { label: event.type, tone: "ink" };
            return (
              <li key={event.id} className={`ap-item tone-${meta.tone}${event.wasClamped ? " clamped" : ""}`}>
                <div className="ap-item-head">
                  <span className="ap-type">{meta.label}</span>
                  <span className="ap-time">{timeOf(event.timestamp)}</span>
                </div>
                {event.reasoning && <p className="ap-reason">{event.reasoning}</p>}
                {event.type === "discount_requested" && <ClampDetail payload={event.payload as DiscountPayload} />}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
