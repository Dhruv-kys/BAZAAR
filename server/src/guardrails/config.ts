export const GUARDRAILS = {
  maxDiscountPercent: 15,
  maxDiscountFlatPaise: 20000,
  maxOrderValuePaise: 500000,
  allowedDiscountReasonCodes: ["FIRST_ORDER", "BULK_ADDON", "SEASONAL_PROMO"] as const,
} as const;

export type DiscountReasonCode = (typeof GUARDRAILS.allowedDiscountReasonCodes)[number];
