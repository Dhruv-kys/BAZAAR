import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentActor, humanActor } from "./actor.js";
import { authorizeTotal, bindingBound, boundsFor } from "./policy.js";
import { isRefusal } from "./refusals.js";
import type { VerifiedMandate } from "./mandate.js";
import { GUARDRAILS } from "../guardrails/config.js";

function mandate(ceilingInPaise: number): VerifiedMandate {
  return {
    claims: {
      mandateId: "m1",
      principalId: "p1",
      agentId: "agent-alpha",
      ceilingInPaise,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  };
}

describe("guardrail intersection", () => {
  it("applies only the merchant cap to a human buyer", () => {
    const bounds = boundsFor(humanActor("s1"));
    assert.equal(bounds.length, 1);
    assert.equal(bounds[0].source, "merchant_order_cap");
  });

  it("lets the tighter mandate ceiling bind", () => {
    const bounds = boundsFor(agentActor("s1", "agent-alpha"), mandate(100000));
    assert.equal(bindingBound(bounds).source, "mandate");
    assert.equal(bindingBound(bounds).limitInPaise, 100000);
  });

  it("never lets a mandate raise the merchant cap", () => {
    const generous = GUARDRAILS.maxOrderValuePaise * 10;
    const bounds = boundsFor(agentActor("s1", "agent-alpha"), mandate(generous));
    const binding = bindingBound(bounds);
    assert.equal(binding.source, "merchant_order_cap");
    assert.equal(binding.limitInPaise, GUARDRAILS.maxOrderValuePaise);

    const result = authorizeTotal(generous - 1, agentActor("s1", "agent-alpha"), mandate(generous));
    assert.equal(isRefusal(result), true);
  });

  it("reports the binding constraint so an agent can self-correct", () => {
    const result = authorizeTotal(250000, agentActor("s1", "agent-alpha"), mandate(200000));
    assert.equal(isRefusal(result), true);
    if (!isRefusal(result)) return;
    assert.equal(result.code, "CEILING_EXCEEDED");
    assert.equal(result.binding?.source, "mandate");
    assert.equal(result.binding?.limitInPaise, 200000);
    assert.equal(result.binding?.requestedInPaise, 250000);
    assert.equal(result.binding?.shortfallInPaise, 50000);
  });

  it("allows a total on the ceiling exactly", () => {
    assert.equal(isRefusal(authorizeTotal(200000, agentActor("s1", "a"), mandate(200000))), false);
  });
});

describe("a budget the customer set", () => {
  it("joins the intersection and can bind", () => {
    const result = authorizeTotal(120000, humanActor("s1", 100000));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "CEILING_EXCEEDED");
    assert.equal(result.binding?.source, "customer_budget");
    assert.equal(result.binding?.limitInPaise, 100000);
  });

  it("allows a total that sits on the budget exactly", () => {
    assert.equal(authorizeTotal(100000, humanActor("s1", 100000)).ok, true);
  });

  it("never widens the merchant cap, however large it is set", () => {
    const overCap = GUARDRAILS.maxOrderValuePaise + 1;
    const result = authorizeTotal(overCap, humanActor("s1", overCap * 10));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.binding?.source, "merchant_order_cap");
  });

  it("is ignored when it is absent or nonsense", () => {
    assert.equal(boundsFor(humanActor("s1")).length, 1);
    assert.equal(boundsFor(humanActor("s1", 0)).length, 1);
    assert.equal(boundsFor(humanActor("s1", -500)).length, 1);
  });

  it("names the budget in the refusal so the shopper knows which wall they hit", () => {
    const result = authorizeTotal(120000, humanActor("s1", 100000));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /budget you set/i);
  });
});
