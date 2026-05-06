import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_rules")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rules: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    if (!body.keyword || !body.response) {
      return NextResponse.json({ error: "keyword och response krävs" }, { status: 400 });
    }
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_rules")
      .insert({
        client_id: clientId,
        keyword: body.keyword.trim(),
        response: body.response.trim(),
        match_mode: body.match_mode || "contains",
        channel: body.channel || "dm",
        active: body.active !== false,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rule: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
