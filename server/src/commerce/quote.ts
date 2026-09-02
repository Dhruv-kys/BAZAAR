import { logAuditEvent } from "../audit/auditStore.js";
import { createDiscountRequest } from "../payments/discountRequestStore.js";
import { createPendingOrder } from "../payments/pendingOrderStore.js";
import type { Actor } from "./actor.js";
import {
  BULK_DISCOUNT_OFFER_PERCENT,
  bulkDiscountQualifies,
  offersFor,
  parseOffer,
  type Offer,
} from "./offers.js";
import { authorizeTotal } from "./policy.js";
import { priceOrder, type OrderLineRequest } from "./pricing.js";
import { refuse, type Refusal } from "./refusals.js";

export interface QuoteRequest {
  items: OrderLineRequest[];
  addOnIds?: string[];
  acceptOffer?: string;
  actor: Actor;
}

export interface AgentQuote {
  quoteId: string;
  items: { productId: string; name: string; variantId: string; variant: string; quantity: number; unitPriceInPaise: number }[];
  addOns: { addOnId: string; name: string; priceInPaise: number }[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  currency: "INR";
  expiresAt: string;
  ceilingInPaise: number;
  offers: Offer[];
}

export type QuoteResult = { ok: true; quote: AgentQuote } | Refusal;

export function requestQuote(request: QuoteRequest): QuoteResult {
  let items = [...request.items];
  let addOnIds = [...(request.addOnIds ?? [])];
  let bulkDiscount = false;

  if (request.acceptOffer) {
    const application = parseOffer(request.acceptOffer);
    if (!application) {
      return refuse("UNKNOWN_PRODUCT", `Unknown offer code: ${request.acceptOffer}`);
    }
    if (application.addAddOnId) addOnIds.push(application.addAddOnId);
    if (application.upgrade) {
      const { productId, toVariantId } = application.upgrade;
      items = items.map((item) =>
        item.productId === productId ? { ...item, variantId: toVariantId } : item,
      );
    }
    if (application.bulkDiscount) bulkDiscount = true;
  }

  const base = priceOrder({ items, addOnIds });
  if (!base.ok) return base;

  let discountRequestId: string | undefined;
  if (bulkDiscount) {
    if (!bulkDiscountQualifies(base.priced.subtotalInPaise)) {
      return refuse(
        "CEILING_EXCEEDED",
        "This order does not reach the bulk-order threshold, so that discount cannot be applied.",
      );
    }
    const discountRequest = createDiscountRequest({
      requestedPercent: BULK_DISCOUNT_OFFER_PERCENT,
      appliedPercent: BULK_DISCOUNT_OFFER_PERCENT,
      reasonCode: "BULK_ADDON",
      wasClamped: false,
    });
    discountRequestId = discountRequest.discountRequestId;
  }

  const pricing = discountRequestId ? priceOrder({ items, addOnIds, discountRequestId }) : base;
  if (!pricing.ok) return pricing;

  const { priced } = pricing;
  const authorization = authorizeTotal(priced.totalInPaise, request.actor);
  if (!authorization.ok) {
    logAuditEvent({
      sessionId: request.actor.sessionId,
      actor: request.actor.kind,
      agentId: request.actor.agentId,
      type: "quote_refused",
      toolName: "request_quote",
      reasoning: `Quote of ${priced.totalInPaise} paise exceeds the merchant order cap of ${authorization.binding?.limitInPaise} paise`,
      payload: { totalInPaise: priced.totalInPaise, binding: authorization.binding },
      wasClamped: true,
      refusalCode: authorization.code,
    });
    return authorization;
  }

  const order = createPendingOrder({
    sessionId: request.actor.sessionId,
    actor: request.actor.kind,
    agentId: request.actor.agentId,
    discountRequestId,
    ...priced,
  });

  logAuditEvent({
    sessionId: request.actor.sessionId,
    actor: request.actor.kind,
    agentId: request.actor.agentId,
    type: "quote_issued",
    toolName: "request_quote",
    reasoning: `Quote ${order.summaryId} issued for ₹${priced.totalInPaise / 100}${
      request.acceptOffer ? ` after the agent accepted offer ${request.acceptOffer}` : ""
    }`,
    payload: {
      quoteId: order.summaryId,
      subtotalInPaise: priced.subtotalInPaise,
      discountInPaise: priced.discountInPaise,
      totalInPaise: priced.totalInPaise,
      acceptedOffer: request.acceptOffer ?? null,
    },
  });

  return {
    ok: true,
    quote: {
      quoteId: order.summaryId,
      items: priced.items.map((item) => ({
        productId: item.productId,
        name: item.productName,
        variantId: item.variantId,
        variant: item.variantLabel,
        quantity: item.quantity,
        unitPriceInPaise: item.priceInPaise,
      })),
      addOns: priced.addOns.map((addOn) => ({
        addOnId: addOn.addOnId,
        name: addOn.name,
        priceInPaise: addOn.priceInPaise,
      })),
      subtotalInPaise: priced.subtotalInPaise,
      discountInPaise: priced.discountInPaise,
      totalInPaise: priced.totalInPaise,
      currency: "INR",
      expiresAt: new Date(order.expiresAt).toISOString(),
      ceilingInPaise: authorization.binding.limitInPaise,
      offers: offersFor(priced),
    },
  };
}
