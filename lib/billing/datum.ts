// BETAL-1 — ren räknelogik för avtal. INGA imports, varken databas eller Next.
//
// Ligger i egen fil av ett skäl: adminvyn ska kunna visa "nästa betalning blir 15 augusti"
// MEDAN Håkan skriver, utan att spara först. Då måste samma funktioner kunna köras i
// webbläsaren, och lib/billing/avtal.ts drar in service-role-klienten.
//
// En andra uppsättning datumfunktioner för klienten vore värre: förr eller senare hade de
// två sagt olika saker, och kunden hade fått en faktura på ett annat datum än vyn lovade.

export type Intervall = "manad" | "kvartal" | "ar" | "engang";
export type Betalsatt = "stripe" | "faktura" | "swish" | "annat";
export type AvtalStatus = "aktiv" | "pausad" | "avslutad";
export type Kalla = "manuell" | "stripe";

export const INTERVALL_TEXT: Record<Intervall, string> = {
  manad: "Varje månad",
  kvartal: "Var tredje månad",
  ar: "En gång om året",
  engang: "Engångsbelopp",
};

export const BETALSATT_TEXT: Record<Betalsatt, string> = {
  stripe: "Kort via Stripe",
  faktura: "Faktura",
  swish: "Swish",
  annat: "Annat",
};

export const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Nästa förfallodatum efter ett givet datum.
 *
 * Månadsskiften hanteras genom att klampa dagen: ett avtal som startade den 31 januari
 * förfaller den 28 februari, inte den 3 mars. Utan klampningen glider datumet framåt
 * för varje period och kunden får till slut fakturan i fel månad.
 */
export function laggTill(datum: string, intervall: Intervall): string {
  const d = new Date(`${datum}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return datum;
  const dag = d.getUTCDate();
  const manader = intervall === "manad" ? 1 : intervall === "kvartal" ? 3 : intervall === "ar" ? 12 : 0;
  if (!manader) return datum;

  const mal = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + manader, 1));
  const sistaIMalmanad = new Date(Date.UTC(mal.getUTCFullYear(), mal.getUTCMonth() + 1, 0)).getUTCDate();
  mal.setUTCDate(Math.min(dag, sistaIMalmanad));
  return iso(mal);
}

/**
 * Rullar fram ett passerat datum till det FÖRSTA som ligger i framtiden. Idempotent och
 * säker att köra ofta — den hoppar över hur många missade perioder som helst utan att
 * skriva historik.
 */
export function rullaFram(nasta: string, intervall: Intervall, idag: string = iso(new Date())): string {
  if (intervall === "engang") return nasta;
  let d = nasta;
  let varv = 0;
  while (d < idag && varv < 600) {
    const nästa = laggTill(d, intervall);
    if (nästa === d) break; // ogiltigt datum, gå inte i loop
    d = nästa;
    varv++;
  }
  return d;
}

/** Dagar kvar till ett datum. Negativt = passerat. */
export function dagarTill(datum: string | null, idag: string = iso(new Date())): number | null {
  if (!datum) return null;
  const mal = new Date(`${datum}T00:00:00Z`).getTime();
  if (Number.isNaN(mal)) return null;
  return Math.round((mal - new Date(`${idag}T00:00:00Z`).getTime()) / 86400000);
}

/** "Om 12 dagar", "Imorgon", "Idag", "3 dagar försenad". */
export function nastaBetalningKlartext(datum: string | null, idag?: string): string {
  const d = dagarTill(datum, idag);
  if (d === null) return "Inget datum satt";
  if (d < 0) return `${Math.abs(d)} ${Math.abs(d) === 1 ? "dag" : "dagar"} försenad`;
  if (d === 0) return "Idag";
  if (d === 1) return "Imorgon";
  return `Om ${d} dagar`;
}

/** Beloppet per period. Ett fritt belopp på avtalet vinner alltid över planens pris. */
export function periodbelopp(avtal: { belopp_sek: number | null }, plan: { belopp_sek: number } | null): number {
  const eget = Number(avtal.belopp_sek);
  if (Number.isFinite(eget) && eget > 0) return eget;
  return Number(plan?.belopp_sek) || 0;
}

/** Normaliserat till en månad, så kvartals- och årsavtal kan summeras med månadsavtal. */
export function manadsvarde(belopp: number, intervall: Intervall): number {
  if (intervall === "manad") return belopp;
  if (intervall === "kvartal") return belopp / 3;
  if (intervall === "ar") return belopp / 12;
  return 0; // engångsbelopp är inte återkommande intäkt
}

export function medMoms(beloppExMoms: number, momssats: number): number {
  return Math.round(beloppExMoms * (1 + momssats / 100) * 100) / 100;
}

/** Långt svenskt datum: "15 augusti 2026". Tom sträng när datumet saknas. */
export function langtDatum(datum: string | null): string {
  if (!datum) return "";
  const d = new Date(`${datum}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
