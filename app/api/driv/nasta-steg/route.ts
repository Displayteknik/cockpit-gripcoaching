import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaHqGhl } from "@/lib/hq/pipeline";
import { sattNastaSteg } from "@/lib/driv/ghl";

export const runtime = "nodejs";

// POST { ghlContactId, titel, datum } — sätter/ändrar nästa steg. Uppdaterar den
// tidigast förfallande öppna uppgiften om en finns, annars skapar en ny (lib/driv/ghl.ts).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const ghlContactId = String(b.ghlContactId || "");
  const titel = String(b.titel || "").trim();
  const datum = String(b.datum || "");
  if (!ghlContactId || !titel || !datum) return NextResponse.json({ error: "ghlContactId, titel och datum krävs" }, { status: 400 });

  const cfg = await hamtaHqGhl();
  if (!cfg) return NextResponse.json({ error: "Ingen koppling till MySales är inlagd för Displayteknik." }, { status: 200 });

  const resultat = await sattNastaSteg(cfg, ghlContactId, titel, new Date(datum).toISOString());
  if (!resultat.ok) return NextResponse.json({ error: resultat.fel }, { status: 200 });
  return NextResponse.json({ ok: true });
}
