import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaHqGhl } from "@/lib/hq/pipeline";

export const runtime = "nodejs";

const BASE = "https://services.leadconnectorhq.com";

// POST { ghlContactId, epost } — sparar en adress systemet HITTAT (aldrig gissat) på
// kontakten i MySales. Sker enbart på Håkans klick: förslaget visas med sitt belägg
// (ämne + datum ur hans egen mejlkorg) och han avgör om det är rätt person.
//
// Bara e-post. Telefonnummer föreslås inte: de finns i regel bara i hans telefon, och en
// siffra som råkar stå i en signatur är för svag grund för att skriva in i CRM:et.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => ({}));
  const ghlContactId = String(b.ghlContactId || "").trim();
  const epost = String(b.epost || "").trim().toLowerCase();
  if (!ghlContactId || !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(epost)) {
    return NextResponse.json({ error: "ghlContactId och en giltig e-postadress krävs" }, { status: 400 });
  }

  const cfg = await hamtaHqGhl();
  if (!cfg) return NextResponse.json({ error: "Ingen koppling till MySales är inlagd." }, { status: 200 });

  const r = await fetch(`${BASE}/contacts/${ghlContactId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${cfg.pit}`,
      Version: "2021-07-28",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: epost }),
  });
  if (!r.ok) {
    return NextResponse.json({ error: `MySales svarade ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: 200 });
  }
  return NextResponse.json({ ok: true, epost });
}
