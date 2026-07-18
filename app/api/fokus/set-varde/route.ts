import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachGhl } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BASE = "https://services.leadconnectorhq.com";

// POST /api/fokus/set-varde { oppId, varde } — KONTROLLERAD write mot GHL (bara monetaryValue).
// Hämtar opp, skriver tillbaka den med enbart värdet ändrat, uppdaterar sedan spegeln så
// prioriteringen slår om direkt. Token hämtas server-side via bryggan (läcker aldrig till klient).
// Sker enbart via kundens knapptryck i /k/fokus.
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: { oppId?: string; varde?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const { oppId, varde } = body;
  if (!oppId || typeof varde !== "number" || varde < 0)
    return NextResponse.json({ error: "oppId och varde (>=0) krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const { ids, token, locationId } = await resolveCoachGhl(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Ingen GHL-token" }, { status: 400 });

  const gh = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" };
  let loc = locationId;
  if (!loc && token.startsWith("pit-")) {
    const r = await fetch(`${BASE}/oauth/installedLocations`, { headers: gh });
    if (r.ok) {
      const d = await r.json();
      const l = d?.locations?.find((x: { isInstalled: boolean }) => x.isInstalled) ?? d?.locations?.[0];
      loc = l?.id ?? l?._id ?? "";
    }
  }

  // 1. Hämta nuvarande opp (så vi kan skriva tillbaka utan att tappa obligatoriska fält).
  const g = await fetch(`${BASE}/opportunities/${oppId}`, { headers: gh });
  if (!g.ok)
    return NextResponse.json({ error: `GHL GET ${g.status}`, detail: (await g.text()).slice(0, 300) }, { status: 200 });
  const o = (await g.json())?.opportunity;
  if (!o) return NextResponse.json({ error: "Opp ej hittad i GHL" }, { status: 200 });

  // 2. PUT tillbaka med ENBART monetaryValue ändrat.
  // OBS: GHL:s update-schema är strikt (forbidNonWhitelisted) — locationId i body ger 422.
  const put: Record<string, unknown> = {
    pipelineId: o.pipelineId,
    name: o.name,
    pipelineStageId: o.pipelineStageId,
    status: o.status,
    monetaryValue: varde,
  };
  const p = await fetch(`${BASE}/opportunities/${oppId}`, { method: "PUT", headers: gh, body: JSON.stringify(put) });
  if (!p.ok)
    return NextResponse.json({ error: `GHL PUT ${p.status}`, detail: (await p.text()).slice(0, 300) }, { status: 200 });

  // 3. Uppdatera DB-spegeln (alla tenant-speglar) direkt — GHL är sanningen, visa den nu.
  const sb = supabaseService();
  await sb
    .from("fokus_opportunities")
    .update({ varde, updated_at: new Date().toISOString() })
    .in("tenant_id", ids)
    .eq("ghl_opportunity_id", oppId);

  return NextResponse.json({ ok: true, varde });
}
