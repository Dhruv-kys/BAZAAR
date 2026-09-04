import { db } from "../db.js";
import { merchant } from "../merchant/profile.js";

/*
 * A receipt number is a merchant record, so it must survive a restart and never
 * be handed to two orders. The per-day counter lives in SQLite and is advanced
 * by an upsert that returns the value it wrote, which is atomic in SQLite --
 * a read-then-write counter in memory would reissue every number after a
 * restart and hand duplicates to two concurrent confirms.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS receipt_sequence (
    day TEXT PRIMARY KEY,
    issued INTEGER NOT NULL
  )
`);

const advanceStmt = db.prepare(`
  INSERT INTO receipt_sequence (day, issued) VALUES (?, 1)
  ON CONFLICT(day) DO UPDATE SET issued = issued + 1
  RETURNING issued
`);

const SERIES = merchant.id.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();

export function issueReceiptNumber(now = new Date()): string {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const { issued } = advanceStmt.get(day) as { issued: number };
  return `${SERIES}-${day}-${String(issued).padStart(4, "0")}`;
}
