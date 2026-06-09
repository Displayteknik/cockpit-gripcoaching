import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// GET /api/fordon/sales-stats — antal sålda fordon denna månad / i år / totalt + senaste.
export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

  const count = async (from?: string) => {
    let q = sb
      .from("client_activity")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("type", "vehicle_sold");
    if (from) q = q.gte("created_at", from);
    const { count: c } = await q;
    return c || 0;
  };

  const [month, year, total, recent] = await Promise.all([
    count(startMonth),
    count(startYear),
    count(),
    sb
      .from("client_activity")
      .select("title, created_at, meta")
      .eq("client_id", clientId)
      .eq("type", "vehicle_sold")
      .order("created_at", { ascending: false })
      .limit(5)
      .then((r) => r.data || []),
  ]);

  return NextResponse.json({ month, year, total, recent });
}
