import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSlidingWindow } from "./security.js";

describe("createSlidingWindow", () => {
  it("allows up to the limit inside one window", () => {
    const window = createSlidingWindow(3, 1000);
    assert.equal(window.hit("a", 0), true);
    assert.equal(window.hit("a", 10), true);
    assert.equal(window.hit("a", 20), true);
    assert.equal(window.hit("a", 30), false);
  });

  it("frees capacity once old hits fall out of the window", () => {
    const window = createSlidingWindow(2, 1000);
    assert.equal(window.hit("a", 0), true);
    assert.equal(window.hit("a", 500), true);
    assert.equal(window.hit("a", 900), false);
    assert.equal(window.hit("a", 1001), true);
  });

  it("tracks keys independently", () => {
    const window = createSlidingWindow(1, 1000);
    assert.equal(window.hit("a", 0), true);
    assert.equal(window.hit("b", 0), true);
    assert.equal(window.hit("a", 1), false);
  });

  it("blocked hits do not consume capacity", () => {
    const window = createSlidingWindow(1, 1000);
    assert.equal(window.hit("a", 0), true);
    assert.equal(window.hit("a", 500), false);
    assert.equal(window.hit("a", 1001), true);
  });
});
