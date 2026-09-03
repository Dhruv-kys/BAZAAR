import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuditEvent } from "./auditStore.js";
import { merchantMetrics, sessionImpact } from "./impact.js";

let nextId = 1;

function event(sessionId: string, type: string, payload: unknown, wasClamped = false): AuditEvent {
  return {
    id: nextId++,
    sessionId,
    timestamp: new Date().toISOString(),
    type,
    toolName: null,
    reasoning: null,
    payload,
    wasClamped,
    actor: "human",
    agentId: null,
    refusalCode: null,
  };
}

function order(overrides: Partial<{ addOns: unknown[]; price: number; discount: number; total: number }> = {}) {
  const price = overrides.price ?? 179900;
  const discount = overrides.discount ?? 0;
  const addOns = overrides.addOns ?? [];
  const addOnTotal = (addOns as { priceInPaise: number }[]).reduce((sum, a) => sum + a.priceInPaise, 0);
  const subtotal = price + addOnTotal;
  return {
    summaryId: "s1",
    items: [
      {
        productId: "choc-truffle-cake",
        productName: "Chocolate Truffle Cake",
        variantId: "choc-truffle-2kg",
        variantLabel: "2 kg (Premium)",
        quantity: 1,
        priceInPaise: price,
      },
    ],
    addOns,
    subtotalInPaise: subtotal,
    discountInPaise: discount,
    totalInPaise: overrides.total ?? subtotal - discount,
  };
}

const recommendation = {
  productId: "choc-truffle-cake",
  variant: { id: "choc-truffle-1kg", label: "1 kg", priceInPaise: 99900 },
};

test("attributes the upgrade above the first recommendation as upsell", () => {
  const impact = sessionImpact("a", [
    event("a", "recommendation", recommendation),
    event("a", "order_summary", order()),
  ]);
  assert.equal(impact?.baselineInPaise, 99900);
  assert.equal(impact?.upsellInPaise, 80000);
  assert.equal(impact?.upsellAccepted, true);
});

test("an offered upsell the customer declined contributes nothing", () => {
  const impact = sessionImpact("a", [
    event("a", "recommendation", recommendation),
    event("a", "upsell", recommendation),
    event("a", "order_summary", order({ price: 99900 })),
  ]);
  assert.equal(impact?.upsellInPaise, 0);
  assert.equal(impact?.upsellOffered, true);
  assert.equal(impact?.upsellAccepted, false);
});

test("counts add-ons actually in the final order, not merely suggested", () => {
  const impact = sessionImpact("a", [
    event("a", "recommendation", recommendation),
    event("a", "cross_sell", { addOn: { id: "candles-number", name: "Number Candles", priceInPaise: 9900 } }),
    event("a", "order_summary", order({ addOns: [{ addOnId: "topper", name: "Topper", priceInPaise: 14900 }] })),
  ]);
  assert.equal(impact?.crossSellInPaise, 14900);
  assert.equal(impact?.addOnCount, 1);
});

test("uses the last order summary when one session stages twice", () => {
  const impact = sessionImpact("a", [
    event("a", "recommendation", recommendation),
    event("a", "order_summary", order({ discount: 0, total: 179900 })),
    event("a", "discount_requested", { appliedPercent: 10 }, true),
    event("a", "order_summary", order({ discount: 17990, total: 161910 })),
  ]);
  assert.equal(impact?.discountInPaise, 17990);
  assert.equal(impact?.totalInPaise, 161910);
  assert.equal(impact?.discountWasClamped, true);
});

test("a session that never staged an order is not counted", () => {
  assert.equal(sessionImpact("a", [event("a", "recommendation", recommendation)]), undefined);
});

test("falls back to the ordered items when nothing was recommended first", () => {
  const impact = sessionImpact("a", [event("a", "order_summary", order({ price: 64900 }))]);
  assert.equal(impact?.baselineInPaise, 64900);
  assert.equal(impact?.upsellInPaise, 0);
});

test("aggregates across sessions and ignores sessions without orders", () => {
  const metrics = merchantMetrics([
    event("a", "recommendation", recommendation),
    event("a", "order_summary", order({ addOns: [{ addOnId: "t", name: "Topper", priceInPaise: 14900 }] })),
    event("b", "recommendation", recommendation),
    event("b", "order_summary", order({ price: 99900 })),
    event("c", "recommendation", recommendation),
  ]);

  assert.equal(metrics.sessionsWithOrder, 2);
  assert.equal(metrics.baselineTotalInPaise, 199800);
  assert.equal(metrics.finalTotalInPaise, 194800 + 99900);
  assert.equal(metrics.upsellInPaise, 80000);
  assert.equal(metrics.crossSellInPaise, 14900);
  assert.equal(metrics.attachRatePercent, 50);
});

test("upsell acceptance is measured against sessions where one was offered", () => {
  const metrics = merchantMetrics([
    event("a", "recommendation", recommendation),
    event("a", "upsell", recommendation),
    event("a", "order_summary", order()),
    event("b", "recommendation", recommendation),
    event("b", "upsell", recommendation),
    event("b", "order_summary", order({ price: 99900 })),
  ]);
  assert.equal(metrics.upsellOfferedCount, 2);
  assert.equal(metrics.upsellAcceptedCount, 1);
  assert.equal(metrics.upsellAcceptancePercent, 50);
});

test("empty history produces zeros, never NaN", () => {
  const metrics = merchantMetrics([]);
  assert.equal(metrics.sessionsWithOrder, 0);
  assert.equal(metrics.upliftPercent, 0);
  assert.equal(metrics.attachRatePercent, 0);
  assert.equal(metrics.averageOrderValueInPaise, 0);
});
