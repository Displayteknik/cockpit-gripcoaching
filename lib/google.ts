// Google OAuth 2.0 + Search Console API + GA4 Data API
// Kräver: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI i env

import { supabaseServer } from "./supabase-admin";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(clientId: string, origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: clientId,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`;
}

export async function exchangeCode(code: string, origin: string) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error("Token exchange misslyckades: " + (await r.text()));
  return (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string };
}

export async function refreshAccessToken(refresh_token: string) {
  const r = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error("Token refresh misslyckades: " + (await r.text()));
  return (await r.json()) as { access_token: string; expires_in: number };
}

export async function getValidAccessToken(clientId: string): Promise<string> {
  const sb = supabaseServer();
  const { data } = await sb.from("google_connections").select("*").eq("client_id", clientId).single();
  if (!data) throw new Error("Google ej anslutet för denna klient");
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + 60_000) return data.access_token;
  const fresh = await refreshAccessToken(data.refresh_token);
  const newExpiry = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  await sb.from("google_connections").update({ access_token: fresh.access_token, expires_at: newExpiry, updated_at: new Date().toISOString() }).eq("client_id", clientId);
  return fresh.access_token;
}

// Auto-koppla rätt GA4-property genom att matcha klientens domän mot property:ns web-datastream.
// Körs best-effort (kastar aldrig). Returnerar property_id om vald/redan satt, annars null.
async function saveGaProperty(sb: ReturnType<typeof supabaseServer>, clientId: string, propertyId: string) {
  await sb.from("google_connections").update({ ga_property_id: propertyId, updated_at: new Date().toISOString() }).eq("client_id", clientId);
}

export async function autoSelectGaProperty(clientId: string): Promise<string | null> {
  try {
    const sb = supabaseServer();
    const { data: conn } = await sb.from("google_connections").select("ga_property_id").eq("client_id", clientId).maybeSingle();
    if (!conn) return null;
    if (conn.ga_property_id) return conn.ga_property_id as string; // redan satt

    const { data: client } = await sb.from("clients").select("public_url").eq("id", clientId).maybeSingle();
    let targetHost: string | null = null;
    try { if (client?.public_url) targetHost = new URL(client.public_url).hostname.replace(/^www\./, "").toLowerCase(); } catch {}

    const token = await getValidAccessToken(clientId);
    const sumRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: { Authorization: `Bearer ${token}` } });
    if (!sumRes.ok) return null;
    const sum = (await sumRes.json()) as { accountSummaries?: Array<{ propertySummaries?: Array<{ property: string }> }> };
    const propIds: string[] = [];
    for (const a of sum.accountSummaries || []) for (const p of a.propertySummaries || []) propIds.push(p.property.replace("properties/", ""));
    if (propIds.length === 0) return null;

    // 1. Matcha på domän via web-datastream (defaultUri)
    if (targetHost) {
      for (const pid of propIds) {
        try {
          const dsRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${pid}/dataStreams`, { headers: { Authorization: `Bearer ${token}` } });
          if (!dsRes.ok) continue;
          const ds = (await dsRes.json()) as { dataStreams?: Array<{ type?: string; webStreamData?: { defaultUri?: string } }> };
          const match = (ds.dataStreams || []).some((s) => {
            if (s.type !== "WEB_DATA_STREAM" || !s.webStreamData?.defaultUri) return false;
            try { return new URL(s.webStreamData.defaultUri).hostname.replace(/^www\./, "").toLowerCase() === targetHost; } catch { return false; }
          });
          if (match) { await saveGaProperty(sb, clientId, pid); return pid; }
        } catch {}
      }
    }
    // 2. Fallback: exakt EN property → använd den (ingen tvetydighet)
    if (propIds.length === 1) { await saveGaProperty(sb, clientId, propIds[0]); return propIds[0]; }
    return null; // flera properties, ingen domän-match → kan ej avgöra säkert
  } catch {
    return null;
  }
}

// Search Console API
export async function listGscSites(clientId: string): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const token = await getValidAccessToken(clientId);
  const r = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("GSC sites: " + (await r.text()));
  const data = await r.json();
  return data.siteEntry || [];
}

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  page?: string;
}

export async function queryGsc(clientId: string, siteUrl: string, days = 28, dimensions: ("query" | "page")[] = ["query"]): Promise<GscQueryRow[]> {
  const token = await getValidAccessToken(clientId);
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions,
      rowLimit: 1000,
    }),
  });
  if (!r.ok) throw new Error("GSC query: " + (await r.text()));
  const data = await r.json();
  return (data.rows || []).map((row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
    query: dimensions[0] === "query" ? row.keys[0] : "",
    page: dimensions.includes("page") ? row.keys[dimensions.indexOf("page")] : undefined,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

// Per-dag GSC: hamtar dagsdata med date som primar dimension.
// Anvands for att fylla gsc_queries_daily-tabellen.
export interface GscDailyRow {
  date: string;
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function queryGscDaily(
  clientId: string,
  siteUrl: string,
  days = 90,
  withQuery = false
): Promise<GscDailyRow[]> {
  const token = await getValidAccessToken(clientId);
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const dimensions = withQuery ? ["date", "query"] : ["date"];

  const r = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions,
        rowLimit: 25000,
      }),
    }
  );
  if (!r.ok) throw new Error("GSC daily query: " + (await r.text()));
  const data = await r.json();
  return ((data.rows || []) as Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>).map((row) => ({
    date: row.keys[0],
    query: withQuery ? row.keys[1] ?? null : null,
    page: null,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

export async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return { email: "" };
  return (await r.json()) as { email: string };
}
