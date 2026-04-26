import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("image_feedback").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const sb = supabaseServer();
  const { error } = await sb.from("image_feedback").insert({
    client_id: clientId,
    prompt: body.prompt,
    image_style: body.image_style,
    content_text: body.content_text,
    rating: body.rating,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
