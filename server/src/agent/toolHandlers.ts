import { logAuditEvent } from "../audit/auditStore.js";
import { addOnsForCategory, getAddOnById, getProductById, getVariant, searchCatalog } from "../catalog/catalog.js";
import { GUARDRAILS } from "../guardrails/config.js";
import { createDiscountRequest, getDiscountRequest } from "../payments/discountRequestStore.js";
import { createPendingOrder, type PendingOrderAddOn, type PendingOrderItem } from "../payments/pendingOrderStore.js";
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
  sessionId: string;
}
export type ToolHandler = (args: unknown, ctx: ToolContext) => ToolResult;

export const toolHandlers: Record<string, ToolHandler> = {
  search_catalog(args) {
    const parsed = searchCatalogParams.safeParse(args);
    if (!parsed.success) return { ok: false, error: parsed.error.message };

    const { query, occasionTag, category } = parsed.data;
    return { ok: true, result: searchCatalog(query ?? undefined, occasionTag ?? undefined, category ?? undefined) };
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
      sessionId: ctx.sessionId,
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
      sessionId: ctx.sessionId,
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
      sessionId: ctx.sessionId,
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
      sessionId: ctx.sessionId,
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

    const items: PendingOrderItem[] = [];
    for (const item of parsed.data.items) {
      const product = getProductById(item.productId);
      const variant = getVariant(item.productId, item.variantId);
      if (!product || !variant) {
        return { ok: false, error: `Unknown product/variant: ${item.productId}/${item.variantId}` };
      }
      items.push({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantLabel: variant.label,
        quantity: item.quantity,
        priceInPaise: variant.priceInPaise,
      });
    }

    const addOns: PendingOrderAddOn[] = [];
    for (const addOnId of parsed.data.addOnIds ?? []) {
      const addOn = getAddOnById(addOnId);
      if (!addOn) return { ok: false, error: `Unknown add-on: ${addOnId}` };
      addOns.push({ addOnId: addOn.id, name: addOn.name, priceInPaise: addOn.priceInPaise });
    }

    const subtotalInPaise =
      items.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0) +
      addOns.reduce((sum, addOn) => sum + addOn.priceInPaise, 0);

    let discountInPaise = 0;
    if (parsed.data.discountRequestId) {
      const discountRequest = getDiscountRequest(parsed.data.discountRequestId);
      if (!discountRequest) {
        return { ok: false, error: `Unknown discountRequestId: ${parsed.data.discountRequestId}` };
      }
      discountInPaise =
        discountRequest.appliedPercent !== undefined
          ? Math.round((subtotalInPaise * discountRequest.appliedPercent) / 100)
          : (discountRequest.appliedAmountInPaise ?? 0);
      discountInPaise = Math.min(discountInPaise, subtotalInPaise);
    }

    const totalInPaise = subtotalInPaise - discountInPaise;

    if (totalInPaise > GUARDRAILS.maxOrderValuePaise) {
      logAuditEvent({
        sessionId: ctx.sessionId,
        type: "order_blocked",
        toolName: "present_order_summary",
        reasoning: `Total of ${totalInPaise} paise exceeds the ${GUARDRAILS.maxOrderValuePaise} paise limit I can approve on my own`,
        payload: { subtotalInPaise, discountInPaise, totalInPaise },
        wasClamped: true,
      });
      return {
        ok: false,
        error: `This order's total exceeds the ₹${GUARDRAILS.maxOrderValuePaise / 100} limit I can approve without the merchant's direct involvement. Suggest splitting the order or contacting the merchant directly.`,
      };
    }

    const pendingOrder = createPendingOrder({
      sessionId: ctx.sessionId,
      items,
      addOns,
      subtotalInPaise,
      discountInPaise,
      totalInPaise,
    });

    logAuditEvent({
      sessionId: ctx.sessionId,
      type: "order_summary",
      toolName: "present_order_summary",
      reasoning: "Customer confirmed items - staging order summary",
      payload: pendingOrder,
    });

    return { ok: true, result: pendingOrder };
  },
};
