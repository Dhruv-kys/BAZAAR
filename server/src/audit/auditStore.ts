import { EventEmitter } from "node:events";
import type { ActorKind } from "../commerce/actor.js";
import { db, hasColumn } from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL,
    tool_name TEXT,
    reasoning TEXT,
    payload_json TEXT,
    was_clamped INTEGER NOT NULL DEFAULT 0
  )
`);

if (!hasColumn("audit_events", "actor")) {
  db.exec(`ALTER TABLE audit_events ADD COLUMN actor TEXT NOT NULL DEFAULT 'human'`);
}
if (!hasColumn("audit_events", "agent_id")) {
  db.exec(`ALTER TABLE audit_events ADD COLUMN agent_id TEXT`);
}
if (!hasColumn("audit_events", "refusal_code")) {
  db.exec(`ALTER TABLE audit_events ADD COLUMN refusal_code TEXT`);
}

const insertStmt = db.prepare(`
  INSERT INTO audit_events (session_id, timestamp, type, tool_name, reasoning, payload_json, was_clamped, actor, agent_id, refusal_code)
  VALUES (@sessionId, @timestamp, @type, @toolName, @reasoning, @payloadJson, @wasClamped, @actor, @agentId, @refusalCode)
`);

const SELECT_COLUMNS = `
  id, session_id AS sessionId, timestamp, type, tool_name AS toolName, reasoning,
  payload_json AS payloadJson, was_clamped AS wasClamped, actor, agent_id AS agentId,
  refusal_code AS refusalCode
`;

const selectBySessionStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS} FROM audit_events WHERE session_id = ? ORDER BY id ASC
`);

const selectRecentStmt = db.prepare(`
  SELECT ${SELECT_COLUMNS} FROM audit_events ORDER BY id DESC LIMIT ?
`);

export interface AuditEventInput {
  sessionId: string;
  type: string;
  toolName?: string;
  reasoning?: string;
  payload?: unknown;
  wasClamped?: boolean;
  actor?: ActorKind;
  agentId?: string;
  refusalCode?: string;
}

export interface AuditEvent {
  id: number;
  sessionId: string;
  timestamp: string;
  type: string;
  toolName: string | null;
  reasoning: string | null;
  payload: unknown;
  wasClamped: boolean;
  actor: ActorKind;
  agentId: string | null;
  refusalCode: string | null;
}

export const auditEvents = new EventEmitter();

export function logAuditEvent(input: AuditEventInput): AuditEvent {
  const timestamp = new Date().toISOString();
  const actor: ActorKind = input.actor ?? "human";
  const info = insertStmt.run({
    sessionId: input.sessionId,
    timestamp,
    type: input.type,
    toolName: input.toolName ?? null,
    reasoning: input.reasoning ?? null,
    payloadJson: input.payload !== undefined ? JSON.stringify(input.payload) : null,
    wasClamped: input.wasClamped ? 1 : 0,
    actor,
    agentId: input.agentId ?? null,
    refusalCode: input.refusalCode ?? null,
  });

  const event: AuditEvent = {
    id: Number(info.lastInsertRowid),
    sessionId: input.sessionId,
    timestamp,
    type: input.type,
    toolName: input.toolName ?? null,
    reasoning: input.reasoning ?? null,
    payload: input.payload ?? null,
    wasClamped: Boolean(input.wasClamped),
    actor,
    agentId: input.agentId ?? null,
    refusalCode: input.refusalCode ?? null,
  };

  auditEvents.emit("event", event);
  return event;
}

interface AuditEventRow {
  id: number;
  sessionId: string;
  timestamp: string;
  type: string;
  toolName: string | null;
  reasoning: string | null;
  payloadJson: string | null;
  wasClamped: number;
  actor: string;
  agentId: string | null;
  refusalCode: string | null;
}

function toEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    sessionId: row.sessionId,
    timestamp: row.timestamp,
    type: row.type,
    toolName: row.toolName,
    reasoning: row.reasoning,
    payload: row.payloadJson ? JSON.parse(row.payloadJson) : null,
    wasClamped: Boolean(row.wasClamped),
    actor: row.actor === "agent" ? "agent" : "human",
    agentId: row.agentId,
    refusalCode: row.refusalCode,
  };
}

export function getAuditEvents(sessionId: string): AuditEvent[] {
  return (selectBySessionStmt.all(sessionId) as AuditEventRow[]).map(toEvent);
}

export function getRecentAuditEvents(limit: number): AuditEvent[] {
  return (selectRecentStmt.all(limit) as AuditEventRow[]).map(toEvent).reverse();
}
