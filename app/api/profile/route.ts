import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sb = supabaseService();
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
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[api/profile] PUT ogiltig body:", (e as Error).message);
    return NextResponse.json({ error: "Kunde inte läsa det som skulle sparas. Försök igen." }, { status: 400 });
  }
  delete body.id;
  delete body.client_id;
  const sb = supabaseService();

  // Säkerställ att rad finns
  const existing = await sb.from("hm_brand_profile").select("client_id").eq("client_id", clientId).maybeSingle();
  if (!existing.data) {
    const { data, error } = await sb.from("hm_brand_profile").insert({ ...body, client_id: clientId }).select().single();
    if (error) {
      console.error("[api/profile] PUT insert misslyckades:", error.message, "client:", clientId);
      return NextResponse.json({ error: "Kunde inte spara profilen. Försök igen om en stund." }, { status: 500 });
    }
    return NextResponse.json(data);
  }
  const { data, error } = await sb
    .from("hm_brand_profile")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) {
    console.error("[api/profile] PUT update misslyckades:", error.message, "client:", clientId);
    return NextResponse.json({ error: "Kunde inte spara profilen. Försök igen om en stund." }, { status: 500 });
  }
  return NextResponse.json(data);
}
