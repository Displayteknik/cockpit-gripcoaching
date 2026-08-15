import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { beslutaLank } from "@/lib/driv/matchning";

export const runtime = "nodejs";

// POST { id, beslut: "bekraftad" | "avvisad" } — Håkans klick på en föreslagen koppling.
// Beslutet är permanent (1A): en avvisad koppling föreslås aldrig igen.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  const beslut = b.beslut === "bekraftad" || b.beslut === "avvisad" ? b.beslut : null;
  if (!id || !beslut) return NextResponse.json({ error: "id och beslut krävs" }, { status: 400 });

  const ok = await beslutaLank(id, beslut, "owner");
  if (!ok) return NextResponse.json({ error: "Kunde inte spara beslutet. Försök igen." }, { status: 200 });
  return NextResponse.json({ ok: true });
}
