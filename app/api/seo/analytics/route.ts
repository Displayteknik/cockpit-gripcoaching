import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since1 = new Date(now - day).toISOString();
  const since7 = new Date(now - 7 * day).toISOString();
  const since30 = new Date(now - 30 * day).toISOString();

  const [c1, c7, c30, topPaths, topRefs, recent] = await Promise.all([
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", since1),
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", since7),
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", since30),
    sb.from("hm_visits").select("path").eq("client_id", clientId).gte("ts", since30).limit(5000),
    sb.from("hm_visits").select("referrer").eq("client_id", clientId).gte("ts", since30).limit(5000).not("referrer", "is", null),
    sb.from("hm_visits").select("path, ts, referrer").eq("client_id", clientId).order("ts", { ascending: false }).limit(20),
  ]);

  const counter = (arr: { [k: string]: string }[] | null, key: string) => {
    const map = new Map<string, number>();
    for (const r of arr || []) {
      const v = (r[key] || "").toString();
      if (!v) continue;
      map.set(v, (map.get(v) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ key: k, count: n }));
  };

  return NextResponse.json({
    visits_24h: c1.count || 0,
    visits_7d: c7.count || 0,
    visits_30d: c30.count || 0,
    top_paths: counter(topPaths.data as { path: string }[] | null, "path"),
    top_referrers: counter(topRefs.data as { referrer: string }[] | null, "referrer"),
    recent: recent.data || [],
  });
}
