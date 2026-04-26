import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb
    .from("scheduled_posts")
    .select("*, hm_social_posts(hook, caption, format, platform, image_url, slides)")
    .eq("client_id", clientId)
    .order("scheduled_at", { ascending: true });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const { post_id, scheduled_at, platform } = await req.json();
  if (!post_id || !scheduled_at) return NextResponse.json({ error: "post_id + scheduled_at krävs" }, { status: 400 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("scheduled_posts").insert({
    client_id: clientId,
    social_post_id: post_id,
    platform: platform || "instagram",
    scheduled_at,
    status: "queued",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity(clientId, "post_scheduled", `Inlägg schemalagt: ${new Date(scheduled_at).toLocaleString("sv-SE")}`, "/dashboard/scheduler");
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const clientId = await getActiveClientId();
  const { id, ...rest } = await req.json();
  const sb = supabaseServer();
  const { data, error } = await sb.from("scheduled_posts").update(rest).eq("id", id).eq("client_id", clientId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const clientId = await getActiveClientId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  await sb.from("scheduled_posts").delete().eq("id", id).eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
