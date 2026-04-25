import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data, error } = await sb.from("hm_seo_keywords").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const sb = supabaseServer();
  const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ ...r, client_id: clientId }));
  const { data, error } = await sb.from("hm_seo_keywords").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(clientId, "keyword_added", `${rows.length} sökord tillagda`);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const { id, ...rest } = body;
  const sb = supabaseServer();
  const update: Record<string, unknown> = { ...rest };
  if (rest.current_rank !== undefined) {
    update.last_checked = new Date().toISOString();
    const { data: existing } = await sb.from("hm_seo_keywords").select("best_rank").eq("id", id).eq("client_id", clientId).single();
    const best = existing?.best_rank;
    const cur = rest.current_rank;
    if (cur && (!best || cur < best)) update.best_rank = cur;
  }
  const { data, error } = await sb.from("hm_seo_keywords").update(update).eq("id", id).eq("client_id", clientId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const clientId = await getActiveClientId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { error } = await sb.from("hm_seo_keywords").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
