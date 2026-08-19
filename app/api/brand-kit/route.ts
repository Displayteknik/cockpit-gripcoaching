import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

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
      clientPrimary: client?.primary_color || "#6B7280",
      clientName: client?.name || "",
      publicUrl: client?.public_url || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT /api/brand-kit — { kit } → sparar/uppdaterar klientens kit
//
// ★ KUNDEN FÅR SKRIVA SITT EGET KIT (Håkans beslut 2026-08-11). Tidigare fick hon LÄSA
//   (GET) men inte spara, så färgerna gick bara att ändra av Håkan. Hennes grafiska
//   profil är hennes, och den ska hon råda över.
//
// ⚠ SÄKERHETEN VILAR PÅ ATT `clientId` KOMMER FRÅN SESSIONEN, ALDRIG FRÅN ANROPET.
//   `getActiveClientId()` låser en kund-session hårt till kundens egen klient (se
//   lib/client-context.ts, gren 0 och 2). Det finns alltså ingen väg för en kund att
//   skriva i en ANNAN kunds kit — inte ens genom att peta i anropets kropp, eftersom
//   kroppen bara bär `kit`. Skulle någon i framtiden lägga till ett clientId-fält i
//   kroppen och läsa det här, är den här grinden bruten. Gör inte det.
export async function PUT(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
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
