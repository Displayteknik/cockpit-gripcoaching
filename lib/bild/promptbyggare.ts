// EN BILDPROMPTBYGGARE FÖR HELA PLATTFORMEN — BILD-10 v2 (Håkans beställning 13/8).
//
// ★ K0 MÄTTE PROBLEMET: bildprompter byggdes på NIO ställen och de delade reglerna i
//   `lib/images.ts` nådde TVÅ av dem. Tre följder, alla synliga i DT-karusellen:
//
//   1. MOTIVMONOTONI. Rotationen (BILD-9, `nyligenMotiv`) skickas bara från
//      `/api/social/generate-image`, alltså legacy-vägen. Studios `suggest-image`, som
//      karusellen faktiskt anropar, har aldrig sett den. Samma mönster som G-6, där
//      bildfeedbacken bara lästes av legacy.
//   2. BILDEN BEVISAR INGENTING. Karusellen skickar 220 tecken text per slide och inget
//      annat: ingen position, ingen kunskap om systerslidesen, ingen härledd poäng.
//      "Hårdvara som inte håller" fick en intakt skärm, för ingen frågade vad bilden
//      skulle bevisa.
//   3. SKÄRMINNEHÅLL. Regeln fanns och nådde fram, men den säger "visar ett foto eller
//      produkten, aldrig text" — och en tallrik mat ÄR ett foto. Regeln var uppfylld och
//      bilden ändå fel.
//
// Reglerna K1 till K4 bor HÄR och ingen annanstans. Samma beslut som den delade
// länkupptäckten i RAPPORT-1, och av samma skäl: två implementationer glider isär.

import { getKitDirectives, imageDirectiveSuffix, type KitDirectives } from "@/lib/studio/kit";
import { supabaseService } from "@/lib/supabase-admin";

export type BildSyfte = "singel" | "karusell-slide" | "blogg-omslag" | "reel-scen" | "legacy";

export interface BildUppdrag {
  clientId: string;
  /** Branschen i klartext. Styr rekvisita- och personkategorier. */
  niche: string;
  syfte: BildSyfte;
  /** Innehållets rubrik. Underlag för bevismeningen. */
  rubrik?: string;
  /** Innehållets brödtext. Underlag för bevismeningen. */
  brodtext?: string;
  /** Position i en serie (karusell, veckoplan). Styr person- och perspektivrotationen. */
  serie?: { index: number; antal: number };
  /** Färdig scenbeskrivning när flödet redan har en. Saknas den härleds motivet ur texten. */
  scen?: string;
}

export interface ByggdBildPrompt {
  /** Hela prompten, redo att skickas till bildmodellen. */
  prompt: string;
  /** K2: vad bilden ska bevisa. Loggas per bild i generationsloggen. */
  bevismening: string;
  /** K3: vilken person-/perspektivkategori bilden fick. Loggas per bild. */
  personkategori: string;
  /** K1: rekvisitaregeln som gällde, och varifrån den kom. */
  rekvisita: { regel: string; kalla: "profil" | "branschdefault" };
}

// ── K1 · REKVISITA OCH MILJÖREGLER ───────────────────────────────────────────
//
// Fältet bor i `studio_brand_kits.kit.rekvisita` (JSONB, ingen migration behövs) och är
// därmed redigerbart av owner via brand-kit-ytan. Saknas det används branschdefaulten
// nedan, som är avsiktligt konkret: en vag regel styr ingenting.
//
// ⚠ MODELLBEGRÄNSNINGEN ÄR INBAKAD I FORMULERINGEN. BILD-10 (10/8) stängde av
//   `DEPICTED_MESSAGE_EN` för att bildmodellen inte kan stava svenska: AluCon fick skylten
//   "HÄLLBARA PROFILER FÖR FRAMITDEN". Rekvisitareglerna beställer därför LAYOUT, aldrig
//   läsbara ord: block, rubrikrad som form, prisruta som geometri, sett på avstånd eller i
//   vinkel. Det ger rätt intryck utan att beställa bokstäver som blir fel.

const REKVISITA_DEFAULT: { monster: RegExp; regel: string }[] = [
  {
    monster: /skylt|signage|display|led|skärm|storformat|av-teknik/i,
    regel:
      "Screens and displays in the scene show believable CAMPAIGN LAYOUT, not a photograph filling the whole panel: " +
      "a strong headline band across the top, a product or dish area, and a clear price or offer block. " +
      "Render these as shapes, colour blocks and blurred text-like bands seen at an angle or from a distance, never as sharp readable words. " +
      "Never a loose stock photograph (food, landscape, animals) covering the entire screen.",
  },
  {
    monster: /terapi|coach|hälsa|friskvård|massage|yoga|psykolog|samtal/i,
    regel:
      "Props and setting carry credibility for care work: a calm treatment room or meeting space, two chairs turned towards each other, " +
      "soft daylight, a folded blanket, plants, a water glass, a notebook closed on the table. " +
      "Never clinical hospital equipment, never crystals or mystic symbols unless the business itself works with them, never an empty stylised studio.",
  },
  {
    monster: /bilhandel|verkstad|fordon|motor|däck/i,
    regel:
      "Props and setting are a real workshop or forecourt: tools in use, lifted vehicle, service desk, keys, protective gloves. " +
      "Vehicles are clean but used, never showroom-perfect renders. Price signage appears as layout blocks, never as readable words.",
  },
  {
    monster: /blomm|florist|bageri|café|restaurang|butik|handel/i,
    regel:
      "Props and setting are the real shop floor: goods on display, hands preparing or wrapping, counter, packaging, seasonal materials in use. " +
      "Signage and menu boards show layout only: a headline band and a price block as shapes, never readable words.",
  },
  {
    monster: /bygg|hantverk|trädgård|träd|anläggning|entreprenad/i,
    regel:
      "Props and setting are the real job site: correct protective gear, the actual machine or tool mid-task, material stacked, weather and ground visible. " +
      "Never a staged studio shot of a tool on a white background.",
  },
];

const REKVISITA_GENERELL =
  "Props and setting belong to this business's real working environment: the actual room, the actual tools or goods, and people using them as they would on a normal day. " +
  "Anything shown as content on a screen, sign or board is layout only: colour blocks and a headline band as shapes, never sharp readable words, and never a decorative stock photograph filling the surface.";

export function branschRekvisita(niche: string): string {
  for (const r of REKVISITA_DEFAULT) if (r.monster.test(niche)) return r.regel;
  return REKVISITA_GENERELL;
}

/** Läser owner-fältet ur brand-kitet. Tomt fält betyder branschdefault, inte "ingen regel". */
export async function hamtaRekvisita(clientId: string, niche: string): Promise<ByggdBildPrompt["rekvisita"]> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    const eget = String(((data?.kit || {}) as Record<string, unknown>).rekvisita ?? "").trim();
    if (eget) return { regel: eget, kalla: "profil" };
  } catch {
    /* fail-open: en trasig läsning får aldrig stoppa en bild */
  }
  return { regel: branschRekvisita(niche), kalla: "branschdefault" };
}

// ── K2 · BEVISMENINGEN ───────────────────────────────────────────────────────
//
// Innan motivet bestäms besvaras frågan "vad ska bilden BEVISA?". Meningen styr scenen och
// loggas per bild, så en dålig bild går att spåra till en dålig fråga.
//
// Härledningen är deterministisk och kostar ingenting: den läser rubrikens egen laddning.
// En modell hade formulerat vackrare, men den hade också kostat ett anrop per slide och
// gått att skylla på. Det här går att mäta.

interface Bevismonster { monster: RegExp; mall: (amne: string) => string }

const BEVIS_MONSTER: Bevismonster[] = [
  { monster: /går sönder|håller inte|slutar fungera|trasig|fel på|kraschar|driftstopp/i,
    mall: (a) => `visible failure in ${a}: a dead section, a fault, or damage that a customer would notice` },
  { monster: /för svag|för mörk|syns inte|urblekt|ljusstyrka|solljus|bländ/i,
    mall: (a) => `${a} washed out and barely legible in harsh daylight, next to one that is clearly readable` },
  { monster: /dyr|kostnad|pris|billig|spara|lönsam|investering/i,
    mall: (a) => `the real, everyday use of ${a} that makes the money back, shown in ordinary working conditions` },
  { monster: /gammal|föråldrad|omodern|sliten|tidsenlig/i,
    mall: (a) => `a worn, dated example of ${a} beside a current one, so the difference is obvious` },
  { monster: /snabb|tid|väntar|kö|effektiv|hinner/i,
    mall: (a) => `${a} in the moment where time is actually saved: someone moving on without waiting` },
  { monster: /trygg|säker|garanti|kvalitet|hållbar|tålig/i,
    mall: (a) => `${a} standing up to real conditions: weather, wear, or heavy use, with the person relying on it` },
  { monster: /lugn|stress|återhämt|balans|sömn|nervsystem|andning/i,
    mall: (a) => `the calm state ${a} leads to, shown in body language and setting, never as a symbol or metaphor` },
  { monster: /börja|första steget|komma igång|nybörjare|prova/i,
    mall: (a) => `the very first, low-threshold step of ${a}, small enough that it looks doable` },
];

/** Kortar en rubrik till ett ämne som går att sätta in i en mening. */
function amnetUr(rubrik: string, brodtext: string): string {
  const kalla = (rubrik || brodtext || "").replace(/\s+/g, " ").trim();
  const utanFraga = kalla.replace(/[?!.]+$/, "");
  return utanFraga.slice(0, 90) || "the subject of the post";
}

export function harledBevismening(rubrik?: string, brodtext?: string): string {
  const text = `${rubrik ?? ""} ${brodtext ?? ""}`;
  const amne = amnetUr(rubrik ?? "", brodtext ?? "");
  for (const b of BEVIS_MONSTER) if (b.monster.test(text)) return b.mall(amne);
  // Ingen träff: bilden ska ändå bevisa något, och det säkraste allmänna beviset är
  // verklig användning. Aldrig en symbol, aldrig en metafor.
  return `real, specific use of ${amne} in this business's own environment, so the claim is visibly true`;
}

// ── K3 · PERSON- OCH PERSPEKTIVROTATION ──────────────────────────────────────
//
// Motivrotationen (BILD-9) sa "variera" men nådde bara legacy-vägen. Den här dimensionen
// DELAS UT i stället för att önskas, precis som tonlägena i TON-1: bilder i en serie
// genereras parallellt och kan inte se varandra, så variationen måste vara deterministisk.
//
// Kategorierna formuleras POSITIVT. Modeller hanterar negationer dåligt: "ingen man vid
// skärmen" ger en man vid skärmen.

const PERSON_KATEGORIER_GENERELL = [
  "a woman working in the real environment, hands visibly engaged in the task",
  "no people at all: the room, the product and the light carry the picture",
  "close crop on the product or surface itself, no human figure in frame",
  "a customer or client seen from behind or in profile, attention on the thing",
  "a man in work clothing, used at most once in a series",
];

const PERSON_KATEGORIER: { monster: RegExp; kategorier: string[] }[] = [
  {
    monster: /skylt|signage|display|led|skärm|storformat/i,
    kategorier: [
      "a woman in a retail or public setting looking at the screen, attention clearly on it",
      "no people: the screen in its real environment, seen from a distance so the room is readable",
      "close crop on the screen surface itself, no human figure in frame",
      "a customer stopping in front of the screen, seen from behind over the shoulder",
      "a man in work clothing installing or servicing, used at most once in a series",
    ],
  },
  {
    monster: /terapi|coach|hälsa|friskvård|massage|yoga|samtal/i,
    kategorier: [
      "the practitioner alone in the room, preparing the space before a session",
      "no people: the empty treatment room in daylight, chairs and blanket ready",
      "close crop on hands, a cup, or the fabric of the chair, no faces",
      "a client seen from behind or in soft profile, face not identifiable",
      "two people in conversation seen at a respectful distance, used at most once in a series",
    ],
  },
];

export function personKategorier(niche: string): string[] {
  for (const p of PERSON_KATEGORIER) if (p.monster.test(niche)) return p.kategorier;
  return PERSON_KATEGORIER_GENERELL;
}

/**
 * Delar ut kategori på position i serien. Samma kategori kan aldrig komma två gånger i
 * rad, och en femslidesserie får minst tre olika.
 */
export function personKategoriFor(niche: string, index: number): string {
  const k = personKategorier(niche);
  return k[((index % k.length) + k.length) % k.length];
}

// ── K4 · LJUSVAKTEN ──────────────────────────────────────────────────────────
//
// Universell regel. En underexponerad bild är inte stämningsfull, den är oanvändbar: motivet
// måste synas även i ett litet flödesformat på en telefon i dagsljus.
export const LJUSVAKT_EN =
  "EXPOSURE: the main subject must be clearly and unmistakably visible. Expose for the subject, not for mood. " +
  "No silhouettes, no near-black frames, no scene so dim or backlit that the subject cannot be made out at thumbnail size. " +
  "Dark or evening settings are allowed only when the subject itself remains clearly lit and readable.";

// ── Byggaren ─────────────────────────────────────────────────────────────────

export interface BildPromptDelar {
  scen: string;
  bevismening: string;
  rekvisita: string;
  personkategori: string;
  kitSuffix: string;
}

/** Sätter ihop delarna i den ordning som mätts fungera. Exporterad för test. */
export function fogaSamman(d: BildPromptDelar): string {
  return [
    d.scen.trim(),
    `WHAT THE PICTURE MUST PROVE: ${d.bevismening}. Build the whole composition around this. If the scene does not show it, change the scene.`,
    `PROPS AND SETTING: ${d.rekvisita}`,
    `PEOPLE AND VIEWPOINT: ${d.personkategori}. Follow this exactly, it varies deliberately between the pictures in a series.`,
    LJUSVAKT_EN,
    "Real photograph, natural light, no readable text anywhere in the image.",
    d.kitSuffix.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

export async function byggBildPrompt(u: BildUppdrag): Promise<ByggdBildPrompt> {
  const bevismening = harledBevismening(u.rubrik, u.brodtext);
  const rekvisita = await hamtaRekvisita(u.clientId, u.niche);
  const personkategori = personKategoriFor(u.niche, u.serie?.index ?? 0);

  let kit: KitDirectives | null = null;
  try {
    kit = await getKitDirectives(u.clientId);
  } catch {
    /* fail-open: kitet är en förstärkning, inte ett villkor */
  }

  const prompt = fogaSamman({
    scen: u.scen ?? `A photograph for a ${u.niche} business about: ${amnetUr(u.rubrik ?? "", u.brodtext ?? "")}.`,
    bevismening,
    rekvisita: rekvisita.regel,
    personkategori,
    kitSuffix: kit ? imageDirectiveSuffix(kit) : "",
  });

  return { prompt, bevismening, personkategori, rekvisita };
}
