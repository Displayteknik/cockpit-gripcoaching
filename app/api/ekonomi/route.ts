import { NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { byggInkop, fraschaApiSaldon } from "@/lib/inkop";
import { saldolarmniva, byggSaldolarmAtgard, SALDO_TROSKLAR_STANDARD, SALDOLARM_PROVIDERS, type SaldolarmProvider } from "@/lib/inkop/saldolarm";

export const runtime = "nodejs";

// KOSTNAD-2 (HELG-1 DEL 8) — /dashboard/ekonomi. En TUNN läsande vy ovanpå K3-INKÖP:s
// redan befintliga uträkning (byggInkop) — ingen ny datakälla, ingen egen mätning.
// Fokuserat på EN fråga: vad händer om ett saldo tar slut, och vad gör jag åt det nu.
// Endast huvudadmin, samma grind som /dashboard/kostnader.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await ownerGrind();
  if (denied) return denied;

  await fraschaApiSaldon().catch(() => {});
  const inkop = await byggInkop();

  const kort = inkop.rader.map((r) => {
    const arSaldolarmProvider = (SALDOLARM_PROVIDERS as readonly string[]).includes(r.provider);
    const saldoSek = r.saldo_kalla === "api" && r.saldo_valuta === "SEK" ? r.saldoSek : null;
    const saldolarmNivaVal = arSaldolarmProvider ? saldolarmniva(saldoSek, SALDO_TROSKLAR_STANDARD) : null;
    const atgard = arSaldolarmProvider && saldolarmNivaVal && saldolarmNivaVal !== "gron" && saldoSek !== null
      ? byggSaldolarmAtgard(r.provider as SaldolarmProvider, r.etikett, saldoSek, saldolarmNivaVal, "/dashboard/ekonomi")
      : null;
    return {
      provider: r.provider,
      etikett: r.etikett,
      typ: r.typ,
      saldoBelopp: r.saldo_belopp,
      saldoValuta: r.saldo_valuta,
      saldoKalla: r.saldo_kalla,
      saldoAlderDagar: r.saldoAlderDagar,
      saldoFel: r.saldo_fel,
      larmniva: r.larmniva, // K3-INKÖP:s dagar-kvar/prognos-larm (befintligt, orört)
      saldolarmniva: saldolarmNivaVal, // KOSTNAD-2:s absoluta kronorlarm (nytt)
      dagarKvar: r.dagarKvar,
      manadHittills: r.manadHittills,
      takt30PerDag: r.takt30.snittPerDag,
      rekommendationKlartext: r.rekommendation?.klartext ?? null,
      vadStannarText: atgard?.atgardstext ?? null,
      fakturalank: r.fakturalank,
      betalkortSistaFyra: r.betalkort_sista_fyra,
    };
  });

  return NextResponse.json({
    kort,
    // Två manuella påminnelser som inget API kan bekräfta eller slå på åt Håkan
    // (HELG-1 DEL 8 punkt 1) — se STATUS.md för varför.
    manuellaKontroller: [
      { text: "Anthropic: auto reload påslaget i konsolen (console.anthropic.com → Billing)", lank: "https://console.anthropic.com/settings/billing" },
    ],
  });
}
