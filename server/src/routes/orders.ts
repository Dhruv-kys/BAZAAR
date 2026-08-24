import { Router } from "express";
import { logAuditEvent } from "../audit/auditStore.js";
import { GUARDRAILS } from "../guardrails/config.js";
import { getPendingOrder, recordPaymentAttempt } from "../payments/pendingOrderStore.js";
import { createPaymentLink } from "../payments/razorpay.js";

export const ordersRouter = Router();

ordersRouter.post("/:summaryId/confirm", async (req, res) => {
  const { summaryId } = req.params;
  const order = getPendingOrder(summaryId);
  if (!order) {
    res.status(404).json({ error: "Unknown or expired order summary" });
    return;
  }

  if (order.totalInPaise > GUARDRAILS.maxOrderValuePaise) {
    res.status(400).json({ error: "This order exceeds the maximum value that can be auto-approved." });
    return;
  }

  if (order.paymentAttempt) {
    res.json({ paymentUrl: order.paymentAttempt.url });
    return;
  }

  try {
    const paymentLink = await createPaymentLink(order);
    recordPaymentAttempt(summaryId, { paymentLinkId: paymentLink.id, url: paymentLink.shortUrl });
    logAuditEvent({
      sessionId: order.sessionId,
      type: "payment_link_created",
      toolName: "confirm_order",
      reasoning: `Customer confirmed order ${summaryId}; payment link created for ₹${order.totalInPaise / 100}`,
      payload: { summaryId, paymentLinkId: paymentLink.id },
    });
    res.json({ paymentUrl: paymentLink.shortUrl });
  } catch (error) {
    console.error("payment link creation failed:", error);
    res.status(502).json({ error: "Couldn't create the payment link right now. Please try again." });
  }
});
