import type { ActorKind } from "../commerce/actor.js";
import type { BillingDetails } from "../commerce/billing.js";
import { GUARDRAILS } from "../guardrails/config.js";

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
  actor: ActorKind;
  agentId?: string;
  mandateId?: string;
  billing?: BillingDetails;
  receiptNo?: string;
  items: PendingOrderItem[];
  addOns: PendingOrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
  discountRequestId?: string;
  expiresAt: number;
  paymentAttempt?: PaymentAttempt;
  attemptCount: number;
  linkCreationInFlight: boolean;
  paidAt?: number;
}

export type NewPendingOrder = Omit<
  PendingOrder,
  "summaryId" | "attemptCount" | "expiresAt" | "linkCreationInFlight"
>;

const MAX_PENDING_ORDERS = 1000;

const pendingOrders = new Map<string, PendingOrder>();

export function createPendingOrder(order: NewPendingOrder, now = Date.now()): PendingOrder {
  if (pendingOrders.size >= MAX_PENDING_ORDERS) {
    const oldest = pendingOrders.keys().next().value;
    if (oldest !== undefined) pendingOrders.delete(oldest);
  }
  const summaryId = crypto.randomUUID();
  const pendingOrder: PendingOrder = {
    summaryId,
    attemptCount: 0,
    expiresAt: now + GUARDRAILS.quoteTtlMs,
    linkCreationInFlight: false,
    ...order,
  };
  pendingOrders.set(summaryId, pendingOrder);
  return pendingOrder;
}

export function getPendingOrder(summaryId: string): PendingOrder | undefined {
  return pendingOrders.get(summaryId);
}

export function isQuoteExpired(order: PendingOrder, now = Date.now()): boolean {
  return now >= order.expiresAt;
}

export function markOrderPaid(summaryId: string): boolean {
  const order = pendingOrders.get(summaryId);
  if (!order || order.paidAt) return false;
  order.paidAt = Date.now();
  return true;
}

/**
 * Billing identity and the receipt number are written once, before the first
 * payment link exists, and every later attempt on the order reuses them: a
 * decline is a second attempt against one receipt, not a second receipt.
 */
export function recordReceiptIdentity(summaryId: string, receiptNo: string, billing?: BillingDetails): void {
  const order = pendingOrders.get(summaryId);
  if (!order) return;
  if (billing) order.billing = billing;
  order.receiptNo ??= receiptNo;
}

export function recordPaymentAttempt(summaryId: string, attempt: PaymentAttempt): void {
  const order = pendingOrders.get(summaryId);
  if (!order) return;
  order.paymentAttempt = attempt;
  order.attemptCount += 1;
}

/**
 * Claiming is synchronous and must happen before the awaited Razorpay call:
 * two concurrent confirms would otherwise both pass the paymentAttempt check
 * and mint two payment links for one order.
 */
export function beginPaymentLinkCreation(summaryId: string): boolean {
  const order = pendingOrders.get(summaryId);
  if (!order || order.linkCreationInFlight) return false;
  order.linkCreationInFlight = true;
  return true;
}

export function endPaymentLinkCreation(summaryId: string): void {
  const order = pendingOrders.get(summaryId);
  if (order) order.linkCreationInFlight = false;
}
