// MARKETPLACE-1 — tar emot authorization-koden när den privata GHL-appen installeras.
//
// ⚠ ADRESSEN FÅR INTE INNEHÅLLA "ghl". GHL:s vitmärkningsfilter vägrar spara en redirect-URL
// som bär strängen `ghl`, `highlevel`, `gohighlevel` eller `leadconnector`. Därför ligger
// routen under /api/crm/ och inte under /api/ghl/ som resten av namngivningen antyder.
// Ändras sökvägen här måste den ändras i utvecklarportalen samtidigt — de måste matcha exakt.

import { NextRequest, NextResponse } from "next/server";
import { vaxlaKod, redirectUri } from "@/lib/ghl-app";

export const runtime = "nodejs";

const MAL = "/dashboard/onboarding";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const mal = `${origin}${MAL}`;
  const code = req.nextUrl.searchParams.get("code");
  const fel = req.nextUrl.searchParams.get("error");

  if (fel) return NextResponse.redirect(`${mal}?app_fel=${encodeURIComponent(fel)}`);
  if (!code) return NextResponse.redirect(`${mal}?app_fel=ingen_kod`);

  try {
    const r = await vaxlaKod(code, redirectUri(origin));
    // Scopes GHL faktiskt gav appen skickas med i klartext — det är mätningen MP-0 inte
    // kunde göra ur rullgardinen, och den ska synas utan att någon behöver läsa en logg.
    const p = new URLSearchParams({ app_ok: "1", scopes: r.scopes ?? "okänt" });
    return NextResponse.redirect(`${mal}?${p.toString()}`);
  } catch (e) {
    return NextResponse.redirect(`${mal}?app_fel=${encodeURIComponent((e as Error).message.slice(0, 300))}`);
  }
}
