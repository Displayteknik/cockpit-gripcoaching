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
  /** K2b: var påståendet utspelar sig, när innehållet säger det. Loggas per bild. */
  plats: string | null;
  /** K2b: när på dygnet det utspelar sig, när innehållet säger det. Loggas per bild. */
  tid: string | null;
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
    // ⚠ BILD-11 punkt 5 (Håkans skarpfynd 15/8): den förra formuleringen beställde
    //   "a strong headline band across the top" och "a clear price or offer block" och
    //   bad i samma andetag om "never sharp readable words". Modellen kan inte rita en
    //   rubrikrad utan bokstäver — den löste motsägelsen genom att skriva ord, och DT fick
    //   "FRESH-BAKED" och "KANELBULLE" i läsbar text på en avbildad skärm. Samma familj som
    //   BILD-10 och BILD-12: felet satt i BESTÄLLNINGEN, inte i grinden.
    //   Nu beställs INNEHÅLLET (köparens egen vara, fotografiskt) och layouten nämns bara
    //   som det den får vara: oskarp, sedd i vinkel, beskuren.
    regel:
      // Monteringen ligger i K5 (VERKLIGHETSVAKTEN), inte här: en snedhängd skärm och en
      // snedhängd tavla hos en terapeut är samma fel, och regeln gäller alla branscher.
      //
      // ⚠ HÅKANS RÄTTNING 15/8: "skärmar visar inte bara en bulle eller pizza sådär, det är
      //   inte relevant." Min förra lydelse bad om ett foto av köparens vara som fyllde
      //   panelen — alltså en TAVLA, inte en kampanj. För ett skyltbolag ÄR innehållet på
      //   skärmen produkten de säljer, och en tavla säljer ingen skärm. Kampanjlayouten är
      //   tillbaka (BILD-7a), och orden hålls borta med läsbarhet i stället.
      "A screen in the scene runs a REAL CAMPAIGN the way this business's own customers run one: a product or dish image as the main area, a heading zone above or beside it, and a clear offer or price block. " +
      "A composed layout — never one big photograph filling the whole panel like a picture frame, and never a blank or dark-grey panel used as an escape. " +
      "The campaign is seen from across the room or the street, at a slight angle, or with the focus nearer the camera, so the layout is unmistakable while no single word can be read, in any language. " +
      "What the campaign is ABOUT belongs to the buyer's own world — their goods, their dishes, their event, their premises — and matches what the post is about. " +
      "Never a decorative stock subject (landscape, mountains, icebergs, animals, abstract art) unless the business sells exactly that.",
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
      "Vehicles are clean but used, never showroom-perfect renders. Price signs are kept out of frame or so far out of focus that nothing can be read as letters.",
  },
  {
    monster: /blomm|florist|bageri|café|restaurang|butik|handel/i,
    // Samma rättning som signage-raden ovan: en "rubrikrad som form" är en beställning av
    // bokstäver. Menytavlor och skyltar hålls därför utanför bild eller ur fokus.
    regel:
      "Props and setting are the real shop floor: goods on display, hands preparing or wrapping, counter, packaging, seasonal materials in use. " +
      "Menu boards and signs are kept out of frame, turned away, or so far out of focus that nothing on them can be read as letters or words.",
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
  "Anything shown as content on a screen, sign or board is a photograph of this business's own goods or premises, softened by distance or shallow focus, and never resolves into letters or words in any language.";

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

// ── K2b · VAR OCH NÄR (BILD-11 tillägg punkt 4, Håkans skarpfynd 15/8) ────────
//
// ★ SKARPT FALL: inlägget "Skärmen som säljer när du sover" — om ett skyltfönster som
//   jobbar dygnet runt — fick en bild med DAGTID, butiksinteriör och personal vid en skärm
//   INNE i butiken. K1 och K3 gjorde sitt (annonslayout på skärmen, kvinna i butiksmiljö),
//   men bevismeningen fångade bara VAD som skulle bevisas. Påståendets hela poäng satt i
//   platsen (utifrån gatan) och tiden (när butiken är stängd).
//
// Härledningen ställer därför TRE frågor till innehållet: vad ska bevisas, VAR utspelar
// det sig, NÄR utspelar det sig. Saknas svar på fråga två eller tre lämnas de tomma —
// en gissad plats är värre än ingen, för då styr den scenen åt fel håll.
//
// ⚠ ÅRSTID HÄRLEDS INTE HÄR, med flit. Bildprompten får redan en säsongsrad ur
//   `seasonPromptLineEn()` som utgår från dagens datum. Ett inlägg som NÄMNER vintern i
//   augusti hade då gett två motstridiga instruktioner i samma prompt, och en modell som
//   får motstridiga order hittar på (lesson: självmotsägande instruktion ger fabricering).
//   Tiden här är tid på DYGNET och veckan, aldrig på året.

// ★ SYSTEMET SKA TÄNKA RÄTT OAVSETT VAD SOM SKRIVS IN (Håkans rättning 15/8).
//
//   Nyckelordslistorna nedan är snabba, gratis och mätta — men de kan bara det de råkar
//   innehålla. "På taket", "i hissen", "under marknadskvällen" hade gett ingenting, och
//   då hade bilden blivit lika godtycklig som före hela etappen.
//
//   Arbetsdelningen är därför: MODELLEN TOLKAR, KODEN FORMULERAR.
//     1. Reglerna först. Träffar de är saken avgjord — de är mätta och glider inte.
//     2. Saknas plats eller tid får modellen läsa inlägget och svara med en NYCKEL ur
//        samma lista. Nyckeln slås upp mot exakt samma text som regeln hade gett.
//     3. Passar inget fack får modellen ge en egen kort mening, som saneras hårt.
//
//   Vinsten är att ordalydelsen förblir kodens. Det var därför "AFTER DARK" gick att
//   härda när modellen levererade gyllene timme — hade instruktionen kommit ur modellen
//   hade härdningen försvunnit vid nästa körning.

export type PlatsNyckel =
  | "gatan-utifran" | "entre" | "massa" | "utomhus" | "i-butiken"
  | "verkstad" | "hemma" | "kontor" | "restaurang" | "mottagning";

export type TidNyckel = "efter-morkret" | "tidig-morgon" | "mitt-pa-dagen" | "rusning" | "helg";

// ⚠ ORDGRÄNSER, INTE SUBSTRÄNGAR — mätt 15/8 och det var ett riktigt fel.
//
//   Listorna innehöll "väg" och "kö" som lösa substränger. "Buketten du hinner hämta på
//   VÄG hem" klassades därför som en fasadbild, och varje inlägg med ordet "KÖpa" hade
//   klassats som rusningstid. Det drabbar varje tenant, inte bara den jag råkade testa.
//
//   JavaScripts \b bygger på [A-Za-z0-9_], så å, ä och ö räknas som ordgräns — `\bväg\b`
//   hade matchat inuti "vägen". Gränserna skrivs därför ut med svenska bokstäver.
const SV = "a-zåäöéèüA-ZÅÄÖÉÈÜ";
/** Exakt ord: "kö" matchar inte i "köpa", "väg" inte i "på väg" med suffix. */
const ORD = (...ord: string[]) => `(?<![${SV}])(?:${ord.join("|")})(?![${SV}])`;
/** Ordstam: får böjas på slutet ("verkstad" → "verkstaden"), men aldrig sitta inuti. */
const STAM = (...stam: string[]) => `(?<![${SV}])(?:${stam.join("|")})`;
const NYCKELORD = (...delar: string[]) => new RegExp(delar.join("|"), "i");

const PLATS_MONSTER: { nyckel: PlatsNyckel; monster: RegExp; plats: string }[] = [
  {
    nyckel: "gatan-utifran",
    // Skyltfönstret är utsidan. Den vanligaste förväxlingen: en skärm i skyltfönstret
    // fotograferad inifrån butiken visar precis fel sak.
    monster: NYCKELORD(STAM("skyltfönst", "förbipasserande", "gatuplan"), "fönstret mot gatan", "utanför butiken", "från gatan"),
    plats: "seen from OUTSIDE on the street, through the shop window: the glass, the pavement and the street are in frame, and the camera is on the public side of the window, never inside the shop",
  },
  { nyckel: "entre", monster: NYCKELORD(STAM("entré", "reception", "väntrum", "foajé", "ingång"), "vid dörren"),
    plats: "in the entrance or reception area, where a visitor first arrives" },
  { nyckel: "massa", monster: NYCKELORD(STAM("mässa", "mässan", "mässor", "monter", "konferens", "utställning"), ORD("event")),
    plats: "at a trade show or event stand, with visitors passing by" },
  // "väg" är BORTA ur listan med flit: det matchade inuti "på väg hem" och gav en
  // fasadbild av en bukett. Vägen som plats fångas av modelltolkningen i stället.
  { nyckel: "utomhus", monster: NYCKELORD(STAM("utomhus", "fasad", "parkering", "infart"), ORD("torg", "torget", "utanför")),
    plats: "outdoors, on the building's own facade or forecourt, with real weather and surroundings visible" },
  { nyckel: "i-butiken", monster: NYCKELORD("inne i butiken", "i butiken", STAM("butiksmiljö", "hyll"), ORD("kassa", "kassan", "disk", "disken")),
    plats: "inside the shop, at the point where the customer actually decides" },
  { nyckel: "verkstad", monster: NYCKELORD(STAM("verkstad", "produktion", "fabrik", "montering"), ORD("lager", "lagret")),
    plats: "in the workshop, warehouse or production area where the work is actually done" },
  { nyckel: "hemma", monster: NYCKELORD(STAM("vardagsrum", "sovrum", "husvagn", "husbil", "sommarstuga"), ORD("hemma", "kök", "köket")),
    plats: "in an ordinary home, in the room the post is about" },
  { nyckel: "kontor", monster: NYCKELORD(STAM("kontor", "mötesrum", "arbetsplats", "skrivbord")),
    plats: "in an ordinary workplace, at the desk or in the meeting room" },
  { nyckel: "restaurang", monster: NYCKELORD(STAM("restaurang", "café", "cafe", "bageri", "servering"), ORD("meny", "menyn")),
    plats: "in the restaurant or café, at the counter where the guest orders" },
  { nyckel: "mottagning", monster: NYCKELORD(STAM("mottagning", "behandlingsrum", "klinik", "salong")),
    plats: "in the treatment room, prepared as it is before a client arrives" },
];

const TID_MONSTER: { nyckel: TidNyckel; monster: RegExp; tid: string }[] = [
  {
    nyckel: "efter-morkret",
    // "Säljer när du sover", "dygnet runt", "efter stängning" — bilden ska visa den
    // TIDPUNKT påståendet handlar om, annars bevisar den ingenting.
    monster: NYCKELORD(
      "när du sover", "medan du sover", "dygnet runt", "24/7", "efter stängning", "när butiken är stängd",
      STAM("nattetid", "nätter", "kväll"), ORD("natten", "stängt"),
    ),
    // ⚠ TVÅ MÄTTA RÄTTNINGAR 15/8, båda ur skarpa bilder:
    //   1. "No daylight" räckte inte — modellen levererade gyllene timme med ljus himmel
    //      och kallade det kväll. Solnedgången är nu utpekad vid namn, som isberget i
    //      BILD-12: en modell väljer det vackraste som inte uttryckligen är förbjudet.
    //   2. "Inga personer" var MIN uppfinning, inte Håkans krav. Människor är varken
    //      förbjudna eller obligatoriska — det är personal mitt i ett ARBETSPASS som inte
    //      går ihop med en stängd lokal.
    tid: "AFTER DARK: the sky is already dark and streetlights, windows and signs are the only light. NOT golden hour, NOT a sunset, NOT dusk with a bright sky — night has fallen. The light comes from the subject itself, which stays clearly lit and readable. If a person is in the picture they are on the public side and they have STOPPED and are looking straight at the subject, head and eyes on it — never someone walking past looking elsewhere, and never staff at work inside a closed place",
  },
  { nyckel: "tidig-morgon", monster: NYCKELORD("tidig morgon", "innan öppning", STAM("morgonen", "frukost", "gryning")),
    tid: "EARLY MORNING: low warm light, the place not yet busy" },
  { nyckel: "mitt-pa-dagen", monster: NYCKELORD("mitt på dagen", STAM("lunch", "middagstid")),
    tid: "MIDDAY: full daylight, the busiest part of the working day" },
  // "kö" är BORTA som löst ord: det matchade inuti "köpa", "kök" och "köra", så varje
  // inlägg om att köpa något klassades som rusningstid.
  { nyckel: "rusning", monster: NYCKELORD("fullt med folk", "när det är som mest", STAM("rusning", "högtrafik", "myllr"), ORD("kö", "kön", "köer")),
    tid: "AT THE BUSIEST HOUR: people moving through the frame, the place visibly in use" },
  { nyckel: "helg", monster: NYCKELORD(STAM("lördag", "söndag", "weekend"), ORD("helg", "helgen", "helger", "helgens")),
    tid: "ON A WEEKEND: the calmer, less formal version of the same place" },
];

/** Texten som hör till en nyckel. Delas av regelvägen och modellvägen. */
export function platsText(nyckel: string): string | null {
  return PLATS_MONSTER.find((p) => p.nyckel === nyckel)?.plats ?? null;
}
export function tidText(nyckel: string): string | null {
  return TID_MONSTER.find((t) => t.nyckel === nyckel)?.tid ?? null;
}

export function harledPlats(rubrik?: string, brodtext?: string): string | null {
  const text = `${rubrik ?? ""} ${brodtext ?? ""}`;
  for (const p of PLATS_MONSTER) if (p.monster.test(text)) return p.plats;
  return null;
}

export function harledTid(rubrik?: string, brodtext?: string): string | null {
  const text = `${rubrik ?? ""} ${brodtext ?? ""}`;
  for (const t of TID_MONSTER) if (t.monster.test(text)) return t.tid;
  return null;
}

// ── K2b, steg 2: modellen tolkar när reglerna inte räcker ────────────────────
//
// ⚠ ÅRSTIDSSPÄRREN GÄLLER ÄVEN HÄR. Bildprompten får redan en säsongsrad ur dagens datum,
//   så ett svar som drar in vinter eller sommar skapar två motstridiga instruktioner.
//   Svaret saneras därför i kod — inte i prompten, för en instruktion man ber modellen
//   följa är ett önskemål, och en kontroll man kör på svaret är en regel.
const ARSTIDSORD = /\b(vinter|winter|sommar|summer|höst|autumn|fall|vår|spring|snow|snö|jul|christmas|påsk|easter|midsommar)\b/i;

/** Saneringen av modellens fritextsvar. Tomt = svaret dög inte. */
export function saneraFritext(svar: unknown): string | null {
  const s = String(svar ?? "").replace(/\s+/g, " ").trim();
  if (!s || s.length < 8 || s.length > 240) return null;
  if (/^(null|saknas|okänt|unknown|n\/a|ingen|none)$/i.test(s)) return null;
  if (ARSTIDSORD.test(s)) return null; // årstiden ägs av säsongsraden
  return s;
}

interface PlatsTidSvar { plats_nyckel?: string; plats_fritext?: string; tid_nyckel?: string; tid_fritext?: string }

/**
 * Läser inlägget och svarar VAR och NÄR — för vilken text som helst, i vilken bransch som
 * helst. Anropas bara när reglerna inte redan gett svar, så vanliga inlägg kostar noll.
 *
 * Fail-open i varje led: utan nyckel, vid nätverksfel eller vid ett svar som inte går att
 * tolka blir svaret null, och då står prompten utan plats- och tidsrad — precis som förut.
 * En gissad plats är sämre än ingen.
 */
export async function tolkaPlatsTid(
  rubrik: string,
  brodtext: string,
  niche: string,
  behovs: { plats: boolean; tid: boolean },
): Promise<{ plats: string | null; tid: string | null }> {
  if (!behovs.plats && !behovs.tid) return { plats: null, tid: null };
  if (!process.env.GEMINI_API_KEY) return { plats: null, tid: null };
  try {
    const { anropaProvider } = await import("@/lib/ai-usage");
    const fraga =
      `Ett inlägg för en verksamhet inom "${niche}" ska illustreras med ett foto.\n` +
      `Inlägg: "${`${rubrik} ${brodtext}`.slice(0, 600)}"\n\n` +
      `Svara på två frågor, men BARA om inlägget självt säger eller tydligt förutsätter det. ` +
      `Gissa aldrig: säger inlägget ingenting om saken ska fältet vara null.\n` +
      `1. VAR utspelar sig det som ska bevisas? Välj en nyckel: ` +
      `gatan-utifran (sett utifrån gatan, genom fönstret), entre, massa (mässa/event), utomhus, i-butiken, ` +
      `verkstad, hemma, kontor, restaurang, mottagning. Passar ingen: sätt plats_nyckel till "annat" och ` +
      `beskriv platsen på engelska i plats_fritext, som en instruktion till en fotograf (max 25 ord).\n` +
      `2. NÄR på dygnet eller veckan utspelar det sig? Välj en nyckel: efter-morkret, tidig-morgon, ` +
      `mitt-pa-dagen, rusning (när det är som mest folk), helg. Passar ingen: "annat" + tid_fritext.\n` +
      `ÅRSTID räknas ALDRIG som en tid — svara null om inlägget bara nämner en säsong.\n` +
      `Svara ENDAST med JSON: {"plats_nyckel":...,"plats_fritext":...,"tid_nyckel":...,"tid_fritext":...}`;
    const svar = await anropaProvider<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>({
      provider: "gemini",
      model: "gemini-2.5-flash",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fraga }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json" },
        }),
      },
    });
    if (!svar.ok) return { plats: null, tid: null };
    const raw = svar.data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "";
    const tolkat = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}") as PlatsTidSvar;
    return {
      plats: behovs.plats ? platsText(String(tolkat.plats_nyckel ?? "")) ?? saneraFritext(tolkat.plats_fritext) : null,
      tid: behovs.tid ? tidText(String(tolkat.tid_nyckel ?? "")) ?? saneraFritext(tolkat.tid_fritext) : null,
    };
  } catch {
    return { plats: null, tid: null };
  }
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
 * Personal mitt i ett ARBETSPASS. Enda kategorin som inte går ihop med en stängd lokal —
 * allt annat (tom lokal, närbild, förbipasserande, kund som stannar utanför) gör det.
 */
const ARBETANDE_PERSONAL = /work clothing|installing or servicing|hands preparing|preparing the space|practitioner alone/i;

/**
 * Delar ut kategori på position i serien. Samma kategori kan aldrig komma två gånger i
 * rad, och en femslidesserie får minst tre olika.
 *
 * `efterStangning` hoppar förbi personal i arbete och tar nästa kategori i tur. Människor
 * är varken förbjudna eller obligatoriska efter stängning (Håkans rättning 15/8) — det är
 * bara arbetspasset som inte kan pågå i en stängd lokal.
 */
export function personKategoriFor(niche: string, index: number, opts?: { efterStangning?: boolean }): string {
  const k = personKategorier(niche);
  const start = ((index % k.length) + k.length) % k.length;
  if (!opts?.efterStangning) return k[start];
  for (let steg = 0; steg < k.length; steg++) {
    const kandidat = k[(start + steg) % k.length];
    if (!ARBETANDE_PERSONAL.test(kandidat)) return kandidat;
  }
  return k[start];
}

// ── K4 · LJUSVAKTEN ──────────────────────────────────────────────────────────
//
// Universell regel. En underexponerad bild är inte stämningsfull, den är oanvändbar: motivet
// måste synas även i ett litet flödesformat på en telefon i dagsljus.
export const LJUSVAKT_EN =
  "EXPOSURE: the main subject must be clearly and unmistakably visible. Expose for the subject, not for mood. " +
  "No silhouettes, no near-black frames, no scene so dim or backlit that the subject cannot be made out at thumbnail size. " +
  "Dark or evening settings are allowed only when the subject itself remains clearly lit and readable.";

// ── K5 · VERKLIGHETSVAKTEN ───────────────────────────────────────────────────
//
// ★ HÅKANS RÄTTNING 15/8: "gör inte missarna bara för DT — se det systemmässigt, oavsett
//   vad som skrivs in måste den tänka rätt."
//
//   Fyndet som utlöste regeln var en skärm som satt PÅ SNEDDEN i ett skyltfönster ("så
//   skulle det aldrig sättas"), och i nästa försök en man med stege som monterade den —
//   mitt i ett inlägg om att skärmen säljer när ingen är där. Båda felen är branschlösa:
//   en snedhängd tavla hos en terapeut, en lutande menytavla i ett café och ett verktyg
//   som svävar över bänken i en verkstad är samma fel.
//
//   Regeln bor därför här, bredvid ljusvakten, och gäller varje tenant och varje motiv.
//   Ett fackmässigt öga ser det här först — och kundens kunder har ofta just det ögat.
export const VERKLIGHETSVAKT_EN =
  "EVERYTHING IS IN ITS FINISHED, NORMAL STATE: screens, signs, boards, frames, shelves, machines and fittings sit the way a professional would leave them — level, upright, square to the wall or the glass, seated in their proper fixing. " +
  "Nothing is tilted, leaning, rotated, propped against something or floating unsupported. " +
  "The installation work is done and out of frame: no ladders, no toolboxes, no loose cables, nobody mounting, adjusting or repairing anything — unless the post is itself about that work. " +
  "Equipment, goods and furniture stand where they belong on a working day, not arranged as props for the camera.";

// ── Byggaren ─────────────────────────────────────────────────────────────────

export interface BildPromptDelar {
  scen: string;
  bevismening: string;
  /** K2b: var påståendet utspelar sig. Tomt när innehållet inte säger något om plats. */
  plats?: string | null;
  /** K2b: när på dygnet det utspelar sig. Aldrig årstid — den kommer från säsongsraden. */
  tid?: string | null;
  rekvisita: string;
  personkategori: string;
  kitSuffix: string;
}

/** Sätter ihop delarna i den ordning som mätts fungera. Exporterad för test. */
export function fogaSamman(d: BildPromptDelar): string {
  return [
    d.scen.trim(),
    `WHAT THE PICTURE MUST PROVE: ${d.bevismening}. Build the whole composition around this. If the scene does not show it, change the scene.`,
    // BILD-11 punkt 4: plats och tid står EFTER beviset och före rekvisitan — de avgör
    // kameraläget och ljuset, alltså sådant som måste vara bestämt innan scenen möbleras.
    d.plats ? `WHERE IT TAKES PLACE: ${d.plats}. This is part of the claim, not a detail — a picture from the wrong side of the glass proves nothing.` : "",
    d.tid ? `WHEN IT TAKES PLACE: ${d.tid}. The time of day is part of the claim.` : "",
    `PROPS AND SETTING: ${d.rekvisita}`,
    `PEOPLE AND VIEWPOINT: ${d.personkategori}. Follow this exactly, it varies deliberately between the pictures in a series.`,
    LJUSVAKT_EN,
    VERKLIGHETSVAKT_EN,
    // ⚠ "natural light" tas BORT när tiden är satt: en kvällsbild med upplyst skärm mot
    //   mörk gata är inte naturligt ljus, och två rader som säger olika saker om ljuset
    //   är just den motsägelse som får modellen att välja fritt.
    `Real photograph, ${d.tid ? "lit exactly as described above" : "natural light"}, no readable text anywhere in the image.`,
    d.kitSuffix.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

export async function byggBildPrompt(u: BildUppdrag): Promise<ByggdBildPrompt> {
  const bevismening = harledBevismening(u.rubrik, u.brodtext);
  // Steg 1: reglerna. Steg 2: modellen tolkar det reglerna inte kände igen — så en ovanlig
  // formulering ("på taket", "under marknadskvällen") ger rätt bild ändå.
  let plats = harledPlats(u.rubrik, u.brodtext);
  let tid = harledTid(u.rubrik, u.brodtext);
  if (!plats || !tid) {
    const tolkat = await tolkaPlatsTid(u.rubrik ?? "", u.brodtext ?? "", u.niche, { plats: !plats, tid: !tid });
    plats = plats ?? tolkat.plats;
    tid = tid ?? tolkat.tid;
  }
  const rekvisita = await hamtaRekvisita(u.clientId, u.niche);

  let kit: KitDirectives | null = null;
  try {
    kit = await getKitDirectives(u.clientId);
  } catch {
    /* fail-open: kitet är en förstärkning, inte ett villkor */
  }

  // Efter stängning byts personal i ARBETE mot nästa kategori i rotationen — en stängd
  // lokal med ett pågående arbetspass i motsäger sig själv.
  const efterStangning = !!tid && tid.startsWith("AFTER DARK");
  // ★ KUNDENS EGEN REGEL VINNER ÖVER ROTATIONEN (Håkan 15/8). Har hon svarat att bilder
  //   ALDRIG ska ha människor får rotationen inte dela ut en personkategori — förut
  //   skrevs önskemålet in i prompten samtidigt som rotationen beställde en kvinna vid
  //   skärmen, och två order som slåss avgörs av modellen, inte av kunden.
  const personkategori = kit?.personer === "aldrig"
    ? personKategorier(u.niche).find((k) => k.startsWith("no people")) ?? "no people at all: the room, the product and the light carry the picture"
    : personKategoriFor(u.niche, u.serie?.index ?? 0, { efterStangning });

  const prompt = fogaSamman({
    scen: u.scen ?? `A photograph for a ${u.niche} business about: ${amnetUr(u.rubrik ?? "", u.brodtext ?? "")}.`,
    bevismening,
    plats,
    tid,
    rekvisita: rekvisita.regel,
    personkategori,
    kitSuffix: kit ? imageDirectiveSuffix(kit) : "",
  });

  return { prompt, bevismening, plats, tid, personkategori, rekvisita };
}
