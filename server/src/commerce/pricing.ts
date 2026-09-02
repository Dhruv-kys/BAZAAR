import { getAddOnById, getProductById, getVariant } from "../catalog/catalog.js";
import { getDiscountRequest } from "../payments/discountRequestStore.js";
import type { PendingOrderAddOn, PendingOrderItem } from "../payments/pendingOrderStore.js";
import { refuse, type Refusal } from "./refusals.js";

export interface OrderLineRequest {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface PriceOrderRequest {
  items: OrderLineRequest[];
  addOnIds?: string[];
  discountRequestId?: string;
}

export interface PricedOrder {
  items: PendingOrderItem[];
  addOns: PendingOrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export type PricingResult = { ok: true; priced: PricedOrder } | Refusal;

export function priceOrder(request: PriceOrderRequest): PricingResult {
  if (request.items.length === 0) {
    return refuse("EMPTY_ORDER", "An order needs at least one item.");
  }

  const items: PendingOrderItem[] = [];
  for (const line of request.items) {
    const product = getProductById(line.productId);
    const variant = getVariant(line.productId, line.variantId);
    if (!product || !variant) {
      return refuse("UNKNOWN_PRODUCT", `Unknown product/variant: ${line.productId}/${line.variantId}`);
    }
    items.push({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantLabel: variant.label,
      quantity: line.quantity,
      priceInPaise: variant.priceInPaise,
    });
  }

  const addOns: PendingOrderAddOn[] = [];
  for (const addOnId of request.addOnIds ?? []) {
    const addOn = getAddOnById(addOnId);
    if (!addOn) return refuse("UNKNOWN_ADDON", `Unknown add-on: ${addOnId}`);
    addOns.push({ addOnId: addOn.id, name: addOn.name, priceInPaise: addOn.priceInPaise });
  }

  const subtotalInPaise =
    items.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0) +
    addOns.reduce((sum, addOn) => sum + addOn.priceInPaise, 0);

  let discountInPaise = 0;
  if (request.discountRequestId) {
    const discountRequest = getDiscountRequest(request.discountRequestId);
    if (!discountRequest) {
      return refuse("UNKNOWN_DISCOUNT_REQUEST", `Unknown discountRequestId: ${request.discountRequestId}`);
    }
    discountInPaise =
      discountRequest.appliedPercent !== undefined
        ? Math.round((subtotalInPaise * discountRequest.appliedPercent) / 100)
        : (discountRequest.appliedAmountInPaise ?? 0);
    discountInPaise = Math.min(discountInPaise, subtotalInPaise);
  }

  return {
    ok: true,
    priced: { items, addOns, subtotalInPaise, discountInPaise, totalInPaise: subtotalInPaise - discountInPaise },
  };
}
