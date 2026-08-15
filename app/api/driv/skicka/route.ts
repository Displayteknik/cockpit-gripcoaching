import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaHqGhl } from "@/lib/hq/pipeline";
import { hamtaKoppling, kopplingsScope, agarToken } from "@/lib/hq/kalender";
import { skickaSvar } from "@/lib/driv/gmail";
import { skickaGhlMeddelande } from "@/lib/driv/ghl";

export const runtime = "nodejs";

// POST { ghlContactId, text, svar: SvarsData } — skickar i EXAKT den kanal/tråd svaret
// hör till. Aldrig kanalväxling, aldrig autoskick: klienten kräver redan ett aktivt
// klick + en bekräftelserad (mottagare+kanal) innan den här routen ens anropas.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const ghlContactId = String(b.ghlContactId || "");
  const text = String(b.text || "").trim();
  const svar = b.svar;
  if (!ghlContactId || !text || !svar) return NextResponse.json({ error: "ghlContactId, text och svar krävs" }, { status: 400 });

  try {
    if (svar.kanal === "gmail") {
      const scope = await kopplingsScope();
      if (!scope) return NextResponse.json({ error: "Google är inte kopplat." }, { status: 200 });
      if (!scope.harGmailSend) {
        return NextResponse.json({
          error: "Google-kopplingen saknar behörighet att skicka mejl (gmail.send). Koppla om Google under Founder HQ så följer den med.",
        }, { status: 200 });
      }
      const koppling = await hamtaKoppling();
      if (!koppling?.email) return NextResponse.json({ error: "Google-kopplingen saknar en e-postadress att skicka från." }, { status: 200 });
      const token = await agarToken();
      const svarPa = { threadId: svar.tradId, messageIdHeader: svar.messageIdHeader };
      const resultat = await skickaSvar(token, koppling.email, svar.motpart, svar.amne || "", text, svarPa);
      if (!resultat.ok) return NextResponse.json({ error: resultat.fel }, { status: 200 });
      return NextResponse.json({ ok: true, kanal: "gmail" });
    }

    if (svar.kanal === "ghl") {
      const cfg = await hamtaHqGhl();
      if (!cfg) return NextResponse.json({ error: "Ingen koppling till MySales är inlagd för Displayteknik." }, { status: 200 });
      const resultat = await skickaGhlMeddelande(cfg, ghlContactId, svar.konversationTyp, text);
      if (!resultat.ok) return NextResponse.json({ error: resultat.fel }, { status: 200 });
      return NextResponse.json({ ok: true, kanal: "ghl" });
    }

    return NextResponse.json({ error: "Okänd kanal" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
