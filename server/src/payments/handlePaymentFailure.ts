import { logAuditEvent } from "../audit/auditStore.js";
import {
  beginPaymentLinkCreation,
  endPaymentLinkCreation,
  getPendingOrder,
  recordPaymentAttempt,
} from "./pendingOrderStore.js";
import { createPaymentLink } from "./razorpay.js";

const MAX_PAYMENT_ATTEMPTS = 3;

export async function handlePaymentFailure(
  summaryId: string,
  reason: string,
): Promise<{ retryUrl: string; paymentLinkId: string }> {
  const order = getPendingOrder(summaryId);
  if (!order) {
    throw new Error(`Unknown order: ${summaryId}`);
  }

  /**
   * A settled order has no failure to retry. Minting another link for it would
   * leave two payable links against one order, so a late or replayed failure
   * signal must not reopen it.
   */
  if (order.paidAt) {
    throw new Error(`Order ${summaryId} is already paid; no retry link will be created`);
  }

  logAuditEvent({
    sessionId: order.sessionId,
    type: "payment_result",
    toolName: "handlePaymentFailure",
    reasoning: reason,
    payload: { summaryId, status: "failed" },
  });

  if (order.attemptCount >= MAX_PAYMENT_ATTEMPTS) {
    logAuditEvent({
      sessionId: order.sessionId,
      type: "payment_result",
      toolName: "handlePaymentFailure",
      reasoning: `Order ${summaryId} has used all ${MAX_PAYMENT_ATTEMPTS} payment attempts; no further link will be created`,
      payload: { summaryId, status: "retry_limit_reached", attemptCount: order.attemptCount },
      wasClamped: true,
    });
    throw new Error(`Order ${summaryId} has reached its ${MAX_PAYMENT_ATTEMPTS}-attempt payment limit`);
  }

  if (!beginPaymentLinkCreation(summaryId)) {
    throw new Error(`A payment link for ${summaryId} is already being created`);
  }

  let paymentLink: { id: string; shortUrl: string };
  try {
    paymentLink = await createPaymentLink(order);
    recordPaymentAttempt(summaryId, { paymentLinkId: paymentLink.id, url: paymentLink.shortUrl });
  } finally {
    endPaymentLinkCreation(summaryId);
  }

  logAuditEvent({
    sessionId: order.sessionId,
    type: "payment_retry",
    toolName: "handlePaymentFailure",
    reasoning: "Generated a fresh payment link after the decline",
    payload: { summaryId, paymentLinkId: paymentLink.id, retryUrl: paymentLink.shortUrl },
  });

  return { retryUrl: paymentLink.shortUrl, paymentLinkId: paymentLink.id };
}
