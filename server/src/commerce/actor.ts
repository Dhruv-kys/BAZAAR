export type ActorKind = "human" | "agent";

export interface Actor {
  kind: ActorKind;
  sessionId: string;
  agentId?: string;
}

export function humanActor(sessionId: string): Actor {
  return { kind: "human", sessionId };
}

export function agentActor(sessionId: string, agentId: string): Actor {
  return { kind: "agent", sessionId, agentId };
}
