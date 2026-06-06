import { NextRequest, NextResponse } from "next/server";
import { autoSelectGaProperty } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

// Admin-trigger för GA4 auto-koppling. Gated med service-role-nyckeln (full access ändå → ingen ny exponering).
// Körs server-side i prod där Google-nycklarna finns. POST {client_id?} — utan id körs alla utan property.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key || auth !== `Bearer ${key}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
