import type { DiscountReasonCode } from "../guardrails/config.js";

export interface DiscountRequest {
  discountRequestId: string;
  requestedPercent?: number;
  requestedAmountInPaise?: number;
  appliedPercent?: number;
  appliedAmountInPaise?: number;
  reasonCode: DiscountReasonCode;
  wasClamped: boolean;
}

const MAX_DISCOUNT_REQUESTS = 2000;

const discountRequests = new Map<string, DiscountRequest>();

export function createDiscountRequest(request: Omit<DiscountRequest, "discountRequestId">): DiscountRequest {
  if (discountRequests.size >= MAX_DISCOUNT_REQUESTS) {
    const oldest = discountRequests.keys().next().value;
    if (oldest !== undefined) discountRequests.delete(oldest);
  }
  const discountRequestId = crypto.randomUUID();
  const record: DiscountRequest = { discountRequestId, ...request };
  discountRequests.set(discountRequestId, record);
  return record;
}

export function getDiscountRequest(discountRequestId: string): DiscountRequest | undefined {
  return discountRequests.get(discountRequestId);
}
