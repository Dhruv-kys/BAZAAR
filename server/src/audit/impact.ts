import type { AuditEvent } from "./auditStore.js";

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
  summaryId: string;
  items: OrderItem[];
  addOns: OrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

export interface SessionImpact {
  sessionId: string;
  baselineInPaise: number;
  upsellInPaise: number;
  crossSellInPaise: number;
  otherItemsInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  addOnCount: number;
  upsellOffered: boolean;
  upsellAccepted: boolean;
  discountWasClamped: boolean;
  paid: boolean;
}

export interface MerchantMetrics {
  sessionsWithOrder: number;
  ordersPaid: number;
  averageOrderValueInPaise: number;
  baselineTotalInPaise: number;
  finalTotalInPaise: number;
  upliftInPaise: number;
  upliftPercent: number;
  upsellInPaise: number;
  crossSellInPaise: number;
  otherItemsInPaise: number;
  discountInPaise: number;
  discountClampedCount: number;
  attachRatePercent: number;
  upsellOfferedCount: number;
  upsellAcceptedCount: number;
  upsellAcceptancePercent: number;
}

function payloadOf<T>(event: AuditEvent | undefined): T | undefined {
  return event?.payload as T | undefined;
}

export function sessionImpact(sessionId: string, events: AuditEvent[]): SessionImpact | undefined {
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

  const upsellInPaise = anchor ? Math.max(0, anchor.priceInPaise * anchor.quantity - baselineInPaise) : 0;
  const crossSellInPaise = order.addOns.reduce((sum, addOn) => sum + addOn.priceInPaise, 0);
  const otherItemsInPaise = order.items
    .filter((item) => item !== anchor)
    .reduce((sum, item) => sum + item.priceInPaise * item.quantity, 0);

  const discountEvent = events.find((event) => event.type === "discount_requested");
  const paid = events.some(
    (event) =>
      event.type === "payment_result" && (event.payload as { status?: string })?.status === "success",
  );

  return {
    sessionId,
    baselineInPaise,
    upsellInPaise,
    crossSellInPaise,
    otherItemsInPaise,
    discountInPaise: order.discountInPaise,
    totalInPaise: order.totalInPaise,
    addOnCount: order.addOns.length,
    upsellOffered: events.some((event) => event.type === "upsell"),
    upsellAccepted: upsellInPaise > 0,
    discountWasClamped: Boolean(discountEvent?.wasClamped),
    paid,
  };
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

export function merchantMetrics(events: AuditEvent[]): MerchantMetrics {
  const bySession = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const bucket = bySession.get(event.sessionId);
    if (bucket) bucket.push(event);
    else bySession.set(event.sessionId, [event]);
  }

  const impacts: SessionImpact[] = [];
  for (const [sessionId, sessionEvents] of bySession) {
    const impact = sessionImpact(sessionId, sessionEvents);
    if (impact) impacts.push(impact);
  }

  const sum = (pick: (impact: SessionImpact) => number) =>
    impacts.reduce((total, impact) => total + pick(impact), 0);

  const baselineTotalInPaise = sum((impact) => impact.baselineInPaise);
  const finalTotalInPaise = sum((impact) => impact.totalInPaise);
  const upsellOfferedCount = impacts.filter((impact) => impact.upsellOffered).length;
  const upsellAcceptedCount = impacts.filter((impact) => impact.upsellAccepted).length;

  return {
    sessionsWithOrder: impacts.length,
    ordersPaid: impacts.filter((impact) => impact.paid).length,
    averageOrderValueInPaise: impacts.length > 0 ? Math.round(finalTotalInPaise / impacts.length) : 0,
    baselineTotalInPaise,
    finalTotalInPaise,
    upliftInPaise: finalTotalInPaise - baselineTotalInPaise,
    upliftPercent: percent(finalTotalInPaise - baselineTotalInPaise, baselineTotalInPaise),
    upsellInPaise: sum((impact) => impact.upsellInPaise),
    crossSellInPaise: sum((impact) => impact.crossSellInPaise),
    otherItemsInPaise: sum((impact) => impact.otherItemsInPaise),
    discountInPaise: sum((impact) => impact.discountInPaise),
    discountClampedCount: impacts.filter((impact) => impact.discountWasClamped).length,
    attachRatePercent: percent(impacts.filter((impact) => impact.addOnCount > 0).length, impacts.length),
    upsellOfferedCount,
    upsellAcceptedCount,
    upsellAcceptancePercent: percent(upsellAcceptedCount, upsellOfferedCount),
  };
}
