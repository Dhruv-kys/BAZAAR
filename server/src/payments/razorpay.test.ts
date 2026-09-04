import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingOrder, getPendingOrder, recordPaymentAttempt } from "./pendingOrderStore.js";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { paymentReferenceId, summaryIdFromReference, verifyWebhookSignature } from "./razorpay.js";

function stagedOrder() {
  return createPendingOrder({
    sessionId: "s1",
    actor: "human" as const,
    items: [
      {
        productId: "p",
        productName: "Cake",
        variantId: "v",
        variantLabel: "1 kg",
        quantity: 1,
        priceInPaise: 99900,
      },
    ],
    addOns: [],
    subtotalInPaise: 99900,
    discountInPaise: 0,
    totalInPaise: 99900,
  });
}

describe("payment reference ids", () => {
  it("uses the bare summaryId for the first attempt", () => {
    const order = stagedOrder();
    assert.equal(paymentReferenceId(order), order.summaryId);
  });

  it("suffixes retries so Razorpay never sees a duplicate", () => {
    const order = stagedOrder();
    const seen = new Set<string>([paymentReferenceId(order)]);

    for (let attempt = 1; attempt <= 5; attempt++) {
      recordPaymentAttempt(order.summaryId, { paymentLinkId: `plink-${attempt}`, url: `https://x/${attempt}` });
      const ref = paymentReferenceId(getPendingOrder(order.summaryId)!);
      assert.ok(!seen.has(ref), `reference id ${ref} was reused on attempt ${attempt}`);
      seen.add(ref);
    }
  });

  it("round-trips back to the stable summaryId", () => {
    const order = stagedOrder();
    assert.equal(summaryIdFromReference(paymentReferenceId(order)), order.summaryId);

    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink", url: "https://x" });
    const retryRef = paymentReferenceId(getPendingOrder(order.summaryId)!);
    assert.equal(summaryIdFromReference(retryRef), order.summaryId);
  });

  it("leaves a plain uuid unchanged", () => {
    const id = "9c17acb9-67f5-45a8-a77e-7a6a0b84330d";
    assert.equal(summaryIdFromReference(id), id);
  });
});

describe("pending order payment attempts", () => {
  it("starts with no live payment link", () => {
    const order = stagedOrder();
    assert.equal(order.attemptCount, 0);
    assert.equal(order.paymentAttempt, undefined);
  });

  it("records the live link so confirm can be idempotent", () => {
    const order = stagedOrder();
    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink-1", url: "https://rzp.io/a" });

    const stored = getPendingOrder(order.summaryId)!;
    assert.equal(stored.paymentAttempt?.url, "https://rzp.io/a");
    assert.equal(stored.attemptCount, 1);
  });

  it("replaces the live link on retry and counts the attempt", () => {
    const order = stagedOrder();
    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink-1", url: "https://rzp.io/a" });
    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink-2", url: "https://rzp.io/b" });

    const stored = getPendingOrder(order.summaryId)!;
    assert.equal(stored.paymentAttempt?.url, "https://rzp.io/b");
    assert.equal(stored.attemptCount, 2);
  });

  it("ignores attempts for unknown orders", () => {
    recordPaymentAttempt("does-not-exist", { paymentLinkId: "x", url: "y" });
    assert.equal(getPendingOrder("does-not-exist"), undefined);
  });
});

describe("webhook signature verification", () => {
  const SECRET = "whsec_test_only";
  const BODY = JSON.stringify({ event: "payment_link.paid", payload: {} });

  function withSecret<T>(secret: string | undefined, run: () => T): T {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (secret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    try {
      return run();
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  }

  const signature = crypto.createHmac("sha256", SECRET).update(BODY).digest("hex");

  it("agrees with the Razorpay SDK on a genuine signature", () => {
    assert.equal(Razorpay.validateWebhookSignature(BODY, signature, SECRET), true);
    assert.equal(withSecret(SECRET, () => verifyWebhookSignature(BODY, signature)), true);
  });

  it("rejects a body altered after signing", () => {
    const tampered = BODY.replace("paid", "failed");
    assert.equal(withSecret(SECRET, () => verifyWebhookSignature(tampered, signature)), false);
  });

  it("rejects a signature made with a different secret", () => {
    const forged = crypto.createHmac("sha256", "not-the-secret").update(BODY).digest("hex");
    assert.equal(withSecret(SECRET, () => verifyWebhookSignature(BODY, forged)), false);
  });

  it("rejects a truncated or non-hex signature rather than matching a prefix", () => {
    for (const bogus of [signature.slice(0, 32), "", "zz", `${signature}00`]) {
      assert.equal(withSecret(SECRET, () => verifyWebhookSignature(BODY, bogus)), false, bogus);
    }
  });

  it("fails closed when no webhook secret is configured", () => {
    assert.throws(() => withSecret(undefined, () => verifyWebhookSignature(BODY, signature)));
  });
});
