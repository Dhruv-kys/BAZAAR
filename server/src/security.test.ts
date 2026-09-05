import assert from "node:assert/strict";
import type { Request } from "express";
import { describe, it } from "node:test";
import { createSlidingWindow, rateLimitBy } from "./security.js";

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

describe("rateLimitBy", () => {
  function run(limiter: ReturnType<typeof rateLimitBy>, req: Partial<Request>): number {
    let status = 200;
    let passed = false;
    limiter(req as Request, { status: (code: number) => { status = code; return { json: () => {} }; } } as never, () => {
      passed = true;
    });
    return passed ? 200 : status;
  }

  const byAgent = (max: number) =>
    rateLimitBy((req) => {
      const header = (req.headers?.authorization as string) ?? "";
      return header ? `agent:${header}` : null;
    }, max, 60_000);

  it("gives each credential its own budget", () => {
    const limiter = byAgent(2);
    assert.equal(run(limiter, { headers: { authorization: "alpha" } }), 200);
    assert.equal(run(limiter, { headers: { authorization: "alpha" } }), 200);
    // alpha is spent, but beta has not touched its own.
    assert.equal(run(limiter, { headers: { authorization: "alpha" } }), 429);
    assert.equal(run(limiter, { headers: { authorization: "beta" } }), 200);
  });

  it("falls back to the address when nobody is identified", () => {
    const limiter = byAgent(1);
    assert.equal(run(limiter, { headers: {}, ip: "1.2.3.4" }), 200);
    assert.equal(run(limiter, { headers: {}, ip: "1.2.3.4" }), 429);
    assert.equal(run(limiter, { headers: {}, ip: "5.6.7.8" }), 200);
  });

  it("does not let an unidentified caller spend an agent's budget", () => {
    const limiter = byAgent(1);
    assert.equal(run(limiter, { headers: {}, ip: "1.2.3.4" }), 200);
    assert.equal(run(limiter, { headers: { authorization: "alpha" } }), 200);
  });
});
