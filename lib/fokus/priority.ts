// Fokusmotorn — prioriteringsmotorn. Transparent formel, ingen svart låda (spec §2).
//   prioritet = värdepoäng × brådskepoäng × stegvikt
import type { Farg, Prioritering, RawOpportunity, ScoredCard, StegTyp, TenantConfig, Zon } from "./types";

const DAY = 86_400_000;

/** Värdepoäng — logaritmisk så en jätteaffär inte dränker allt (spec §2.1). */
export function vardepoang(varde: number): number {
  if (!varde || varde <= 0) return 1.0; // okänt värde — flaggas separat (§2.4)
  if (varde <= 10_000) return 1.5;
  if (varde <= 50_000) return 2.5;
  if (varde <= 150_000) return 4.0;
  return 6.0;
}

/** Brådskepoäng + zon + färg ur dagar över SLA (spec §2.1). */
export function bradska(dagarOverSla: number, harSla: boolean): { poang: number; zon: Zon; farg: Farg } {
  if (!harSla) return { poang: 1.0, zon: "frisk", farg: "neutral" }; // t.ex. "tills mötesdatum"
  if (dagarOverSla >= 15) return { poang: 3.0, zon: "kallnar", farg: "cold" }; // §2.3 kallnar
  if (dagarOverSla >= 4) return { poang: 5.0, zon: "risk", farg: "red" };
  if (dagarOverSla >= 1) return { poang: 3.5, zon: "risk", farg: "amber" };
  if (dagarOverSla >= 0) return { poang: 2.0, zon: "risk", farg: "amber" }; // sista SLA-dagen
  return { poang: 1.0, zon: "frisk", farg: "neutral" };
}

function dagarSedan(dateStr: string | null | undefined, now: number): number {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY));
}

/** Deterministisk lägesbild ur data — alltid sann, ingen AI (spec §3.4 p.3). */
function lagesText(typ: StegTyp, dagar: number, over: number): string {
  switch (typ) {
    case "offert":
      return `Offert skickad för ${dagar} dagar sedan${over > 0 ? ", ingen rörelse sedan dess" : ""}`;
    case "mote":
      return `Möte genomfört för ${dagar} dagar sedan${over > 0 ? " — offert väntar" : ""}`;
    case "uppfoljning":
      return `I uppföljning sedan ${dagar} dagar`;
    case "kontakt":
    default:
      return `${dagar} dagar utan nästa steg`;
  }
}

/** Regelbaserat rekommenderat drag (gratis, alltid tillgängligt — spec §3.4 p.4). */
function rekommenderatDrag(typ: StegTyp, zon: Zon, okantVarde: boolean): string {
  if (okantVarde) return "Sätt ett värde på affären (gissa hellre än lämna tomt)";
  if (zon === "kallnar") return "Sista stöten eller arkivera — den blockerar toppen";
  switch (typ) {
    case "offert":
      return "Ring och fråga om offerten landat rätt";
    case "mote":
      return "Skicka offerten idag";
    case "uppfoljning":
      return "Ställ avslutsfrågan eller sätt en deadline";
    case "kontakt":
    default:
      return "Ta nästa kontakt och boka ett möte";
  }
}

/** Poängsätt ett enskilt kort. now injiceras för testbarhet. */
export function scoreCard(opp: RawOpportunity, cfg: TenantConfig, now: number): ScoredCard {
  const regel = cfg.stegMap[opp.stegId] ?? cfg.fallback;
  const dagarISteget = dagarSedan(opp.lastStageChangeAt ?? opp.updatedAt, now);
  const harSla = regel.sla !== null;
  const dagarOverSla = harSla ? dagarISteget - (regel.sla as number) : 0;
  const vp = vardepoang(opp.varde);
  const { poang: bp, zon, farg } = bradska(dagarOverSla, harSla);
  const okantVarde = !opp.varde || opp.varde <= 0;
  const prioritet = Math.round(vp * bp * regel.vikt * 10) / 10;
  return {
    id: opp.id,
    namn: opp.namn,
    foretag: opp.foretag,
    varde: opp.varde || 0,
    stegNamn: regel.namn,
    typ: regel.typ,
    dagarISteget,
    sla: regel.sla,
    dagarOverSla,
    vardepoang: vp,
    bradskepoang: bp,
    stegvikt: regel.vikt,
    prioritet,
    zon,
    farg,
    sektion: zon === "kallnar" ? "avgor" : "dagens_drag",
    okantVarde,
    ghlContactId: opp.ghlContactId,
    lagesText: lagesText(regel.typ, dagarISteget, dagarOverSla),
    rekommenderatDrag: rekommenderatDrag(regel.typ, zon, okantVarde),
  };
}

/**
 * Kör hela pipelinen → dagens_drag-vyn (spec §6). Exkluderar won/lost via steg-id
 * (status-fältet ljuger — verifierat live: vunna/förlorade står kvar som 'open').
 */
export function prioritize(opps: RawOpportunity[], cfg: TenantConfig, now: number): Prioritering {
  const oppna = opps.filter((o) => o.stegId !== cfg.wonStageId && o.stegId !== cfg.lostStageId);
  const scored = oppna.map((o) => scoreCard(o, cfg, now));

  const dagensDrag = scored
    .filter((c) => c.sektion === "dagens_drag")
    .sort((a, b) => b.prioritet - a.prioritet);
  const avgor = scored
    .filter((c) => c.sektion === "avgor")
    .sort((a, b) => b.varde - a.varde);

  const pengalinjen = { frisk: 0, risk: 0, kallnar: 0, totalt: 0 };
  for (const c of scored) {
    pengalinjen[c.zon] += c.varde;
    pengalinjen.totalt += c.varde;
  }

  return { dagensDrag, avgor, pengalinjen, antalKallnar: avgor.length };
}
