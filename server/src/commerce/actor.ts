export type ActorKind = "human" | "agent";

export interface Actor {
  kind: ActorKind;
  sessionId: string;
  agentId?: string;
  /** A budget the customer set for themselves. Another bound to intersect. */
  budgetInPaise?: number;
}

export function humanActor(sessionId: string, budgetInPaise?: number): Actor {
  return { kind: "human", sessionId, budgetInPaise };
}

export function agentActor(sessionId: string, agentId: string): Actor {
  return { kind: "agent", sessionId, agentId };
}
