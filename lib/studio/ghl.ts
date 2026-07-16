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
