import type { Request } from "express";

/**
 * Fails closed: with no AGENT_CREDENTIALS configured no agent can authenticate,
 * so the agent door can never become an unauthenticated charge path.
 */
function credentialMap(): Map<string, string> {
  const raw = process.env.AGENT_CREDENTIALS ?? "";
  const entries = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf(":");
      return separator === -1
        ? null
        : ([pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()] as const);
    })
    .filter((entry): entry is readonly [string, string] => entry !== null && entry[0] !== "" && entry[1] !== "");

  return new Map(entries);
}

export function firstCredential(): string | null {
  return [...credentialMap().keys()][0] ?? null;
}

export function firstAgent(): { key: string; agentId: string } | null {
  const [entry] = [...credentialMap().entries()];
  return entry ? { key: entry[0], agentId: entry[1] } : null;
}

export function resolveAgentId(req: Request): string | null {
  const header = req.header("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  return credentialMap().get(token) ?? null;
}

export function agentSessionId(req: Request, agentId: string): string {
  const provided = req.header("x-bazaar-session");
  if (provided && /^[a-zA-Z0-9_-]{1,64}$/.test(provided)) return provided;
  return `agent:${agentId}`;
}
