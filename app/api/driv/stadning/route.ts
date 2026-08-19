import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { DT_CLIENT_ID } from "@/lib/dt-client";
import { byggForslag, godkannStadning } from "@/lib/driv/stadning";

export const runtime = "nodejs";

// GET — förslagslistan (läser bara). POST — godkänn (kan vara en justerad delmängd av
// samma lista) och skapa uppgifterna i MySales.
//
// Läckage-fix 19/8: byggForslag() är hårdkodad mot DT:s pipeline (samma mönster som
// Founder HQ och Dagens drag), inte tenant-generell. Spärras här så den inte visas
// när en annan klient är aktiv i Cockpit.
async function dtGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getActiveClientId()) !== DT_CLIENT_ID) {
    return NextResponse.json({ error: "Städa pipelinen visas bara när Displayteknik är aktiv klient." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await dtGrind();
  if (denied) return denied;
  try {
    const forslag = await byggForslag();
    return NextResponse.json({ forslag });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await dtGrind();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const rader = Array.isArray(b.rader) ? b.rader : [];
  if (!rader.length) return NextResponse.json({ error: "Inga rader att godkänna" }, { status: 400 });

  try {
    const kvitton = await godkannStadning(rader);
    return NextResponse.json({ kvitton });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}
