import { logAuditEvent } from "../audit/auditStore.js";
import { handlePaymentFailure } from "./handlePaymentFailure.js";
import { getPendingOrder, markOrderPaid } from "./pendingOrderStore.js";
import { getPaymentLinkStatus } from "./razorpay.js";

const POLL_INTERVAL_MS = 8000;
const MAX_WATCH_MS = 20 * 60 * 1000;

export type LinkOutcome = "paid" | "retry" | "stop" | "keep_watching";

export function resolveLinkOutcome(status: string): LinkOutcome {
  if (status === "paid") return "paid";
  if (status === "expired") return "retry";
  if (status === "cancelled") return "stop";
  return "keep_watching";
}

const watchers = new Map<string, NodeJS.Timeout>();

export function stopWatching(summaryId: string): void {
  const timer = watchers.get(summaryId);
  if (timer) clearTimeout(timer);
  watchers.delete(summaryId);
}

export function watchPaymentLink(summaryId: string, paymentLinkId: string, intervalMs = POLL_INTERVAL_MS): void {
  stopWatching(summaryId);
  const startedAt = Date.now();

  const tick = async () => {
    const order = getPendingOrder(summaryId);
    if (!order || order.paidAt || order.paymentAttempt?.paymentLinkId !== paymentLinkId) {
      stopWatching(summaryId);
      return;
    }
    if (Date.now() - startedAt > MAX_WATCH_MS) {
      stopWatching(summaryId);
      return;
    }

    let status: string;
    try {
      status = await getPaymentLinkStatus(paymentLinkId);
    } catch (error) {
      console.error("payment link poll failed:", error);
      schedule();
      return;
    }

    switch (resolveLinkOutcome(status)) {
      case "paid": {
        stopWatching(summaryId);
        if (markOrderPaid(summaryId)) {
          logAuditEvent({
            sessionId: order.sessionId,
            type: "payment_result",
            toolName: "paymentWatcher",
            reasoning: `Payment link ${paymentLinkId} reported paid (detected by polling)`,
            payload: { summaryId, paymentLinkId, status: "success" },
          });
        }
        return;
      }
      case "retry": {
        stopWatching(summaryId);
        try {
          const retry = await handlePaymentFailure(summaryId, `Payment link ${paymentLinkId} expired`);
          watchPaymentLink(summaryId, retry.paymentLinkId, intervalMs);
        } catch (error) {
          console.error("retry after expiry failed:", error);
        }
        return;
      }
      case "stop": {
        stopWatching(summaryId);
        logAuditEvent({
          sessionId: order.sessionId,
          type: "payment_result",
          toolName: "paymentWatcher",
          reasoning: `Payment link ${paymentLinkId} was cancelled`,
          payload: { summaryId, paymentLinkId, status: "cancelled" },
        });
        return;
      }
      default:
        schedule();
    }
  };

  const schedule = () => {
    watchers.set(
      summaryId,
      setTimeout(() => void tick(), intervalMs),
    );
  };

  schedule();
}
