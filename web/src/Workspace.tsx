import { useState } from "react";
import { AuditDrawer } from "./audit/AuditDrawer";
import { useAuditEvents } from "./audit/useAuditEvents";
import { ConversationPanel } from "./chat/ConversationPanel";
import { OrderOverlay } from "./order/OrderOverlay";
import type { PendingOrder } from "./order/StagedOrder";
import { SystemBar } from "./system/SystemBar";
import { useTheme } from "./useTheme";
import "./App.css";

const sessionId = crypto.randomUUID();

export function Workspace() {
  const { theme, toggleTheme } = useTheme();
  const { events, status } = useAuditEvents(sessionId);
  const [order, setOrder] = useState<PendingOrder>();
  const [started, setStarted] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  function stageOrder(next: PendingOrder) {
    setOrder(next);
    setOrderOpen(true);
  }

  return (
    <div className="cs">
      <SystemBar
        sessionId={sessionId}
        stream={status}
        theme={theme}
        onToggleTheme={toggleTheme}
        started={started}
        eventCount={events.length}
        hasOrder={Boolean(order)}
        onOpenOrder={() => setOrderOpen(true)}
        auditOpen={auditOpen}
        onToggleAudit={() => setAuditOpen((open) => !open)}
        onReset={() => window.location.reload()}
      />

      <main className="cs-main">
        <ConversationPanel sessionId={sessionId} onOrderStaged={stageOrder} onStarted={() => setStarted(true)} />
      </main>

      {orderOpen && order && (
        <OrderOverlay order={order} events={events} onClose={() => setOrderOpen(false)} />
      )}

      {auditOpen && <AuditDrawer events={events} status={status} onClose={() => setAuditOpen(false)} />}
    </div>
  );
}
