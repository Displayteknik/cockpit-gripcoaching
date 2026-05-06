import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    if (!body.ig_username) {
      return NextResponse.json({ error: "ig_username krävs" }, { status: 400 });
    }
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_contacts")
      .insert({
        client_id: clientId,
        ig_username: String(body.ig_username).replace(/^@/, "").trim(),
        display_name: body.display_name || null,
        source: body.source || "manuell",
        source_post: body.source_post || null,
        stage: body.stage || "new",
        notes: body.notes || null,
        next_action: body.next_action || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
