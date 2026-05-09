import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Hamtar score-trend per klient + typ over senaste N dagarna fran agent_experiments.
// Anvands av /dashboard/agents.
export async function GET(req: NextRequest) {
  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get("days") || 14)));
  const clientId = req.nextUrl.searchParams.get("client_id");

  const sb = supabaseServer();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  let q = sb
    .from("agent_experiments")
    .select("client_id, type, winner_score, runner_up_score, spread, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregera per type
  const byType: Record<string, { type: string; runs: number; avg_score: number; avg_spread: number; latest: string | null }> = {};
  for (const r of data || []) {
    const k = (r as { type: string }).type;
    if (!byType[k]) byType[k] = { type: k, runs: 0, avg_score: 0, avg_spread: 0, latest: null };
    byType[k].runs++;
    byType[k].avg_score += (r as { winner_score: number | null }).winner_score ?? 0;
    byType[k].avg_spread += (r as { spread: number | null }).spread ?? 0;
    const ts = (r as { created_at: string }).created_at;
    if (!byType[k].latest || ts > byType[k].latest!) byType[k].latest = ts;
  }
  for (const k of Object.keys(byType)) {
    byType[k].avg_score = Math.round(byType[k].avg_score / Math.max(1, byType[k].runs));
    byType[k].avg_spread = Math.round(byType[k].avg_spread / Math.max(1, byType[k].runs));
  }

  return NextResponse.json({
    days,
    total_runs: (data || []).length,
    by_type: Object.values(byType).sort((a, b) => b.runs - a.runs),
    recent: (data || []).slice(0, 50),
  });
}
