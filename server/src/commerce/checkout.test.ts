import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GUARDRAILS } from "../guardrails/config.js";
import {
  beginPaymentLinkCreation,
  createPendingOrder,
  endPaymentLinkCreation,
  recordPaymentAttempt,
  type NewPendingOrder,
} from "../payments/pendingOrderStore.js";
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
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1") })),
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
      await codeOf(confirmOrder({ summaryId: order.summaryId, actor: humanActor("s1") })),
      "PAYMENT_IN_PROGRESS",
    );
    endPaymentLinkCreation(order.summaryId);
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
