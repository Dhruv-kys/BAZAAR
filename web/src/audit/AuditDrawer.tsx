import { useEffect } from "react";
import { CloseIcon } from "../icons";
import { AuditStream } from "./AuditStream";
import type { AuditEvent, StreamStatus } from "./useAuditEvents";
import "./AuditDrawer.css";

export function AuditDrawer({
  events,
  status,
  onClose,
}: {
  events: AuditEvent[];
  status: StreamStatus;
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
    <div className="ad" role="dialog" aria-label="Audit trail">
      <div className="ad-panel">
        <button className="ad-close" type="button" aria-label="Hide audit trail" onClick={onClose}>
          <CloseIcon size={14} />
        </button>
        <AuditStream events={events} status={status} />
      </div>
    </div>
  );
}
