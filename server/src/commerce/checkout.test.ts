import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { getAuditEvents } from "../audit/auditStore.js";
import { GUARDRAILS } from "../guardrails/config.js";
import {
  beginPaymentLinkCreation,
  createPendingOrder,
  endPaymentLinkCreation,
  recordPaymentAttempt,
  type NewPendingOrder,
} from "../payments/pendingOrderStore.js";
import { getPendingOrder } from "../payments/pendingOrderStore.js";
import { stopWatching } from "../payments/paymentWatcher.js";
import { agentActor, humanActor } from "./actor.js";
import { confirmOrder } from "./checkout.js";
import { isRefusal } from "./refusals.js";

function stage(overrides: Partial<NewPendingOrder> = {}, now = Date.now()) {
  return createPendingOrder(
    {
      sessionId: "s1",
      actor: "human",
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
    },
    now,
  );
}

const billing = { name: "Ananya Rao", email: "ananya@example.com", contact: "+919876543210" };

async function codeOf(promise: ReturnType<typeof confirmOrder>): Promise<string | undefined> {
  const result = await promise;
  return isRefusal(result) ? result.code : undefined;
}

describe("confirm gating", () => {
  it("refuses an unknown quote", async () => {
    assert.equal(
      await codeOf(confirmOrder({ summaryId: "nope", actor: humanActor("s1") })),
      "QUOTE_NOT_FOUND",
    );
  });

  it("refuses an agent that presents no mandate", async () => {
    const order = stage({ actor: "agent", agentId: "agent-alpha" });
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: agentActor("s1", "agent-alpha") })),
      "MANDATE_REQUIRED",
    );
  });

  it("refuses an expired quote", async () => {
    const order = stage({}, Date.now() - GUARDRAILS.quoteTtlMs - 1000);
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1") })),
      "QUOTE_EXPIRED",
    );
  });

  it("refuses a quote whose stored total no longer matches the catalog", async () => {
    const order = stage({ totalInPaise: 12345, subtotalInPaise: 12345 });
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1"), billing })),
      "PRICE_CHANGED",
    );
  });

  it("refuses to confirm an agent's quote through the human door", async () => {
    const order = stage({ actor: "agent", agentId: "agent-alpha", sessionId: "agent:agent-alpha" });
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("agent:agent-alpha") })),
      "ORDER_ACTOR_MISMATCH",
    );
  });

  it("refuses to confirm a human's quote as an agent", async () => {
    const order = stage();
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: agentActor("s1", "agent-alpha") })),
      "ORDER_ACTOR_MISMATCH",
    );
  });

  it("refuses to confirm another agent's quote", async () => {
    const order = stage({ actor: "agent", agentId: "agent-alpha" });
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: agentActor("s1", "agent-beta") })),
      "ORDER_ACTOR_MISMATCH",
    );
  });

  it("refuses the mismatched actor even once a payment link exists", async () => {
    const order = stage({ actor: "agent", agentId: "agent-alpha" });
    recordPaymentAttempt(order.summaryId, { paymentLinkId: "plink-1", url: "https://rzp.io/a" });
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1") })),
      "ORDER_ACTOR_MISMATCH",
    );
  });

  it("refuses a second confirm while a payment link is already being created", async () => {
    const order = stage();
    assert.equal(beginPaymentLinkCreation(order.summaryId), true);
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1"), billing })),
      "PAYMENT_IN_PROGRESS",
    );
    endPaymentLinkCreation(order.summaryId);
  });
});

describe("the billing gate", () => {
  it("refuses a human confirm that names no payer", async () => {
    const order = stage();
    assert.equal(
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1") })),
      "BILLING_DETAILS_REQUIRED",
    );
  });

  it("refuses billing details that are present but not valid", async () => {
    for (const invalid of [
      { ...billing, email: "not-an-email" },
      { ...billing, contact: "12345" },
      { ...billing, name: "A" },
    ]) {
      const order = stage();
      assert.equal(
        await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1"), billing: invalid })),
        "BILLING_DETAILS_INVALID",
      );
    }
  });

  // I8: an agent's counterparty text must never reach the merchant's record.
  // The agent door identifies the payer by the mandate's principal, so billing
  // sent by an agent is not a shortcut past the mandate gate.
  it("does not let an agent substitute billing details for a mandate", async () => {
    const order = stage({ actor: "agent", agentId: "agent-alpha" });
    assert.equal(
      await codeOf(
        confirmOrder({ summaryId: order.summaryId, actor: agentActor("s1", "agent-alpha"), billing }),
      ),
      "MANDATE_REQUIRED",
    );
  });
});

describe("a confirmed order's record", () => {
  async function confirmWithStubbedProvider(sessionId: string) {
    const order = stage({ sessionId });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ id: "plink_stub", short_url: "https://rzp.io/i/stub" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "secret";

    try {
      const result = await confirmOrder({ summaryId: order.summaryId, actor: humanActor(sessionId), billing });
      assert.ok(result.ok);
      return { order: getPendingOrder(order.summaryId)!, result };
    } finally {
      globalThis.fetch = realFetch;
      stopWatching(order.summaryId);
    }
  }

  it("issues a receipt number and bills it to the payer who confirmed", async () => {
    const { order, result } = await confirmWithStubbedProvider("s-receipt");
    assert.match(result.receiptNo, /^[A-Z]{1,3}-\d{8}-\d{4}$/);
    assert.equal(order.receiptNo, result.receiptNo);
    assert.equal(order.billing?.name, billing.name);
    assert.equal(order.billing?.contact, "+919876543210");
  });

  it("records the payer in the audit trail without republishing their contact details", async () => {
    // The audit store is a real SQLite file that outlives a test run, so this
    // session has to be one no earlier run can have written to.
    const sessionId = `s-audit-${crypto.randomUUID()}`;
    const { result } = await confirmWithStubbedProvider(sessionId);
    const created = getAuditEvents(sessionId).find((event) => event.type === "payment_link_created");
    assert.ok(created);

    const payload = created.payload as { receiptNo: string; billedTo: { name: string; email: string; contact: string } };
    assert.equal(payload.receiptNo, result.receiptNo);
    assert.equal(payload.billedTo.name, billing.name);
    assert.ok(!payload.billedTo.email.includes("ananya@"));
    assert.ok(!payload.billedTo.contact.includes("543"));
    assert.ok(!JSON.stringify(created).includes(billing.email));
  });

  // A decline is a second attempt against one receipt, never a second receipt.
  it("keeps one receipt number across a re-confirm", async () => {
    const { order, result } = await confirmWithStubbedProvider("s-again");
    const again = await confirmOrder({ summaryId: order.summaryId, actor: humanActor("s-again"), billing });
    assert.ok(again.ok);
    assert.equal(again.receiptNo, result.receiptNo);
    stopWatching(order.summaryId);
  });
});

describe("payment link claim", () => {
  it("is held by exactly one caller at a time", () => {
    const order = stage();
    assert.equal(beginPaymentLinkCreation(order.summaryId), true);
    assert.equal(beginPaymentLinkCreation(order.summaryId), false);
    endPaymentLinkCreation(order.summaryId);
    assert.equal(beginPaymentLinkCreation(order.summaryId), true);
  });

  it("ignores unknown orders", () => {
    assert.equal(beginPaymentLinkCreation("nope"), false);
  });
});
