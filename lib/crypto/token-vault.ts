// Token-vault — AES-256-GCM kryptering-at-rest för Meta/IG-tokens.
// Nyckeln (TOKEN_ENC_KEY) är 32 byte base64 och sätts ENDAST i env (Vercel + .env.local).
// Format: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>". iv = 12 slumpade byte per kryptering.
//
// SÄKERHET: körs bara server-side (nodejs runtime). Ett värde kan aldrig dekrypteras utan
// nyckeln → även en DB-dump eller service-role-läcka exponerar inte råa tokens.
// decryptMaybe() faller tillbaka på plaintext så befintliga okrypterade clients.ig_access_token
// (DT/HM) fortsätter fungera under migreringen.

import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) throw new Error("TOKEN_ENC_KEY saknas — kan inte kryptera/dekryptera tokens.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENC_KEY måste vara 32 byte (base64-kodad).");
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function decryptToken(value: string): string {
  if (!isEncrypted(value)) throw new Error("Värdet är inte krypterat (saknar prefix).");
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Krypterat värde har fel format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}

// Dekryptera om krypterat, annars returnera värdet oförändrat (bakåtkompat med plaintext).
export function decryptMaybe(value: string | null | undefined): string | null {
  if (!value) return null;
  return isEncrypted(value) ? decryptToken(value) : value;
}
