import { useEffect, useRef } from "react";
import type { AuditEvent, StreamStatus } from "./useAuditEvents";
import "./AuditStream.css";

type Tone = "agent" | "policy" | "gate" | "fail" | "neutral";

const SHAPE: Record<string, { label: string; tone: Tone }> = {
  recommendation: { label: "Recommend", tone: "agent" },
  cross_sell: { label: "Cross-sell", tone: "agent" },
  upsell: { label: "Upsell", tone: "agent" },
  discount_requested: { label: "Discount", tone: "policy" },
  order_summary: { label: "Order ready", tone: "gate" },
  order_blocked: { label: "Order refused", tone: "fail" },
  payment_result: { label: "Payment", tone: "gate" },
  payment_retry: { label: "Recovered", tone: "policy" },
  function: { label: "Tool", tone: "neutral" },
};

function shapeOf(event: AuditEvent) {
  const base = SHAPE[event.type] ?? { label: event.type.replace(/_/g, " "), tone: "neutral" as Tone };
  if (event.wasClamped) return { ...base, tone: "policy" as Tone };
  if (event.type === "payment_result" && (event.payload as { status?: string })?.status === "failed") {
    return { label: "Payment declined", tone: "fail" as Tone };
  }
  return base;
}

function timeOf(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour12: false });
}

export function AuditStream({ events, status }: { events: AuditEvent[]; status: StreamStatus }) {
  const trackRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: track.scrollWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [events.length]);

  return (
    <section className="as" aria-labelledby="as-title">
      <div className="as-head">
        <h2 className="cs-label" id="as-title">
          What just happened
        </h2>
        <span className="as-meta">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="as-empty">
          {status === "offline"
            ? "Not connected right now. Decisions will show up here once the shop\u2019s server is back."
            : "Each choice the agent makes shows up here as it happens, with the reason behind it."}
        </p>
      ) : (
        <ol className="as-track" ref={trackRef}>
          {events.map((event) => {
            const shape = shapeOf(event);
            return (
              <li key={event.id} className={`as-card as-${shape.tone}`}>
                <div className="as-card-head">
                  <span className="as-time">{timeOf(event.timestamp)}</span>
                  <span className="as-type">{shape.label}</span>
                </div>
                {event.reasoning && <p className="as-reason">{event.reasoning}</p>}
                <div className="as-foot">
                  {event.toolName && <code className="as-tool">{event.toolName}</code>}
                  {event.wasClamped && <span className="as-flag">limit enforced</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
