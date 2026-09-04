import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { agentToolInputs } from "./server.js";

const REQUIRED = new Set(["productId", "items", "quoteId", "mandate"]);

describe("agent tool schemas", () => {
  it("accepts an explicit null for every non-required field", () => {
    for (const [tool, shape] of Object.entries(agentToolInputs)) {
      for (const [field, schema] of Object.entries(shape as Record<string, z.ZodType>)) {
        if (REQUIRED.has(field)) continue;
        assert.equal(
          schema.safeParse(null).success,
          true,
          `${tool}.${field} rejects the explicit null a tool-calling model sends`,
        );
        assert.equal(schema.safeParse(undefined).success, true, `${tool}.${field} rejects omission`);
      }
    }
  });

  it("still rejects a null on the fields that carry the money", () => {
    assert.equal(agentToolInputs.request_quote.items.safeParse(null).success, false);
    assert.equal(agentToolInputs.confirm_order.quoteId.safeParse(null).success, false);
    assert.equal(agentToolInputs.confirm_order.mandate.safeParse(null).success, false);
  });

  it("prices a quote whose optional fields arrived as null", () => {
    const parsed = z.object(agentToolInputs.request_quote).safeParse({
      items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-1kg", quantity: 1 }],
      addOnIds: null,
      acceptOffer: null,
    });
    assert.equal(parsed.success, true);
  });
});
