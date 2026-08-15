import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaHqGhl } from "@/lib/hq/pipeline";
import { skapaNotering } from "@/lib/driv/ghl";

export const runtime = "nodejs";

// POST { ghlContactId, text } — text eller Prata in-transkribering (klienten återanvänder
// samma röstflöde som Fokus-kortets "Coacha affären", se CoachContextInput).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const ghlContactId = String(b.ghlContactId || "");
  const text = String(b.text || "").trim();
  if (!ghlContactId || !text) return NextResponse.json({ error: "ghlContactId och text krävs" }, { status: 400 });

  const cfg = await hamtaHqGhl();
  if (!cfg) return NextResponse.json({ error: "Ingen koppling till MySales är inlagd för Displayteknik." }, { status: 200 });

  const resultat = await skapaNotering(cfg, ghlContactId, text);
  if (!resultat.ok) return NextResponse.json({ error: resultat.fel }, { status: 200 });
  return NextResponse.json({ ok: true });
}
