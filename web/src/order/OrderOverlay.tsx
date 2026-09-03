import { useEffect } from "react";
import type { AuditEvent } from "../audit/useAuditEvents";
import { Guarantees } from "../governance/Guarantees";
import { PolicyBoundary } from "../governance/PolicyBoundary";
import { PolicyRail } from "../governance/PolicyRail";
import { RevenueImpact } from "../governance/RevenueImpact";
import { CloseIcon } from "../icons";
import { StagedOrder, type PendingOrder } from "./StagedOrder";
import "./OrderOverlay.css";

export function OrderOverlay({
  order,
  events,
  sessionId,
  onClose,
}: {
  order: PendingOrder;
  events: AuditEvent[];
  sessionId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="oo" role="dialog" aria-modal="true" aria-label="Order summary">
      <button className="oo-scrim" type="button" aria-label="Close order summary" onClick={onClose} />
      <div className="oo-sheet">
        <header className="oo-head">
          <div>
            <span className="oo-kicker">Human gate</span>
            <h2 className="oo-title">Review before anything is charged</h2>
          </div>
          <button className="oo-close" type="button" aria-label="Close order summary" onClick={onClose}>
            <CloseIcon size={15} />
          </button>
        </header>

        <div className="oo-body">
          <StagedOrder order={order} />
          <RevenueImpact sessionId={sessionId} eventCount={events.length} />
          <PolicyBoundary events={events} />
          <PolicyRail />
          <Guarantees events={events} />
        </div>
      </div>
    </div>
  );
}
