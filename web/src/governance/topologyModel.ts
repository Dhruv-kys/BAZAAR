import type { AuditEvent } from "../audit/useAuditEvents";

export type StageState = "idle" | "active" | "bounded" | "locked" | "open";

export interface Stage {
  key: string;
  label: string;
  /** x, y in 0..1 of the panel box. DOM labels and WebGL nodes read the same
   *  numbers, which is what keeps the two layers aligned at any size. */
  at: [number, number];
  state: StageState;
}

export type GateState = "none" | "staged" | "authorized" | "settled";

/**
 * The topology is derived from real audit events only. A stage never lights up
 * because time passed; it lights up because the server recorded something.
 */
export function buildStages(events: AuditEvent[], gate: GateState): Stage[] {
  const has = (...types: string[]) => events.some((e) => types.includes(e.type));
  const clamped = events.some((e) => e.wasClamped);

  return [
    {
      key: "intent",
      label: "You ask",
      at: [0.07, 0.5],
      state: events.length ? "active" : "idle",
    },
    {
      key: "agent",
      label: "Agent",
      at: [0.26, 0.5],
      state: has("recommendation", "cross_sell", "upsell", "discount_requested") ? "active" : "idle",
    },
    {
      key: "recommend",
      label: "It suggests",
      at: [0.47, 0.17],
      state: has("recommendation", "cross_sell", "upsell") ? "active" : "idle",
    },
    {
      key: "policy",
      label: "Limits",
      at: [0.47, 0.5],
      state: clamped ? "bounded" : has("discount_requested") ? "active" : "idle",
    },
    {
      key: "staged",
      label: "Order ready",
      at: [0.47, 0.83],
      state: has("order_blocked") ? "bounded" : gate !== "none" ? "active" : "idle",
    },
    {
      key: "gate",
      label: "Your approval",
      at: [0.7, 0.5],
      state: gate === "none" || gate === "staged" ? "locked" : "open",
    },
    {
      key: "payment",
      label: "Payment",
      at: [0.92, 0.5],
      state: gate === "authorized" || gate === "settled" ? "open" : "locked",
    },
  ];
}

export const EDGES: [string, string][] = [
  ["intent", "agent"],
  ["agent", "recommend"],
  ["agent", "policy"],
  ["agent", "staged"],
  ["recommend", "gate"],
  ["policy", "gate"],
  ["staged", "gate"],
  ["gate", "payment"],
];
