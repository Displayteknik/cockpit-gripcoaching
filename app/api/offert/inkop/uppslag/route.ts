import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { slaUpp } from "@/lib/offert/inkopsdata";

export const runtime = "nodejs";

// GET /api/offert/inkop/uppslag?nyckel=...&antal=5
// Landad kostnad i leverantörens valuta för en produkt vid ett offererat antal, med källhänvisning.
// Saknas fraktpriset returneras det som saknat — aldrig som en nolla, aldrig som en uppskattning.
// Är antalet inte offererat returneras trapporna som finns — aldrig en omräkning.
// Svaret innehåller ALDRIG SEK: växelkurs och påslag hör till O-2.

export async function GET(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sp = new URL(req.url).searchParams;

  const nyckel = (sp.get("nyckel") || "").trim();
  if (!nyckel) return NextResponse.json({ error: "nyckel krävs (produktnyckel, aldrig modellnr)" }, { status: 400 });

  const rått = sp.get("antal");
  const antal = rått === null ? 1 : Number(rått);
  if (!Number.isInteger(antal) || antal <= 0) {
    return NextResponse.json({ error: "antal måste vara ett positivt heltal" }, { status: 400 });
  }

  return NextResponse.json(await slaUpp(clientId, nyckel, antal));
}
