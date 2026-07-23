import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachGhl, resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/lobby/sync { id } — skjut en lobby-kontakt till MySales (GHL): upsert
// kontakt + skapa opportunity i kvalificerings-steget + anteckning. Porterad från
// Coachens ghl-sync.ts men token hämtas SERVER-SIDE via bryggan (klienten skickar
// aldrig token). Sparar ghl_contact_id + status='passed' → "Öppna i MySales" blir
// en direktlänk. GHL-write sker vid Håkans knapptryck (server), aldrig från terminal.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let b: { id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 403 });

  const sb = supabaseService();
  const { data: contact } = await sb
    .from("lobby_contacts")
    .select("id, name, company, email, phone, last_message, next_step, notes")
    .eq("id", b.id)
    .in("user_id", ids)
    .maybeSingle();
  if (!contact) return NextResponse.json({ error: "Kontakten finns inte" }, { status: 404 });

  const { token, locationId } = await resolveCoachGhl(clientId);
  if (!token) return NextResponse.json({ error: "GHL-token saknas för klientens Coach-koppling" }, { status: 400 });

  const isV2 = token.startsWith("eyJ") || token.startsWith("pit-");
  const BASE = isV2 ? "https://services.leadconnectorhq.com" : "https://rest.gohighlevel.com/v1";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };

  const nameParts = (contact.name || "").trim().split(" ");
  const firstName = nameParts[0] || contact.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  // ── 1. Upsert kontakt ───────────────────────────────────────────────────────
  const contactPayload: Record<string, unknown> = {
    firstName, lastName,
    tags: ["MySales Coach", "Lobby"],
    source: "MySales Coach",
  };
  if (locationId) contactPayload.locationId = locationId;
  if (contact.company) contactPayload.companyName = contact.company;
  if (contact.email) contactPayload.email = contact.email;
  if (contact.phone) contactPayload.phone = contact.phone;

  let ghlContactId: string | null = null;
  let contactExisted = false;
  try {
    const res = await fetch(isV2 ? `${BASE}/contacts/upsert` : `${BASE}/contacts/`, {
      method: "POST", headers, body: JSON.stringify(contactPayload),
    });
    if (res.ok) {
      const d = await res.json();
      ghlContactId = d?.contact?.id ?? d?.id ?? null;
      contactExisted = d?.new === false;
    } else {
      const txt = await res.text();
      return NextResponse.json({ error: `GHL-fel ${res.status}: ${txt.slice(0, 160)}` }, { status: 502 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Nätverksfel mot GHL", detail: String(err).slice(0, 160) }, { status: 500 });
  }
  if (!ghlContactId) return NextResponse.json({ error: "Kunde inte skapa/hitta kontakt i GHL" }, { status: 502 });

  // ── 2. Hitta pipeline + kvalificerings-steg ─────────────────────────────────
  let pipelineId: string | null = null;
  let stageId: string | null = null;
  try {
    const purl = isV2 && locationId
      ? `${BASE}/opportunities/pipelines?locationId=${locationId}`
      : `${BASE}/pipelines/`;
    const pr = await fetch(purl, { headers });
    if (pr.ok) {
      const pd = await pr.json();
      const pipelines: Array<{ id: string; stages: Array<{ id: string; name: string }> }> = pd?.pipelines ?? pd ?? [];
      outer: for (const p of pipelines) {
        for (const s of p.stages ?? []) {
          if (s.name.toLowerCase().includes("kvalif")) { pipelineId = p.id; stageId = s.id; break outer; }
        }
      }
      if (!pipelineId && pipelines.length) { pipelineId = pipelines[0].id; stageId = pipelines[0].stages?.[0]?.id ?? null; }
    }
  } catch { /* best-effort */ }

  // ── 3. Skapa opportunity (skippa om kontakten redan fanns) ──────────────────
  let opportunityId: string | null = null;
  if (pipelineId && !contactExisted) {
    try {
      const oppPayload: Record<string, unknown> = {
        name: `${contact.name}${contact.company ? ` — ${contact.company}` : ""}`,
        contactId: ghlContactId,
        pipelineId,
        status: "open",
      };
      if (stageId) oppPayload.pipelineStageId = stageId;
      if (isV2 && locationId) oppPayload.locationId = locationId;
      const or = await fetch(`${BASE}/opportunities/`, { method: "POST", headers, body: JSON.stringify(oppPayload) });
      if (or.ok) { const od = await or.json(); opportunityId = od?.opportunity?.id ?? od?.id ?? null; }
    } catch { /* best-effort */ }
  }

  // ── 4. Anteckning med kontext ───────────────────────────────────────────────
  try {
    const noteText = [
      "Källa: MySales Coach (Lobbyn)",
      contact.last_message ? `Ärende: ${String(contact.last_message).slice(0, 300)}` : "",
      contact.next_step ? `Nästa steg: ${contact.next_step}` : "",
      contact.notes ? `Anteckningar: ${String(contact.notes).slice(0, 200)}` : "",
    ].filter(Boolean).join("\n");
    await fetch(`${BASE}/contacts/${ghlContactId}/notes/`, { method: "POST", headers, body: JSON.stringify({ body: noteText }) });
  } catch { /* best-effort */ }

  // ── 5. Spegla i lobby-raden: passad + ghl_contact_id för deeplink ───────────
  await sb.from("lobby_contacts")
    .update({ status: "passed", ghl_contact_id: ghlContactId, updated_at: new Date().toISOString() })
    .eq("id", contact.id)
    .in("user_id", ids);

  // MySales är white-label GHL: customers/detail (INTE contacts/detail), /location/ utan /v2.
  const mysalesUrl = locationId
    ? `https://app.mysales.se/location/${locationId}/customers/detail/${ghlContactId}`
    : null;

  return NextResponse.json({ success: true, ghlContactId, opportunityId, contactExisted, mysalesUrl });
}
