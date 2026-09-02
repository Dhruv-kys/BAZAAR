import { Router } from "express";
import { humanActor } from "../commerce/actor.js";
import { confirmOrder, orderStatus } from "../commerce/checkout.js";
import { httpStatusFor } from "../commerce/refusals.js";
import { getPendingOrder } from "../payments/pendingOrderStore.js";

export const ordersRouter = Router();

ordersRouter.post("/:summaryId/confirm", async (req, res) => {
  const { summaryId } = req.params;
  const order = getPendingOrder(summaryId);
  if (!order) {
    res.status(404).json({ error: "Unknown or expired order summary" });
    return;
  }

  const result = await confirmOrder({ summaryId, actor: humanActor(order.sessionId) });
  if (!result.ok) {
    res.status(httpStatusFor(result.code)).json({ error: result.message, code: result.code });
    return;
  }

  res.json({ paymentUrl: result.paymentUrl });
});

ordersRouter.get("/:summaryId/status", (req, res) => {
  const result = orderStatus(req.params.summaryId);
  if (!result.ok) {
    res.status(httpStatusFor(result.code)).json({ error: result.message, code: result.code });
    return;
  }
  res.json({ status: result.status, paymentUrl: result.paymentUrl });
});
