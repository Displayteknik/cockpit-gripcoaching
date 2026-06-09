import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { verifyAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

// POST /api/fordon/mark-sold  { id, sold }
// Markerar fordon sålt/till salu. Loggar en "vehicle_sold"-händelse vid övergång → sålt
// (för säljräknaren). Admin-only.
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!secret || !(await verifyAdminSession(token, secret))) {
    return NextResponse.json({ error: "ej inloggad" }, { status: 401 });
  }

  const clientId = await getActiveClientId();
  const { id, sold } = await req.json();
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const { data: v } = await sb
    .from("hm_vehicles")
    .select("title, price, is_sold")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!v) return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });

  const { error } = await sb.from("hm_vehicles").update({ is_sold: !!sold }).eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Logga som sälj bara vid övergång till sålt (inte vid återställning eller dubbelklick).
  if (sold && !v.is_sold) {
    await logActivity(clientId, "vehicle_sold", v.title || "Fordon", "/dashboard/fordon", {
      price: v.price ?? null,
      via: "manual",
    });
  }
  return NextResponse.json({ ok: true });
}
