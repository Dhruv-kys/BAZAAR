import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskedBilling, parseBillingDetails } from "./billing.js";
import { isRefusal } from "./refusals.js";

function parsed(input: unknown) {
  const result = parseBillingDetails(input);
  assert.ok(!isRefusal(result), `expected billing details, got ${JSON.stringify(result)}`);
  return result;
}

function code(input: unknown) {
  const result = parseBillingDetails(input);
  return isRefusal(result) ? result.code : undefined;
}

const valid = { name: "Ananya Rao", email: "Ananya@Example.com", contact: "9876543210" };

describe("billing details", () => {
  it("requires them at all", () => {
    assert.equal(code(null), "BILLING_DETAILS_REQUIRED");
    assert.equal(code(undefined), "BILLING_DETAILS_REQUIRED");
  });

  it("normalises the payer's mobile number to the form Razorpay accepts", () => {
    // customer.contact must be 8-14 characters including the country code.
    for (const written of ["9876543210", "+919876543210", "919876543210", "09876543210", "98765 43210", "98765-43210"]) {
      const details = parsed({ ...valid, contact: written });
      assert.equal(details.contact, "+919876543210");
      assert.ok(details.contact.length >= 8 && details.contact.length <= 14);
    }
  });

  it("lowercases the email so one payer is one payer", () => {
    assert.equal(parsed(valid).email, "ananya@example.com");
  });

  it("keeps names with the punctuation real names have", () => {
    for (const name of ["Ananya Rao", "D'Souza", "Jean-Luc Menon", "R. Krishnan"]) {
      assert.equal(parsed({ ...valid, name }).name, name);
    }
  });

  it("refuses details that would not reach a real payer", () => {
    assert.equal(code({ ...valid, email: "ananya@" }), "BILLING_DETAILS_INVALID");
    assert.equal(code({ ...valid, contact: "1234567890" }), "BILLING_DETAILS_INVALID");
    assert.equal(code({ ...valid, contact: "98765" }), "BILLING_DETAILS_INVALID");
    assert.equal(code({ ...valid, name: "A" }), "BILLING_DETAILS_INVALID");
    assert.equal(code({ ...valid, name: "<script>alert(1)</script>" }), "BILLING_DETAILS_INVALID");
    assert.equal(code({ name: "Ananya Rao" }), "BILLING_DETAILS_INVALID");
  });

  it("names the field that has to change", () => {
    const result = parseBillingDetails({ ...valid, contact: "12345" });
    assert.ok(isRefusal(result) && /mobile number/i.test(result.message));
  });

  it("masks the payer in anything written to the audit record", () => {
    const masked = maskedBilling(parsed(valid));
    assert.equal(masked.name, "Ananya Rao");
    assert.ok(!masked.email.includes("ananya@"));
    assert.ok(masked.email.endsWith("@example.com"));
    assert.ok(!masked.contact.includes("6543"));
    assert.ok(masked.contact.endsWith("3210"));
  });
});
