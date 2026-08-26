import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLinkOutcome } from "./paymentWatcher.js";

describe("resolveLinkOutcome", () => {
  it("maps paid to paid", () => {
    assert.equal(resolveLinkOutcome("paid"), "paid");
  });

  it("maps expired to retry", () => {
    assert.equal(resolveLinkOutcome("expired"), "retry");
  });

  it("maps cancelled to stop", () => {
    assert.equal(resolveLinkOutcome("cancelled"), "stop");
  });

  it("keeps watching on created and unknown statuses", () => {
    assert.equal(resolveLinkOutcome("created"), "keep_watching");
    assert.equal(resolveLinkOutcome("partially_paid"), "keep_watching");
    assert.equal(resolveLinkOutcome("something_new"), "keep_watching");
  });
});
