import { useEffect, useRef } from "react";
import type { AuditEvent } from "./useAuditEvents";
import "./AuditPanel.css";

const TYPE_META: Record<string, { label: string; tone: string }> = {
  recommendation: { label: "recommend", tone: "blue" },
  cross_sell: { label: "cross_sell", tone: "cyan" },
  upsell: { label: "upsell", tone: "cyan" },
  discount_requested: { label: "discount", tone: "warn" },
  order_blocked: { label: "blocked", tone: "stop" },
  order_summary: { label: "staged", tone: "dim" },
  payment_link_created: { label: "pay_link", tone: "go" },
  payment_result: { label: "result", tone: "stop" },
  payment_retry: { label: "retry", tone: "warn" },
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
      <span className="ap-clamp-key">guardrail</span>
      <span className="ap-clamp-was">{requested}</span>
      <span className="ap-clamp-arrow" aria-hidden="true">
        →
      </span>
      <span className="ap-clamp-now">{applied}</span>
      <span className="ap-clamp-tag">CAPPED</span>
    </div>
  );
}

function timeOf(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour12: false });
}

export function AuditPanel({ events, sessionId }: { events: AuditEvent[]; sessionId: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  return (
    <aside className="ap">
      <header className="ap-bar">
        <span className="ap-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="ap-title">audit.log — agent decisions</span>
      </header>

      <div className="ap-body" ref={bodyRef}>
        <p className="ap-boot">
          <span className="ap-prompt">$</span> tail -f audit.log --session {sessionId.slice(0, 8)}
        </p>

        {events.length === 0 ? (
          <p className="ap-waiting">waiting for first agent decision…</p>
        ) : (
          <ol className="ap-list">
            {events.map((event) => {
              const meta = TYPE_META[event.type] ?? { label: event.type, tone: "dim" };
              return (
                <li key={event.id} className={`ap-item tone-${meta.tone}`}>
                  <div className="ap-line">
                    <span className="ap-time">{timeOf(event.timestamp)}</span>
                    <span className="ap-type">{meta.label}</span>
                    {event.wasClamped && <span className="ap-flag">!</span>}
                  </div>
                  {event.reasoning && (
                    <p className="ap-reason">
                      <span className="ap-arrow" aria-hidden="true">
                        ▸
                      </span>
                      {event.reasoning}
                    </p>
                  )}
                  {event.type === "discount_requested" && <ClampDetail payload={event.payload as DiscountPayload} />}
                </li>
              );
            })}
          </ol>
        )}

        <p className="ap-cursor" aria-hidden="true">
          <span className="ap-prompt">$</span>
          <span className="ap-caret" />
        </p>
      </div>

      <footer className="ap-status">
        <span className="ap-live">
          <i />
          live
        </span>
        <span>
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
        <span className="ap-sess">sess:{sessionId.slice(0, 8)}</span>
      </footer>
    </aside>
  );
}
