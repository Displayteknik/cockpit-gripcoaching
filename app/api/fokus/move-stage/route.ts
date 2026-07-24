import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachGhl } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BASE = "https://services.leadconnectorhq.com";

// POST /api/fokus/move-stage { oppId, stegId, stegNamn? } — flytta en affär till ett annat
// pipeline-steg i GHL, direkt från Fokus-kortet. Samma kontrollerade write-mönster som
// set-varde: GET opp → PUT med enbart pipelineStageId ändrat → uppdatera spegeln så
// prioriteringen slår om direkt. Token server-side via bryggan. Sker via kundens knapptryck.
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: { oppId?: string; stegId?: string; stegNamn?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const { oppId, stegId, stegNamn } = body;
  if (!oppId || !stegId) return NextResponse.json({ error: "oppId och stegId krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const { ids, token } = await resolveCoachGhl(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Ingen GHL-token" }, { status: 400 });

  const gh = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" };

  // 1. Hämta nuvarande opp (bevara obligatoriska fält vid write-back).
  const g = await fetch(`${BASE}/opportunities/${oppId}`, { headers: gh });
  if (!g.ok)
    return NextResponse.json({ error: `GHL GET ${g.status}`, detail: (await g.text()).slice(0, 300) }, { status: 200 });
  const o = (await g.json())?.opportunity;
  if (!o) return NextResponse.json({ error: "Opp ej hittad i GHL" }, { status: 200 });

  // 2. PUT tillbaka med ENBART pipelineStageId ändrat. locationId i body ger 422 (strikt schema).
  const put: Record<string, unknown> = {
    pipelineId: o.pipelineId,
    name: o.name,
    pipelineStageId: stegId,
    status: o.status,
    monetaryValue: o.monetaryValue ?? 0,
  };
  const p = await fetch(`${BASE}/opportunities/${oppId}`, { method: "PUT", headers: gh, body: JSON.stringify(put) });
  if (!p.ok)
    return NextResponse.json({ error: `GHL PUT ${p.status}`, detail: (await p.text()).slice(0, 300) }, { status: 200 });

  // 3. Uppdatera spegeln (alla tenant-speglar) — GHL är sanningen, visa den nu.
  //    steg_sedan nollställs (nytt steg = ny SLA-klocka i prioriteringen).
  const sb = supabaseService();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { steg_id: stegId, steg_sedan: now, updated_at: now };
  if (stegNamn) patch.steg_namn = stegNamn;
  await sb.from("fokus_opportunities").update(patch).in("tenant_id", ids).eq("ghl_opportunity_id", oppId);

  return NextResponse.json({ ok: true, stegId });
}
