import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { httpStatusFor, REFUSAL_CODES, REFUSAL_CONTRACT } from "./refusals.js";

describe("the published error contract", () => {
  it("describes every code the server can refuse with", () => {
    for (const code of REFUSAL_CODES) {
      assert.ok(REFUSAL_CONTRACT[code], `${code} is published with no meaning`);
    }
  });

  it("describes nothing the server cannot refuse with", () => {
    for (const code of Object.keys(REFUSAL_CONTRACT)) {
      assert.ok(
        (REFUSAL_CODES as readonly string[]).includes(code),
        `${code} is documented but is not a refusal this server issues`,
      );
    }
  });

  it("gives every code a meaning worth reading", () => {
    for (const code of REFUSAL_CODES) {
      const { meaning } = REFUSAL_CONTRACT[code];
      assert.ok(meaning.length > 30, `${code} needs a fuller meaning than "${meaning}"`);
      assert.ok(meaning.trim().endsWith("."), `${code} meaning should be a sentence`);
    }
  });

  // The contract publishes httpStatusFor's answer rather than its own, so this
  // guards the wiring: a hand-written status could drift from what is served.
  it("cannot publish a status the server would not answer with", () => {
    for (const code of REFUSAL_CODES) {
      const status = httpStatusFor(code);
      assert.ok(status >= 400 && status < 600, `${code} resolves to ${status}`);
    }
  });

  it("marks a refusal retryable only when the same call could later succeed", () => {
    // A permanent wall must never invite a retry: the caller has to change
    // something, or nothing, but never simply try again.
    for (const code of ["MANDATE_ALREADY_CONSUMED", "MANDATE_EXPIRED", "PAYMENT_PROVIDER_LIMIT", "AGENT_UNAUTHENTICATED"] as const) {
      assert.equal(REFUSAL_CONTRACT[code].retryable, false, `${code} must not be advertised as retryable`);
    }
    for (const code of ["CEILING_EXCEEDED", "QUOTE_EXPIRED", "PRICE_CHANGED"] as const) {
      assert.equal(REFUSAL_CONTRACT[code].retryable, true, `${code} is recoverable by re-quoting`);
    }
  });
});
