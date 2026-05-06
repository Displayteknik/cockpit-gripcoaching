// lib/insights.ts — vinnande hooks/format per klient baserat på IG-metrics

import { supabaseService } from "./supabase-admin";

export interface WinningPattern {
  format: string;
  top_hooks: { hook: string; engagement_rate: number; saves: number }[];
  avg_engagement_per_format: Record<string, number>;
  best_day_of_week: string | null;
}

interface PostWithMetrics {
  id: string;
  hook: string;
  format: string;
  published_at: string | null;
  views?: number;
  likes?: number;
  saves?: number;
  shares?: number;
  reach?: number;
}

export async function getWinningPatterns(clientId: string): Promise<WinningPattern> {
  const sb = supabaseService();

  const { data: posts } = await sb
    .from("hm_social_posts")
    .select("id, hook, format, published_at")
    .eq("client_id", clientId)
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) {
    return { format: "", top_hooks: [], avg_engagement_per_format: {}, best_day_of_week: null };
  }

  // Hämta metrics per post
  const ids = posts.map((p) => (p as { id: string }).id);
  const { data: metrics } = await sb
    .from("post_metrics")
    .select("post_id, views, likes, saves, shares, reach")
    .in("post_id", ids);

  const metricsByPost = new Map<string, { views: number; likes: number; saves: number; shares: number; reach: number }>();
  for (const m of metrics || []) {
    const cur = metricsByPost.get((m as { post_id: string }).post_id) || {
      views: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      reach: 0,
    };
    metricsByPost.set((m as { post_id: string }).post_id, {
      views: Math.max(cur.views, (m as { views?: number }).views || 0),
      likes: Math.max(cur.likes, (m as { likes?: number }).likes || 0),
      saves: Math.max(cur.saves, (m as { saves?: number }).saves || 0),
      shares: Math.max(cur.shares, (m as { shares?: number }).shares || 0),
      reach: Math.max(cur.reach, (m as { reach?: number }).reach || 0),
    });
  }

  const enriched: PostWithMetrics[] = posts.map((p) => {
    const m = metricsByPost.get((p as { id: string }).id);
    return { ...(p as PostWithMetrics), ...(m || {}) };
  });

  // Engagement rate = (likes + saves*3 + shares*5) / max(reach, views, 1)
  const withRate = enriched.map((p) => {
    const denom = Math.max(p.reach || 0, p.views || 0, 1);
    const numerator = (p.likes || 0) + (p.saves || 0) * 3 + (p.shares || 0) * 5;
    return { ...p, engagement_rate: numerator / denom };
  });

  // Top 5 hooks
  const top = [...withRate]
    .filter((p) => p.engagement_rate > 0)
    .sort((a, b) => b.engagement_rate - a.engagement_rate)
    .slice(0, 5)
    .map((p) => ({
      hook: p.hook,
      engagement_rate: Math.round(p.engagement_rate * 1000) / 10, // som procent
      saves: p.saves || 0,
    }));

  // Genomsnitt per format
  const byFormat = new Map<string, { total: number; count: number }>();
  for (const p of withRate) {
    const cur = byFormat.get(p.format) || { total: 0, count: 0 };
    byFormat.set(p.format, { total: cur.total + p.engagement_rate, count: cur.count + 1 });
  }
  const avgPerFormat: Record<string, number> = {};
  for (const [f, { total, count }] of byFormat) {
    avgPerFormat[f] = Math.round((total / count) * 1000) / 10;
  }

  // Bästa dag i veckan
  const dayMap = new Map<number, { total: number; count: number }>();
  const dayNames = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
  for (const p of withRate) {
    if (!p.published_at) continue;
    const d = new Date(p.published_at).getDay();
    const cur = dayMap.get(d) || { total: 0, count: 0 };
    dayMap.set(d, { total: cur.total + p.engagement_rate, count: cur.count + 1 });
  }
  let bestDay: string | null = null;
  let bestAvg = 0;
  for (const [d, { total, count }] of dayMap) {
    const avg = total / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = dayNames[d];
    }
  }

  return {
    format: "",
    top_hooks: top,
    avg_engagement_per_format: avgPerFormat,
    best_day_of_week: bestDay,
  };
}

// Bygger en prompt-block för generatorn med vinnar-mönster
export function patternsToPromptBlock(p: WinningPattern): string {
  if (p.top_hooks.length === 0) return "";

  const lines = ["═══ KUNDENS VINNAR-MÖNSTER (lärt från historiska inlägg) ═══"];
  lines.push("Hooks som har konverterat bäst (engagement-rate %):");
  p.top_hooks.forEach((h, i) => {
    lines.push(`  ${i + 1}. (${h.engagement_rate}%, ${h.saves} sparningar) "${h.hook.slice(0, 100)}"`);
  });

  if (Object.keys(p.avg_engagement_per_format).length > 0) {
    lines.push("");
    lines.push("Format som funkar bäst:");
    Object.entries(p.avg_engagement_per_format)
      .sort((a, b) => b[1] - a[1])
      .forEach(([f, avg]) => lines.push(`  - ${f}: ${avg}% engagement-snitt`));
  }

  if (p.best_day_of_week) {
    lines.push("");
    lines.push(`Bästa dag att publicera: ${p.best_day_of_week}`);
  }

  lines.push("");
  lines.push("APPLICERA DESSA MÖNSTER — om historiken visar att fråge-hooks vinner, börja med fråga.");
  return lines.join("\n");
}
