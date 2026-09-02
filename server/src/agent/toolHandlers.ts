import { logAuditEvent } from "../audit/auditStore.js";
import { addOnsForCategory, getAddOnById, getProductById, getVariant, searchCatalog } from "../catalog/catalog.js";
import type { Actor } from "../commerce/actor.js";
import { authorizeTotal } from "../commerce/policy.js";
import { priceOrder } from "../commerce/pricing.js";
import { GUARDRAILS } from "../guardrails/config.js";
import { createDiscountRequest } from "../payments/discountRequestStore.js";
import { createPendingOrder } from "../payments/pendingOrderStore.js";
import {
  applyDiscountParams,
  getProductDetailsParams,
  presentOrderSummaryParams,
  recommendProductParams,
  searchCatalogParams,
  suggestAddonParams,
  suggestUpsellParams,
} from "./tools.js";

export type ToolResult = { ok: true; result: unknown } | { ok: false; error: string };
export interface ToolContext {
  actor: Actor;
}
export type ToolHandler = (args: unknown, ctx: ToolContext) => ToolResult;

function auditFields(actor: Actor) {
  return { sessionId: actor.sessionId, actor: actor.kind, agentId: actor.agentId };
}

export const toolHandlers: Record<string, ToolHandler> = {
  search_catalog(args) {
    const parsed = searchCatalogParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const { query, occasionTag, category } = parsed.data;
    const matches = searchCatalog(query ?? undefined, occasionTag ?? undefined, category ?? undefined);
    return {
      ok: true,
      result: matches.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        fromPaise: Math.min(...product.variants.map((v) => v.priceInPaise)),
        variantCount: product.variants.length,
      })),
    };
  },

  get_product_details(args) {
    const parsed = getProductDetailsParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const product = getProductById(parsed.data.productId);
    if (!product) return { ok: false, error: `No product with id "${parsed.data.productId}"` };

    return { ok: true, result: { ...product, availableAddOns: addOnsForCategory(product.category) } };
  },

  recommend_product(args, ctx) {
    const parsed = recommendProductParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const variant = getVariant(parsed.data.productId, parsed.data.variantId);
    if (!variant) return { ok: false, error: "That product/variant combination doesn't exist" };

    logAuditEvent({
      ...auditFields(ctx.actor),
      type: "recommendation",
      toolName: "recommend_product",
      reasoning: parsed.data.reason,
      payload: { productId: parsed.data.productId, variant },
    });

    return { ok: true, result: { productId: parsed.data.productId, variant, reason: parsed.data.reason } };
  },

  suggest_addon(args, ctx) {
    const parsed = suggestAddonParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const addOn = getAddOnById(parsed.data.addOnId);
    if (!addOn) return { ok: false, error: `No add-on with id "${parsed.data.addOnId}"` };

    logAuditEvent({
      ...auditFields(ctx.actor),
      type: "cross_sell",
      toolName: "suggest_addon",
      reasoning: parsed.data.reason,
      payload: { addOn },
    });

    return { ok: true, result: { addOn, reason: parsed.data.reason } };
  },

  suggest_upsell(args, ctx) {
    const parsed = suggestUpsellParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const variant = getVariant(parsed.data.productId, parsed.data.variantId);
    if (!variant) return { ok: false, error: "That product/variant combination doesn't exist" };
    if (!variant.premium) return { ok: false, error: "That variant isn't a premium option" };

    logAuditEvent({
      ...auditFields(ctx.actor),
      type: "upsell",
      toolName: "suggest_upsell",
      reasoning: parsed.data.reason,
      payload: { productId: parsed.data.productId, variant },
    });

    return { ok: true, result: { productId: parsed.data.productId, variant, reason: parsed.data.reason } };
  },

  apply_discount(args, ctx) {
    const parsed = applyDiscountParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const { percent, amountInPaise, reasonCode } = parsed.data;

    let appliedPercent: number | undefined;
    let appliedAmountInPaise: number | undefined;
    let wasClamped = false;

    if (percent != null) {
      appliedPercent = Math.min(percent, GUARDRAILS.maxDiscountPercent);
      wasClamped = appliedPercent < percent;
    } else {
      appliedAmountInPaise = Math.min(amountInPaise!, GUARDRAILS.maxDiscountFlatPaise);
      wasClamped = appliedAmountInPaise < amountInPaise!;
    }

    const discountRequest = createDiscountRequest({
      requestedPercent: percent ?? undefined,
      requestedAmountInPaise: amountInPaise ?? undefined,
      appliedPercent,
      appliedAmountInPaise,
      reasonCode,
      wasClamped,
    });

    logAuditEvent({
      ...auditFields(ctx.actor),
      type: "discount_requested",
      toolName: "apply_discount",
      reasoning: reasonCode,
      payload: discountRequest,
      wasClamped,
    });

    return { ok: true, result: discountRequest };
  },

  present_order_summary(args, ctx) {
    const parsed = presentOrderSummaryParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const pricing = priceOrder({
      items: parsed.data.items,
      addOnIds: parsed.data.addOnIds ?? undefined,
      discountRequestId: parsed.data.discountRequestId ?? undefined,
    });
    if (!pricing.ok) return { ok: false, error: pricing.message };

    const { priced } = pricing;
    const authorization = authorizeTotal(priced.totalInPaise, ctx.actor);
    if (!authorization.ok) {
      logAuditEvent({
        ...auditFields(ctx.actor),
        type: "order_blocked",
        toolName: "present_order_summary",
        reasoning: `Total of ${priced.totalInPaise} paise exceeds the ${authorization.binding?.limitInPaise} paise limit I can approve on my own`,
        payload: {
          subtotalInPaise: priced.subtotalInPaise,
          discountInPaise: priced.discountInPaise,
          totalInPaise: priced.totalInPaise,
          binding: authorization.binding,
        },
        wasClamped: true,
        refusalCode: authorization.code,
      });
      return {
        ok: false,
        error: `This order's total exceeds the ₹${GUARDRAILS.maxOrderValuePaise / 100} limit I can approve without the merchant's direct involvement. Suggest splitting the order or contacting the merchant directly.`,
      };
    }

    const pendingOrder = createPendingOrder({
      sessionId: ctx.actor.sessionId,
      actor: ctx.actor.kind,
      agentId: ctx.actor.agentId,
      discountRequestId: parsed.data.discountRequestId ?? undefined,
      ...priced,
    });

    logAuditEvent({
      ...auditFields(ctx.actor),
      type: "order_summary",
      toolName: "present_order_summary",
      reasoning: "Customer confirmed items - staging order summary",
      payload: pendingOrder,
    });

    return { ok: true, result: pendingOrder };
  },
};
