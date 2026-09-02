import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUARDRAILS } from "../guardrails/config.js";
import { getPendingOrder, type PendingOrder } from "../payments/pendingOrderStore.js";
import { toolHandlers } from "./toolHandlers.js";

import { humanActor } from "../commerce/actor.js";

const ctx = { actor: humanActor("test-session") };

function call(tool: keyof typeof toolHandlers | string, args: unknown) {
  return toolHandlers[tool](args, ctx);
}

function expectOk<T = unknown>(result: ReturnType<typeof call>): T {
  assert.equal(result.ok, true, `expected ok, got: ${JSON.stringify(result)}`);
  return (result as { ok: true; result: T }).result;
}

function expectErr(result: ReturnType<typeof call>): string {
  assert.equal(result.ok, false, `expected error, got: ${JSON.stringify(result)}`);
  return (result as { ok: false; error: string }).error;
}

describe("apply_discount clamping", () => {
  it("clamps a percent above the cap and flags it", () => {
    const out = expectOk<{ requestedPercent: number; appliedPercent: number; wasClamped: boolean }>(
      call("apply_discount", { percent: 90, reasonCode: "FIRST_ORDER" }),
    );
    assert.equal(out.requestedPercent, 90);
    assert.equal(out.appliedPercent, GUARDRAILS.maxDiscountPercent);
    assert.equal(out.wasClamped, true);
  });

  it("leaves a percent under the cap untouched", () => {
    const out = expectOk<{ appliedPercent: number; wasClamped: boolean }>(
      call("apply_discount", { percent: 5, reasonCode: "FIRST_ORDER" }),
    );
    assert.equal(out.appliedPercent, 5);
    assert.equal(out.wasClamped, false);
  });

  it("clamps a flat amount above the cap", () => {
    const out = expectOk<{ appliedAmountInPaise: number; wasClamped: boolean }>(
      call("apply_discount", { amountInPaise: 999999, reasonCode: "BULK_ADDON" }),
    );
    assert.equal(out.appliedAmountInPaise, GUARDRAILS.maxDiscountFlatPaise);
    assert.equal(out.wasClamped, true);
  });

  it("rejects a reason code outside the allowed list", () => {
    expectErr(call("apply_discount", { percent: 10, reasonCode: "BECAUSE_I_SAID_SO" }));
  });

  it("rejects a request with neither percent nor amount", () => {
    expectErr(call("apply_discount", { reasonCode: "FIRST_ORDER" }));
  });

  it("accepts explicit nulls for the unused discount field", () => {
    expectOk(call("apply_discount", { percent: 10, amountInPaise: null, reasonCode: "FIRST_ORDER" }));
  });
});

describe("present_order_summary totals", () => {
  const items = [{ productId: "choc-truffle-cake", variantId: "choc-truffle-1kg", quantity: 2 }];

  it("computes totals from the catalog, not from model input", () => {
    const order = expectOk<PendingOrder>(call("present_order_summary", { items }));
    assert.equal(order.subtotalInPaise, 99900 * 2);
    assert.equal(order.discountInPaise, 0);
    assert.equal(order.totalInPaise, 99900 * 2);
  });

  it("includes add-ons in the subtotal", () => {
    const order = expectOk<PendingOrder>(
      call("present_order_summary", { items, addOnIds: ["topper-happy-birthday"] }),
    );
    assert.equal(order.subtotalInPaise, 99900 * 2 + 14900);
  });

  it("applies the clamped discount, never the requested one", () => {
    const discount = expectOk<{ discountRequestId: string }>(
      call("apply_discount", { percent: 90, reasonCode: "FIRST_ORDER" }),
    );
    const order = expectOk<PendingOrder>(
      call("present_order_summary", { items, discountRequestId: discount.discountRequestId }),
    );
    const expected = Math.round((99900 * 2 * GUARDRAILS.maxDiscountPercent) / 100);
    assert.equal(order.discountInPaise, expected);
    assert.equal(order.totalInPaise, 99900 * 2 - expected);
  });

  it("blocks an order above the spend cap", () => {
    const error = expectErr(
      call("present_order_summary", {
        items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-2kg", quantity: 4 }],
      }),
    );
    assert.match(error, /exceeds/i);
  });

  it("stages the order so it can be confirmed later", () => {
    const order = expectOk<PendingOrder>(call("present_order_summary", { items }));
    const stored = getPendingOrder(order.summaryId);
    assert.ok(stored, "order should be retrievable by summaryId");
    assert.equal(stored.totalInPaise, order.totalInPaise);
    assert.equal(stored.attemptCount, 0);
  });

  it("rejects a product/variant mismatch", () => {
    expectErr(
      call("present_order_summary", {
        items: [{ productId: "choc-truffle-cake", variantId: "red-velvet-1kg", quantity: 1 }],
      }),
    );
  });

  it("rejects an unknown discountRequestId", () => {
    expectErr(call("present_order_summary", { items, discountRequestId: "not-a-real-id" }));
  });
});

describe("catalog-grounded tools", () => {
  it("rejects a recommendation for a variant that does not exist", () => {
    expectErr(call("recommend_product", { productId: "choc-truffle-cake", variantId: "nope", reason: "x" }));
  });

  it("rejects an upsell to a non-premium variant", () => {
    const error = expectErr(
      call("suggest_upsell", { productId: "choc-truffle-cake", variantId: "choc-truffle-1kg", reason: "x" }),
    );
    assert.match(error, /premium/i);
  });

  it("accepts an upsell to a genuine premium variant", () => {
    expectOk(call("suggest_upsell", { productId: "choc-truffle-cake", variantId: "choc-truffle-2kg", reason: "x" }));
  });

  it("rejects an unknown add-on", () => {
    expectErr(call("suggest_addon", { addOnId: "not-real", reason: "x" }));
  });

  it("returns compact search results without full variant payloads", () => {
    const results = expectOk<Array<Record<string, unknown>>>(call("search_catalog", { occasionTag: "birthday" }));
    assert.ok(results.length > 0);
    assert.ok(!("variants" in results[0]), "search results must stay compact");
    assert.ok("fromPaise" in results[0]);
  });
});
