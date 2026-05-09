import { NextRequest, NextResponse } from "next/server";
import { queryGsc } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daglig auto-synk av GSC for ALLA anslutna klienter.
// Triggas av Vercel Cron 03:00 UTC.
// Manuellt: curl -H "Authorization: Bearer $CRON_SECRET" /api/google/gsc/cron
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const sb = supabaseServer();
  const days = Number(req.nextUrl.searchParams.get("days") || 28);

  // Hamta alla klienter med GSC-koppling
  const { data: connections } = await sb
    .from("google_connections")
    .select("client_id, gsc_site, email")
    .not("gsc_site", "is", null);

  if (!connections || connections.length === 0) {
    return NextResponse.json({ ok: true, message: "Inga GSC-anslutna klienter", duration_ms: Date.now() - t0 });
  }

  const results: Array<{ client_id: string; ok: boolean; rows?: number; error?: string }> = [];

  for (const conn of connections) {
    const clientId = (conn as { client_id: string }).client_id;
    const gscSite = (conn as { gsc_site: string }).gsc_site;
    try {
      const [byQuery, byQueryPage] = await Promise.all([
        queryGsc(clientId, gscSite, days, ["query"]),
        queryGsc(clientId, gscSite, days, ["query", "page"]),
      ]);

      const period_end = new Date().toISOString().slice(0, 10);
      const period_start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

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

      // Rensa duplicates for samma period_end
      await sb.from("gsc_queries").delete().eq("client_id", clientId).eq("period_end", period_end);
      if (rows.length) await sb.from("gsc_queries").insert(rows);

      results.push({ client_id: clientId, ok: true, rows: rows.length });
    } catch (e) {
      results.push({ client_id: clientId, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    clients_synced: results.filter((r) => r.ok).length,
    clients_failed: results.filter((r) => !r.ok).length,
    total_rows: results.reduce((s, r) => s + (r.rows ?? 0), 0),
    results,
    duration_ms: Date.now() - t0,
  });
}
