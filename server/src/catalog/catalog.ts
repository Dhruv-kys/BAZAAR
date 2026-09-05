import { merchant } from "../merchant/profile.js";
import { isNearMatch } from "./fuzzy.js";

export interface Variant {
  id: string;
  label: string;
  priceInPaise: number;
  premium?: boolean;
  upsellReason?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  tags: string[];
  variants: Variant[];
}

export interface AddOn {
  id: string;
  name: string;
  priceInPaise: number;
  crossSellFor: string[];
  tags: string[];
}

const products = merchant.products as Product[];
const addOns = merchant.addOns as AddOn[];

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function haystackOf(product: Product): string {
  return `${product.name} ${product.category} ${product.tags.join(" ")}`.toLowerCase();
}

export function searchCatalog(query?: string, occasionTag?: string, category?: string): Product[] {
  const shortlist = products.filter((product) => {
    if (category && product.category !== category) return false;
    if (occasionTag && !product.tags.includes(occasionTag)) return false;
    return true;
  });
  if (!query) return shortlist;

  const queryWords = words(query);
  const exact = shortlist.filter((product) => {
    const haystack = haystackOf(product);
    return queryWords.every((word) => haystack.includes(word));
  });
  if (exact.length > 0) return exact;

  return shortlist.filter((product) => {
    const haystack = haystackOf(product);
    const tokens = words(haystack);
    return queryWords.every(
      (word) => haystack.includes(word) || tokens.some((token) => isNearMatch(word, token)),
    );
  });
}

export function getProductById(productId: string): Product | undefined {
  return products.find((product) => product.id === productId);
}

export function getVariant(productId: string, variantId: string): Variant | undefined {
  return getProductById(productId)?.variants.find((variant) => variant.id === variantId);
}

export function getAddOnById(addOnId: string): AddOn | undefined {
  return addOns.find((addOn) => addOn.id === addOnId);
}

export function addOnsForCategory(category: string): AddOn[] {
  return addOns.filter((addOn) => addOn.crossSellFor.includes(category));
}

export function catalogKeyterms(): string[] {
  const clean = (name: string) => name.replace(/[("]/g, " ").replace(/\)/g, " ").replace(/\s+/g, " ").trim();
  const terms = new Set<string>();
  for (const product of products) terms.add(clean(product.name));
  for (const addOn of addOns) terms.add(clean(addOn.name));
  return [...terms];
}
