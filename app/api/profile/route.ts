import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  let { data, error } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();
  if (!data && !error) {
    // Skapa tom om saknas
    const ins = await sb.from("hm_brand_profile").insert({ client_id: clientId }).select().single();
    data = ins.data;
    error = ins.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  delete body.id;
  delete body.client_id;
  const sb = supabaseServer();

  // Säkerställ att rad finns
  const existing = await sb.from("hm_brand_profile").select("client_id").eq("client_id", clientId).maybeSingle();
  if (!existing.data) {
    const { data, error } = await sb.from("hm_brand_profile").insert({ ...body, client_id: clientId }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const { data, error } = await sb
    .from("hm_brand_profile")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
