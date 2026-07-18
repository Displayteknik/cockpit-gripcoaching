import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

// Grafisk profil (brand kit) per klient. Admin-grindad av proxy.ts. Strikt RLS → service-role.

// GET /api/brand-kit — { kit, clientPrimary, clientName }
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    return NextResponse.json({
      kit: data?.kit || {},
      clientPrimary: client?.primary_color || "#1A6B3C",
      clientName: client?.name || "",
      publicUrl: client?.public_url || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT /api/brand-kit — { kit } → sparar/uppdaterar klientens kit
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const kit = b.kit;
    if (!kit || typeof kit !== "object") return NextResponse.json({ error: "kit krävs" }, { status: 400 });

    const sb = supabaseService();
    const { error } = await sb.from("studio_brand_kits").upsert(
      { client_id: clientId, kit, source: b.source || "manual", updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
