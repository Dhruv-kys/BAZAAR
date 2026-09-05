import assert from "node:assert/strict";
import { test } from "node:test";
import { damerauLevenshtein, isNearMatch } from "./fuzzy.js";

test("damerauLevenshtein counts a transposition as one edit", () => {
  assert.equal(damerauLevenshtein("cake", "caek"), 1);
});

test("damerauLevenshtein counts substitutions and insertions normally", () => {
  assert.equal(damerauLevenshtein("cake", "cakes"), 1);
  assert.equal(damerauLevenshtein("cake", "bake"), 1);
});

test("words shorter than the fuzzy floor never near-match, even off by one letter", () => {
  assert.equal(isNearMatch("cat", "cot"), false);
});

test("a differing first letter never near-matches", () => {
  assert.equal(isNearMatch("mango", "tango"), false);
});

test("a one-letter typo on a mid-length word near-matches", () => {
  assert.ok(isNearMatch("chocolate", "chocolat"));
  assert.ok(isNearMatch("chocolate", "choclate"));
});

test("a word past its distance budget does not near-match", () => {
  assert.equal(isNearMatch("chocolate", "chocolatemousse"), false);
});

test("an identical word always near-matches", () => {
  assert.ok(isNearMatch("cheesecake", "cheesecake"));
});
