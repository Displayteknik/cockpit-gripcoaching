import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getCompassSchedule, DAY_KEYS, type DayKey } from "@/lib/content-compass/schedule";

export const runtime = "nodejs";

// PUT /api/content-compass/days — { activeDays: DayKey[] }
// Bara publiceringsdagarna. Kunden får styra sin egen takt (t.ex. 3 dagar i veckan)
// utan att komma åt själva Compass-profilen, som är byråns inställning.
export async function PUT(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const valda: DayKey[] = Array.isArray(b.activeDays)
      ? DAY_KEYS.filter((d) => (b.activeDays as string[]).includes(d)) // alltid mån→sön
      : [];
    if (valda.length === 0) return NextResponse.json({ error: "Välj minst en dag" }, { status: 400 });

    // Behåll befintlig dagprofil, byt bara ut de aktiva dagarna.
    const cc = await getCompassSchedule(clientId);
    const sb = supabaseService();
    const { error } = await sb.from("content_compass_schedules").upsert(
      {
        client_id: clientId,
        schedule: { days: cc.days, activeDays: valda },
        cadence: cc.cadence,
        source: "manuell",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, activeDays: valda });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
