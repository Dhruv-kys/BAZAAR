import { logAuditEvent } from "../audit/auditStore.js";
import { getProductById } from "../catalog/catalog.js";
import {
  beginPaymentLinkCreation,
  endPaymentLinkCreation,
  getPendingOrder,
  isQuoteExpired,
  recordPaymentAttempt,
  type PendingOrder,
} from "../payments/pendingOrderStore.js";
import { createPaymentLink } from "../payments/razorpay.js";
import { watchPaymentLink } from "../payments/paymentWatcher.js";
import type { Actor } from "./actor.js";
import { consumeMandate, releaseMandate, verifyMandate, type VerifiedMandate } from "./mandate.js";
import { authorizeTotal, scopeAllows } from "./policy.js";
import { priceOrder } from "./pricing.js";
import { isRefusal, refuse, type Refusal } from "./refusals.js";

export interface ConfirmOrderRequest {
  summaryId: string;
  actor: Actor;
  mandate?: unknown;
}

export interface ConfirmOrderSuccess {
  ok: true;
  summaryId: string;
  paymentUrl: string;
  paymentLinkId: string;
  totalInPaise: number;
  mandateId?: string;
}

export type ConfirmOrderResult = ConfirmOrderSuccess | Refusal;

function repriceMatchesQuote(order: PendingOrder): Refusal | null {
  const pricing = priceOrder({
    items: order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
    addOnIds: order.addOns.map((addOn) => addOn.addOnId),
    discountRequestId: order.discountRequestId,
  });

  if (!pricing.ok) return pricing;
  if (pricing.priced.totalInPaise !== order.totalInPaise) {
    return refuse(
      "PRICE_CHANGED",
      `The catalog price moved after this quote was issued (quoted ${order.totalInPaise} paise, now ${pricing.priced.totalInPaise} paise). Request a fresh quote.`,
    );
  }
  return null;
}

/**
 * The mandate gate is selected by actor kind, so a quote staged over the agent
 * door must not be confirmable through the human one: that route hardcodes a
 * human actor and would skip mandate verification, consumption and ceiling
 * intersection entirely.
 */
function actorMismatch(order: PendingOrder, actor: Actor): Refusal | null {
  if (order.actor === actor.kind && order.agentId === actor.agentId) return null;
  return refuse(
    "ORDER_ACTOR_MISMATCH",
    "This quote was staged by a different party and can only be confirmed through the door that created it.",
  );
}

function deny(request: ConfirmOrderRequest, refusal: Refusal): Refusal {
  logAuditEvent({
    sessionId: request.actor.sessionId,
    actor: request.actor.kind,
    agentId: request.actor.agentId,
    type: "confirm_refused",
    toolName: "confirm_order",
    reasoning: refusal.message,
    payload: { summaryId: request.summaryId, binding: refusal.binding ?? null },
    wasClamped: refusal.code === "CEILING_EXCEEDED",
    refusalCode: refusal.code,
  });
  return refusal;
}

export async function confirmOrder(request: ConfirmOrderRequest): Promise<ConfirmOrderResult> {
  const { summaryId, actor } = request;
  const order = getPendingOrder(summaryId);
  if (!order) {
    return deny(request, refuse("QUOTE_NOT_FOUND", "Unknown or expired order summary."));
  }

  const mismatch = actorMismatch(order, actor);
  if (mismatch) return deny(request, mismatch);

  if (order.paymentAttempt) {
    if (!order.paidAt) watchPaymentLink(summaryId, order.paymentAttempt.paymentLinkId);
    return {
      ok: true,
      summaryId,
      paymentUrl: order.paymentAttempt.url,
      paymentLinkId: order.paymentAttempt.paymentLinkId,
      totalInPaise: order.totalInPaise,
      mandateId: order.mandateId,
    };
  }

  if (isQuoteExpired(order)) {
    return deny(request, refuse("QUOTE_EXPIRED", "This quote has expired. Request a fresh quote before confirming."));
  }

  let mandate: VerifiedMandate | undefined;
  if (actor.kind === "agent") {
    if (request.mandate == null) {
      return deny(
        request,
        refuse(
          "MANDATE_REQUIRED",
          "An agent must present a signed spend mandate to confirm an order. There is no unauthorized charge path.",
        ),
      );
    }
    const verified = verifyMandate(request.mandate, { expectedAgentId: actor.agentId ?? "" });
    if (isRefusal(verified)) return deny(request, verified);

    const categories = [
      ...new Set(
        order.items
          .map((item) => getProductById(item.productId)?.category)
          .filter((category): category is string => category !== undefined),
      ),
    ];
    const scopeViolation = scopeAllows(verified, categories);
    if (scopeViolation) return deny(request, scopeViolation);

    mandate = verified;
  }

  const priceDrift = repriceMatchesQuote(order);
  if (priceDrift) return deny(request, priceDrift);

  const authorization = authorizeTotal(order.totalInPaise, actor, mandate);
  if (!authorization.ok) return deny(request, authorization);

  if (mandate && !consumeMandate(mandate.claims.mandateId, actor.agentId ?? "", summaryId)) {
    return deny(
      request,
      refuse(
        "MANDATE_ALREADY_CONSUMED",
        "This mandate has already been spent. Mandates are single-use; obtain a fresh one.",
      ),
    );
  }

  if (!beginPaymentLinkCreation(summaryId)) {
    if (mandate) releaseMandate(mandate.claims.mandateId);
    return deny(request, refuse("PAYMENT_IN_PROGRESS", "A payment link for this order is already being created."));
  }

  try {
    const paymentLink = await createPaymentLink(order);
    recordPaymentAttempt(summaryId, { paymentLinkId: paymentLink.id, url: paymentLink.shortUrl });
    order.mandateId = mandate?.claims.mandateId;
    watchPaymentLink(summaryId, paymentLink.id);

    logAuditEvent({
      sessionId: order.sessionId,
      actor: actor.kind,
      agentId: actor.agentId,
      type: "payment_link_created",
      toolName: "confirm_order",
      reasoning: mandate
        ? `Agent ${actor.agentId} confirmed order ${summaryId} under mandate ${mandate.claims.mandateId} (ceiling ₹${mandate.claims.ceilingInPaise / 100}); payment link created for ₹${order.totalInPaise / 100}`
        : `Customer confirmed order ${summaryId}; payment link created for ₹${order.totalInPaise / 100}`,
      payload: {
        summaryId,
        paymentLinkId: paymentLink.id,
        totalInPaise: order.totalInPaise,
        binding: authorization.binding,
        mandateId: mandate?.claims.mandateId,
        principalId: mandate?.claims.principalId,
      },
    });

    return {
      ok: true,
      summaryId,
      paymentUrl: paymentLink.shortUrl,
      paymentLinkId: paymentLink.id,
      totalInPaise: order.totalInPaise,
      mandateId: mandate?.claims.mandateId,
    };
  } catch (error) {
    if (mandate) releaseMandate(mandate.claims.mandateId);
    console.error("payment link creation failed:", error);
    return deny(request, refuse("PAYMENT_PROVIDER_ERROR", "Couldn't create the payment link right now. Please try again."));
  } finally {
    endPaymentLinkCreation(summaryId);
  }
}

export function orderStatus(
  summaryId: string,
): { ok: true; status: string; paymentUrl?: string; totalInPaise: number } | Refusal {
  const order = getPendingOrder(summaryId);
  if (!order) return refuse("QUOTE_NOT_FOUND", "Unknown or expired order summary.");

  return {
    ok: true,
    status: order.paidAt ? "paid" : order.paymentAttempt ? "awaiting_payment" : "staged",
    paymentUrl: order.paymentAttempt?.url,
    totalInPaise: order.totalInPaise,
  };
}
