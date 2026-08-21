// KOSTNAD-2 (HELG-1 DEL 8, 2026-08-21) — saldoskyddet, PUSH i stället för bara en vy.
//
// K3-INKÖP larmar redan med dagar-kvar och prognos-procent (lib/inkop/berakning.ts) —
// bra för planering, men ett konto med hög takt kan ha "gott om dagar kvar" och ändå
// stå på 90 kr om saldot i grunden är litet. Beställningen vill ha en andra, enklare
// tröskel: ett absolut kronbelopp, bara för de konton som HAR ett API-läsbart saldo
// (fal, elks46 — se lib/inkop/index.ts::HAMTARE). Anthropic och Google Cloud saknar ett
// sådant API och larmas alltså inte här; de täcks av dagars-kvar-larmet och av att
// "Anthropic auto reload" är en manuell inställning i Anthropics egen konsol, inget en
// nyckel eller ett API kan slå på åt Håkan.
//
// Rena funktioner: ingen databas, inget nätverk, `new Date()` skickas alltid in.

export type Saldolarmniva = "gron" | "varning" | "akut";

export interface SaldoTrosklar {
  varningSek: number;
  akutSek: number;
}

export const SALDO_TROSKLAR_STANDARD: SaldoTrosklar = { varningSek: 200, akutSek: 100 };

/** Bara konton med API-läsbart saldo prövas mot den absoluta kronorgränsen. */
export const SALDOLARM_PROVIDERS = ["fal", "elks46"] as const;
export type SaldolarmProvider = (typeof SALDOLARM_PROVIDERS)[number];

/**
 * Larmnivån för ETT konto, ur dess saldo i kronor.
 * null-saldo (aldrig hämtat, eller hämtningen gick fel) larmar INGET här — ett gammalt
 * eller okänt saldo är K3-INKÖP:s vy att flagga, det här larmet ska aldrig gissa att ett
 * saknat tal betyder noll kronor.
 */
export function saldolarmniva(saldoSek: number | null, trosklar: SaldoTrosklar = SALDO_TROSKLAR_STANDARD): Saldolarmniva {
  if (saldoSek === null || !Number.isFinite(saldoSek)) return "gron";
  if (saldoSek < trosklar.akutSek) return "akut";
  if (saldoSek < trosklar.varningSek) return "varning";
  return "gron";
}

const NIVA_ORDNING: Record<Saldolarmniva, number> = { gron: 0, varning: 1, akut: 2 };

/**
 * Ska ett mail/sms skickas NU, givet vilken nivå som senast skickades?
 *
 * Regeln, "max ett mail per nivå": samma nivå skickas bara EN gång, och bara en
 * ESKALERING (allvarligare än det senast skickade) triggar ett nytt larm — gron→varning,
 * varning→akut, eller gron→akut om mätningen missade ett steg. En FÖRBÄTTRING (akut→
 * varning, saldot är på väg upp igen) ska INTE trigga ett nytt "varning"-mail rakt efter
 * ett "akut"-mail — det vore förvirrande, inte hjälpsamt. Anroparen nollställer
 * `senastSkickad` helt när kontot är tillbaka på grönt, så nästa dropp under tröskeln
 * larmar från början igen.
 */
export function skaLarma(nu: Saldolarmniva, senastSkickad: Saldolarmniva | null): boolean {
  if (nu === "gron") return false;
  return NIVA_ORDNING[nu] > NIVA_ORDNING[senastSkickad ?? "gron"];
}

export interface SaldolarmAtgard {
  provider: SaldolarmProvider;
  etikett: string;
  niva: Saldolarmniva;
  saldoSek: number;
  rubrik: string;
  atgardstext: string;
  /** Direktlänk till leverantörens egen påfyllningssida. */
  paffyllningslank: string;
  ekonomiLank: string;
}

const PAFYLLNINGSLANKAR: Record<SaldolarmProvider, string> = {
  fal: "https://fal.ai/dashboard/billing",
  elks46: "https://46elks.se/mina-sidor/fakturering",
};

/**
 * Bygger den KONKRETA åtgärden ett larmmail/sms ska säga — inte bara "lågt saldo", utan
 * exakt vad som stannar och exakt var man fyller på. Beställningens krav: "exakt
 * åtgärdslista och direktlänkar".
 */
export function byggSaldolarmAtgard(
  provider: SaldolarmProvider,
  etikett: string,
  saldoSek: number,
  niva: Saldolarmniva,
  ekonomiLank: string,
): SaldolarmAtgard {
  const vadStannar = provider === "fal"
    ? "AI-genererade bilder och video (fal.ai) slutar fungera för alla kunder"
    : "SMS-larm och 2FA-koder via 46elks slutar gå fram";

  const rubrik = niva === "akut"
    ? `AKUT: ${etikett} har bara ${Math.round(saldoSek)} kr kvar`
    : `Varning: ${etikett} börjar ta slut (${Math.round(saldoSek)} kr kvar)`;

  const atgardstext = niva === "akut"
    ? `Fyll på ${etikett} NU. Tar saldot slut: ${vadStannar}.`
    : `Fyll på ${etikett} inom kort. Fortsätter förbrukningen i samma takt tar saldot slut om några dagar, och då: ${vadStannar}.`;

  return {
    provider, etikett, niva, saldoSek, rubrik, atgardstext,
    paffyllningslank: PAFYLLNINGSLANKAR[provider],
    ekonomiLank,
  };
}
