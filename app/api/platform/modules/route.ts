import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getModuleRegistry } from "@/lib/entitlements";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Admin Vy 1 — MySales Pro-standarden. GET hela registret; PATCH en modul
// (in_pro_default / kampanjfält / active). Klient-scopad admin får inte röra
// den globala Pro-uppsättningen (bara full admin).
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json(await getModuleRegistry());
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  // Global uppsättning → endast full admin (ingen scope).
  if (await getAdminScope()) return NextResponse.json({ error: "ej behörig" }, { status: 403 });

  try {
    const body = await req.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "modul-id krävs" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof body.in_pro_default === "boolean") patch.in_pro_default = body.in_pro_default;
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.campaign === "boolean") patch.campaign = body.campaign;
    if ("campaign_label" in body) patch.campaign_label = body.campaign_label ? String(body.campaign_label).slice(0, 120) : null;
    if ("campaign_until" in body) patch.campaign_until = body.campaign_until || null; // 'YYYY-MM-DD' | null
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "inget att uppdatera" }, { status: 400 });

    const sb = supabaseService();
    const { data, error } = await sb.from("platform_modules").update(patch).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
