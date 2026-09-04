import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueReceiptNumber } from "./receipts.js";

describe("receipt numbering", () => {
  it("never hands the same number to two orders", () => {
    const issued = new Set(Array.from({ length: 200 }, () => issueReceiptNumber()));
    assert.equal(issued.size, 200);
  });

  it("reads as a merchant record: series, date, sequence", () => {
    assert.match(issueReceiptNumber(new Date(2026, 8, 5)), /^[A-Z]{1,3}-20260905-\d{4}$/);
  });

  it("counts each day separately", () => {
    const first = issueReceiptNumber(new Date(2031, 0, 2));
    const second = issueReceiptNumber(new Date(2031, 0, 2));
    assert.equal(Number(second.split("-")[2]) - Number(first.split("-")[2]), 1);
  });
});
