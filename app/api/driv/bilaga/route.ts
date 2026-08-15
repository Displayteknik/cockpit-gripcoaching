import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaKoppling, agarToken } from "@/lib/hq/kalender";
import { hamtaBilagelista, hamtaBilagaData } from "@/lib/driv/gmail";

export const runtime = "nodejs";

// GET ?id=<gmail-message-id> — hämtar mejlets FÖRSTA bilaga live och strömmar tillbaka
// den. 1C: bilagen lagras ingenstans, samma engångsvisning som hela mejlkroppen redan har.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  try {
    const koppling = await hamtaKoppling();
    if (!koppling) return NextResponse.json({ error: "Google är inte kopplat." }, { status: 200 });
    const token = await agarToken();

    const bilagor = await hamtaBilagelista(token, id);
    if (!bilagor.length) return NextResponse.json({ error: "Ingen bilaga hittades på det mejlet." }, { status: 200 });
    const forsta = bilagor[0];

    const data = await hamtaBilagaData(token, id, forsta.attachmentId);
    if (!data) return NextResponse.json({ error: "Kunde inte hämta bilagan från Gmail just nu." }, { status: 200 });

    return new NextResponse(new Blob([new Uint8Array(data)]), {
      headers: {
        "Content-Type": forsta.mimeType,
        // inline = öppnas i fliken (t.ex. PDF-läsaren), inte ett tvingat nedladdningspaket.
        "Content-Disposition": `inline; filename="${forsta.filnamn.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
