import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { signingBytes, type MandateClaims, type SignedMandate } from "../commerce/mandate.js";

export const principalKeyPath = path.resolve(import.meta.dirname, "../../.wallet/principal.key");

export function loadPrivateKey(): crypto.KeyObject {
  return crypto.createPrivateKey({
    key: Buffer.from(fs.readFileSync(principalKeyPath, "utf8"), "base64"),
    format: "der",
    type: "pkcs8",
  });
}

export function signMandate(claims: MandateClaims, key = loadPrivateKey()): SignedMandate {
  return { claims, signature: crypto.sign(null, signingBytes(claims), key).toString("base64") };
}
