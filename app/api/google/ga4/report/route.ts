import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = await getActiveClientId();
  const days = parseInt(req.nextUrl.searchParams.get("days") || "28");

  const sb = supabaseServer();
  const { data: conn } = await sb.from("google_connections").select("ga_property_id").eq("client_id", clientId).maybeSingle();
  if (!conn?.ga_property_id) return NextResponse.json({ error: "Välj GA4-property först" }, { status: 400 });

  try {
    const token = await getValidAccessToken(clientId);
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${conn.ga_property_id}:runReport`;

    async function run(body: object) {
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }

    const dateRange = { startDate: `${days}daysAgo`, endDate: "today" };

    const [overview, channels, topPages, devices] = await Promise.all([
      run({
        dateRanges: [dateRange],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "conversions" }],
      }),
      run({
        dateRanges: [dateRange],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "conversions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "10",
      }),
      run({
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "10",
      }),
      run({
        dateRanges: [dateRange],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
      }),
    ]);

    const pickRow = (data: { rows?: { metricValues: { value: string }[] }[] }, idx = 0) => data.rows?.[0]?.metricValues?.[idx]?.value;
    const mapRows = <T extends string>(data: { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }, dimNames: T[], metricNames: string[]) =>
      (data.rows || []).map((r) => {
        const o: Record<string, string | number> = {};
        dimNames.forEach((d, i) => { o[d] = r.dimensionValues[i].value; });
        metricNames.forEach((m, i) => { o[m] = parseFloat(r.metricValues[i].value); });
        return o;
      });

    return NextResponse.json({
      days,
      overview: {
        active_users: parseInt(pickRow(overview, 0) || "0"),
        sessions: parseInt(pickRow(overview, 1) || "0"),
        page_views: parseInt(pickRow(overview, 2) || "0"),
        avg_session_duration: parseFloat(pickRow(overview, 3) || "0"),
        bounce_rate: parseFloat(pickRow(overview, 4) || "0"),
        conversions: parseFloat(pickRow(overview, 5) || "0"),
      },
      channels: mapRows(channels, ["channel"], ["sessions", "conversions"]),
      top_pages: mapRows(topPages, ["page"], ["page_views", "avg_session_duration"]),
      devices: mapRows(devices, ["device"], ["sessions"]),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
