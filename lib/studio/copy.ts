// Studio — hook-driven textmotor. Prompten byggs av lib/prompt-core (TEXT-1 T-3):
// uppdraget här är affischreglerna, kärnan lägger hook-playbook, brand-profil (exakt en
// gång — förr låg den dubbelt via getKnowledge + egen hämtning), röst, winning examples,
// pa-bild-anatomin, kit-donts och skrivregler. iterateGenerate (Anthropic) får prebuilt
// och genererar flera varianter; filtren efteråt tar bort fragment/AI-språk → topp 3.

import { iterateGenerate } from "@/lib/iterate";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { harPrisuppgift } from "@/lib/content/writing-rules";
import { getTemplateMeta } from "@/lib/studio/templates-meta";

export interface StudioCopySuggestion {
  hookType: string;
  headline1: string;
  headline2: string;
  body: string;
}

export interface StudioCopyOpts {
  clientId: string;
  templateId: string;
  format: string;
  topic?: string;
  brandName?: string;
  industry?: string;
  caption?: string; // inläggets grundtext (om satt i sessionen) — texten grundas i den
  imageDescription?: string; // vad bilden föreställer (Bildhjälpen-scen eller bildanalys)
  imageRole?: "problem" | "losning" | "neutral"; // bildens roll → styr vilka texter som föreslås
}

// Vilka hook-typer passar en bild i respektive roll?
// Problembild → sätt ord på problemet / ställ frågan (aldrig säljande påstående ovanpå).
// Lösningsbild → landa påståendet/resultatet. Statistik kräver ALLTID verifierade siffror.
function tillatnaHooks(role: StudioCopyOpts["imageRole"], harSiffror: boolean): string[] {
  const bas =
    role === "problem" ? ["fråga", "konträr", "berättelse"]
    : role === "losning" ? ["påstående", "konträr", "berättelse"]
    : ["fråga", "konträr", "berättelse", "påstående"];
  return harSiffror ? [...bas, "statistik"] : bas;
}

// Har tenanten verifierade siffror inlagda (t.ex. priser/statistik i Brand-profilen)?
// Grind för statistik-mallen: utan källa får inga siffror genereras.
function profilHarSiffror(profile: string): boolean {
  const komp = profile.replace(/[\s ]/g, "");
  if (/(\d[\d.,]*)%/.test(komp)) return true; // procent
  if (/(\d[\d.,]*)(kr|:-|sek)/i.test(komp)) return true; // pris
  for (const m of komp.matchAll(/\d[\d.,]*/g)) {
    if (Number(m[0].replace(/[.,]/g, "")) >= 1000) return true; // större tal (t.ex. 21000)
  }
  return false;
}

const FORBIDDEN = [
  "kraftfull", "banbrytande", "game-changer", "handlar om",
  "nästa nivå", "holistisk", "skalbar",
];

// Dinglande funktionsord i slutet = troligt avhugget fragment ("En liten skäv förändrar").
const DANGLING = /\b(och|att|som|en|ett|för|med|på|till|av|den|det|är|kan|när|men|eller|så|de|vi|din|ditt)\s*$/i;

// CTA hör i bildtexten och i mallens fot-knapp, aldrig i texten PÅ bilden.
const CTA_ORD = /\b(boka|ring|kontakta|hör av dig|mejla|maila|swisha|beställ|offert inom|slå en signal|besök oss|klicka)\b/i;

export async function generateStudioCopy(opts: StudioCopyOpts): Promise<StudioCopySuggestion[]> {
  const meta = getTemplateMeta(opts.templateId);
  const brand = opts.brandName || "kunden";
  const industry = opts.industry ? ` (${opts.industry})` : "";
  const softMax = meta?.headlineSoftMax ?? 26;

  // Bildgrundning: knyt texten till inläggets grundtext + vad bilden föreställer.
  // Renderas av kärnan som "=== GRUNDA TEXTEN I INLÄGGET ===" (B-paketets mönster).
  const caption = (opts.caption || "").trim();
  const bildDesc = (opts.imageDescription || "").trim();
  const rollGuide =
    opts.imageRole === "problem"
      ? "Bilden föreställer PROBLEMET (före-läget). Texten ska sätta ord på problemet eller ställa frågan läsaren känner igen — presentera INTE lösningen och skriv INGEN säljande rubrik ovanpå. Det krockar med bilden. Låt bilden vara problemet och texten spegla det."
      : opts.imageRole === "losning"
      ? "Bilden föreställer LÖSNINGEN/det önskade resultatet (efter-läget). Texten ska landa påståendet eller resultatet som bilden visar."
      : "";

  const uppdrag = [
    `Du skriver text som ska tryckas PÅ EN BILD (affisch/social-media-inlägg) för ${brand}${industry}.`,
    "Det är INTE ett caption-inlägg — det är korta ord som ska rymmas i en grafisk mall.",
    // Kärnan renderar bildkontext-blocket bara när caption/bildbeskrivning finns —
    // en ensam roll-styrning (t.ex. uppladdad bild utan analys) får ligga i uppdraget.
    !caption && !bildDesc && rollGuide ? `\nBILDENS ROLL: ${rollGuide}` : "",
    "\n=== MALLENS FÄLT (tre korta fält, inget annat) ===",
    `Rubrik: "${meta?.fields.headline1 ?? "rubrik"}". Underrubrik: "${meta?.fields.headline2 ?? "underrubrik"}". Kort text: "${meta?.fields.body ?? "brödtext"}".`,
    "\n=== HÅRDA REGLER (affisch-format) ===",
    `- headline1: kort och slagkraftig, MAX ~${softMax} tecken (stor rubrik på bilden). Hel begriplig fras — aldrig ett avhugget fragment.`,
    "- headline2: en kort underrubrik/fråga, ~20–45 tecken, hel mening.",
    "- body: EN hel mening (två korta om det behövs), MAX ~90 tecken. Skriv som du pratar, inte som en punktlista i löptext.",
    "- FÖRBJUDET i body: stapla fristående fragment efter varandra. Aldrig så här: 'Syns i dagsljus. En kontakt för allt. Offert inom 24 timmar.' Skriv EN sammanhängande tanke istället.",
    "- INGEN uppmaning/CTA i något fält (inte 'boka', 'ring', 'kontakta oss', 'offert inom X'). Mallens fot har redan en CTA-knapp och bildtexten bär uppmaningen. Texten PÅ bilden ska bara få läsaren att stanna och känna igen sig.",
    "- SIFFROR: använd ENDAST tal, priser och procent som faktiskt STÅR i varumärkesprofilen — en kvot eller procentsats får bara användas om EXAKT den formuleringen står där. Hitta ALDRIG på statistik ('400 % fler blickar'), kvoter ('8 av 10 kunder') eller priser. Saknar profilen verifierade siffror: skriv helt utan siffror. Osäker på en siffra: skriv utan siffra.",
    "- VASSARE SPRÅK: konkret substantiv före abstrakt (skyltfönster, inte 'kommunikationsyta'), aktivt verb, vardagsord. Inga floskler, ingen svengelska, ingen myndighetston.",
    "- FÖRBJUDET i alla fält: emoji, symboler (✅▶•), punktlistor, radbrytningslistor, signatur (t.ex. '— Ingela'), telefonnummer, URL, hashtag. Kontaktuppgifter finns REDAN i mallen.",
    "- Använd EN tydlig hook-typ och gör den scrollstoppande enligt playbooken (komprimerad till affisch-längd).",
    "- Gyllene-zonen-kedjan: rubrik väcker → underrubrik skärper → body ger igenkänning eller konkret nytta.",
    "- Målgruppens EGNA ord ur profilen. Svenska tecken å/ä/ö korrekt. Uppfinn inget utanför kundens värld.",
  ].filter(Boolean).join("\n");

  const b = await byggTextPrompt({
    clientId: opts.clientId,
    syfte: "studio-text", // pa-bild-anatomin — harmonierar med CTA-förbudet i uppdraget
    uppdrag,
    knowledge: ["hook-playbook"],
    // KVALITET-3/punkt 5: ämnet och inläggets grundtext är det ANVÄNDAREN skrev.
    // Står ett pris där är det hens beslut; annars gäller prisregeln fullt ut.
    anvandarText: [opts.topic || "", caption].filter(Boolean).join("\n"),
    bildKontext:
      caption || bildDesc
        ? {
            caption: caption
              ? `"${caption.slice(0, 700)}". Texten på bilden ska höra ihop med detta budskap — inte upprepa det ordagrant, utan fånga kärnan i några få ord.`
              : undefined,
            bildbeskrivning: bildDesc
              ? `${bildDesc}. Texten ska förstärka bildens roll i berättelsen, aldrig säga emot det man ser.`
              : undefined,
            bildRoll: rollGuide || undefined,
          }
        : undefined,
  });

  // Grindkälla för siffergrinden = profilen (lager 3) + winning examples. Samma innehåll
  // som den gamla egen-hämtade profilen bar (getProfileAsMarkdown vävde in winning-blocket)
  // — nu utan en andra DB-läsning, och alltid för RÄTT klient (förr: sessionshärledd,
  // vilket i skript/cron tyst blev standardklientens profil).
  const grindKalla = [b.profilText, ...b.winning].filter(Boolean).join("\n");
  const harSiffror = profilHarSiffror(grindKalla);
  // KVALITET-3/punkt 5: undantaget läses ur ANVÄNDARENS text (ämne + inläggets
  // grundtext), aldrig ur profilen. Samma källa som kärnan använder för promptlagret,
  // så prompt och grind aldrig kan säga emot varandra.
  const prisTillatet = harPrisuppgift([opts.topic || "", caption].filter(Boolean).join("\n"));
  const hooks = tillatnaHooks(opts.imageRole, harSiffror);

  const userPrompt = [
    `Ämne/vinkel: ${opts.topic?.trim() || (caption ? "utgå från inläggets grundtext ovan" : "välj den starkaste vinkeln för verksamheten")}. Postformat: ${opts.format}.`,
    "Returnera ENDAST strikt JSON, inga kodstaket, inga kommentarer:",
    `{"hookType":"${hooks.join("|")}","headline1":"...","headline2":"...","body":"..."}`,
  ].join("\n");

  const result = await iterateGenerate({
    prebuilt: { system: b.system, fingerprint: b.fingerprint, winning: b.winning },
    userPrompt,
    clientId: opts.clientId,
    category: "studio_copy",
    variants: 7, // fler råförslag → större chans att ≥3 distinkta överlever filter + dedup
    // En hook-typ per försök, men BARA hooks som passar bildens roll (problembild → problem/fråga,
    // lösningsbild → påstående/resultat) och med statistik bortgrindad utan verifierade siffror.
    variantSuffixes: hooks.map(
      (h) => `DITT FÖRSÖK: använd hook-typen "${h}" och en egen vinkel som de andra försöken inte kan råka landa på. Sätt hookType till exakt "${h}".`,
    ),
    temperature: 0.9,
    maxTokens: 400,
  });

  const out: { s: StudioCopySuggestion; score: number }[] = [];
  const seen = new Set<string>();
  // Alla siffer-/pris-tokens i profilen som en mängd (utan mellanslag/tusenavgränsare).
  // "21 000 kr" → "21000". Används för att backa VARJE siffra i förslaget — även små tal
  // och kvoter som "7 av 10" (annars slipper påhittad statistik förbi).
  const profilTal = new Set<string>();
  for (const m of grindKalla.matchAll(/\d[\d\s.,]*\d|\d/g)) profilTal.add(m[0].replace(/[\s.,]/g, ""));
  // Statistik-PÅSTÅENDEN ("8 av 10", "40 %") kräver att HELA frasen står i profilen —
  // lösa tal räcker inte ("8" och "10" finns som öppettider men "8 av 10 kunder" är påhitt).
  const profilKomp = grindKalla.normalize("NFC").toLowerCase().replace(/[\s ]/g, "");
  const tillatna = new Set(hooks); // deterministisk backstop för roll-styrning + statistik-grind
  for (const v of result.all_variants) {
    const obj = parseJson(v.text);
    if (!obj) continue;
    const s: StudioCopySuggestion = {
      hookType: str(obj.hookType),
      headline1: str(obj.headline1),
      headline2: str(obj.headline2),
      body: str(obj.body),
    };
    if (!s.headline1 || !s.body) continue;
    // Statistik utan verifierade siffror, eller en hook-typ som krockar med bildens roll → bort.
    if (s.hookType && !tillatna.has(s.hookType)) continue;
    if (![s.headline1, s.headline2, s.body].filter(Boolean).every(looksComplete)) continue;
    if (![s.headline1, s.headline2, s.body].every(noForbidden)) continue;
    if ([s.headline1, s.headline2, s.body].some(hasEmojiOrList)) continue; // affisch-format: rent
    if (hasContactInfo(s.body)) continue; // telefon/URL finns redan i mallens fot
    if (arStaplad(s.body)) continue; // telegramspråk: staplade fragment
    if ([s.headline1, s.headline2, s.body].some(harCta)) continue; // CTA hör i bildtext + fot-knapp
    if ([s.headline1, s.headline2, s.body].some((f) => harObackadSiffra(f, profilTal))) continue; // aldrig påhittade siffror (även "7 av 10")
    if ([s.headline1, s.headline2, s.body].some((f) => harObackadStatistikfras(f, profilKomp))) continue; // kvot/procent-påståenden kräver frasen i profilen
    // KVALITET-3/punkt 5: siffergrinden ovan backar tal MOT PROFILEN — och sedan
    // PROFIL-1/F1 kopplade in pricing_notes står de riktiga priserna där. Ett pris
    // passerar alltså numera den grinden med heder i behåll. Det är precis vad
    // prisregeln säger nej till: priset ska tas i samtalet, inte i inlägget. Här
    // finns flera kandidater att välja mellan, så grinden kan vara hård utan att
    // riskera en tom leverans (3-av-3-loopen genererar om). Undantaget: användaren
    // skrev själv in ett pris i ämnet eller grundtexten.
    if (!prisTillatet && [s.headline1, s.headline2, s.body].some(harPrisuppgift)) continue;
    if (s.headline1.length > Math.round(softMax * 1.8) || s.body.length > 150) continue;
    // Likhets-dedup: normalisera bort småord/skiljetecken så nästan-dubbletter
    // ("Vad säger blommorna?" vs "Vad säger dina blommor?") räknas som samma.
    const key = normalizeHeadline(s.headline1);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ s, score: v.score?.total ?? 0 });
  }
  out.sort((a, b) => b.score - a.score);
  // Topp 3 men prioritera OLIKA hook-typer så de tre känns distinkta, inte tre likadana frågor.
  const picked: StudioCopySuggestion[] = [];
  const usedHooks = new Set<string>();
  for (const p of out) {
    if (picked.length >= 3) break;
    if (!usedHooks.has(p.s.hookType)) { picked.push(p.s); usedHooks.add(p.s.hookType); }
  }
  for (const p of out) {
    if (picked.length >= 3) break;
    if (!picked.includes(p.s)) picked.push(p.s);
  }
  // TEXT-1 justeringsrundan (v2): fälten gick aldrig genom saneringen — tankstreck
  // läckte rakt ut på bilderna (20 %→50 % i mätningen). Saneras EFTER score/dedup
  // (scoren ska mäta modellens råa träffsäkerhet som förut), FÖRE retur. Hashtag-
  // städet är verkningslöst här (fälten har inga hashtags) men skadar inte.
  return Promise.all(
    picked.map(async (s) => ({
      hookType: s.hookType,
      headline1: await saneraText(s.headline1, opts.clientId),
      headline2: await saneraText(s.headline2, opts.clientId),
      body: await saneraText(s.body, opts.clientId),
    })),
  );
}

// Normalisera en rubrik för likhets-jämförelse: gemener, bort skiljetecken + vanliga småord.
function normalizeHeadline(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/gi, " ")
    .replace(/\b(din|ditt|dina|en|ett|den|det|de|vi|er|ert|era|min|mitt|mina|och|som|är|för|på|att)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Hel mening? Avvisa avhuggna fragment (slutar på dinglande funktionsord).
function looksComplete(s: string): boolean {
  const t = s.trim().replace(/["'?!.…]+$/g, "").trim();
  if (t.length < 3) return false;
  return !DANGLING.test(t);
}

function noForbidden(s: string): boolean {
  const low = s.toLowerCase();
  return !FORBIDDEN.some((f) => low.includes(f));
}

// Affisch-format ska vara rent: ingen emoji/symbol/punktlista/radbrytningslista/signatur.
function hasEmojiOrList(s: string): boolean {
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2705}\u{25B6}\u{2714}\u{2022}]/u.test(s)) return true;
  if (/(^|\n)\s*[-*•▶✅]/.test(s)) return true; // punktlista
  if (/—\s*[A-ZÅÄÖ][a-zåäö]+\s*$/.test(s.trim())) return true; // signatur "— Ingela"
  return false;
}

// Telefon/URL i body → avvisa (kontaktuppgifter finns redan i mallens fot).
function hasContactInfo(s: string): boolean {
  if (/0\d[\d\s-]{5,}\d/.test(s)) return true; // svenskt telefonnummer
  if (/(https?:\/\/|www\.|\.se\b|\.com\b|opticur)/i.test(s)) return true;
  return false;
}

// Staplade fristående fragment = telegramspråk ("Syns i dagsljus. En kontakt. Offert inom 24 h.").
// Tre eller fler satser i en 90-teckens ruta är alltid stapling, aldrig en tanke.
function arStaplad(s: string): boolean {
  const satser = s.split(/[.!?:;]+/).map((d) => d.trim()).filter((d) => d.length > 1);
  return satser.length >= 3;
}

// CTA hör i bildtexten + mallens fot-knapp. Två uppmaningar bryter mot skrivregel 4.
function harCta(s: string): boolean {
  return CTA_ORD.test(s);
}

/**
 * Fail-closed siffergrind: VARJE siffra i texten måste finnas som ett verkligt tal i
 * varumärkesprofilen. Stoppar all påhittad statistik — både "400 % fler blickar" OCH små
 * kvoter som "7 av 10 går förbi" — men släpper igenom äkta prisuppgifter ("43 tum, 21 000 kr").
 * Matchar hela tal-tokens (inte delsträngar), så "7" inte råkar backas av "27500" i profilen.
 * Saknas profil → profilTal tom → alla siffror avvisas. Hellre text utan siffra än en uppfunnen.
 */
function harObackadSiffra(s: string, profilTal: Set<string>): boolean {
  for (const m of s.matchAll(/\d[\d\s.,]*\d|\d/g)) {
    if (!profilTal.has(m[0].replace(/[\s.,]/g, ""))) return true;
  }
  return false;
}

/**
 * Statistik-PÅSTÅENDEN på frasnivå: "X av Y" och "X %" måste stå som HEL fras i profilen.
 * Token-grinden ovan räcker inte — "8" och "10" kan finnas som öppettider i profilen
 * medan "8 av 10 kunder" är ren fabrikation (hände skarpt för Displayteknik).
 */
function harObackadStatistikfras(s: string, profilKomp: string): boolean {
  const komp = (fras: string) => fras.normalize("NFC").toLowerCase().replace(/[\s ]/g, "");
  for (const m of s.matchAll(/\d+\s*av\s*\d+/gi)) {
    if (!profilKomp.includes(komp(m[0]))) return true;
  }
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?\s*%/g)) {
    if (!profilKomp.includes(komp(m[0]))) return true;
  }
  return false;
}
