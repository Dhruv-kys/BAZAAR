import { addOnsForCategory, getProductById, getVariant } from "../catalog/catalog.js";
import { GUARDRAILS } from "../guardrails/config.js";
import type { PricedOrder } from "./pricing.js";

const BULK_DISCOUNT_THRESHOLD_PAISE = 150000;
const BULK_DISCOUNT_PERCENT = 10;

export type OfferKind = "ADDON_BUNDLE" | "VARIANT_UPGRADE" | "BULK_DISCOUNT";

export interface Offer {
  code: string;
  kind: OfferKind;
  description: string;
  rationale: string;
  deltaInPaise: number;
  newSubtotalInPaise: number;
  savesInPaise?: number;
  qualified: boolean;
  shortfallInPaise?: number;
}

export function bulkDiscountPercent(): number {
  return Math.min(BULK_DISCOUNT_PERCENT, GUARDRAILS.maxDiscountPercent);
}

function bulkDiscountFor(subtotalInPaise: number): number {
  return Math.floor((subtotalInPaise * bulkDiscountPercent()) / 100);
}

export function offersFor(priced: PricedOrder): Offer[] {
  const offers: Offer[] = [];
  const presentAddOns = new Set(priced.addOns.map((addOn) => addOn.addOnId));

  for (const item of priced.items) {
    const product = getProductById(item.productId);
    if (!product) continue;

    for (const addOn of addOnsForCategory(product.category)) {
      if (presentAddOns.has(addOn.id)) continue;
      offers.push({
        code: `ADDON:${addOn.id}`,
        kind: "ADDON_BUNDLE",
        description: `Add ${addOn.name}`,
        rationale: `Pairs with ${product.name}; tagged ${addOn.tags.join(", ")}`,
        deltaInPaise: addOn.priceInPaise,
        newSubtotalInPaise: priced.subtotalInPaise + addOn.priceInPaise,
        qualified: true,
      });
      presentAddOns.add(addOn.id);
    }

    const current = getVariant(item.productId, item.variantId);
    if (!current || current.premium) continue;

    const premium = product.variants.find((variant) => variant.premium);
    if (!premium) continue;

    const delta = (premium.priceInPaise - current.priceInPaise) * item.quantity;
    offers.push({
      code: `UPGRADE:${product.id}:${premium.id}`,
      kind: "VARIANT_UPGRADE",
      description: `Upgrade ${product.name} from ${current.label} to ${premium.label}`,
      rationale: premium.upsellReason ?? `${premium.label} is the premium option`,
      deltaInPaise: delta,
      newSubtotalInPaise: priced.subtotalInPaise + delta,
      qualified: true,
    });
  }

  const qualified = priced.subtotalInPaise >= BULK_DISCOUNT_THRESHOLD_PAISE;
  offers.push({
    code: "BULK_DISCOUNT",
    kind: "BULK_DISCOUNT",
    description: `${bulkDiscountPercent()}% off orders over ₹${BULK_DISCOUNT_THRESHOLD_PAISE / 100}`,
    rationale: `Merchant bulk-order offer, capped by the merchant's ${GUARDRAILS.maxDiscountPercent}% maximum discount`,
    deltaInPaise: 0,
    newSubtotalInPaise: priced.subtotalInPaise,
    savesInPaise: qualified ? bulkDiscountFor(priced.subtotalInPaise) : undefined,
    qualified,
    shortfallInPaise: qualified ? undefined : BULK_DISCOUNT_THRESHOLD_PAISE - priced.subtotalInPaise,
  });

  return offers;
}

export interface OfferApplication {
  addAddOnId?: string;
  upgrade?: { productId: string; toVariantId: string };
  bulkDiscount?: boolean;
}

export function parseOffer(code: string): OfferApplication | null {
  if (code === "BULK_DISCOUNT") return { bulkDiscount: true };

  const [kind, ...rest] = code.split(":");
  if (kind === "ADDON" && rest.length === 1) return { addAddOnId: rest[0] };
  if (kind === "UPGRADE" && rest.length === 2) {
    return { upgrade: { productId: rest[0], toVariantId: rest[1] } };
  }
  return null;
}

export function bulkDiscountQualifies(subtotalInPaise: number): boolean {
  return subtotalInPaise >= BULK_DISCOUNT_THRESHOLD_PAISE;
}

export const BULK_DISCOUNT_OFFER_PERCENT = BULK_DISCOUNT_PERCENT;
