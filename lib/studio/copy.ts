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
  /** KVALITET-3/punkt 2b: färdig beskrivningsrad för idélistan — 1–2 fullständiga
   *  meningar, byggd av underrubrik + brödtext. Se byggBeskrivning för varför den
   *  finns: gränssnittet limmade förr ihop delarna med kolon och fick fragment. */
  beskrivning: string;
}

/** Antal idéer flödet lovar användaren ("Ge mig 3 idéer"). Löftet är en siffra, inte en gissning. */
export const ANTAL_IDEER = 3;

/**
 * KVALITET-3/punkt 2a — raden användaren ska se när löftet inte kunde hållas.
 * En källa, så gränssnittet och API:t aldrig säger olika saker. Tom sträng när
 * allt levererades: då finns inget att meddela.
 */
export function ideerMeddelande(levererat: number, begart: number = ANTAL_IDEER): string {
  return levererat >= begart ? "" : `${levererat} av ${begart} klara, generera fler`;
}

export interface StudioCopyResultat {
  suggestions: StudioCopySuggestion[];
  /** Vad som utlovades (ANTAL_IDEER). */
  begart: number;
  /** Vad som faktiskt kunde levereras. Understiger den begart har flödet gett upp efter omgenerering. */
  levererat: number;
  /** Antal genereringsrundor som kördes (1 = allt överlevde första gången). */
  forsok: number;
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
  /** G-2: 9:16 UTAN video är en story; med video är det en reel. Skiljer anatomin åt. */
  videoUrl?: string;
}

// Vilka hook-typer passar en bild i respektive roll?
// Problembild → sätt ord på problemet / ställ frågan (aldrig säljande påstående ovanpå).
// Lösningsbild → landa påståendet/resultatet. Statistik kräver ALLTID verifierade siffror.
//
// KVALITET-3/punkt 2c: "berättelse" grindas nu på samma sätt som "statistik". Skarpt
// utfall 1/8: idé-flödet levererade "Förra sommaren fick vi ett samtal / Kunden hade
// väntat i tre år" — ett uppfunnet kundcase. Sanningskravet i prompten säger redan nej,
// men så länge berättelse-hooken BEGÄRS av flödet frestas modellen att uppfinna det
// material den saknar. Utan story-bank eller kundröster i profilen begärs den inte.
function tillatnaHooks(role: StudioCopyOpts["imageRole"], harSiffror: boolean, harBerattelser: boolean): string[] {
  const bas =
    role === "problem" ? ["fråga", "konträr"]
    : role === "losning" ? ["påstående", "konträr"]
    : ["fråga", "konträr", "påstående"];
  const ut = harBerattelser ? [...bas, "berättelse"] : bas;
  return harSiffror ? [...ut, "statistik"] : ut;
}

// Har tenanten verkligt berättelsematerial? Story-bank och kundröster är de sektioner
// sanningskravet pekar på som enda tillåtna källa för ett kundcase. Rubriken räcker
// inte — den finns även när sektionen är tom, så innehållet under den måste väga något.
function profilHarBerattelser(profile: string): boolean {
  for (const namn of ["Story-bank", "Customer Voice", "Voice of Customer", "Kundröster"]) {
    const re = new RegExp(`(?:^|\\n)#{1,3}\\s*(?:═+\\s*)?${namn}[^\\n]*\\n([\\s\\S]*?)(?=\\n#|$)`, "i");
    const m = profile.match(re);
    if (m && m[1].replace(/[\s\-*_"'.]/g, "").length >= 40) return true;
  }
  return false;
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

export async function generateStudioCopyResultat(opts: StudioCopyOpts): Promise<StudioCopyResultat> {
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

  // G-2: en STORY är inte ett inlägg i annan storlek. Den ses i helskärm, i några
  // sekunder, och försvinner efter ett dygn — ett inläggs textmängd blir oläsbar där.
  // Före G-2 fanns story inte ens som syfte (G0 0.3a) och fick pa-bild-anatomin rakt av.
  const arStory = opts.format === "1080x1920" && !opts.videoUrl;

  const b = await byggTextPrompt({
    clientId: opts.clientId,
    // pa-bild-anatomin harmonierar med CTA-förbudet i uppdraget; storyn har sin egen.
    syfte: arStory ? "story" : "studio-text",
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
  const anvandarKalla = [opts.topic || "", caption].filter(Boolean).join("\n");
  const prisTillatet = harPrisuppgift(anvandarKalla);
  const hooks = tillatnaHooks(opts.imageRole, harSiffror, profilHarBerattelser(grindKalla));

  const userPrompt = [
    `Ämne/vinkel: ${opts.topic?.trim() || (caption ? "utgå från inläggets grundtext ovan" : "välj den starkaste vinkeln för verksamheten")}. Postformat: ${opts.format}.`,
    "Returnera ENDAST strikt JSON, inga kodstaket, inga kommentarer:",
    `{"hookType":"${hooks.join("|")}","headline1":"...","headline2":"...","body":"..."}`,
  ].join("\n");

  // Alla siffer-/pris-tokens i profilen som en mängd (utan mellanslag/tusenavgränsare).
  // "21 000 kr" → "21000". Används för att backa VARJE siffra i förslaget — även små tal
  // och kvoter som "7 av 10" (annars slipper påhittad statistik förbi).
  //
  // KVALITET-3/punkt 5 (fail-safe): ANVÄNDARENS egen text räknas som källa här, inte
  // bara profilen. Grindens uppgift är att stoppa PÅHITTADE tal, och ett tal användaren
  // själv skrivit in i sitt ämne är per definition inte påhittat av modellen — det ska
  // aldrig skalas bort. Vilka HOOK-TYPER som är tillåtna avgörs däremot fortsatt av
  // profilen ensam (profilHarSiffror ovan): statistik-hooken kräver verifierade siffror
  // i varumärket, inte ett tal någon råkade nämna i ämnesraden.
  const backningsKalla = [grindKalla, anvandarKalla].filter(Boolean).join("\n");
  const profilTal = new Set<string>();
  for (const m of backningsKalla.matchAll(/\d[\d\s.,]*\d|\d/g)) profilTal.add(m[0].replace(/[\s.,]/g, ""));
  // Statistik-PÅSTÅENDEN ("8 av 10", "40 %") kräver att HELA frasen står i profilen —
  // lösa tal räcker inte ("8" och "10" finns som öppettider men "8 av 10 kunder" är påhitt).
  const profilKomp = backningsKalla.normalize("NFC").toLowerCase().replace(/[\s\u00a0]/g, "");
  const tillatna = new Set(hooks); // deterministisk backstop för roll-styrning + statistik-grind

  // Kandidater som överlevt grindarna, delade mellan genereringsrundorna.
  const out: { s: StudioCopySuggestion; score: number }[] = [];
  const seen = new Set<string>();

  // Grindarna i EN funktion, så omgenereringen döms med exakt samma måttstock som
  // första rundan. Returnerar antalet nya kandidater som överlevde.
  const samlaKandidater = (varianter: { text: string; score: { total: number } | null }[]): number => {
    let nya = 0;
    for (const v of varianter) {
      const obj = parseJson(v.text);
      if (!obj) continue; // parsningsfall — räknas som ett bortfall, rättas av omgenereringen
      const s: StudioCopySuggestion = {
        hookType: str(obj.hookType),
        headline1: str(obj.headline1),
        headline2: str(obj.headline2),
        body: str(obj.body),
        beskrivning: "",
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
      // KVALITET-3/punkt 2c: kvantifierade löften i ORDFORM ("dubbelt så många gäster",
      // "betalar sig själv på tre månader"). Siffergrinden ovan ser dem inte — de
      // innehåller ingen siffra — men de lovar en mätbar storlek eller tid och kräver
      // därför samma täckning i profilen.
      if ([s.headline1, s.headline2, s.body].some((f) => harObackatKvantLofte(f, profilKomp))) continue;
      // KVALITET-3/punkt 2c: ett uppfunnet kundcase ("Förra sommaren fick vi ett
      // samtal") är samma sorts brott som en uppfunnen siffra — en idé som lovar
      // något den inte kan backa. Fail-closed mot story-bank och kundröster.
      if ([s.headline1, s.headline2, s.body].some((f) => harObackatMinne(f, profilKomp))) continue;
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
      // Gäller ÄVEN över rundgränser: en omgenerering får inte ge samma idé igen.
      const key = normalizeHeadline(s.headline1);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      s.beskrivning = byggBeskrivning(s.headline1, s.headline2, s.body);
      out.push({ s, score: v.score?.total ?? 0 });
      nya++;
    }
    return nya;
  };

  // Välj topp N, men prioritera OLIKA hook-typer så idéerna känns distinkta.
  const valj = (): StudioCopySuggestion[] => {
    const sorterade = [...out].sort((a, b) => b.score - a.score);
    const picked: StudioCopySuggestion[] = [];
    const usedHooks = new Set<string>();
    for (const p of sorterade) {
      if (picked.length >= ANTAL_IDEER) break;
      if (!usedHooks.has(p.s.hookType)) { picked.push(p.s); usedHooks.add(p.s.hookType); }
    }
    for (const p of sorterade) {
      if (picked.length >= ANTAL_IDEER) break;
      if (!picked.includes(p.s)) picked.push(p.s);
    }
    return picked;
  };

  // KVALITET-3/punkt 2a: 3-av-3 DETERMINISTISKT. Förr kunde antalet variera mellan 2
  // och 3 mellan körningar på samma ämne: 7 råförslag gick genom parsning, tolv
  // kvalitetsgrindar och en likhets-dedup, och hur många som överlevde var slumpens
  // sak. Ett bortfall är inte ett fel i grindarna — de ska vara hårda — utan ett skäl
  // att GENERERA OM. Loopen kör därför nya rundor tills löftet är infriat, med
  // hook-typerna som saknas först och ett uttryckligt "de andra föll på kvalitets-
  // grindarna" i instruktionen. Taket på tre rundor finns för att en profil som helt
  // saknar underlag aldrig ska kunna hålla anropet uppe i det oändliga; då levereras
  // det som finns, och anroparen får begart/levererat och kan säga det rakt ut i UI:t.
  const MAX_RUNDOR = 3;
  let forsok = 0;
  let picked: StudioCopySuggestion[] = [];
  for (let runda = 1; runda <= MAX_RUNDOR; runda++) {
    const saknas = ANTAL_IDEER - picked.length;
    // Runda 1 tar hela bredden. Omgenereringen behöver bara täcka bortfallet, men med
    // marginal: grindarna fäller en del av dem också.
    const variants = runda === 1 ? 7 : Math.min(7, Math.max(3, saknas * 2 + 1));
    // Hook-typer som ännu inte gett en vald idé först — så omgenereringen fyller
    // luckan i stället för att producera en fjärde variant av det som redan finns.
    const anvanda = new Set(picked.map((p) => p.hookType));
    const kvar = hooks.filter((h) => !anvanda.has(h));
    const rundansHooks = kvar.length ? kvar : hooks;
    forsok = runda;

    let result;
    try {
      result = await iterateGenerate({
        prebuilt: { system: b.system, fingerprint: b.fingerprint, winning: b.winning },
        userPrompt: runda === 1 ? userPrompt : `${userPrompt}\n\nOMTAG: tidigare förslag föll på kvalitetsgrindarna (avhugget fragment, uppmaning i affischtexten, obackad siffra eller pris, eller för likt ett annat förslag). Skriv en HELT NY idé med en egen vinkel, hela meningar och inga tal som inte står i varumärkesprofilen.`,
        clientId: opts.clientId,
        category: "studio_copy",
        variants,
        // En hook-typ per försök, men BARA hooks som passar bildens roll (problembild → problem/fråga,
        // lösningsbild → påstående/resultat) och med statistik bortgrindad utan verifierade siffror.
        // G-3: varje variant loggas med den hooktyp den ombads anvanda.
        hookTyper: rundansHooks,
        variantSuffixes: rundansHooks.map(
          (h) => `DITT FÖRSÖK: använd hook-typen "${h}" och en egen vinkel som de andra försöken inte kan råka landa på. Sätt hookType till exakt "${h}".`,
        ),
        // Höjd temperatur i omtagen: samma prompt vid samma temperatur tenderar att ge
        // tillbaka samma förslag, och dedupen slänger det direkt.
        temperature: runda === 1 ? 0.9 : 1,
        maxTokens: 400,
        // G-1: studio-texten är den som trycks PÅ bilden (pa-bild-anatomin). Formatet
        // sätts inte här — texten skrivs innan användaren låst bildstorleken.
        generering: {
          syfte: arStory ? "story" : "studio-text",
          promptVersion: b.meta.promptVersion,
          funnel: b.meta.funnel,
          lager: b.meta.lager,
          varianter: variants,
        },
      });
    } catch (e) {
      // Fail-open: ett tappat omtag får aldrig radera det som redan lyckats.
      console.error(`[studio/copy] genereringsrunda ${runda} misslyckades:`, e);
      break;
    }

    samlaKandidater(result.all_variants);
    picked = valj();
    if (picked.length >= ANTAL_IDEER) break;
    console.warn(`[studio/copy] runda ${runda}: ${picked.length}/${ANTAL_IDEER} idéer överlevde grindarna, genererar om.`);
  }

  // TEXT-1 justeringsrundan (v2): fälten gick aldrig genom saneringen — tankstreck
  // läckte rakt ut på bilderna (20 %→50 % i mätningen). Saneras EFTER score/dedup
  // (scoren ska mäta modellens råa träffsäkerhet som förut), FÖRE retur. Hashtag-
  // städet är verkningslöst här (fälten har inga hashtags) men skadar inte.
  const suggestions = await Promise.all(
    picked.map(async (s) => {
      const [headline1, headline2, body] = await Promise.all([
        saneraText(s.headline1, opts.clientId, undefined, { prisTillatet }),
        saneraText(s.headline2, opts.clientId, undefined, { prisTillatet }),
        saneraText(s.body, opts.clientId, undefined, { prisTillatet }),
      ]);
      // Beskrivningen byggs OM efter saneringen: saneraText kan ändra orden
      // (tankstreck, floskler, terminologi) och beskrivningen ska visa det som
      // faktiskt hamnar på bilden, inte den osanerade råtexten.
      return { hookType: s.hookType, headline1, headline2, body, beskrivning: byggBeskrivning(headline1, headline2, body) };
    }),
  );

  if (suggestions.length < ANTAL_IDEER) {
    console.warn(`[studio/copy] levererar ${suggestions.length}/${ANTAL_IDEER} idéer efter ${forsok} rundor (${opts.clientId}).`);
  }
  return { suggestions, begart: ANTAL_IDEER, levererat: suggestions.length, forsok };
}

/**
 * Bakåtkompatibel form: bara listan. Skripten (scripts/text1-*.mts) och äldre
 * anropare vill ha en array. Löftesräkningen finns i generateStudioCopyResultat.
 */
export async function generateStudioCopy(opts: StudioCopyOpts): Promise<StudioCopySuggestion[]> {
  return (await generateStudioCopyResultat(opts)).suggestions;
}

/**
 * KVALITET-3/punkt 2b — beskrivningsraden för idélistan.
 *
 * ROTORSAK till de trasiga beskrivningarna ("aktuell?:", "gäster.:"): gränssnittet
 * renderade `{headline2}: {body}`. Underrubriken är i regel en HEL mening med egen
 * slutpunkt eller frågetecken, så kolonet hamnade efter ett avslutat påstående och
 * gav ett fragment. Felet satt alltså varken i prompten eller i parsningen utan i
 * hopfogningen — och därför byggs raden nu på servern, en gång, som riktig text.
 *
 * Regler: 1–2 FULLSTÄNDIGA meningar. Varje del avslutas med skiljetecken. Hooken
 * (headline1) är rubriken och upprepas aldrig i beskrivningen. Dubbletter faller.
 */
export function byggBeskrivning(headline1: string, headline2: string, body: string): string {
  const hook = normalizeHeadline(headline1 || "");
  const alla = [...delaMeningar(headline2), ...delaMeningar(body)].map(avslutaMening).filter(Boolean);
  // En del som börjar med liten bokstav är en FORTSÄTTNING på rubriken, inte en egen
  // mening: modellen delar ibland en mening över headline1 → headline2 ("Varje dag du
  // väntar" / "passerar kunder utan att se dig."). På affischen läses de ihop, men i
  // idélistan står rubriken för sig och fortsättningen blir ett fragment. Faller allt
  // bort behåller vi originalet — hellre en svag rad än en tom.
  const helaMeningar = alla.filter((m) => /^[^a-zåäö]/.test(m));
  const kandidater = helaMeningar.length ? helaMeningar : alla;
  const ut: string[] = [];
  const sedda = new Set<string>();
  for (const m of kandidater) {
    // normalizeHeadline städar bort småord och kan ge tom sträng för en kort mening
    // ("Ett. Två."). Rå gemener som reserv, annars tappas meningen helt.
    const n = normalizeHeadline(m) || m.toLowerCase();
    if (sedda.has(n)) continue;
    if (hook && n === hook) continue; // hooken är rubriken, inte beskrivning
    sedda.add(n);
    ut.push(m);
    if (ut.length === 2) break;
  }
  return ut.join(" ");
}

/** Dela upp i meningar och behåll skiljetecknet. Tom sträng ger tom lista. */
function delaMeningar(s: string): string[] {
  return (String(s || "").match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).map((m) => m.trim()).filter(Boolean);
}

/**
 * Gör delen till en avslutad mening. Släpande kolon, semikolon och komma tas bort
 * först: det är just de tecknen som gjorde raden till ett fragment när delarna
 * limmades ihop.
 */
function avslutaMening(s: string): string {
  const t = String(s || "").trim().replace(/[\s:;,]+$/, "");
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
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
/**
 * KVALITET-3/punkt 2c: kvantifierade löften i ORDFORM.
 *
 * Skarptestet av idé-flödet fällde "dubbelt så många gäster" och "betalar sig själv
 * på tre månader". Ingen av dem innehåller en siffra, så både modellen och den
 * teckenbaserade siffergrinden ovan såg rakt igenom dem. De är ändå sifferpåståenden:
 * de lovar en mätbar STORLEK eller en mätbar TID. Fail-closed på samma sätt som
 * statistikfraserna — hela uttrycket måste stå i profilen, annars faller förslaget.
 *
 * Mönstren är branschneutrala: de träffar löftets FORM, inte en viss produkt. Samma
 * grind fäller "dubbelt så många bröllop" hos floristen och "halva tiden" hos coachen.
 */
const ORDTAL = "(?:en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv)";
const KVANT_MONSTER: RegExp[] = [
  // Multiplikatorer och andelar: "dubbelt så många", "halva tiden", "hälften av".
  /\b(?:dubbelt|dubbla|tredubbelt|tredubbla|fyrdubbelt|tiodubbelt|hälften|halva\s+(?:tiden|priset|kostnaden|jobbet|arbetet))\b/gi,
  // "tre gånger fler", "två ggr så snabbt".
  new RegExp(`\\b${ORDTAL}\\s+(?:gånger|ggr)\\b`, "gi"),
  // Återbetalningslöften. Både infinitiv och presens: skarptestet gav "börjar tjäna
  // in sig redan första veckan" där en presensbunden lista ("tjänar") missade träffen.
  /\b(?:betalar?\s+sig|tjänar?\s+in\s+sig)\b/gi,
  // Tidslöften i ordform: "på tre månader", "redan efter en vecka", "redan första veckan".
  // Tidsordet matchas på STAM + böjning ("vecka", "veckor", "månader", "året") —
  // en handskriven ändelselista missade "vecka" och släppte igenom hela löftet.
  // "i" är med: skarptestet gav "Kunden hade väntat i tre år" — samma mätbara tid.
  // Ordningstalen med: "första veckan" lovar lika mycket som "en vecka".
  new RegExp(
    `\\b(?:i|på|inom|redan(?:\\s+efter)?|efter|ta[gr]?\\s+bara)\\s+(?:den\\s+)?(?:${ORDTAL}|första|andra|tredje|fjärde|femte)\\s+(?:sekund|minut|timm|dygn|dag|veck|månad|kvartal|år)[a-zåäö]*\\b`,
    "gi",
  ),
  // Kvantitativa jämförelser i ordform. Fångad i skarptestet 1/8: "Ett träd som
  // faller fel kostar mer än tio offertsamtal" — en uppfunnen storlek, klädd i ord.
  // "en/ett" är uteslutet: "mer än en gång" är idiom, inte ett mätbart påstående.
  /\b(?:mer|mindre|fler|färre|över|under)\s+än\s+(?:två|tre|fyra|fem|sex|sju|åtta|nio|tio|elva|tolv)\b/gi,
];

/**
 * KVALITET-3/punkt 2c: MINNESMARKÖRER — ett specifikt kundcase utan täckning.
 *
 * Sanningskravet i prompt-core förbjuder redan uppfunna minnen, men skarptestet 1/8
 * visade att idé-flödet ändå levererade "Förra sommaren fick vi ett samtal. Kunden
 * hade väntat i tre år." Regeln behöver alltså en deterministisk backstop, precis
 * som statistikfraserna har.
 *
 * Markörerna är formuleringar som PÅSTÅR en specifik händelse: en tidpunkt i det
 * förflutna, en namngiven part eller ett samtal som ska ha ägt rum. Generella
 * observationer ("vi möter ofta", "vi hör det varje höst") träffas inte — det är
 * exakt den formuleringen sanningskravet anvisar som väg ut.
 *
 * Fail-closed mot samma källa som siffrorna: står händelsen i story-banken eller
 * bland kundrösterna passerar den.
 */
const MINNESMARKORER: RegExp[] = [
  /\b(?:förra|i)\s+(?:somras|våras|höstas|vintras|sommaren|våren|hösten|vintern|veckan|månaden|året)\b/gi,
  /\b(?:häromdagen|häromveckan|nyligen kom|för ett tag sedan)\b/gi,
  /\bjag\s+minns\b/gi,
  /\b(?:en|ett)\s+(?:av\s+våra\s+)?kund(?:er|)\w*\s+(?:som|berättade|hörde|ringde|sa)\b/gi,
  /\b(?:fick|hade)\s+vi\s+(?:ett|en)\s+(?:samtal|telefonsamtal|mejl|förfrågan)\b/gi,
  /\bringde\s+(?:oss|mig)\b/gi,
];

function harObackatMinne(s: string, profilKomp: string): boolean {
  const komp = (fras: string) => fras.normalize("NFC").toLowerCase().replace(/[\s ]/g, "");
  for (const re of MINNESMARKORER) {
    for (const m of String(s || "").matchAll(re)) {
      if (!profilKomp.includes(komp(m[0]))) return true;
    }
  }
  return false;
}

function harObackatKvantLofte(s: string, profilKomp: string): boolean {
  const komp = (fras: string) => fras.normalize("NFC").toLowerCase().replace(/[\s ]/g, "");
  for (const re of KVANT_MONSTER) {
    for (const m of String(s || "").matchAll(re)) {
      if (!profilKomp.includes(komp(m[0]))) return true;
    }
  }
  return false;
}

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
