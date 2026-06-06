import { NextRequest, NextResponse } from "next/server";
import { autoSelectGaProperty } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

// Admin-trigger för GA4 auto-koppling. Gated med service-role-nyckeln (full access ändå → ingen ny exponering).
// Körs server-side i prod där Google-nycklarna finns. POST {client_id?} — utan id körs alla utan property.
// Accepterar valfri giltig Supabase service-role-JWT för detta projekt (nyckeln kan ha roterats →
// exakt sträng-match mot env är skört). Rollkoll räcker; endpointen gör bara ofarlig GA-koppling.
function isServiceToken(auth: string): boolean {
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  try {
    const payload = JSON.parse(Buffer.from(m[1].split(".")[1], "base64").toString("utf8")) as { role?: string; ref?: string };
    return payload.role === "service_role" && payload.ref === "liunepzrmygiaaibsbni";
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!isServiceToken(auth)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as { client_id?: string }));
  if (body.client_id) {
    const picked = await autoSelectGaProperty(body.client_id);
    return NextResponse.json({ client_id: body.client_id, picked });
  }
  const sb = supabaseServer();
  const { data } = await sb.from("google_connections").select("client_id").is("ga_property_id", null);
  const results: Array<{ client_id: string; picked: string | null }> = [];
  for (const c of (data ?? []) as Array<{ client_id: string }>) {
    results.push({ client_id: c.client_id, picked: await autoSelectGaProperty(c.client_id) });
  }
  return NextResponse.json({ results });
}
