import { logAuditEvent } from "../audit/auditStore.js";
import { getPendingOrder, recordPaymentAttempt } from "./pendingOrderStore.js";
import { createPaymentLink } from "./razorpay.js";

export async function handlePaymentFailure(
  summaryId: string,
  reason: string,
): Promise<{ retryUrl: string; paymentLinkId: string }> {
  const order = getPendingOrder(summaryId);
  if (!order) {
    throw new Error(`Unknown order: ${summaryId}`);
  }

  logAuditEvent({
    sessionId: order.sessionId,
    type: "payment_result",
    toolName: "handlePaymentFailure",
    reasoning: reason,
    payload: { summaryId, status: "failed" },
  });

  const paymentLink = await createPaymentLink(order);
  recordPaymentAttempt(summaryId, { paymentLinkId: paymentLink.id, url: paymentLink.shortUrl });

  logAuditEvent({
    sessionId: order.sessionId,
    type: "payment_retry",
    toolName: "handlePaymentFailure",
    reasoning: "Generated a fresh payment link after the decline",
    payload: { summaryId, paymentLinkId: paymentLink.id, retryUrl: paymentLink.shortUrl },
  });

  return { retryUrl: paymentLink.shortUrl, paymentLinkId: paymentLink.id };
}
