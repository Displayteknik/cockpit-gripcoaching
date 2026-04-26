import { NextRequest, NextResponse } from "next/server";
import { queryGsc } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json().catch(() => ({}));
  const days: number = body.days || 28;

  const sb = supabaseServer();
  const { data: conn } = await sb.from("google_connections").select("gsc_site").eq("client_id", clientId).maybeSingle();
  if (!conn?.gsc_site) return NextResponse.json({ error: "Välj en GSC-site först" }, { status: 400 });

  try {
    // Hämta query-dimension + query+page-dimension
    const [byQuery, byQueryPage] = await Promise.all([
      queryGsc(clientId, conn.gsc_site, days, ["query"]),
      queryGsc(clientId, conn.gsc_site, days, ["query", "page"]),
    ]);

    const period_end = new Date().toISOString().slice(0, 10);
    const period_start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    // Map query → bästa landningssida
    const pageByQuery = new Map<string, string>();
    for (const r of byQueryPage) {
      if (r.query && r.page && !pageByQuery.has(r.query)) pageByQuery.set(r.query, r.page);
    }

    const rows = byQuery.map((r) => ({
      client_id: clientId,
      query: r.query,
      page: pageByQuery.get(r.query) || null,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
      period_start,
      period_end,
    }));

    // Rensa tidigare period_end-rader för samma period (för att undvika duplikater)
    await sb.from("gsc_queries").delete().eq("client_id", clientId).eq("period_end", period_end);
    if (rows.length) await sb.from("gsc_queries").insert(rows);

    await logActivity(clientId, "gsc_synced", `GSC synkad: ${rows.length} sökord (${days} dagar)`, "/dashboard/seo");
    return NextResponse.json({ ok: true, rows: rows.length, period_start, period_end });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
