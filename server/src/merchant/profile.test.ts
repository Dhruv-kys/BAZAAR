import assert from "node:assert/strict";
import { test } from "node:test";
import { merchant, profileIds } from "./profile.js";
import { GUARDRAILS } from "../guardrails/config.js";
import { searchCatalog } from "../catalog/catalog.js";

test("ships three profiles", () => {
  assert.deepEqual(profileIds.sort(), ["bakery", "clothing", "dealer"]);
});

test("the default profile is the bakery", () => {
  assert.equal(merchant.id, "bakery");
});

test("guardrails come from the active profile", () => {
  assert.equal(GUARDRAILS.maxOrderValuePaise, merchant.guardrails.maxOrderValuePaise);
  assert.equal(GUARDRAILS.maxDiscountPercent, merchant.guardrails.maxDiscountPercent);
});

test("reason codes are the system vocabulary, not merchant data", () => {
  assert.deepEqual([...GUARDRAILS.allowedDiscountReasonCodes], [
    "FIRST_ORDER",
    "BULK_ADDON",
    "SEASONAL_PROMO",
  ]);
});

test("the catalog served is the active profile's catalog", () => {
  const all = searchCatalog();
  assert.equal(all.length, merchant.products.length);
  assert.ok(all.every((product) => merchant.products.some((p) => p.id === product.id)));
});

test("every profile prices in paise and declares a cap above its priciest variant", async () => {
  for (const id of profileIds) {
    const profile = (await import(`./${id}.json`, { with: { type: "json" } })).default;
    const dearest = Math.max(
      ...profile.products.flatMap((p: { variants: { priceInPaise: number }[] }) =>
        p.variants.map((v) => v.priceInPaise),
      ),
    );
    assert.ok(
      Number.isInteger(dearest) && dearest > 0,
      `${id} has a non-integer or zero price`,
    );
    assert.ok(
      profile.guardrails.maxOrderValuePaise >= dearest,
      `${id} cannot sell its own dearest variant: cap ${profile.guardrails.maxOrderValuePaise} < ${dearest}`,
    );
  }
});

test("every premium variant states why it is worth the upgrade", async () => {
  for (const id of profileIds) {
    const profile = (await import(`./${id}.json`, { with: { type: "json" } })).default;
    for (const product of profile.products) {
      for (const variant of product.variants) {
        if (variant.premium) {
          assert.ok(
            typeof variant.upsellReason === "string" && variant.upsellReason.length > 20,
            `${id}/${variant.id} is premium with no upsell reason`,
          );
        }
      }
    }
  }
});

test("every add-on cross-sells to a category that exists in its profile", async () => {
  for (const id of profileIds) {
    const profile = (await import(`./${id}.json`, { with: { type: "json" } })).default;
    const categories = new Set(profile.products.map((p: { category: string }) => p.category));
    for (const addOn of profile.addOns) {
      for (const category of addOn.crossSellFor) {
        assert.ok(categories.has(category), `${id}/${addOn.id} cross-sells to unknown "${category}"`);
      }
    }
  }
});
