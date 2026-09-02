import { useState } from "react";
import { AuditStream } from "./audit/AuditStream";
import { useAuditEvents } from "./audit/useAuditEvents";
import { ConversationPanel } from "./chat/ConversationPanel";
import { Guarantees } from "./governance/Guarantees";
import { PolicyBoundary } from "./governance/PolicyBoundary";
import { PolicyRail } from "./governance/PolicyRail";
import { HelpDock } from "./help/HelpDock";
import { StagedOrder, type PendingOrder } from "./order/StagedOrder";
import { SystemBar } from "./system/SystemBar";
import { useTheme } from "./useTheme";
import "./App.css";

const sessionId = crypto.randomUUID();

export function Workspace() {
  const { theme, toggleTheme } = useTheme();
  const { events, status } = useAuditEvents(sessionId);
  const [order, setOrder] = useState<PendingOrder>();

  return (
    <div className="cs">
      <SystemBar sessionId={sessionId} stream={status} theme={theme} onToggleTheme={toggleTheme} />

      <div className="cs-main">
        <div className="cs-primary">
          <ConversationPanel sessionId={sessionId} onOrderStaged={setOrder} />
        </div>

        <aside className="cs-governance" aria-label="Governance">
          <PolicyBoundary events={events} />
          {order && <StagedOrder order={order} />}
          <PolicyRail />
          <Guarantees events={events} />
        </aside>
      </div>

      <AuditStream events={events} status={status} />
      <HelpDock />
    </div>
  );
}
