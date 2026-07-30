// Meta / Facebook Login for Business — OAuth + Graph-hjälpare för Anslutningsmotorn.
// App: "Display Engine AI" (app-id publikt). App-secret läses ENDAST från env (IG_APP_SECRET,
// samma secret som webhook-HMAC använder — återanvänds, inget nytt namn).
//
// SÄKERHET: körs bara server-side. appsecret_proof (HMAC av token med app-secret) skickas på
// alla Graph-anrop med token — Metas rekommendation, hindrar token-återanvändning utanför appen.
// Inget token/secret loggas här.

import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";
const OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

// Scopes appen redan är godkänd för.
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
];

export function metaAppId(): string {
  return process.env.META_APP_ID || "2129511757816331";
}

function metaAppSecret(): string {
  const s = process.env.IG_APP_SECRET;
  if (!s) throw new Error("IG_APP_SECRET saknas — kan inte prata med Meta.");
  return s;
}

export function metaRedirectUri(): string {
  return process.env.META_OAUTH_REDIRECT || "https://cockpit.gripcoaching.se/api/meta/oauth/callback";
}

// appsecret_proof = HMAC-SHA256(access_token, app_secret).
export function appsecretProof(token: string): string {
  return crypto.createHmac("sha256", metaAppSecret()).update(token).digest("hex");
}

export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: metaAppId(),
    redirect_uri: metaRedirectUri(),
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `${OAUTH_DIALOG}?${p.toString()}`;
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  url.searchParams.set("appsecret_proof", appsecretProof(token));
  const r = await fetch(url.toString());
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `Graph GET ${path}: ${r.status}`);
  return d;
}

// code → short-lived user-token
export async function exchangeCodeForToken(code: string): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("code", code);
  const r = await fetch(url.toString());
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Kunde inte byta code mot token.");
  return d.access_token as string;
}

// short-lived → long-lived user-token (~60 dgr)
export async function exchangeForLongLived(shortToken: string): Promise<{ token: string; expiresIn?: number }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", metaAppSecret());
  url.searchParams.set("fb_exchange_token", shortToken);
  const r = await fetch(url.toString());
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Kunde inte byta till long-lived token.");
  return { token: d.access_token as string, expiresIn: d.expires_in as number | undefined };
}

export async function getMe(token: string): Promise<{ id: string; name: string }> {
  return graphGet("/me", token, { fields: "id,name" });
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

// me/accounts → sidor + kopplat IG-konto. Page-token ur denna typ (via long-lived user-token)
// har inget utgångsdatum.
export async function getPages(token: string): Promise<MetaPage[]> {
  const d = await graphGet("/me/accounts", token, {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  });
  return (d.data || []) as MetaPage[];
}

export interface DebugTokenResult {
  is_valid: boolean;
  expires_at?: number;
  data_access_expires_at?: number;
  scopes?: string[];
  error?: { message: string; code?: number };
}

// debug_token — validerar en token med app-access-token (app-id|app-secret).
export async function debugToken(inputToken: string): Promise<DebugTokenResult> {
  const url = new URL(`${GRAPH}/debug_token`);
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", `${metaAppId()}|${metaAppSecret()}`);
  const r = await fetch(url.toString());
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "debug_token misslyckades.");
  return (d.data || {}) as DebugTokenResult;
}

// Billigt läsanrop mot IG-kontot (username + followers) — bekräftar att page-token lever.
export async function getIgUsername(igId: string, token: string): Promise<{ username?: string; followers_count?: number }> {
  return graphGet(`/${igId}`, token, { fields: "username,followers_count" });
}
