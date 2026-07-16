// Studio → GoHighLevel Social Planner. Publicerar en Studio-bild som UTKAST (draft)
// till klientens kopplade sociala konton. Multi-tenant: varje klient har egen
// location + Private Integration Token (PIT) i clients-tabellen.
//
// API-kontrakt verifierat mot live-API 2026-07-16:
//   GET  /social-media-posting/{loc}/accounts          → lista kopplade konton
//   GET  /users/?locationId={loc}                       → userId (krävs vid post)
//   POST /social-media-posting/{loc}/posts              → skapa post
//   required: accountIds[], type(post|story|reel), userId, media[]; + summary, status
// Headers: Authorization: Bearer <pit>, Version: 2021-07-28

import { supabaseService } from "@/lib/supabase-admin";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

export interface GhlConfig {
  locationId: string;
  pit: string;
}

export interface GhlAccount {
  id: string;
  name: string;
  platform: string;
  type: string;
  avatar?: string;
  isExpired?: boolean;
}

function headers(pit: string): Record<string, string> {
  return { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
}

// Hämtar klientens GHL-koppling. null = ej kopplat (UI visar hjälp-text).
export async function getGhlConfig(clientId: string): Promise<GhlConfig | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("ghl_location_id, ghl_pit")
    .eq("id", clientId)
    .maybeSingle();
  if (!data?.ghl_location_id || !data?.ghl_pit) return null;
  return { locationId: data.ghl_location_id, pit: data.ghl_pit };
}

// Lista kopplade sociala konton (FB/IG/LinkedIn) för publicering.
export async function ghlListAccounts(cfg: GhlConfig): Promise<{ accounts: GhlAccount[]; error?: string }> {
  try {
    const r = await fetch(`${BASE}/social-media-posting/${cfg.locationId}/accounts`, { headers: headers(cfg.pit) });
    if (!r.ok) return { accounts: [], error: `GHL ${r.status}: ${(await r.text()).slice(0, 160)}` };
    const d = await r.json();
    const raw = d?.results?.accounts || [];
    const accounts: GhlAccount[] = raw
      .filter((a: { deleted?: boolean }) => !a.deleted)
      .map((a: Record<string, unknown>) => ({
        id: String(a.id), name: String(a.name || ""), platform: String(a.platform || ""),
        type: String(a.type || ""), avatar: a.avatar as string | undefined, isExpired: Boolean(a.isExpired),
      }));
    return { accounts };
  } catch (e) {
    return { accounts: [], error: (e as Error).message };
  }
}

// Ett giltigt userId för location (krävs som post-författare). Första admin/aktiva.
export async function ghlFirstUserId(cfg: GhlConfig): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/users/?locationId=${cfg.locationId}`, { headers: headers(cfg.pit) });
    if (!r.ok) return null;
    const d = await r.json();
    const users = Array.isArray(d?.users) ? d.users : [];
    const active = users.find((u: { deleted?: boolean }) => !u.deleted) || users[0];
    return active?.id || null;
  } catch {
    return null;
  }
}

// Skapa ett UTKAST i Social Planner. Returnerar GHL-postens id.
export async function ghlCreateDraft(
  cfg: GhlConfig,
  opts: { accountIds: string[]; summary: string; mediaUrl?: string; userId: string; postType?: "post" | "story" | "reel" },
): Promise<{ postId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      accountIds: opts.accountIds,
      summary: opts.summary || "",
      type: opts.postType || "post",
      userId: opts.userId,
      status: "draft",
      media: opts.mediaUrl ? [{ url: opts.mediaUrl }] : [],
    };
    const r = await fetch(`${BASE}/social-media-posting/${cfg.locationId}/posts`, {
      method: "POST",
      headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = Array.isArray(d?.message) ? d.message.join("; ") : d?.message || `GHL ${r.status}`;
      return { error: String(msg).slice(0, 300) };
    }
    // Svaret är { results: { post: { _id } } } (verifierat mot live-API).
    const p = d?.results?.post || d?.post || d;
    const postId = p?._id || p?.id;
    return { postId: postId ? String(postId) : undefined };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── GHL Blogs (Fas 4) ──────────────────────────────────────────────
// Kontrakt verifierat mot live-API 2026-07-16:
//   GET  /blogs/site/all?locationId=&limit=&skip=0        → bloggsajter (_id)
//   GET  /blogs/authors?locationId=&limit=&offset=0       → författare (obs: offset, ej skip)
//   GET  /blogs/categories?locationId=&limit=&offset=0    → kategorier
//   POST /blogs/posts  { locationId, blogId, title, rawHTML, description, urlSlug,
//                        author, categories[], status:"DRAFT" }  → { blogPost:{_id} }
//   VIKTIGT: rawHTML måste wrappas i <body>…</body> för att innehållet ska sparas.
//   OBS: ingen DELETE finns i API:t — utkast raderas i GHL-UI:t.

export interface GhlBlogMeta {
  sites: { id: string; name: string }[];
  authors: { id: string; name: string }[];
  categories: { id: string; label: string }[];
}

async function ghlGet(cfg: GhlConfig, path: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: headers(cfg.pit) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function ghlBlogMeta(cfg: GhlConfig): Promise<{ meta?: GhlBlogMeta; error?: string }> {
  const loc = cfg.locationId;
  const [sitesRes, authorsRes, catsRes] = await Promise.all([
    ghlGet(cfg, `/blogs/site/all?locationId=${loc}&limit=50&skip=0`),
    ghlGet(cfg, `/blogs/authors?locationId=${loc}&limit=50&offset=0`),
    ghlGet(cfg, `/blogs/categories?locationId=${loc}&limit=100&offset=0`),
  ]);
  if (!sitesRes) return { error: "Kunde inte hämta bloggsajter (saknar token scope 'Blogs'?)" };
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    meta: {
      sites: arr(sitesRes.data).map((s) => ({ id: String(s._id || s.id), name: String(s.name || "") })),
      authors: arr(authorsRes?.authors ?? authorsRes?.data).map((a) => ({ id: String(a._id || a.id), name: String(a.name || "") })),
      categories: arr(catsRes?.categories ?? catsRes?.data).map((c) => ({ id: String(c._id || c.id), label: String(c.label || c.name || "") })),
    },
  };
}

export async function ghlCreateBlogDraft(
  cfg: GhlConfig,
  opts: {
    blogId: string; title: string; html: string; description?: string; urlSlug?: string;
    author?: string; categories?: string[]; imageUrl?: string; imageAltText?: string;
  },
): Promise<{ postId?: string; error?: string }> {
  try {
    // rawHTML MÅSTE wrappas i <body> för att innehållet ska sparas (verifierat).
    const rawHTML = /^\s*<body[\s>]/i.test(opts.html) ? opts.html : `<body>${opts.html}</body>`;
    const body: Record<string, unknown> = {
      locationId: cfg.locationId,
      blogId: opts.blogId,
      title: opts.title,
      rawHTML,
      description: opts.description || "",
      urlSlug: opts.urlSlug || "",
      status: "DRAFT",
      ...(opts.author ? { author: opts.author } : {}),
      ...(opts.categories?.length ? { categories: opts.categories } : {}),
      ...(opts.imageUrl ? { imageUrl: opts.imageUrl, imageAltText: opts.imageAltText || opts.title } : {}),
    };
    const r = await fetch(`${BASE}/blogs/posts`, {
      method: "POST",
      headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = Array.isArray(d?.message) ? d.message.join("; ") : d?.message || `GHL ${r.status}`;
      return { error: String(msg).slice(0, 300) };
    }
    const p = d?.blogPost || d?.data || d;
    const postId = p?._id || p?.id;
    return { postId: postId ? String(postId) : undefined };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
