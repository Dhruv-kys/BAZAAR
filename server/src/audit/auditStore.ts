import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.resolve(import.meta.dirname, "../../data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "audit.sqlite"));

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

const insertStmt = db.prepare(`
  INSERT INTO audit_events (session_id, timestamp, type, tool_name, reasoning, payload_json, was_clamped)
  VALUES (@sessionId, @timestamp, @type, @toolName, @reasoning, @payloadJson, @wasClamped)
`);

const selectStmt = db.prepare(`
  SELECT id, session_id AS sessionId, timestamp, type, tool_name AS toolName, reasoning, payload_json AS payloadJson, was_clamped AS wasClamped
  FROM audit_events WHERE session_id = ? ORDER BY id ASC
`);

export interface AuditEventInput {
  sessionId: string;
  type: string;
  toolName?: string;
  reasoning?: string;
  payload?: unknown;
  wasClamped?: boolean;
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
}

export const auditEvents = new EventEmitter();

export function logAuditEvent(input: AuditEventInput): AuditEvent {
  const timestamp = new Date().toISOString();
  const info = insertStmt.run({
    sessionId: input.sessionId,
    timestamp,
    type: input.type,
    toolName: input.toolName ?? null,
    reasoning: input.reasoning ?? null,
    payloadJson: input.payload !== undefined ? JSON.stringify(input.payload) : null,
    wasClamped: input.wasClamped ? 1 : 0,
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
}

export function getAuditEvents(sessionId: string): AuditEvent[] {
  const rows = selectStmt.all(sessionId) as AuditEventRow[];
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    timestamp: row.timestamp,
    type: row.type,
    toolName: row.toolName,
    reasoning: row.reasoning,
    payload: row.payloadJson ? JSON.parse(row.payloadJson) : null,
    wasClamped: Boolean(row.wasClamped),
  }));
}
