import assert from "node:assert/strict";
import { test } from "node:test";
import { searchCatalog } from "./catalog.js";

test("multi-word queries match products whose words are separated", () => {
  const matches = searchCatalog("chocolate cake", "birthday");
  assert.ok(matches.some((product) => product.id === "choc-truffle-cake"));
});

test("every word must be present", () => {
  assert.equal(searchCatalog("chocolate mango").length, 0);
});

test("punctuation and extra spacing do not break matching", () => {
  const matches = searchCatalog("  chocolate,  cake ");
  assert.ok(matches.some((product) => product.id === "choc-truffle-cake"));
});

test("occasion tag still filters", () => {
  assert.equal(searchCatalog(undefined, "wedding").length, 0);
});
