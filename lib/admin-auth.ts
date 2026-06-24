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

// Signerad session-token: "<payload>.<hmac(payload)>".
//  - Full admin:        payload = "<exp>"                 (unix-sekunder)
//  - Klient-scopad:     payload = "<exp>~<client_id>"     (låst till en klient, t.ex. HM Motor)
// Signaturen täcker hela payloaden → scope går inte att förfalska eller ändra.
export async function createAdminSession(secret: string, scope?: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const payload = scope ? `${exp}~${scope}` : String(exp);
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
  const exp = Number(payload.split("~")[0]); // exp ligger före ev. ~scope
  return Number.isFinite(exp) && exp * 1000 > Date.now();
}

// Läser klient-scopet ur en VERIFIERAD session. null = full admin (ingen scope).
// Returnerar bara scope om signaturen + giltighetstiden stämmer.
export async function getSessionScope(value: string | undefined, secret: string): Promise<string | null> {
  if (!(await verifyAdminSession(value, secret))) return null;
  const v = value as string;
  const payload = v.slice(0, v.lastIndexOf("."));
  const tilde = payload.indexOf("~");
  return tilde >= 0 ? payload.slice(tilde + 1) : null;
}

// Konstant-tid lösenordskoll via SHA-256 (döljer även längdskillnad).
export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!input || !expected) return false;
  const hash = async (s: string) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return constTimeEqual(await hash(input), await hash(expected));
}
