import { merchant } from "../merchant/profile.js";

const ALLOWED_DISCOUNT_REASON_CODES = ["FIRST_ORDER", "BULK_ADDON", "SEASONAL_PROMO"] as const;

export const GUARDRAILS = {
  ...merchant.guardrails,
  allowedDiscountReasonCodes: ALLOWED_DISCOUNT_REASON_CODES,
} as const;

export type DiscountReasonCode = (typeof ALLOWED_DISCOUNT_REASON_CODES)[number];
