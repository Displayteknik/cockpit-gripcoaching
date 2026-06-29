import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId, logActivity } from "@/lib/client-context";
import { requireAdmin, requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  // Läsning: kundportalen (/k/seo) får läsa sin egen klients sökord.
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await resolveClientId();
  const sb = supabaseServer();
  const { data, error } = await sb.from("hm_seo_keywords").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // AUTO-POSITION: fyll i placeringen från Google Search Console istället för manuellt.
  // Matcha varje bevakat sökord mot SENASTE GSC-synken (undviker att stapla perioder).
  // Bara ord du faktiskt syns på (har visningar) får en position — det är sanningen,
  // ett ord du inte rankar på alls har ingen placering.
  const keywords = (data ?? []) as Record<string, unknown>[];
  if (keywords.length > 0) {
    const { data: meta } = await sb
      .from("gsc_queries").select("period_start")
      .eq("client_id", clientId).not("query", "is", null)
      .order("period_start", { ascending: false }).limit(1).maybeSingle();
    const latest = (meta as { period_start?: string } | null)?.period_start ?? null;
    if (latest) {
      const { data: rows } = await sb
        .from("gsc_queries").select("query, clicks, impressions, position")
        .eq("client_id", clientId).eq("period_start", latest);
      const agg = new Map<string, { clicks: number; impressions: number; posSum: number; posN: number }>();
      for (const r of (rows ?? []) as { query: string; clicks: number; impressions: number; position: number | string }[]) {
        const key = (r.query || "").trim().toLowerCase();
        if (!key) continue;
        const e = agg.get(key) ?? { clicks: 0, impressions: 0, posSum: 0, posN: 0 };
        e.clicks += r.clicks; e.impressions += r.impressions;
        const pos = Number(r.position) || 0;
        if (pos > 0) { e.posSum += pos * r.impressions; e.posN += r.impressions; }
        agg.set(key, e);
      }
      for (const kw of keywords) {
        const norm = String(kw.keyword || "").trim().toLowerCase();
        const m = agg.get(norm);
        if (m) {
          // Exakt träff: din riktiga placering för precis det ordet.
          kw.gsc_position = m.posN > 0 ? Math.round((m.posSum / m.posN) * 10) / 10 : null;
          kw.gsc_clicks = m.clicks;
          kw.gsc_impressions = m.impressions;
          continue;
        }
        // Ingen exakt träff → närmaste sökning du FAKTISKT syns på (en längre/kortare variant).
        // Märks tydligt som "liknande" så det inte förväxlas med exakt placering.
        if (norm) {
          let best: { q: string; pos: number; imp: number } | null = null;
          for (const [q, e] of agg) {
            if (e.posN <= 0) continue;
            if (q.includes(norm) || norm.includes(q)) {
              if (!best || e.impressions > best.imp) {
                best = { q, pos: Math.round((e.posSum / e.posN) * 10) / 10, imp: e.impressions };
              }
            }
          }
          if (best) { kw.gsc_related_query = best.q; kw.gsc_related_position = best.pos; }
        }
      }
    }
  }
  return NextResponse.json(keywords);
}

export async function POST(req: NextRequest) {
  // Mutation: endast admin (kunden lägger inte till sökord).
  const denied = await requireAdmin();
  if (denied) return denied;
  const clientId = await resolveClientId();
  const body = await req.json();
  const sb = supabaseServer();
  const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ ...r, client_id: clientId }));
  const { data, error } = await sb.from("hm_seo_keywords").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(clientId, "keyword_added", `${rows.length} sökord tillagda`);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const clientId = await resolveClientId();
  const body = await req.json();
  const { id, ...rest } = body;
  const sb = supabaseServer();
  const update: Record<string, unknown> = { ...rest };
  if (rest.current_rank !== undefined) {
    update.last_checked = new Date().toISOString();
    const { data: existing } = await sb.from("hm_seo_keywords").select("best_rank").eq("id", id).eq("client_id", clientId).single();
    const best = existing?.best_rank;
    const cur = rest.current_rank;
    if (cur && (!best || cur < best)) update.best_rank = cur;
  }
  const { data, error } = await sb.from("hm_seo_keywords").update(update).eq("id", id).eq("client_id", clientId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const clientId = await resolveClientId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hm_seo_keywords").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
