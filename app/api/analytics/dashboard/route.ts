import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// Samlad analytics-dashboard for aktiv klient.
// Period-stod: 7/14/30/90 dagar.
// Returnerar: KPIs, position-distribution, quick-wins, top-keywords, top-pages, traffic.
export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const days = Math.max(1, Math.min(180, Number(req.nextUrl.searchParams.get("days") || 30)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const sinceDate = since.slice(0, 10);

  const [gsc, visits, keywords, audits, client, brand, gscMeta] = await Promise.all([
    // GSC-data ar aggregerad per period_end (en rad per sokfras for hela perioden).
    // Vi laser ALLTID senaste synken — period-valjaren i UI styr SYNK-perioden.
    sb.from("gsc_queries").select("query, page, clicks, impressions, ctr, position, period_start, period_end").eq("client_id", clientId).limit(2000),
    sb.from("hm_visits").select("path, ts, referrer, is_returning, page_load_ms, screen_w").eq("client_id", clientId).gte("ts", since).limit(5000),
    sb.from("hm_seo_keywords").select("id, keyword, target_url, current_rank, best_rank, search_volume").eq("client_id", clientId),
    sb.from("hm_seo_audits").select("id, url, seo_score, aeo_score, audited_at").eq("client_id", clientId).order("audited_at", { ascending: false }).limit(10),
    sb.from("clients").select("name, public_url").eq("id", clientId).maybeSingle(),
    sb.from("hm_brand_profile").select("company_name").eq("client_id", clientId).maybeSingle(),
    sb.from("gsc_queries").select("imported_at, period_start, period_end").eq("client_id", clientId).order("imported_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  type GscRow = { query: string; page: string | null; clicks: number; impressions: number; ctr: number | string; position: number | string };
  type VisitRow = { path: string; ts: string; referrer: string | null; is_returning: boolean | null; page_load_ms: number | null; screen_w: number | null };

  const gscRows: GscRow[] = (gsc.data ?? []) as GscRow[];
  const visitRows: VisitRow[] = (visits.data ?? []) as VisitRow[];

  // Aggregera per query (en sokfras kan ha flera page-rader)
  const byQuery = new Map<string, { query: string; clicks: number; impressions: number; positionSum: number; positionN: number; pages: Map<string, number>; topPage: string | null }>();
  for (const r of gscRows) {
    const k = r.query;
    if (!byQuery.has(k)) byQuery.set(k, { query: k, clicks: 0, impressions: 0, positionSum: 0, positionN: 0, pages: new Map(), topPage: null });
    const e = byQuery.get(k)!;
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    const pos = Number(r.position) || 0;
    if (pos > 0) {
      e.positionSum += pos * r.impressions;
      e.positionN += r.impressions;
    }
    if (r.page) {
      e.pages.set(r.page, (e.pages.get(r.page) || 0) + r.impressions);
    }
  }
  const queries = Array.from(byQuery.values()).map((e) => {
    const topPage = Array.from(e.pages.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      query: e.query,
      clicks: e.clicks,
      impressions: e.impressions,
      avg_position: e.positionN > 0 ? Math.round((e.positionSum / e.positionN) * 10) / 10 : null,
      ctr: e.impressions > 0 ? Math.round((e.clicks / e.impressions) * 1000) / 10 : 0,
      page_count: e.pages.size,
      page: topPage,
    };
  });

  // Top pages
  const byPage = new Map<string, { page: string; clicks: number; impressions: number; queryCount: number }>();
  for (const r of gscRows) {
    if (!r.page) continue;
    if (!byPage.has(r.page)) byPage.set(r.page, { page: r.page, clicks: 0, impressions: 0, queryCount: 0 });
    const e = byPage.get(r.page)!;
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    e.queryCount++;
  }
  const topPages = Array.from(byPage.values()).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 15);

  // Position-distribution
  const positionBuckets = { top3: 0, top10: 0, top20: 0, beyond: 0, top3Imp: 0, top10Imp: 0, top20Imp: 0, beyondImp: 0 };
  for (const q of queries) {
    if (q.avg_position === null) continue;
    if (q.avg_position <= 3) { positionBuckets.top3++; positionBuckets.top3Imp += q.impressions; }
    else if (q.avg_position <= 10) { positionBuckets.top10++; positionBuckets.top10Imp += q.impressions; }
    else if (q.avg_position <= 20) { positionBuckets.top20++; positionBuckets.top20Imp += q.impressions; }
    else { positionBuckets.beyond++; positionBuckets.beyondImp += q.impressions; }
  }

  // Quick wins: position 4-15 OCH impressions >= 30 — dessa kan klattra till topp 3 lattast
  const quickWins = queries
    .filter((q) => q.avg_position !== null && q.avg_position >= 4 && q.avg_position <= 15 && q.impressions >= 30)
    .sort((a, b) => (b.impressions * (16 - (b.avg_position ?? 16))) - (a.impressions * (16 - (a.avg_position ?? 16))))
    .slice(0, 20);

  // Brand vs non-brand
  const brandTerm = (brand.data as { company_name?: string } | null)?.company_name?.toLowerCase().split(" ")[0] || (client.data as { name?: string } | null)?.name?.toLowerCase().split(" ")[0] || "";
  const slug = (client.data as { public_url?: string } | null)?.public_url?.replace(/^https?:\/\/(www\.)?/, "").split(".")[0] || "";
  const brandWords = [brandTerm, slug].filter((w) => w && w.length > 2);
  const isBrand = (q: string) => brandWords.some((w) => q.toLowerCase().includes(w));
  const brandClicks = queries.filter((q) => isBrand(q.query)).reduce((s, q) => s + q.clicks, 0);
  const brandImp = queries.filter((q) => isBrand(q.query)).reduce((s, q) => s + q.impressions, 0);
  const nonBrandClicks = queries.reduce((s, q) => s + q.clicks, 0) - brandClicks;
  const nonBrandImp = queries.reduce((s, q) => s + q.impressions, 0) - brandImp;

  // Trafik over tid (per dag)
  const trafficByDay = new Map<string, number>();
  for (const v of visitRows) {
    const d = v.ts.slice(0, 10);
    trafficByDay.set(d, (trafficByDay.get(d) || 0) + 1);
  }
  const trafficSeries = Array.from(trafficByDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([d, c]) => ({ date: d, visits: c }));

  // Top paths fran egen pixel
  const byPath = new Map<string, number>();
  const refMap = new Map<string, number>();
  for (const v of visitRows) {
    if (v.path) byPath.set(v.path, (byPath.get(v.path) || 0) + 1);
    if (v.referrer) {
      try {
        const h = new URL(v.referrer).hostname.replace(/^www\./, "");
        if (h) refMap.set(h, (refMap.get(h) || 0) + 1);
      } catch {}
    }
  }
  const topPaths = Array.from(byPath.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ path: k, visits: n }));
  const topReferrers = Array.from(refMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ host: k, visits: n }));

  // KPI:er
  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const totalImp = queries.reduce((s, q) => s + q.impressions, 0);
  const avgPosition = queries.length > 0
    ? Math.round((queries.filter((q) => q.avg_position !== null).reduce((s, q) => s + (q.avg_position ?? 0), 0) / Math.max(1, queries.filter((q) => q.avg_position !== null).length)) * 10) / 10
    : null;
  const avgPageLoad = visitRows.length > 0
    ? Math.round((visitRows.filter((v) => v.page_load_ms !== null).reduce((s, v) => s + (v.page_load_ms ?? 0), 0) / Math.max(1, visitRows.filter((v) => v.page_load_ms !== null).length)))
    : null;
  const returningCount = visitRows.filter((v) => v.is_returning === true).length;
  const mobileCount = visitRows.filter((v) => v.screen_w !== null && v.screen_w < 768).length;

  const meta = gscMeta.data as { imported_at: string | null; period_start: string | null; period_end: string | null } | null;
  const gscDays = meta?.period_start && meta?.period_end
    ? Math.round((new Date(meta.period_end).getTime() - new Date(meta.period_start).getTime()) / 86400000)
    : null;

  return NextResponse.json({
    period: { days, since: sinceDate, until: new Date().toISOString().slice(0, 10) },
    client: client.data,
    gsc_last_sync: meta ? { imported_at: meta.imported_at, period_start: meta.period_start, period_end: meta.period_end, days: gscDays } : null,
    kpi: {
      visits: visitRows.length,
      visits_returning: returningCount,
      visits_mobile_pct: visitRows.length > 0 ? Math.round((mobileCount / visitRows.length) * 100) : 0,
      avg_page_load_ms: avgPageLoad,
      gsc_clicks: totalClicks,
      gsc_impressions: totalImp,
      gsc_ctr: totalImp > 0 ? Math.round((totalClicks / totalImp) * 1000) / 10 : 0,
      gsc_avg_position: avgPosition,
      gsc_keyword_count: queries.length,
      tracked_keywords: (keywords.data ?? []).length,
      audits: (audits.data ?? []).length,
    },
    position_distribution: positionBuckets,
    brand_split: { brand: { clicks: brandClicks, impressions: brandImp }, non_brand: { clicks: nonBrandClicks, impressions: nonBrandImp } },
    quick_wins: quickWins,
    queries_top: queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 50),
    queries_all_count: queries.length,
    top_pages: topPages,
    traffic_series: trafficSeries,
    top_paths: topPaths,
    top_referrers: topReferrers,
    tracked_keywords: keywords.data ?? [],
    recent_audits: audits.data ?? [],
  });
}
