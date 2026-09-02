import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { signingBytes, type MandateClaims } from "../commerce/mandate.js";

const walletDir = path.resolve(import.meta.dirname, "../../.wallet");
const keyPath = path.join(walletDir, "principal.key");

function keygen(): void {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.mkdirSync(walletDir, { recursive: true });
  fs.writeFileSync(
    keyPath,
    privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    { mode: 0o600 },
  );
  const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  console.log(`Private key written to ${keyPath} (keep this off the merchant).`);
  console.log(`\nAdd this to the merchant's .env:\n\nMANDATE_PUBLIC_KEY=${spki}\n`);
}

function loadPrivateKey(): crypto.KeyObject {
  if (!fs.existsSync(keyPath)) {
    console.error(`No principal key at ${keyPath}. Run: npm run wallet -w server -- keygen`);
    process.exit(1);
  }
  return crypto.createPrivateKey({
    key: Buffer.from(fs.readFileSync(keyPath, "utf8"), "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function flag(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  if (fallback !== undefined) return fallback;
  console.error(`Missing required --${name}`);
  process.exit(1);
}

function mint(): void {
  const privateKey = loadPrivateKey();
  const ttlMinutes = Number(flag("ttl", "30"));
  const categories = flag("categories", "").trim();

  const claims: MandateClaims = {
    mandateId: crypto.randomUUID(),
    principalId: flag("principal", "person:demo-buyer"),
    agentId: flag("agent"),
    ceilingInPaise: Number(flag("ceiling")),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    ...(categories ? { scope: { categories: categories.split(",").map((c) => c.trim()) } } : {}),
  };

  const signature = crypto.sign(null, signingBytes(claims), privateKey).toString("base64");
  console.log(JSON.stringify({ claims, signature }, null, 2));
}

const command = process.argv[2];
if (command === "keygen") keygen();
else if (command === "mint") mint();
else {
  console.error("Usage:\n  wallet keygen\n  wallet mint --agent <id> --ceiling <paise> [--ttl <minutes>] [--categories cake,cupcakes] [--principal <id>]");
  process.exit(1);
}
