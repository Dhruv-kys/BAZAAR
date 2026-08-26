import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSessionMessages } from "./session.js";

describe("session store bounds", () => {
  it("evicts the oldest session past the cap instead of growing forever", () => {
    const first = getSessionMessages("evict-first");
    first.push({ role: "user", content: "marker" });

    for (let i = 0; i < 520; i++) {
      getSessionMessages(`evict-fill-${i}`);
    }

    assert.equal(getSessionMessages("evict-first").length, 0);
  });
});
