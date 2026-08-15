import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaKoppling, agarToken } from "@/lib/hq/kalender";
import { hamtaFullMeddelande } from "@/lib/driv/gmail";

export const runtime = "nodejs";

// GET /api/driv/meddelande?id=... — full Gmail-kropp, LIVE, på klick. 1C: skrivs
// ingenstans till databasen. Klienten visar den och håller den bara i minnet.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  try {
    const koppling = await hamtaKoppling();
    if (!koppling) return NextResponse.json({ error: "Google är inte kopplat." }, { status: 200 });
    const token = await agarToken();
    const meddelande = await hamtaFullMeddelande(token, id, koppling.email || "");
    if (!meddelande) return NextResponse.json({ error: "Meddelandet kunde inte hämtas." }, { status: 200 });
    return NextResponse.json(meddelande);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
