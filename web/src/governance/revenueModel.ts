import type { AuditEvent } from "../audit/useAuditEvents";

interface Variant {
  id: string;
  label: string;
  priceInPaise: number;
}

interface OrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  priceInPaise: number;
}

interface OrderAddOn {
  addOnId: string;
  name: string;
  priceInPaise: number;
}

interface OrderSummary {
  items: OrderItem[];
  addOns: OrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export interface ImpactLine {
  key: string;
  label: string;
  detail: string;
  amountInPaise: number;
}

export interface Impact {
  baselineInPaise: number;
  finalInPaise: number;
  upliftInPaise: number;
  upliftPercent: number;
  lines: ImpactLine[];
}

function payloadOf<T>(event: AuditEvent | undefined): T | undefined {
  return event?.payload as T | undefined;
}

export function computeImpact(events: AuditEvent[]): Impact | undefined {
  const summaryEvent = [...events].reverse().find((event) => event.type === "order_summary");
  const order = payloadOf<OrderSummary>(summaryEvent);
  if (!order || order.items.length === 0) return undefined;

  const firstRecommendation = payloadOf<{ productId: string; variant: Variant }>(
    events.find((event) => event.type === "recommendation"),
  );

  const anchor =
    firstRecommendation && order.items.find((item) => item.productId === firstRecommendation.productId);

  const baselineInPaise = anchor
    ? firstRecommendation.variant.priceInPaise * anchor.quantity
    : order.items.reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);

  const lines: ImpactLine[] = [
    {
      key: "baseline",
      label: "First recommendation",
      detail: anchor
        ? `${anchor.productName} ${firstRecommendation.variant.label}`
        : "Items as first chosen",
      amountInPaise: baselineInPaise,
    },
  ];

  if (anchor) {
    const upsell = anchor.priceInPaise * anchor.quantity - baselineInPaise;
    if (upsell > 0) {
      lines.push({
        key: "upsell",
        label: "Upsell accepted",
        detail: `Upgraded to ${anchor.variantLabel}`,
        amountInPaise: upsell,
      });
    }
  }

  const crossSell = order.addOns.reduce((sum, addOn) => sum + addOn.priceInPaise, 0);
  if (crossSell > 0) {
    lines.push({
      key: "cross-sell",
      label: order.addOns.length === 1 ? "Cross-sell accepted" : `${order.addOns.length} cross-sells accepted`,
      detail: order.addOns.map((addOn) => addOn.name.replace(/"/g, "")).join(", "),
      amountInPaise: crossSell,
    });
  }

  const otherItems = order.items
    .filter((item) => item !== anchor)
    .reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);
  if (otherItems > 0) {
    lines.push({
      key: "additional",
      label: "Additional items",
      detail: order.items
        .filter((item) => item !== anchor)
        .map((item) => item.productName)
        .join(", "),
      amountInPaise: otherItems,
    });
  }

  if (order.discountInPaise > 0) {
    const discountEvent = events.find((event) => event.type === "discount_requested");
    const reason = discountEvent?.reasoning?.replace(/_/g, " ").toLowerCase();
    lines.push({
      key: "discount",
      label: "Discount applied",
      detail: reason ? `within cap, ${reason}` : "within the server cap",
      amountInPaise: -order.discountInPaise,
    });
  }

  const upliftInPaise = order.totalInPaise - baselineInPaise;

  return {
    baselineInPaise,
    finalInPaise: order.totalInPaise,
    upliftInPaise,
    upliftPercent: baselineInPaise > 0 ? (upliftInPaise / baselineInPaise) * 100 : 0,
    lines,
  };
}
