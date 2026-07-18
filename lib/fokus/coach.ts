// Fokusmotorn AI-coach — REN logik (delas av endpoint + tester). Modellanropet ligger i
// app/api/fokus/coach/route.ts. Här: datakontrakt (§4.2), systemprompt (§4.3),
// schemavalidering + regelbaserad fallback (§6). Inga sidoeffekter, allt testbart.
import type { ScoredCard } from "./types";

export interface Verksamhet {
  namn: string;
  erbjudande: string;
  typisk_affar: string;
  ton: string;
  sprak: string;
}

export interface Aktivitet {
  datum: string;
  typ: string;
  notering: string;
}

export interface Datakontrakt {
  verksamhet: Verksamhet;
  case: {
    kontakt: string;
    foretag: string;
    bransch_kund: string;
    steg: string;
    dagar_i_steget: number;
    sla: number | null;
    varde: number;
    kalla: string;
    historik: Aktivitet[];
    tidigare_coachrad: unknown[];
  };
  anvandarens_fraga: string | null;
}

export interface CoachSvar {
  lagesbild: string;
  disc_hypotes: string;
  drag: { vad: string; varfor: string; oppning: string };
  utkast: { kanal: "telefon" | "mejl" | "sms"; amnesrad: string | null; text: string };
  riskflagga: string | null;
  nasta_kontroll: number;
}

/** Generisk fallback-verksamhet. Byts per tenant ur klientens brand-profil i routen. */
export const DEFAULT_VERKSAMHET: Verksamhet = {
  namn: "din verksamhet",
  erbjudande: "dina produkter och tjänster",
  typisk_affar: "varierande ordervärde",
  ton: "rak, varm, professionell, inga floskler",
  sprak: "svenska",
};

/** Bygg datakontraktet ur ett kort + historik (spec §4.2). */
export function buildDatakontrakt(
  kort: ScoredCard,
  verksamhet: Verksamhet,
  historik: Aktivitet[] = [],
  fraga: string | null = null,
  tidigareCoachrad: unknown[] = [],
): Datakontrakt {
  return {
    verksamhet,
    case: {
      kontakt: kort.namn,
      foretag: kort.foretag,
      bransch_kund: "",
      steg: kort.stegNamn,
      dagar_i_steget: kort.dagarISteget,
      sla: kort.sla,
      varde: kort.varde,
      kalla: "",
      historik,
      tidigare_coachrad: tidigareCoachrad,
    },
    anvandarens_fraga: fraga,
  };
}

/** Systemprompten ordagrant ur spec §4.3, med tonprofil inflätad. */
export function byggSystemprompt(v: Verksamhet): string {
  return `Du är en erfaren säljcoach inbyggd i ett säljverktyg. Din användare är ${v.namn} som säljer ${v.erbjudande}. Typisk affär: ${v.typisk_affar}. All kommunikation sker på ${v.sprak} och i den här tonen: ${v.ton}.

DIN UPPGIFT
Du får ett säljcase med full historik. Du ska hjälpa användaren att flytta affären ETT konkret steg framåt — idag. Inte ge en föreläsning. Inte lista alternativ i onödan. Du är den kollega som sett tusen affärer och säger "gör så här, och säg så här".

SÅ ANALYSERAR DU (internt, visa inte stegen)
1. Var i köpresan är kunden känslomässigt? (nyfiken / jämför / tvekar / har glömt / undviker) — läs det ur tempot i historiken, inte bara stegen.
2. DISC-hypotes ur beteendedata: svarar snabbt och kort = trolig D (var rak, ge beslutsunderlag). Frågar mycket om detaljer/drift = trolig C (ge fakta, riskreducering, referenser). Varm och relationell = trolig I/S (bygg relation, förenkla beslutet, ta bort press). Markera alltid hypotesen som just en hypotes.
3. Vad är det verkliga hindret? Tystnad efter offert betyder oftast en av: priset kändes fel / beslutet involverar fler personer / behovet var inte akut / offerten var svår att förstå. Välj den mest sannolika ur historiken och adressera DEN, inte alla fyra.
4. Vilket enskilt drag har högst sannolikhet att skapa rörelse inom 48 h? Ring slår mejl när det gått mer än en påminnelse. Ett mejl med en enda fråga slår ett mejl med tre. En deadline med ärlig anledning slår en konstlad rabatt.

REGLER FÖR DINA RÅD
- Alltid specifikt för DETTA case. Använd namn, siffror och detaljer ur historiken. Skriver du något som passar vilket case som helst har du misslyckats.
- Ett (1) rekommenderat drag. Nämn max ett alternativ, och bara om casen genuint kan gå två vägar.
- Utkast skrivs i användarens ton, kort (mejl max 90 ord, sms max 30), slutar alltid i EN tydlig fråga eller ETT tydligt nästa steg.
- Hitta aldrig på fakta om kunden, produkten eller priser. Saknas något viktigt: säg det, och ge rådet villkorat ("Om priset var stötestenen: ...").
- Föreslå aldrig rabatt som första verktyg. Värde, tydlighet och deadline kommer först. Rabatt föreslås bara om historiken visar uttalad prisinvändning, och då alltid i utbyte mot något (snabbare beslut, större order, referens).
- Var ärlig om döda affärer. Ser caset dött ut: säg det, och ge ett värdigt break-up-mejl som ofta väcker liv i tysta affärer — och annars frigör tid.
- Etik: inga manipulativa knep, ingen falsk brådska, inga påhittade "andra intressenter". Förtroende är användarens viktigaste tillgång.

SVARSFORMAT (alltid exakt denna JSON, inget annat)
{
  "lagesbild": "1–2 meningar. Vad som troligen pågår hos kunden just nu.",
  "disc_hypotes": "En mening.",
  "drag": { "vad": "Imperativ mening.", "varfor": "1–2 meningar som förklarar logiken så användaren lär sig.", "oppning": "Exakt formulering att inleda samtalet/mejlet med." },
  "utkast": { "kanal": "telefon | mejl | sms", "amnesrad": "endast vid mejl", "text": "Färdig text i användarens ton. Vid telefon: punktmanus, max 5 punkter." },
  "riskflagga": "En mening om största risken med draget, eller null.",
  "nasta_kontroll": 3
}`;
}

/** Validera modellsvar mot schemat (spec §6). Returnerar fel-lista (tom = giltigt). */
export function validateCoachSvar(obj: unknown): string[] {
  const fel: string[] = [];
  const o = obj as Record<string, unknown>;
  if (!o || typeof o !== "object") return ["svaret är inte ett objekt"];
  if (typeof o.lagesbild !== "string" || !o.lagesbild) fel.push("lagesbild saknas");
  if (typeof o.disc_hypotes !== "string") fel.push("disc_hypotes saknas");
  const d = o.drag as Record<string, unknown> | undefined;
  if (!d || typeof d.vad !== "string" || typeof d.varfor !== "string" || typeof d.oppning !== "string")
    fel.push("drag ofullständig (vad/varfor/oppning)");
  const u = o.utkast as Record<string, unknown> | undefined;
  if (!u || !["telefon", "mejl", "sms"].includes(u.kanal as string)) fel.push("utkast.kanal ogiltig");
  if (!u || typeof u.text !== "string" || !u.text) fel.push("utkast.text saknas");
  if (o.riskflagga !== null && typeof o.riskflagga !== "string") fel.push("riskflagga måste vara text eller null");
  if (!Number.isInteger(o.nasta_kontroll)) fel.push("nasta_kontroll måste vara heltal");
  return fel;
}

/** Regelbaserad fallback — användaren ser aldrig ett trasigt svar (spec §6). */
export function fallbackRad(kort: ScoredCard): CoachSvar {
  const dott = kort.dagarOverSla >= 15;
  return {
    lagesbild: kort.lagesText + ".",
    disc_hypotes: "Ingen AI-hypotes tillgänglig — regelbaserat råd.",
    drag: {
      vad: kort.rekommenderatDrag + ".",
      varfor: dott
        ? "Affären har legat still länge. En sista tydlig kontakt väcker ofta liv i den — annars frigör den din tid."
        : "Nästa konkreta steg utifrån var affären står just nu.",
      oppning: dott
        ? `Hej ${kort.namn.split(" ")[0] || ""}, jag vill inte tjata — men jag stänger hellre affären än lämnar den öppen. Är det fortfarande aktuellt?`
        : `Hej ${kort.namn.split(" ")[0] || ""}, jag hör av mig om ${kort.stegNamn.toLowerCase()}.`,
    },
    utkast: {
      kanal: dott ? "mejl" : "telefon",
      amnesrad: dott ? "Ska jag stänga eller hålla den öppen?" : null,
      text: kort.rekommenderatDrag + ".",
    },
    riskflagga: null,
    nasta_kontroll: dott ? 7 : 3,
  };
}

/** Robust JSON-extraktion (modeller kan slå in svaret i ```json … ```). */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const kandidat = fence ? fence[1] : text;
  const start = kandidat.indexOf("{");
  const slut = kandidat.lastIndexOf("}");
  if (start === -1 || slut === -1) return null;
  try {
    return JSON.parse(kandidat.slice(start, slut + 1));
  } catch {
    return null;
  }
}
