import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/clients/customer-access — hämta token + status för aktiv klient
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("clients")
      .select("customer_token, customer_access_enabled, name")
      .eq("id", clientId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      token: data.customer_token,
      enabled: data.customer_access_enabled,
      name: data.name,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PATCH — slå på/av access eller rotera token
export async function PATCH(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const sb = supabaseService();
    const patch: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") patch.customer_access_enabled = body.enabled;
    if (body.rotate_token) {
      // Rotera token genom UUID-generering — DB-funktion gen_random_uuid()
      const { data: rot } = await sb.rpc("gen_random_uuid").single();
      // Fallback: manuell UUID
      patch.customer_token =
        rot ||
        "00000000-0000-0000-0000-".concat(Math.floor(Math.random() * 1e12).toString(16).padStart(12, "0"));
    }
    const { data, error } = await sb
      .from("clients")
      .update(patch)
      .eq("id", clientId)
      .select("customer_token, customer_access_enabled")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      token: data.customer_token,
      enabled: data.customer_access_enabled,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
