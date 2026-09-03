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

export function rupees(paise: number): string {
  const sign = paise < 0 ? "−" : "";
  return `${sign}₹${(Math.abs(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function rupeesShort(paise: number): string {
  return `₹${Math.round(Math.abs(paise) / 100).toLocaleString("en-IN")}`;
}
