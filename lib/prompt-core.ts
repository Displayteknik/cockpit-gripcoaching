// lib/prompt-core.ts — ENDA stället där textprompter sätts ihop (TEXT-1).
// Princip: ingen text lämnar systemet utan full kontext. Varje textgenerering får
// samtliga lager i fast ordning (senare = väger tyngre, formatkrav allra sist):
//
//   1. Uppdrag (flödets rollrad + hårda regler)        — ägs av anroparen
//   2. Statisk kunskap (knowledge/*.md)                — utan profil-prepend
//   3. Brand-profil (hm_brand_profile + customer voice + story-bank)
//   4. Röst-fingerprint (client_voice_profile + råa exempel)
//   5. Vinnande exempel (client_assets, winning_example)
//      + ev. bildkontext ("grunda texten i inlägget")
//   6. Anatomi + Content Compass (POST_ANATOMY alltid; funnel/4A/DISC ur params
//      eller mjuk default per syfte — aldrig bofu som default)
//   7. Grafisk kontext (kit-donts) för bildnära syften
//   8. Globala skrivregler (styrs av clients.writing_rules_enabled)
//   8b. Klientens förbjudna ord (hårt block, T-5 — flyttat ur röstblocket)
//   9. JSON-formatkrav (styr ENDAST formen)
//
// Dubblettregel: varje lager finns EXAKT en gång. Därför hämtas brand-profilen med
// medVoice:false (lager 4–5 ägs här, inte av knowledge.ts) och statisk kunskap via
// getStaticKnowledge (ingen profil-prepend). Idempotensvakterna i gemini.ts/iterate.ts
// finns kvar som skyddsnät men ska aldrig behöva trigga.
//
// Spec: TEXT1-PLAN.md (godkänd 2026-07-31).

import type { VoiceFingerprint } from "@/lib/voice-fingerprint";
import type { CompassParams } from "@/lib/content-compass/prompt";
import {
  POST_ANATOMY,
  contentCompassBlock,
} from "@/lib/content-compass/prompt";
import type { FunnelLevel } from "@/lib/content-compass/data";
import {
  WRITING_RULES_BLOCK,
  harPrisuppgift,
  hittaForbjudnaOrd,
  hittaPrisuppgifter,
  sanitizeGenerated,
  skrivreglerPa,
  taBortFloskler,
  type HashtagKanal,
} from "@/lib/content/writing-rules";
import { sasongsPromptRad } from "@/lib/content/sasong";

export type TextSyfte =
  | "caption"
  | "studio-text"
  | "karusell"
  | "kanal-anpassning"
  | "linkedin"
  | "blogg"
  | "nyhetsbrev"
  | "veckoplan"
  | "enskilt"
  | "social"
  | "specialist"
  | "reel";

export interface ByggParams {
  clientId: string | null;
  syfte: TextSyfte;
  kanal?: "instagram" | "facebook" | "linkedin" | "webb" | "mejl";
  uppdrag: string;
  underlag?: string;
  compass?: CompassParams;
  bildKontext?: { caption?: string; bildbeskrivning?: string; bildRoll?: string };
  knowledge?: string[];
  jsonSchema?: string;
  /** Winning-example-kategori (subcategory i client_assets). Default härleds ur syftet. */
  kategori?: string;
  maxProfilTecken?: number;
  /** BILD-5b: datum för säsongskontexten — injiceras i tester (fast datum), default nu. */
  datum?: Date;
  /** T-6c (rotation): senaste genererade hookar/öppningar ur flödets historik —
   *  renderas som "NYLIGEN ANVÄNT — undvik dessa ingångar/öppningar". Flödet läser
   *  sin egen tabell (linkedin_posts/hm_social_posts/studio_posts); ingen ny datamodell. */
  nyligen?: string[];
  /** KVALITET-3/punkt 5: den text ANVÄNDAREN själv skrev (ämne/instruktion). Enda
   *  källan som kan öppna prisundantaget. Sätts av flöden som vet vad användaren
   *  skrev; utan den faller kärnan tillbaka på `underlag`. Profilens priser räknas
   *  ALDRIG som medgivande — de är sanningsunderlag, inte citatmaterial. */
  anvandarText?: string;
  /** KVALITET-3/punkt 5: flödet har uttryckligen bett om ett pris (t.ex. reel-mallen
   *  "Pris rakt ut", som användaren väljer aktivt). Öppnar samma undantag. */
  prisTillatet?: boolean;
}

export interface ByggdPrompt {
  system: string;
  user: string;
  fingerprint: VoiceFingerprint | null;
  winning: string[];
  /** Lager 3-texten (klippt profil) — för anroparens deterministiska grindar
   *  (t.ex. copy.ts fail-closed siffergrind) utan en andra DB-läsning. */
  profilText: string;
  meta: { lager: Record<string, boolean>; profilKlippt: string[] };
}

// ── Compass-default per syfte ─────────────────────────────────────────────────
// Endast funnel defaultas (mjukt). 4A/DISC lämnas osatta — en default där skulle
// tvinga alla texter i samma berättarform. BOFU sätts ALDRIG som default: sälj-CTA
// ska alltid vara ett aktivt val.
const DEFAULT_FUNNEL: Partial<Record<TextSyfte, FunnelLevel>> = {
  linkedin: "mofu",
  nyhetsbrev: "mofu",
  blogg: "mofu",
  caption: "tofu",
  "studio-text": "tofu",
  karusell: "tofu",
  social: "tofu",
  reel: "tofu",
  enskilt: "tofu",
};

// Winning-example-kategori per syfte (subcategory-filtret i fetchWinningExamples).
const KATEGORI: Partial<Record<TextSyfte, string>> = {
  "studio-text": "studio_copy",
  caption: "caption",
  karusell: "carousel",
  linkedin: "linkedin",
  blogg: "blog",
  nyhetsbrev: "newsletter",
  social: "post",
  enskilt: "post",
  veckoplan: "post",
  reel: "reel",
};

// Syften där texten sitter på/vid en bild → kit-donts vävs in (lager 7).
const BILDNARA: TextSyfte[] = ["caption", "studio-text", "karusell", "reel", "kanal-anpassning"];

// ── Anatomilagret — frikopplat från Compass ──────────────────────────────────
// "full": hela anatomin inkl. exakt en CTA. "pa-bild": text som trycks PÅ bilden —
// captionen bär CTA:n, annars får inlägget två uppmaningar (affischregeln ur copy.ts).
//
// CTA-GOLV (T-5, skärpt T-6a): "exakt EN CTA" är en HÅRD regel som funnel-lagret
// aldrig kan upphäva — en satt eller defaultad funnel-nivå styr uppmaningens TON,
// aldrig dess EXISTENS eller imperativform. Golvet läggs därför sist i VARJE
// "full"-variant, oavsett compass-läge. T-6a: skarptestet visade captions som
// KONSTATERAR ("vi ser till att du får...") utan att någonsin UPPMANA — golvet
// kräver nu imperativ + väg, och föredrar tenantens egna CTA-formuleringar.
const CTA_GOLV = [
  "HÅRD REGEL (CTA-golv): texten avslutas med exakt EN uppmaning (CTA), alltid sist — aldrig noll, aldrig två.",
  "SIST betyder bokstavligt: uppmaningen är textens SISTA MENING. Platsrader ('Vi finns i Roslagen'), löften ('Vi hör av oss samma dag') och andra konstateranden placeras FÖRE uppmaningen, aldrig efter. Hashtags ligger på egen rad efter.",
  "CTA:n är en UPPMANING I IMPERATIV MED VÄG: den börjar med ett verb (boka, skicka, svara, kommentera, ring, läs) och säger hur eller var handlingen görs. Ett konstaterande ('vi hjälper dig gärna', 'vi ser till att du får...') är INTE en CTA.",
  "Funnel-nivån styr uppmaningens TON och tyngd — aldrig om den finns eller att den är imperativ. Mjuk och imperativ går ihop: 'Boka en digital fika, ingen säljpitch.'",
  "Innehåller varumärkesprofilen färdiga CTA-formuleringar (Erbjudande/CTA-sektion, kundens egna ord): FÖREDRA dem framför nyskrivna.",
].join("\n");

// ── SANNINGSKRAV (T-6b, skärpt A2) — KRITISK trovärdighetsregel, alla flöden ─
// Skarptestet fångade en caption som började "Jag minns en fastighetsägare som var
// orolig..." — ett påhittat minne. Berättelser, kundcase, citat och siffror får
// ENDAST bygga på verkligt material ur tenantens profil. Plattformsregel: gäller
// varje tenant/bransch. Blocket ligger sent (sist väger tyngst) och gäller ÄVEN
// pa-bild-texter. Den deterministiska siffergrinden i copy.ts är oberoende av detta
// promptlager och rörs inte.
//
// A2-SKÄRPNINGEN (T-6-delbatchen): regeln läckte när ÄMNET SJÄLVT bad om en
// kundberättelse. Ämnet "En kund tvekade länge, så blev resultatet" gav "Jag minns
// en kund som tvekade länge..." för två av fyra profiler — modellen läste
// ämnesformuleringen som ett mandat att uppfinna minnet den saknade. Därför säger
// regeln nu uttryckligen att uppdraget/ämnet ALDRIG upphäver sanningskravet: ett
// ämne som efterfrågar ett kundcase ska skrivas om till en generell observation när
// grundat material saknas. Ämnet bestämmer VAD texten handlar om — aldrig att det
// får hittas på.
export const SANNINGSKRAV = [
  "=== SANNINGSKRAV (hård regel — trovärdighet, väger tyngst) ===",
  "Berättelser i jag-form, kundcase, kundminnen, kundcitat och specifika sifferpåståenden får ENDAST bygga på verkligt material ur klientens profil ovan (story-bank, kundröster/Customer Voice, verifierade siffror).",
  "Saknas passande material: skriv en GENERELL observation i stället. Tillåtet: 'Vi möter ofta fastighetsägare som oroar sig för...'. FÖRBJUDET: 'Jag minns en fastighetsägare som...' utan källa i profilen.",
  "Hitta ALDRIG på ett specifikt minne, ett kundnamn, ett citat eller en siffra. Hellre allmängiltigt och sant än specifikt och påhittat.",
  "ÄMNET ÄR INGET MANDAT ATT FABRICERA: uppdraget, ämnesraden eller rubriken kan vara formulerad som en kundberättelse ('En kund tvekade länge...', 'Så räddade vi kundens...', 'Ett case där...'). Den formuleringen beskriver bara VAD texten ska handla om — den upphäver ALDRIG sanningskravet och ger ALDRIG tillåtelse att uppfinna kunden, minnet, citatet eller resultatet.",
  "Ber ämnet om en kundberättelse och profilen saknar passande story-bank-material: SKRIV OM ÄMNET som en generell observation om mönstret, i samma anda. Tillåtet: 'Vi möter ofta kunder som tvekar länge...', 'Den tveksamheten hör vi varje vecka...', 'Många väntar för länge, och reaktionen efteråt är nästan alltid densamma.' FÖRBJUDET: 'Jag minns en kund som...', 'En av våra kunder berättade att...' när personen inte finns i profilen.",
  "Formuleringar som signalerar ett specifikt minne — 'jag minns', 'en av våra kunder', 'häromdagen', 'förra veckan kom en kund', 'ett brudpar som' — får bara användas när personen eller händelsen faktiskt står i profilen ovan. Kan du inte peka på var i profilen den finns: skriv generellt i stället.",
  // KVALITET-3/punkt 2c: skarptestet av idé-flödet fällde "dubbelt så många gäster"
  // och "betalar sig själv på tre månader". Ingen av dem innehåller en SIFFRA, så
  // varken modellen eller den deterministiska siffergrinden såg dem som sifferpåstå-
  // enden. De är det ändå: ett mätbart löfte om storlek eller tid. Regeln måste därför
  // säga uttryckligen att ordformen räknas.
  "SIFFERPÅSTÅENDEN GÄLLER ÄVEN I ORDFORM. 'Dubbelt så många gäster', 'tre gånger fler förfrågningar', 'halva tiden', 'betalar sig själv på tre månader', 'lönsam redan efter en vecka' är exakt lika mycket sifferpåståenden som '200 %' — de lovar en mätbar storlek eller en mätbar tid. De kräver samma täckning i profilen som ett tal med siffror.",
  "Saknas täckningen: skriv utfallet UTAN storlek. Tillåtet: 'fler gäster ser menyn', 'sparar tryckkostnader', 'du slipper skriva om tavlan varje morgon'. FÖRBJUDET: 'dubbelt så många gäster', 'betalar sig på tre månader', 'sparar tusenlappar i månaden'.",
  "Det gäller ALLA led i leveransen, även idéer, rubrikförslag och korta pitchar. En idé med en påhittad siffra är ett löfte som följer med: väljs idén följer siffran med in i den färdiga texten, eller så tappar inlägget sin poäng när grinden skalar bort den. Håll löftet sant redan i idén.",
  "KRAVET GÄLLER VARJE SIFFRA, ÄVEN OM OMVÄRLDEN. Tal om konkurrenter, branschsnitt, vad andra produkter klarar eller vad 'de flesta' gör är lika obackade som tal om klienten själv — 'en vanlig TV klarar sällan mer än 400 nits' är ett sifferpåstående som kräver täckning i profilen ovan. Saknas talet där: skriv jämförelsen GENERELLT i stället ('en vanlig TV blir en svart spegel i solljus', 'långt ljusstarkare än en vanlig skärm'). Poängen bär utan siffran; en uppfunnen siffra sänker hela texten den dag någon kollar.",
].join("\n");

// ── PRISREGELN (KVALITET-3/punkt 5) — Håkans beslut, plattformsregel ─────────
// Verifierat brott: en caption innehöll "kostar från 21 000 kr" och "43-tums".
// Beslutet: värdet beskrivs i texten, priset hör hemma i samtalet eller offerten —
// dit CTA:n leder. Ett pris i inlägget tar bort själva anledningen att höra av sig.
//
// ⚠ VIKTIG KONTEXT (PROFIL-1/F1): pricing_notes kopplades nyss in i lager 3, så
// modellen SER numera riktiga priser i profilen. Regeln behövs alltså MER än förut,
// och den måste vara tydlig med skillnaden: prisuppgifterna är SANNINGSUNDERLAG
// (de gör det möjligt att säga "prisvärt" utan att ljuga, och att peka CTA:n rätt),
// inte citatmaterial. Det är exakt den distinktionen som formuleras nedan.
//
// AVGRÄNSNING: den här regeln gäller TEXT (inlägg, caption, text på bilden) och
// byggs bara av byggTextPrompt. Avbildad demo-skyltning i en genererad BILD
// ("DAGENS LUNCH 129 KR" på en skärm i motivet) styrs av BILD-7:s budskapsregel i
// lib/images.ts och rörs INTE härifrån — den ligger i bildprompten, inte textprompten.
//
// Plattformstest: fungerar lika för blomsteraffär (ingen buketprislista i captionen),
// bilhandlare (ingen "från 189 000 kr") och coach (ingen "1 495 kr per session").
const PRISREGEL_BAS = [
  "=== PRISREGEL (hård regel — priset hör hemma i samtalet, inte i inlägget) ===",
  "Skriv ALDRIG ut priser, prisintervall, månadskostnader, rabattsatser eller andra kostnadsuppgifter för klientens egna produkter och tjänster. Inte \"från 21 000 kr\", inte \"995 kr/mån\", inte \"20 % rabatt\", inte \"halva priset\".",
  "Beskriv VÄRDET i stället: vad kunden får, vad det löser och vad det gör för vardagen. Uppmaningen leder till samtalet eller offerten, och där tas priset.",
  "PRISUPPGIFTERNA I VARUMÄRKESPROFILEN ÄR SANNINGSUNDERLAG, INTE CITATMATERIAL. De står där för att du ska VETA vad saker kostar: så att ett ord som prisvärt eller överkomligt är sant när du använder det, och så att uppmaningen pekar rätt. De ska ALDRIG kopieras in i texten. Att känna till priset och att skriva ut priset är två olika saker.",
  "SPECIFIKATIONER följer samma grind: mått, tumtal, modellbeteckningar, effekt, vikt, garantitid och andra tekniska tal får bara skrivas ut om EXAKT den uppgiften står ORDAGRANT i varumärkesprofilen ovan. Står den inte där: beskriv i ord (\"en skärm som syns även i solljus\") i stället för att gissa ett tal.",
].join("\n");

// Undantaget: användaren har själv skrivit in ett pris i sitt ämne eller sin instruktion,
// eller valt en mall/ett flöde som uttryckligen ska handla om priset (reel-mallen "Pris
// rakt ut"). Då är priset användarens eget beslut och ska inte skalas bort — men det
// öppnar bara för DEN uppgiften, aldrig för egna påhitt.
const PRISREGEL_UNDANTAG = [
  "UNDANTAG (gäller i den här körningen): priset är uttryckligen efterfrågat — användaren har själv skrivit in det i sitt ämne eller sin instruktion, eller valt en mall som ska handla om priset. Just den uppgiften får skrivas ut, ordagrant som användaren angav den.",
  "Undantaget gäller ENDAST den uppgiften. Lägg aldrig till egna priser, avrundningar eller intervall utöver den, och hitta aldrig på ett pris som saknas.",
].join("\n");

export const PRISREGEL = PRISREGEL_BAS;

/** Prisregeln med eller utan undantagsstycket. Exporterad för test och granskning. */
export function prisregelBlock(prisTillatet: boolean): string {
  return prisTillatet ? `${PRISREGEL_BAS}\n${PRISREGEL_UNDANTAG}` : PRISREGEL_BAS;
}

// ── PERSPEKTIVREGELN (KVALITET-3/punkt 4) — vem som talar, alla flöden ───────
// Verifierat fel i skarp drift: en studio-text löd "Tills vi satte upp skärmen skrev
// vi menyn för hand... nu hinner vi laga mat istället". Texten talade SOM restaurangen
// — alltså som tenantens KUND — i stället för som tenanten som säljer skärmen. Två fel
// i ett: fel avsändare, och en antydd kundhistoria utan täckning i story-banken.
//
// Regeln är en PLATTFORMSREGEL, inte en bransch-regel: den fungerar likadant för en
// blomsteraffär (texten talar som floristen, inte som brudparet), för en bilhandlare
// (som handlaren, inte som köparen) och för en coach (som coachen, inte som klienten).
// Perspektivbytet lockar mest när ämnet är ett kundscenario, därför ligger blocket
// direkt efter sanningskravet: de två griper i varandra (ett bytt perspektiv är nästan
// alltid också ett påhittat kundminne).
export const PERSPEKTIVREGEL = [
  "=== PERSPEKTIV (hård regel — vem som talar) ===",
  "Texten talar ALLTID SOM klienten i varumärkesprofilen ovan, och TILL klientens kund. \"Vi\", \"jag\", \"oss\" och \"vår\" är alltid klienten, aldrig kunden.",
  "Skriv ALDRIG en text där \"vi\" är kundens verksamhet. FÖRBJUDET när klienten levererar skärmen: \"Tills vi satte upp skärmen skrev vi menyn för hand, nu hinner vi laga mat i stället.\" Där talar restaurangen, alltså kunden, och avsändaren har försvunnit.",
  "Kundernas upplevelser återges i TREDJE PERSON: \"restaurangägare berättar att...\", \"flera av våra kunder säger att...\", \"för en verkstad betyder det att...\". Ett direkt citat kräver att personen eller händelsen står i story-banken eller kundrösterna ovan.",
  "KONTROLLFRÅGA innan du lämnar ifrån dig texten: byt ut varje \"vi\" mot klientens namn. Blir meningen fortfarande sann? Blir den det inte har du bytt perspektiv, och då ska meningen skrivas om.",
  "Du-tilltalet pekar på kunden: \"du\" är den som läser inlägget, aldrig klienten själv.",
].join("\n");

// ── VARIANTREGELN (T-6c) — central regel för alla multivariant-flöden ────────
// När flera idéer/varianter genereras i samma anrop ska de skilja sig i RETORISK
// INGÅNG, inte bara format. Flödena (enskilt/A-B, veckoplan, linkedin-idéer m.fl.)
// refererar konstanten i sina uppdrag; parallella en-variant-per-anrop-flöden
// (studio-copy, caption-A/B) sprider i stället via variantSuffixes/vinklar.
export const VARIANTREGEL = [
  "=== VARIANTREGEL (när flera idéer/varianter genereras) ===",
  "Varje variant ska ha en EGEN RETORISK INGÅNG — inte bara olika format. Välj olika ingångar ur listan: mytkrossning, kundscenario, konkret siffra (endast verifierad ur profilen), målgruppsvinkel, personlig hantverksstolthet, före/efter, rak fråga, konträrt påstående.",
  "Två varianter får ALDRIG dela tankefigur eller öppningsfras. Läser man bara första raden av varje ska de kännas som olika ingångar till samma budskap.",
].join("\n");

// ── ROTATIONSREGELN (T-6c) — sprid profilfakta över tid ──────────────────────
// Prompten instruerar att inte bygga varje text på samma profilfakta. Där flödet
// enkelt kan läsa inläggshistorik skickas de senaste hookarna in via p.nyligen och
// renderas som "NYLIGEN ANVÄNT" — ingen ny datamodell.
export const ROTATIONSREGEL =
  "ROTATION: bygg inte varje text på samma profilfakta. Rotera mellan klientens sanningar — olika USP:ar, vertikaler/tjänster, verifierade siffror, berättelser och CTA-varianter — så att flödet inte upprepar samma vinkel i inlägg efter inlägg.";

export function anatomiBlock(variant: "full" | "pa-bild", compass?: CompassParams, mjukDefault?: FunnelLevel): string {
  if (variant === "pa-bild") {
    return [
      "=== INLÄGGSANATOMI FÖR TEXT PÅ BILD (följ i ordning) ===",
      `1. ${POST_ANATOMY.hook}`,
      `2. ${POST_ANATOMY.story}`,
      `3. ${POST_ANATOMY.nytta}`,
      "4. INGEN CTA i texten på bilden. Captionen bär uppmaningen — en affisch med egen uppmaning ger inlägget två.",
    ].join("\n");
  }
  const harParams = !!(compass && (compass.funnel || compass.four_a || (compass.disc || []).length));
  if (harParams) return `${contentCompassBlock(compass!)}\n${CTA_GOLV}`;
  if (mjukDefault) {
    const block = contentCompassBlock({ funnel: mjukDefault, four_a: null, disc: [] });
    return `${block}\n(Funnel-nivån ovan är förvald för den här innehållstypen — väg in den bara om inget annat framgår av ämnet.)\n${CTA_GOLV}`;
  }
  return [
    "=== INLÄGGSANATOMI (följ i ordning) ===",
    `1. ${POST_ANATOMY.hook}`,
    `2. ${POST_ANATOMY.story}`,
    `3. ${POST_ANATOMY.nytta}`,
    `4. ${POST_ANATOMY.cta}`,
    CTA_GOLV,
  ].join("\n");
}

// ── Profilklippning med fast prioritet ───────────────────────────────────────
// Tonregler, GÖR/GÖR INTE och USP överlever ALLTID klippet (Håkans tillägg till
// TEXT1-PLAN avsnitt 2). Story-bank klipps först (längst och minst ordförråds-tät),
// därefter övriga sektioner i omvänd viktordning. Customer Voice bär klientens
// eget ordförråd (röst-träffen sjönk när den klipptes tidigt — justeringsrundan v2)
// och klipps därför först EFTER Sekundär ICP. Klipp sker på hel sektion — aldrig
// mitt i mening.
//
// PROFIL-1/F1: de fyra nykopplade fälten placeras efter sin klientunikhet.
// "Erbjudande: priser (verifierade siffror)" och "Erbjudande: CTA-väg" står med
// FLIT INTE i listan — de överlever alltså alltid (som Tonregler/USP/GÖR/GÖR INTE).
// Motivering: priserna är den enda källan till konkreta tal som SANNINGSKRAVET
// tillåter, och CTA-vägen är exakt det CTA-golvet hänvisar till. "Differentiering"
// och "Erbjudande: tjänster" är också klientunika och konkreta och klipps därför
// sent — efter allt allmänt material (kundresa, konkurrenter, brand story), men före
// de billiga grundfakta-raderna längst ned (att klippa 30 tecken sparar ingenting).
const KLIPPORDNING = [
  "Story-bank",
  "Kundresa",
  "Konkurrenter",
  "Sekundär ICP",
  "Customer Voice",
  "Voice of Customer (kundord)",
  "Hashtag-bas",
  "Brand story",
  "Smärtpunkter kunden har",
  "Erbjudande: tjänster och produkter",
  "Differentiering",
  "Kontakt",
  "Grundare",
  "Plats",
];

export function klippProfil(md: string, max: number): { text: string; klippta: string[] } {
  if (!md || md.length <= max) return { text: md, klippta: [] };
  const klippta: string[] = [];
  let ut = md;
  for (const namn of KLIPPORDNING) {
    if (ut.length <= max) break;
    // Toppnivåblock: "# ═══ Namn ... ═══" t.o.m. nästa "# ═══" eller slutet.
    const topp = new RegExp(`\\n?# ═══ ${escapeRe(namn)}[^\\n]*═══\\n[\\s\\S]*?(?=\\n# ═══ |$)`);
    // Undersektion i brand-profilen: "## Namn" t.o.m. nästa "## "/"# " eller slutet.
    const under = new RegExp(`\\n?## ${escapeRe(namn)}\\n[\\s\\S]*?(?=\\n## |\\n# |$)`);
    const fore = ut;
    ut = ut.replace(topp, "");
    if (ut === fore) ut = ut.replace(under, "");
    if (ut !== fore) klippta.push(namn);
  }
  // Sista utväg om profilen ändå är för lång: hård klipp på sektionsgräns.
  if (ut.length > max) {
    const cut = ut.lastIndexOf("\n## ", max);
    ut = cut > 0 ? ut.slice(0, cut) : ut.slice(0, max);
    klippta.push("(hårdklipp på sektionsgräns)");
  }
  return { text: ut.trim(), klippta };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Kärnan ───────────────────────────────────────────────────────────────────
export async function byggTextPrompt(p: ByggParams): Promise<ByggdPrompt> {
  const delar: string[] = [p.uppdrag.trim()];
  const lager: Record<string, boolean> = { uppdrag: true };

  // 1b. Säsongskontext (BILD-5b) — kort rad direkt efter uppdraget, så inget flöde
  // föreslår motiv ur fel säsong (skarpt fel: semla i juli). Datum injicerbart för test.
  delar.push(sasongsPromptRad(p.datum));
  lager.sasong = true;
  let profilKlippt: string[] = [];
  let profilText = "";
  let fingerprint: VoiceFingerprint | null = null;
  let winning: string[] = [];

  // 2. Statisk kunskap — getStaticKnowledge, ALDRIG getKnowledge (profil-prepend = dubblett).
  if (p.knowledge?.length) {
    const { getStaticKnowledge } = await import("@/lib/knowledge");
    const kunskap = (await getStaticKnowledge(...p.knowledge)).slice(0, 2500 * p.knowledge.length);
    if (kunskap) {
      delar.push(kunskap);
      lager.kunskap = true;
    }
  }

  if (p.clientId) {
    // 3. Brand-profil — medVoice:false: lager 4–5 ägs här.
    try {
      const { getProfileAsMarkdown } = await import("@/lib/knowledge");
      const raa = await getProfileAsMarkdown(p.clientId, { medVoice: false });
      if (raa) {
        // 9000 (höjt från 6000 i justeringsrundan v2): 6000 klippte bort röstbärande
        // sektioner för de fylligare profilerna och röst-träffen sjönk mätbart.
        // 11000 (PROFIL-1/F1): de fyra nykopplade fälten lägger ~3 100 tecken på
        // Displaytekniks profil (9 396 → 13 086). Vid 9000 hade klippet gått ända ned
        // i "Voice of Customer (kundord)" och "Brand story" — exakt de röstbärande
        // sektioner som v2-höjningen infördes för att skydda. Vid 11000 klipps bara
        // det allmänna materialet (mätt: DT klipper Kundresa + Konkurrenter, 13 086 →
        // 10 842) och de verifierade priserna kommer in utan att kosta kundorden.
        // Taket är mätt mot plattformens största profil, inte gissat
        // (scripts/profil1/f1-verifiera.mts).
        const klippt = klippProfil(raa, p.maxProfilTecken ?? 11000);
        profilKlippt = klippt.klippta;
        // T-5 (5): synliggör klipputfallet i loggen (batch + prod). Klipps röst-
        // bärande sektioner (Customer Voice) är det en profilfråga att agera på.
        if (klippt.klippta.length) {
          console.log(`[prompt-core] profil klippt (${p.syfte}, ${p.clientId}): ${klippt.klippta.join(" → ")} (${raa.length} → ${klippt.text.length} tecken)`);
        }
        profilText = klippt.text;
        delar.push(`=== KLIENTENS VARUMÄRKESPROFIL ===\n${klippt.text}\n\n${ROTATIONSREGEL}`);
        lager.brandProfil = true;
        lager.rotation = true;
      }
    } catch (e) {
      console.error("[prompt-core] brand-profil kunde inte hämtas:", e);
    }

    // 4. Röst-fingerprint. Fail-open som iterate: hellre text utan röst än inget svar.
    // T-5 (3): medForbjudna:false — förbuden flyttas till ett eget HÅRT block sist
    // (lager 8b nedan) där de väger tyngst, i stället för att drunkna i röstblocket.
    try {
      const { getVoiceFingerprint, fingerprintToPromptBlock } = await import("@/lib/voice-fingerprint");
      fingerprint = await getVoiceFingerprint(p.clientId);
      delar.push(fingerprintToPromptBlock(fingerprint, { medForbjudna: false }));
      lager.rost = true;
    } catch (e) {
      console.error("[prompt-core] fingerprint kunde inte hämtas:", e);
    }

    // 5. Vinnande exempel.
    try {
      const { fetchWinningExamples } = await import("@/lib/voice-score");
      winning = await fetchWinningExamples(p.clientId, p.kategori ?? KATEGORI[p.syfte]);
      if (winning.length) {
        delar.push(
          "=== VINNANDE EXEMPEL (matcha denna kvalitet) ===\n" +
            winning.map((w, i) => `Exempel ${i + 1}:\n${w}`).join("\n\n"),
        );
        lager.vinnande = true;
      }
    } catch (e) {
      console.error("[prompt-core] winning examples kunde inte hämtas:", e);
    }
  }

  // 5b. Nyligen använt (T-6c rotation) — flödets senaste hookar, så nästa text inte
  // återanvänder samma ingång/öppning. Trimmas och tak-begränsas defensivt.
  const nyligen = (p.nyligen ?? [])
    .map((h) => String(h ?? "").replace(/\s+/g, " ").trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 20);
  if (nyligen.length) {
    delar.push(
      "=== NYLIGEN ANVÄNT — undvik dessa ingångar/öppningar ===\n" +
        nyligen.map((h) => `- ${h}`).join("\n") +
        "\nVälj en annan retorisk ingång och en annan öppningsfras än ovanstående.",
    );
    lager.nyligen = true;
  }

  // Bildkontext — grunda texten i inlägget (mönstret ur B-paketet/copy.ts).
  if (p.bildKontext && (p.bildKontext.caption || p.bildKontext.bildbeskrivning)) {
    const b = p.bildKontext;
    delar.push(
      "=== GRUNDA TEXTEN I INLÄGGET ===\n" +
        [
          b.caption ? `Caption: ${b.caption}` : "",
          b.bildbeskrivning ? `Bilden föreställer: ${b.bildbeskrivning}` : "",
          b.bildRoll ? `Bildens roll: ${b.bildRoll}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
    );
    lager.bildKontext = true;
  }

  // 6. Anatomi + Compass — ALLTID (variant per syfte).
  const variant = p.syfte === "studio-text" ? "pa-bild" : "full";
  delar.push(anatomiBlock(variant, p.compass, DEFAULT_FUNNEL[p.syfte]));
  lager.anatomi = true;
  // Kanalmappning så anatomin inte krockar med blogg/nyhetsbrevs egna strukturblock.
  if (p.syfte === "blogg") delar.push("Anatomin mappas för blogg: hook = rubrik + ingress, story/nytta = brödtextens sektioner, CTA = avslutande sektion.");
  if (p.syfte === "nyhetsbrev") delar.push("Anatomin mappas för nyhetsbrev: hook = ämnesrad + intro, story/nytta = sektionerna, CTA = cta_text (exakt en).");

  // 7. Grafisk kontext för bildnära syften.
  if (p.clientId && BILDNARA.includes(p.syfte)) {
    try {
      const { getKitDirectives, dontsRule } = await import("@/lib/studio/kit");
      const kit = await getKitDirectives(p.clientId);
      const rad = dontsRule(kit.donts).trim();
      if (rad) {
        delar.push(rad);
        lager.grafisk = true;
      }
    } catch (e) {
      console.error("[prompt-core] kit-direktiv kunde inte hämtas:", e);
    }
  }

  // 8. Globala skrivregler — per-tenant-flaggan styr BÅDA lagren (prompt + sanering).
  if (await skrivreglerPa(p.clientId)) {
    delar.push(WRITING_RULES_BLOCK);
    lager.skrivregler = true;
  }

  // 8b. Klientens förbjudna ord — HÅRT block sist bland innehållsreglerna (T-5).
  // Flyttat ur röstblocket: sist = väger tyngst, och förbudet ska aldrig kunna
  // "läsas förbi" mitt i rösten. Ingen mekanisk ersättning finns för godtyckliga
  // klientord — prompten är förstahandsförsvaret, saneraText loggar träffar.
  if (fingerprint?.forbidden_words?.length) {
    delar.push(
      "=== FÖRBJUDNA ORD FÖR DEN HÄR KLIENTEN (hård regel, väger tyngst) ===\n" +
        `Använd ALDRIG: ${fingerprint.forbidden_words.join(", ")}. Formulera om med klientens egna ord i stället.`,
    );
    lager.forbjudnaOrd = true;
  }

  // 8c. Sanningskrav (T-6b) — ALLTID, alla syften (även pa-bild och utan clientId:
  // utan profil finns INGET grundat material, då gäller förbudet fullt ut). Sent
  // block = väger tyngst; formatkravet nedan styr bara formen.
  delar.push(SANNINGSKRAV);
  lager.sanningskrav = true;

  // 8d. Perspektiv (KVALITET-3/punkt 4) — ALLTID, alla syften. Ligger direkt efter
  // sanningskravet: reglerna griper i varandra (ett bytt perspektiv är nästan alltid
  // också ett påhittat kundminne) och båda ska väga tyngre än stil- och formatlagren.
  delar.push(PERSPEKTIVREGEL);
  lager.perspektiv = true;

  // 8e. Prisregel (KVALITET-3/punkt 5) — ALLTID, alla syften. Undantaget öppnas bara
  // när priset är användarens eget beslut: antingen har flödet sagt det uttryckligen
  // (prisTillatet, t.ex. reel-mallen "Pris rakt ut") eller så står prisuppgiften i den
  // text ANVÄNDAREN skrev. anvandarText är den precisa källan där flödet kan peka ut
  // den; saknas den faller vi tillbaka på underlaget, som i de flesta flöden ÄR
  // användarens ämne. Profilens priser räknas aldrig som ett sådant medgivande —
  // det är hela poängen med regeln.
  const prisTillatet = p.prisTillatet === true || harPrisuppgift(p.anvandarText ?? p.underlag ?? "");
  delar.push(prisregelBlock(prisTillatet));
  lager.prisregel = true;
  if (prisTillatet) lager.prisUndantag = true;

  // 9. Formatkrav — ALLTID sist. Styr formen, aldrig innehållsreglerna ovanför.
  if (p.jsonSchema) {
    delar.push(`=== SVARSFORMAT (styr ENDAST formen, aldrig innehållsreglerna ovan) ===\n${p.jsonSchema.trim()}`);
    lager.format = true;
  }

  return {
    system: delar.filter((d) => d && d.trim()).join("\n\n"),
    user: (p.underlag ?? "").trim(),
    fingerprint,
    winning,
    profilText,
    meta: { lager, profilKlippt },
  };
}

// ── Sanering — samma villkor överallt ────────────────────────────────────────
// Flaggan av → regel 1–4 hoppar över BÅDA lagren, men floskelgolvet (förbjudna
// AI-ord) körs ALLTID: det är plattformens kvalitetsgolv, inte en tenant-preferens.
export async function saneraText(
  text: string,
  clientId: string | null | undefined,
  kanal?: HashtagKanal,
  opts?: { prisTillatet?: boolean },
): Promise<string> {
  if (!text) return text;
  const ut = (await skrivreglerPa(clientId)) ? sanitizeGenerated(text, { kanal }) : taBortFloskler(text);
  // KVALITET-3/punkt 5: DETEKTERING av prisuppgifter — logg, INGEN borttagning.
  // FAIL-SAFE är hela poängen: en siffra som användaren själv skrivit in får aldrig
  // skalas bort, och saneringen kan inte veta vems siffra det är. Att klippa ett tal
  // ur en färdig mening bryter dessutom grammatiken. Enforcement sker där flödet har
  // alternativ att välja mellan (lib/studio/copy.ts filtrerar och genererar om);
  // här är det ett kvitto som gör brott synliga i loggen.
  if (!opts?.prisTillatet) {
    const priser = hittaPrisuppgifter(ut);
    if (priser.length) {
      console.warn(`[saneraText] prisuppgift kvar i genererad text (${clientId ?? "utan klient"}): ${priser.join(", ")}`);
    }
  }
  // T-5 (3): DETEKTERING av klientens förbjudna ord — logg, INGEN ersättning.
  // Godtyckliga klientord kan inte bytas mekaniskt utan att grammatiken bryts
  // (designfråga — se TEXT1-rapporten). Fail-open: får aldrig stoppa en leverans.
  if (clientId) {
    try {
      const traffar = hittaForbjudnaOrd(ut, await klientForbjudnaOrd(clientId));
      if (traffar.length) {
        console.warn(`[saneraText] klientens förbjudna ord kvar i färdig text (${clientId}): ${traffar.join(", ")}`);
      }
    } catch {}
  }
  return ut;
}

// Cache för klientens förbjudna ord (client_voice_profile.forbidden_words) — en
// generering sanerar många fält; en DB-läsning per klient per 5 min räcker.
const forbjudnaCache = new Map<string, { ord: string[]; ts: number }>();
async function klientForbjudnaOrd(clientId: string): Promise<string[]> {
  const c = forbjudnaCache.get(clientId);
  if (c && Date.now() - c.ts < 5 * 60 * 1000) return c.ord;
  let ord: string[] = [];
  try {
    const { supabaseService } = await import("@/lib/supabase-admin");
    const { data } = await supabaseService()
      .from("client_voice_profile")
      .select("forbidden_words")
      .eq("client_id", clientId)
      .maybeSingle();
    ord = ((data?.forbidden_words as string[]) || []).filter(Boolean);
  } catch {}
  forbjudnaCache.set(clientId, { ord, ts: Date.now() });
  return ord;
}
