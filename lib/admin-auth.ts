// Admin-session: HMAC-signerad cookie. Går inte att förfalska utan ADMIN_SESSION_SECRET.
// Körs i både proxy (Node.js-runtime) och route handlers → använder global Web Crypto
// (crypto.subtle finns i Node 18+ och Edge). Inga Node-specifika importer.

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dygn

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(sig);
}

// Konstant-tid-jämförelse av två strängar med samma längd.
function constTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Signerad session-token: "<exp>.<hmac(exp)>" där exp = unix-sekunder.
export async function createAdminSession(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const payload = String(exp);
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyAdminSession(value: string | undefined, secret: string): Promise<boolean> {
  if (!value || !secret) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(payload, secret);
  if (!constTimeEqual(sig, expected)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp * 1000 > Date.now();
}

// Konstant-tid lösenordskoll via SHA-256 (döljer även längdskillnad).
export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!input || !expected) return false;
  const hash = async (s: string) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return constTimeEqual(await hash(input), await hash(expected));
}
