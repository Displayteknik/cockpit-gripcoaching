import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { genereraUtkast } from "@/lib/driv/utkast";

export const runtime = "nodejs";

// POST { oppId, kanal: "gmail"|"ghl", motpart, amne?, senasteText } → { text }
//
// DRIV-2 "Svara": ÅTERANVÄNDER syftet "dm-svar" i prompt-core (byggt för AKUT-DM,
// dokumenterat att täcka just "DM, mejl eller kommentarsfält") i stället för att bygga
// ett parallellt "direktkommunikation"-läge. Själva genereringen bor i lib/driv/utkast.ts
// så DRIV-4:s morgonkö kan förbereda utkast vid köbygget, inte bara på klick här.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const oppId = String(b.oppId || "");
  const kanal = b.kanal === "gmail" || b.kanal === "ghl" ? b.kanal : null;
  const motpart = String(b.motpart || "").trim();
  const senasteText = String(b.senasteText || "").trim();
  if (!oppId || !kanal) return NextResponse.json({ error: "oppId och kanal krävs" }, { status: 400 });

  const resultat = await genereraUtkast({ oppId, kanal, motpart, amne: b.amne, senasteText });
  if (!resultat.text) return NextResponse.json({ error: resultat.fel || "Inget utkast kunde skapas" }, { status: 200 });
  return NextResponse.json({ text: resultat.text });
}
