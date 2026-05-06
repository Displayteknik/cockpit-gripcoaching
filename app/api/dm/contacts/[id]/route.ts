import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const sb = supabaseService();

    const allowed: (keyof typeof body)[] = [
      "stage",
      "notes",
      "next_action",
      "next_action_at",
      "display_name",
      "ig_username",
      "source_post",
    ];
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) patch[k as string] = body[k];

    const { data, error } = await sb
      .from("cockpit_dm_contacts")
      .update(patch)
      .eq("id", id)
      .eq("client_id", clientId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
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
      .from("cockpit_dm_contacts")
      .delete()
      .eq("id", id)
      .eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
