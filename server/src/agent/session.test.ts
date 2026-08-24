import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type OpenAI from "openai";
import { trimHistory } from "./session.js";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function turn(n: number): Message[] {
  return [
    { role: "user", content: `question ${n}` },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: `call-${n}`, type: "function", function: { name: "search_catalog", arguments: "{}" } }],
    },
    { role: "tool", tool_call_id: `call-${n}`, content: "[]" },
    { role: "assistant", content: `answer ${n}` },
  ];
}

function build(turns: number): Message[] {
  const history: Message[] = [{ role: "system", content: "system prompt" }];
  for (let i = 0; i < turns; i++) history.push(...turn(i));
  return history;
}

function assertValidSequence(history: Message[]) {
  const seen = new Set<string>();
  for (const message of history) {
    if (message.role === "assistant" && "tool_calls" in message && message.tool_calls) {
      for (const call of message.tool_calls) seen.add(call.id);
    }
    if (message.role === "tool") {
      assert.ok(
        seen.has(message.tool_call_id),
        `orphaned tool result ${message.tool_call_id} - no preceding assistant tool_call`,
      );
    }
  }
}

describe("trimHistory", () => {
  it("leaves short histories untouched", () => {
    const history = build(2);
    const before = history.length;
    trimHistory(history);
    assert.equal(history.length, before);
  });

  it("always preserves the system prompt", () => {
    const history = build(20);
    trimHistory(history);
    assert.equal(history[0].role, "system");
    assert.equal(history[0].content, "system prompt");
  });

  it("never leaves an orphaned tool result", () => {
    for (let turns = 1; turns <= 30; turns++) {
      const history = build(turns);
      trimHistory(history);
      assertValidSequence(history);
    }
  });

  it("cuts at a user boundary so the window starts a turn", () => {
    const history = build(20);
    trimHistory(history);
    assert.equal(history[1].role, "user", "first message after system should start a turn");
  });

  it("actually reduces long histories", () => {
    const history = build(30);
    const before = history.length;
    trimHistory(history);
    assert.ok(history.length < before, "expected trimming to shorten the history");
  });

  it("keeps the most recent turn", () => {
    const history = build(30);
    trimHistory(history);
    const last = history[history.length - 1];
    assert.equal(last.role, "assistant");
    assert.equal(last.content, "answer 29");
  });

  it("is stable when applied repeatedly", () => {
    const history = build(30);
    trimHistory(history);
    const afterFirst = history.length;
    trimHistory(history);
    assert.equal(history.length, afterFirst);
    assertValidSequence(history);
  });

  it("handles a history with no system prompt", () => {
    const history: Message[] = [];
    for (let i = 0; i < 20; i++) history.push(...turn(i));
    trimHistory(history);
    assertValidSequence(history);
    assert.equal(history[0].role, "user");
  });
});
