import express, { Router } from "express";
import { logAuditEvent } from "../audit/auditStore.js";
import { handlePaymentFailure } from "../payments/handlePaymentFailure.js";
import { watchPaymentLink } from "../payments/paymentWatcher.js";
import { getPendingOrder, markOrderPaid } from "../payments/pendingOrderStore.js";
import { summaryIdFromReference, verifyWebhookSignature } from "../payments/razorpay.js";

export const paymentsRouter = Router();

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment_link?: { entity?: { reference_id?: string; notes?: Record<string, string> } };
    payment?: { entity?: { id?: string; status?: string; notes?: Record<string, string> } };
  };
}

const FAILURE_EVENTS = new Set(["payment.failed", "payment_link.expired", "payment_link.cancelled"]);

function extractSummaryId(event: RazorpayWebhookEvent): string | undefined {
  const fromNotes =
    event.payload?.payment_link?.entity?.notes?.summaryId ?? event.payload?.payment?.entity?.notes?.summaryId;
  if (fromNotes) return fromNotes;

  const referenceId = event.payload?.payment_link?.entity?.reference_id;
  return referenceId ? summaryIdFromReference(referenceId) : undefined;
}

paymentsRouter.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = (req.body as Buffer).toString("utf8");

  let signatureValid: boolean;
  try {
    signatureValid = typeof signature === "string" && verifyWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error("webhook signature verification failed:", error);
    res.status(500).json({ error: "Webhook verification is not configured correctly" });
    return;
  }

  if (!signatureValid) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    res.status(400).json({ error: "Webhook body is not valid JSON" });
    return;
  }

  const summaryId = extractSummaryId(event);
  const order = summaryId ? getPendingOrder(summaryId) : undefined;

  if (order && event.event === "payment_link.paid") {
    if (markOrderPaid(summaryId!)) {
      logAuditEvent({
        sessionId: order.sessionId,
        type: "payment_result",
        toolName: "webhook",
        reasoning: `Payment succeeded for order ${summaryId}`,
        payload: { summaryId, paymentId: event.payload?.payment?.entity?.id, status: "success" },
      });
    }
  } else if (order && !order.paidAt && FAILURE_EVENTS.has(event.event)) {
    try {
      const retry = await handlePaymentFailure(summaryId!, `Received "${event.event}" from Razorpay`);
      watchPaymentLink(summaryId!, retry.paymentLinkId);
    } catch (error) {
      console.error("handlePaymentFailure failed for webhook event:", error);
    }
  }

  res.json({ received: true });
});

paymentsRouter.post("/:summaryId/simulate-failure", async (req, res) => {
  const { summaryId } = req.params;
  try {
    const result = await handlePaymentFailure(summaryId, "Simulated failure (demo trigger)");
    watchPaymentLink(summaryId, result.paymentLinkId);
    res.json(result);
  } catch (error) {
    console.error("simulate-failure failed:", error);
    res.status(404).json({ error: "Unknown order, or a retry payment link couldn't be generated" });
  }
});
