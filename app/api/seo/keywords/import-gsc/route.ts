import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// POST /api/seo/keywords/import-gsc
// "Hämta mina sökord från Google" — lägger in de sökord klienten FAKTISKT syns på
// (från senaste GSC-synk) i sökords-trackern, med sin riktiga placering. Hoppar
// dubletter och rena domän-/URL-sökningar. Tenant-låst via resolveClientId.
export async function POST() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await resolveClientId();
  const sb = supabaseServer();

  const { data: meta } = await sb
    .from("gsc_queries").select("period_start")
    .eq("client_id", clientId).not("query", "is", null)
    .order("period_start", { ascending: false }).limit(1).maybeSingle();
  const latest = (meta as { period_start?: string } | null)?.period_start ?? null;
  if (!latest) return NextResponse.json({ added: 0, reason: "Ingen Google-data ännu. Koppla Google Search Console först." });

  const { data: rows } = await sb
    .from("gsc_queries").select("query, clicks, impressions, position")
    .eq("client_id", clientId).eq("period_start", latest);

  // Aggregera per sökord (impression-viktad snittposition). Hoppa domän/URL-sökningar.
  const agg = new Map<string, { clicks: number; impressions: number; posSum: number; posN: number }>();
  for (const r of (rows ?? []) as { query: string; clicks: number; impressions: number; position: number | string }[]) {
    const key = (r.query || "").trim();
    if (!key || /\.[a-z]{2,}(\/|$)/i.test(key)) continue;
    const e = agg.get(key) ?? { clicks: 0, impressions: 0, posSum: 0, posN: 0 };
    e.clicks += r.clicks; e.impressions += r.impressions;
    const pos = Number(r.position) || 0;
    if (pos > 0) { e.posSum += pos * r.impressions; e.posN += r.impressions; }
    agg.set(key, e);
  }
  if (agg.size === 0) return NextResponse.json({ added: 0, reason: "Ingen Google-data ännu." });

  const { data: existing } = await sb.from("hm_seo_keywords").select("keyword").eq("client_id", clientId);
  const have = new Set(((existing ?? []) as { keyword: string }[]).map((k) => k.keyword.trim().toLowerCase()));

  const toInsert = Array.from(agg.entries())
    .filter(([q]) => !have.has(q.toLowerCase()))
    .sort((a, b) => b[1].impressions - a[1].impressions)
    .slice(0, 50)
    .map(([q, e]) => ({
      client_id: clientId,
      keyword: q,
      intent: "informational",
      current_rank: e.posN > 0 ? Math.round(e.posSum / e.posN) : null,
    }));

  if (toInsert.length === 0) return NextResponse.json({ added: 0, reason: "Alla dina Google-ord finns redan i listan." });

  const { error } = await sb.from("hm_seo_keywords").insert(toInsert);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ added: toInsert.length });
}
