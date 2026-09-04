import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPendingOrder, getPendingOrder, recordPaymentAttempt } from "./pendingOrderStore.js";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import {
  createPaymentLink,
  paymentReferenceId,
  summaryIdFromReference,
  verifyWebhookSignature,
  PaymentProviderError,
} from "./razorpay.js";
import { recordReceiptIdentity } from "./pendingOrderStore.js";

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

describe("the payment link request", () => {
  async function capturedBody(): Promise<Record<string, any>> {
    const order = stagedOrder();
    recordReceiptIdentity(
      order.summaryId,
      "BAK-20260905-0007",
      { name: "Ananya Rao", email: "ananya@example.com", contact: "+919876543210" },
    );

    const realFetch = globalThis.fetch;
    let sent: Record<string, any> = {};
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ id: "plink_1", short_url: "https://rzp.io/i/x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "secret";
    try {
      await createPaymentLink(getPendingOrder(order.summaryId)!);
    } finally {
      globalThis.fetch = realFetch;
    }
    return sent;
  }

  it("bills a named payer, in the contact format Razorpay accepts", async () => {
    const body = await capturedBody();
    assert.deepEqual(body.customer, {
      name: "Ananya Rao",
      email: "ananya@example.com",
      contact: "+919876543210",
    });
    // customer.contact must be 8-14 characters including the country code.
    assert.ok(body.customer.contact.length >= 8 && body.customer.contact.length <= 14);
  });

  /*
   * The payer's address is typed into a demo, so Razorpay must not mail or text
   * it on the merchant's behalf. The link is handed back over the API instead.
   */
  it("never asks Razorpay to notify or remind the payer", async () => {
    const body = await capturedBody();
    assert.deepEqual(body.notify, { sms: false, email: false });
    assert.equal(body.reminder_enable, false);
  });

  it("carries the receipt number into the merchant's own notes", async () => {
    const body = await capturedBody();
    assert.equal(body.notes.receiptNo, "BAK-20260905-0007");
    assert.equal(body.notes.billingName, "Ananya Rao");
    assert.ok(body.notes.summaryId);
    // Razorpay caps notes at 15 pairs and 255 characters per value.
    assert.ok(Object.keys(body.notes).length <= 15);
    for (const value of Object.values(body.notes)) assert.ok(String(value).length <= 255);
  });

  it("keeps reference_id inside Razorpay's 40-character limit", async () => {
    const body = await capturedBody();
    assert.ok(body.reference_id.length <= 40);
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

describe("payment provider errors", () => {
  const capBody = JSON.stringify({
    error: { code: "RATE_LIMIT_EXCEEDED", description: "test mode limit of 30 reached for payment_link" },
  });

  it("reads the code and description out of Razorpay's envelope", () => {
    const failure = new PaymentProviderError(400, capBody);
    assert.equal(failure.code, "RATE_LIMIT_EXCEEDED");
    assert.match(failure.description, /test mode limit of 30/);
  });

  it("recognises the lifetime test-mode link cap", () => {
    assert.equal(new PaymentProviderError(400, capBody).isTestModeLinkLimit, true);
  });

  it("does not mistake other refusals for the cap", () => {
    const duplicate = JSON.stringify({
      error: { code: "BAD_REQUEST_ERROR", description: "payment link with given reference_id already exists" },
    });
    assert.equal(new PaymentProviderError(400, duplicate).isTestModeLinkLimit, false);

    const throttled = JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED", description: "too many requests" } });
    assert.equal(new PaymentProviderError(429, throttled).isTestModeLinkLimit, false);
  });

  it("survives a body that is not JSON", () => {
    const html = new PaymentProviderError(502, "<html>bad gateway</html>");
    assert.equal(html.code, "HTTP_502");
    assert.equal(html.isTestModeLinkLimit, false);
  });
});
