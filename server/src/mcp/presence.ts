/**
 * Who is at the agent door right now.
 *
 * Deliberately in memory and deliberately small: this is a liveness signal for
 * the screen, not a record. The audit trail is the record, and it is durable.
 */

const SEEN_WINDOW_MS = 45_000;
const RECENT_CALLS = 6;

export interface AgentCall {
  tool: string;
  at: string;
}

export interface AgentPresence {
  agentId: string;
  firstSeen: string;
  lastSeen: string;
  calls: number;
  recent: AgentCall[];
}

const seen = new Map<string, AgentPresence>();

export function noteAgentActivity(agentId: string, tool?: string): void {
  const now = new Date().toISOString();
  const existing = seen.get(agentId);

  if (!existing) {
    seen.set(agentId, {
      agentId,
      firstSeen: now,
      lastSeen: now,
      calls: tool ? 1 : 0,
      recent: tool ? [{ tool, at: now }] : [],
    });
    return;
  }

  existing.lastSeen = now;
  if (tool) {
    existing.calls += 1;
    existing.recent = [{ tool, at: now }, ...existing.recent].slice(0, RECENT_CALLS);
  }
}

export function activeAgents(now = Date.now()): AgentPresence[] {
  const live: AgentPresence[] = [];
  for (const [agentId, presence] of seen) {
    if (now - Date.parse(presence.lastSeen) > SEEN_WINDOW_MS) {
      seen.delete(agentId);
      continue;
    }
    live.push(presence);
  }
  return live.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export function forgetAgents(): void {
  seen.clear();
}
