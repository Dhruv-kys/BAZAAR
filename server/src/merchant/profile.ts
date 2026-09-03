import bakery from "./bakery.json" with { type: "json" };
import clothing from "./clothing.json" with { type: "json" };
import dealer from "./dealer.json" with { type: "json" };

export interface ProfileVariant {
  id: string;
  label: string;
  priceInPaise: number;
  premium?: boolean;
  upsellReason?: string;
}

export interface ProfileProduct {
  id: string;
  name: string;
  category: string;
  tags: string[];
  variants: ProfileVariant[];
}

export interface ProfileAddOn {
  id: string;
  name: string;
  priceInPaise: number;
  crossSellFor: string[];
  tags: string[];
}

export interface MerchantProfile {
  id: string;
  name: string;
  currency: string;
  trade: string;
  qualifiers: string;
  guardrails: {
    maxDiscountPercent: number;
    maxDiscountFlatPaise: number;
    maxOrderValuePaise: number;
    quoteTtlMs: number;
  };
  products: ProfileProduct[];
  addOns: ProfileAddOn[];
}

const PROFILES: Record<string, MerchantProfile> = {
  bakery: bakery as MerchantProfile,
  clothing: clothing as MerchantProfile,
  dealer: dealer as MerchantProfile,
};

export const profileIds = Object.keys(PROFILES);

function resolve(): MerchantProfile {
  const requested = process.env.MERCHANT_PROFILE ?? "bakery";
  const profile = PROFILES[requested];
  if (!profile) {
    throw new Error(
      `MERCHANT_PROFILE "${requested}" is not a profile. Known profiles: ${profileIds.join(", ")}`,
    );
  }
  return profile;
}

export const merchant = resolve();
