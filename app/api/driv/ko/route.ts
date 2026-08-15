import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { hamtaKo, agerraKoRad } from "@/lib/driv/ko";

export const runtime = "nodejs";
export const maxDuration = 120; // möten körs igenom AI-frågeförslag, kan ta en stund första gången idag

// GET ?tvinga=1 — dagens kö. Beräknas första gången den efterfrågas per dag, cachas sedan.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const tvinga = req.nextUrl.searchParams.get("tvinga") === "1";
    const { rader, redanBeraknad } = await hamtaKo(tvinga);
    return NextResponse.json({ rader, redanBeraknad });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 200 });
  }
}

// POST { id, beslut: "klar" | "senare_idag" | "vecka" }
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const beslut = ["klar", "senare_idag", "vecka"].includes(b.beslut) ? b.beslut : null;
  if (!id || !beslut) return NextResponse.json({ error: "id och beslut krävs" }, { status: 400 });

  const resultat = await agerraKoRad(id, beslut);
  if (!resultat.ok) return NextResponse.json({ error: resultat.fel }, { status: 200 });
  return NextResponse.json({ ok: true });
}
