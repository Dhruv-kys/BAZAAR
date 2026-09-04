import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handlePaymentFailure } from "./handlePaymentFailure.js";
import {
  createPendingOrder,
  getPendingOrder,
  markOrderPaid,
  recordPaymentAttempt,
  type NewPendingOrder,
} from "./pendingOrderStore.js";

// Every assertion here must be refused before createPaymentLink is reached:
// the Razorpay test account's payment-link quota is spent for good.
function stage(overrides: Partial<NewPendingOrder> = {}) {
  return createPendingOrder({
    sessionId: "s1",
    actor: "human" as const,
    items: [
      {
        productId: "choc-truffle-cake",
        productName: "Chocolate Truffle Cake",
        variantId: "choc-truffle-1kg",
        variantLabel: "1 kg",
        quantity: 1,
        priceInPaise: 99900,
      },
    ],
    addOns: [],
    subtotalInPaise: 99900,
    discountInPaise: 0,
    totalInPaise: 99900,
    ...overrides,
  });
}

async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("retry bounds", () => {
  it("refuses to mint another link once the order is paid", async () => {
    const order = stage();
    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink-1", url: "https://rzp.io/a" });
    assert.equal(markOrderPaid(order.summaryId), true);

    const message = await rejection(handlePaymentFailure(order.summaryId, "late failure signal"));
    assert.match(message, /already paid/);

    const stored = getPendingOrder(order.summaryId)!;
    assert.equal(stored.attemptCount, 1);
    assert.equal(stored.paymentAttempt?.paymentLinkId, "plink-1");
  });

  it("stops retrying once the attempt limit is reached", async () => {
    const order = stage();
    for (let attempt = 1; attempt <= 3; attempt++) {
      recordPaymentAttempt(order.summaryId, { paymentLinkId: `plink-${attempt}`, url: `https://x/${attempt}` });
    }

    const message = await rejection(handlePaymentFailure(order.summaryId, "declined again"));
    assert.match(message, /payment limit/);
    assert.equal(getPendingOrder(order.summaryId)!.attemptCount, 3);
  });

  it("still refuses an unknown order", async () => {
    assert.match(await rejection(handlePaymentFailure("nope", "whatever")), /Unknown order/);
  });
});
