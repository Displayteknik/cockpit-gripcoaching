import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const allowed = [
      "hook",
      "caption",
      "cta",
      "hashtags",
      "image_url",
      "slides",
      "scheduled_for",
      "status",
      "format",
      "platform",
    ];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const sb = supabaseService();
    const { data, error } = await sb
      .from("hm_social_posts")
      .update(patch)
      .eq("id", id)
      .eq("client_id", clientId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const sb = supabaseService();
    const { error } = await sb
      .from("hm_social_posts")
      .delete()
      .eq("id", id)
      .eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
