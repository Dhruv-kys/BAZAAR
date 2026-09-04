import crypto from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { refuse, type Refusal } from "./refusals.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS consumed_mandates (
    mandate_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    quote_id TEXT NOT NULL,
    consumed_at TEXT NOT NULL
  )
`);

const consumeStmt = db.prepare(`
  INSERT INTO consumed_mandates (mandate_id, agent_id, quote_id, consumed_at)
  VALUES (?, ?, ?, ?)
`);

const mandateScopeSchema = z.object({
  categories: z.array(z.string()).optional(),
});

export const mandateClaimsSchema = z.object({
  mandateId: z.string().min(1),
  principalId: z.string().min(1),
  agentId: z.string().min(1),
  ceilingInPaise: z.number().int().positive(),
  scope: mandateScopeSchema.optional(),
  issuedAt: z.string().min(1),
  expiresAt: z.string().min(1),
});

export const signedMandateSchema = z.object({
  claims: mandateClaimsSchema,
  signature: z.string().min(1),
});

export type MandateClaims = z.infer<typeof mandateClaimsSchema>;
export type SignedMandate = z.infer<typeof signedMandateSchema>;

export interface VerifiedMandate {
  claims: MandateClaims;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export function signingBytes(claims: MandateClaims): Buffer {
  return Buffer.from(canonicalize(claims), "utf8");
}

function publicKey(): crypto.KeyObject | null {
  const encoded = process.env.MANDATE_PUBLIC_KEY;
  if (!encoded) return null;
  try {
    return crypto.createPublicKey({
      key: Buffer.from(encoded, "base64"),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

export interface VerifyOptions {
  expectedAgentId: string;
  now?: number;
}

/**
 * I8: a refusal message is logged verbatim as merchant audit reasoning, so no
 * claim value is interpolated here. A signature proves the principal authored
 * the mandate, not that its text belongs in the merchant's compliance record.
 */
export function verifyMandate(raw: unknown, options: VerifyOptions): VerifiedMandate | Refusal {
  const parsed = signedMandateSchema.safeParse(raw);
  if (!parsed.success) {
    return refuse("MANDATE_MALFORMED", "The mandate is missing required fields or has the wrong shape.");
  }

  const key = publicKey();
  if (!key) {
    return refuse(
      "MANDATE_SIGNATURE_INVALID",
      "The merchant has no mandate public key configured, so no mandate can be trusted.",
    );
  }

  const { claims, signature } = parsed.data;
  const signatureValid = crypto.verify(
    null,
    signingBytes(claims),
    key,
    Buffer.from(signature, "base64"),
  );
  if (!signatureValid) {
    return refuse(
      "MANDATE_SIGNATURE_INVALID",
      "The mandate signature does not match its claims. It was altered after signing, or signed by an unknown principal.",
    );
  }

  if (claims.agentId !== options.expectedAgentId) {
    return refuse(
      "MANDATE_AGENT_MISMATCH",
      "This mandate authorizes a different agent than the one making the request.",
    );
  }

  const expiresAt = Date.parse(claims.expiresAt);
  if (Number.isNaN(expiresAt)) {
    return refuse("MANDATE_MALFORMED", "The mandate's expiresAt is not a valid timestamp.");
  }
  if (expiresAt <= (options.now ?? Date.now())) {
    return refuse("MANDATE_EXPIRED", "This mandate has expired.");
  }

  return { claims };
}

export function consumeMandate(mandateId: string, agentId: string, quoteId: string): boolean {
  try {
    consumeStmt.run(mandateId, agentId, quoteId, new Date().toISOString());
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_PRIMARYKEY") return false;
    throw error;
  }
}

export function releaseMandate(mandateId: string): void {
  db.prepare(`DELETE FROM consumed_mandates WHERE mandate_id = ?`).run(mandateId);
}
