import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { byggForslag, godkannStadning } from "@/lib/driv/stadning";

export const runtime = "nodejs";

// GET — förslagslistan (läser bara). POST — godkänn (kan vara en justerad delmängd av
// samma lista) och skapa uppgifterna i MySales.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const forslag = await byggForslag();
    return NextResponse.json({ forslag });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
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
