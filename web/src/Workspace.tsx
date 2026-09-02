import { useState } from "react";
import { AuditStream } from "./audit/AuditStream";
import { useAuditEvents } from "./audit/useAuditEvents";
import { ConversationPanel } from "./chat/ConversationPanel";
import { AgentDoor } from "./governance/AgentDoor";
import { AgentTopology } from "./governance/AgentTopology";
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

  const settled = events.some(
    (e) => e.type === "payment_result" && (e.payload as { status?: string })?.status === "success",
  );
  const authorized = events.some((e) => e.type === "payment_retry") || settled;
  const gate = !order ? "none" : settled ? "settled" : authorized ? "authorized" : "staged";

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
          <AgentTopology events={events} gate={gate} />
          <Guarantees events={events} />
          <AgentDoor />
        </aside>
      </div>

      <AuditStream events={events} status={status} />
      <HelpDock />
    </div>
  );
}
