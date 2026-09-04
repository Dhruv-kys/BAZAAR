import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { activeAgents, forgetAgents, noteAgentActivity } from "./presence.js";

describe("agent presence", () => {
  beforeEach(() => forgetAgents());

  it("reports nobody at the door by default", () => {
    assert.deepEqual(activeAgents(), []);
  });

  it("records an agent and the tool it reached for", () => {
    noteAgentActivity("agent-alpha", "request_quote");
    const [agent] = activeAgents();
    assert.equal(agent.agentId, "agent-alpha");
    assert.equal(agent.calls, 1);
    assert.equal(agent.recent[0].tool, "request_quote");
  });

  it("counts a session that opens without calling a tool, but does not count it as a call", () => {
    noteAgentActivity("agent-alpha");
    const [agent] = activeAgents();
    assert.equal(agent.calls, 0);
    assert.deepEqual(agent.recent, []);
  });

  it("keeps the newest call first and holds only a short tail", () => {
    for (const tool of ["a", "b", "c", "d", "e", "f", "g"]) noteAgentActivity("agent-alpha", tool);
    const [agent] = activeAgents();
    assert.equal(agent.calls, 7);
    assert.equal(agent.recent[0].tool, "g");
    assert.ok(agent.recent.length <= 6);
  });

  it("tracks two agents apart", () => {
    noteAgentActivity("agent-alpha", "search_catalog");
    noteAgentActivity("agent-beta", "get_product");
    assert.equal(activeAgents().length, 2);
  });

  it("forgets an agent that has gone quiet", () => {
    noteAgentActivity("agent-alpha", "search_catalog");
    assert.equal(activeAgents(Date.now() + 60_000).length, 0);
  });
});
