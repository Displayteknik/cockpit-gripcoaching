// GA4 Data API — auktoritativ trafik/kanal/AI-data för dashboarden.
// Använder klientens anslutna ga_property_id. Returnerar null om GA4 ej kopplat.
import { supabaseServer } from "./supabase-admin";
import { getValidAccessToken } from "./google";

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

// Källor som räknas som AI-sökmotorer (substräng-match mot sessionSource).
const AI_SOURCES = [
  "chatgpt", "chat.openai", "openai.com", "perplexity", "gemini.google", "copilot",
  "bard.google", "you.com", "claude.ai", "poe.com", "phind.com", "neeva",
];

export interface Ga4Summary {
  property_id: string;
  sessions: number;
  users: number;
  newUsers: number;
  engagedSessions: number;
  engagementRate: number; // 0-100
  avgSessionSec: number;
  pageviews: number;
  channels: Array<{ channel: string; sessions: number }>;
  ai: { sessions: number; sources: Array<{ source: string; sessions: number }> };
  daily: Array<{ date: string; sessions: number }>;
}

type Row = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };

export async function getGa4Summary(clientId: string, days: number): Promise<Ga4Summary | null> {
  try {
    const sb = supabaseServer();
    const { data: conn } = await sb.from("google_connections").select("ga_property_id").eq("client_id", clientId).maybeSingle();
    const propertyId = conn?.ga_property_id as string | undefined;
    if (!propertyId) return null;

    const token = await getValidAccessToken(clientId);
    const range = { startDate: `${Math.max(1, days)}daysAgo`, endDate: "today" };

    const run = async (body: Record<string, unknown>): Promise<Row[]> => {
      const r = await fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dateRanges: [range], ...body }),
      });
      if (!r.ok) return [];
      const j = (await r.json()) as { rows?: Row[] };
      return j.rows || [];
    };

    // 1. Totaler
    const totalsRows = await run({ metrics: [
      { name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" },
      { name: "engagedSessions" }, { name: "averageSessionDuration" }, { name: "screenPageViews" },
    ] });
    const tv = totalsRows[0]?.metricValues?.map((m) => Number(m.value || 0)) || [0, 0, 0, 0, 0, 0];
    const [sessions, users, newUsers, engagedSessions, avgDur, pageviews] = tv;

    // 2. Kanaler
    const chRows = await run({ dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 20 });
    const channels = chRows.map((r) => ({ channel: r.dimensionValues?.[0]?.value || "Okänd", sessions: Number(r.metricValues?.[0]?.value || 0) }));

    // 3. Källor → AI-segment
    const srcRows = await run({ dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 50 });
    const aiSources = srcRows
      .map((r) => ({ source: r.dimensionValues?.[0]?.value || "", sessions: Number(r.metricValues?.[0]?.value || 0) }))
      .filter((s) => AI_SOURCES.some((ai) => s.source.toLowerCase().includes(ai)));
    const aiSessions = aiSources.reduce((sum, s) => sum + s.sessions, 0);

    // 4. Daglig serie
    const dayRows = await run({ dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }], orderBys: [{ dimension: { dimensionName: "date" } }], limit: 200 });
    const daily = dayRows.map((r) => {
      const d = r.dimensionValues?.[0]?.value || "";
      const iso = d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;
      return { date: iso, sessions: Number(r.metricValues?.[0]?.value || 0) };
    });

    return {
      property_id: propertyId,
      sessions, users, newUsers, engagedSessions,
      engagementRate: sessions > 0 ? Math.round((engagedSessions / sessions) * 1000) / 10 : 0,
      avgSessionSec: Math.round(avgDur),
      pageviews,
      channels,
      ai: { sessions: aiSessions, sources: aiSources },
      daily,
    };
  } catch {
    return null;
  }
}
