export interface PendingOrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  priceInPaise: number;
}

export interface PendingOrderAddOn {
  addOnId: string;
  name: string;
  priceInPaise: number;
}

export interface PaymentAttempt {
  paymentLinkId: string;
  url: string;
}

export interface PendingOrder {
  summaryId: string;
  sessionId: string;
  items: PendingOrderItem[];
  addOns: PendingOrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  paymentAttempt?: PaymentAttempt;
  attemptCount: number;
}

const MAX_PENDING_ORDERS = 1000;

const pendingOrders = new Map<string, PendingOrder>();

export function createPendingOrder(
  order: Omit<PendingOrder, "summaryId" | "attemptCount">,
): PendingOrder {
  if (pendingOrders.size >= MAX_PENDING_ORDERS) {
    const oldest = pendingOrders.keys().next().value;
    if (oldest !== undefined) pendingOrders.delete(oldest);
  }
  const summaryId = crypto.randomUUID();
  const pendingOrder: PendingOrder = { summaryId, attemptCount: 0, ...order };
  pendingOrders.set(summaryId, pendingOrder);
  return pendingOrder;
}

export function getPendingOrder(summaryId: string): PendingOrder | undefined {
  return pendingOrders.get(summaryId);
}

export function recordPaymentAttempt(summaryId: string, attempt: PaymentAttempt): void {
  const order = pendingOrders.get(summaryId);
  if (!order) return;
  order.paymentAttempt = attempt;
  order.attemptCount += 1;
}
