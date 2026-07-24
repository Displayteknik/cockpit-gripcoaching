import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer, requireAdmin } from "@/lib/api-auth";
import { getCompassSchedule, type Cadence } from "@/lib/content-compass/schedule";

export const runtime = "nodejs";

// Content Compass-schema per klient. Speglar brand-kit-routen. Strikt RLS → service-role.

// GET /api/content-compass — { schedule, cadence, clientName, isDefault }
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data } = await sb.from("content_compass_schedules").select("schedule, cadence").eq("client_id", clientId).maybeSingle();
    const cc = await getCompassSchedule(clientId);
    return NextResponse.json({ schedule: cc.days, cadence: cc.cadence, clientName: client?.name || "", isDefault: !data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// PUT /api/content-compass — { schedule, cadence } → sparar per tenant
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const days = b.schedule && typeof b.schedule === "object" ? b.schedule : null;
    const cadence: Cadence = ["7", "4", "2-3"].includes(b.cadence) ? b.cadence : "7";
    if (!days) return NextResponse.json({ error: "schedule krävs" }, { status: 400 });
    const sb = supabaseService();
    const { error } = await sb.from("content_compass_schedules").upsert(
      { client_id: clientId, schedule: { days }, cadence, source: "manuell", updated_at: new Date().toISOString() },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
