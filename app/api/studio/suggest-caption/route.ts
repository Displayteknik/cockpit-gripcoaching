import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generateWithUsage } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { hamtaNyligen } from "@/lib/rotation";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { ctaVagForVariant, perspektivForVariant, vinkelMedVag } from "@/lib/cta-vagar";
import { BERATTELSE_UTAN_STORYBANK, MINNE_SKARPNING, harStorybank, hittaUppfunnetMinne } from "@/lib/minnesgrind";
import { sakerstallCaption, talTokens } from "@/lib/content/writing-rules";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Slide { kind?: string; headline?: string; body?: string }

const TYPE_LABEL: Record<string, string> = {
  reel: "en reel (rörlig video)", story: "en story", carousel: "en karusell (flera bilder att svepa)", post: "ett inlägg med bild",
};

// AI-språk som aldrig får slinka igenom (inkl. "handlar (inte) om"-klichén).
const BANNED = [/kraftfull/i, /banbrytande/i, /game-?changer/i, /handlar\s+(inte\s+)?om/i, /nästa\s+nivå/i, /holistisk/i, /skalbar/i];
function hasBanned(t: string): boolean {
  return BANNED.some((re) => re.test(t));
}

// Mekanisk sista-utväg: byt ut inrotade klichéer modellen vägrar släppa (särskilt "handlar om").
function sanitizeCaption(t: string): string {
  return t
    .replace(/\bhandlar\s+inte\s+om\b/gi, "gäller inte")
    .replace(/\bhandlar\s+om\b/gi, "gäller")
    .replace(/\bkraftfullt\b/gi, "starkt").replace(/\bkraftfulla\b/gi, "starka").replace(/\bkraftfull\b/gi, "stark")
    .replace(/\bbanbrytande\b/gi, "nyskapande")
    .replace(/\bnästa\s+nivå\b/gi, "längre")
    .replace(/\bholistiskt?\b/gi, "helhet").replace(/\bholistiska\b/gi, "helhets")
    .replace(/\bskalbar[t]?\b/gi, "lätt att växa");
}

// POST /api/studio/suggest-caption — { headline, headline2, body, topic, slides[], postType }
// Genererar en färdig, strukturerad social-caption (brödtexten man LÄSER, inte affisch-text)
// grundad i HELA inläggets innehåll + varumärkesröst. Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const clientId = await resolveClientId();
    const b = await req.json().catch(() => ({}));
    const headline = (b.headline || "").toString().slice(0, 200);
    const headline2 = (b.headline2 || "").toString().slice(0, 200);
    const body = (b.body || "").toString().slice(0, 400);
    const topic = (b.topic || "").toString().slice(0, 200);
    const postType = (b.postType || "post").toString();
    const slides: Slide[] = Array.isArray(b.slides) ? b.slides.slice(0, 12) : [];

    const isCarousel = slides.length > 0;
    const longer = isCarousel || postType === "reel";

    // TEXT-1 T-2: prompten byggs av prompt-core (brand-profil, röst, winning, anatomi/compass,
    // kit-donts och skrivregler ägs av kärnan). Den gamla egna STRUKTUR-sektionen är ersatt av
    // kärnans anatomilager (planbeslut) — kvar här är kanal-/längdregler + språkregler.
    const uppdrag = [
      `Du skriver bildtexten (captionen) till ${TYPE_LABEL[postType] || "ett socialt inlägg"} (Instagram/Facebook) för ${client?.name || "kunden"}.`,
      "Detta är texten man LÄSER under/bredvid inlägget — inte text på bilden. Skriv som en människa, varmt och konkret.",
      "\n=== KANAL & LÄNGD ===",
      `- ${longer ? "2–4 korta stycken" : "1–2 korta stycken"} som ger konkret värde/berättelse. Radbryt för luft.`,
      isCarousel ? "- Knyt ihop karusellens poänger till en helhet (räkna inte bara upp dem)." : "",
      postType === "reel" ? "- Skriv så att den funkar till en reel: fånga i första raden, driv till att titta klart." : "",
      "- 3–5 relevanta hashtags på egen rad sist.",
      "\n=== SPRÅK ===",
      "- Svenska tecken å/ä/ö korrekt. Naturligt, mänskligt språk. Emoji sparsamt (0–2), bara om det passar rösten.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
      "- Inga telefonnummer/URL:er. Returnera ENDAST själva captionen (med radbrytningar), ingen förklaring.",
    ].filter(Boolean).join("\n");

    const contentBlock = isCarousel
      ? "Karusellens slides:\n" + slides.map((s, i) => `${i + 1}. [${s.kind || "slide"}] ${s.headline || ""}${s.body ? ` — ${s.body}` : ""}`).join("\n")
      : [headline ? `Rubrik på bilden: ${headline}.` : "", headline2 ? `Underrubrik: ${headline2}.` : "", body ? `Text på bilden: ${body}.` : ""].filter(Boolean).join("\n");

    // T-6c (rotation), G-3d: senaste sparade captions (första raden = öppningen) →
    // "NYLIGEN ANVÄNT" i kärnan, så nästa caption inte återanvänder samma ingång.
    const nyligen = await hamtaNyligen(clientId, "caption");

    const bygg = await byggTextPrompt({
      clientId,
      syfte: "caption",
      kanal: "instagram",
      uppdrag,
      underlag: [
        topic ? `Ämne: ${topic}.` : "",
        contentBlock,
        "\nSkriv captionen nu — strukturerad enligt reglerna.",
      ].filter(Boolean).join("\n"),
      compass: b.compass && typeof b.compass === "object" ? b.compass : undefined,
      nyligen,
      // KVALITET-3/punkt 5: ämnet är det användaren själv skrev. Skrev hen in ett
      // pris där är det hens beslut och undantaget öppnas. Rubrik/brödtext på bilden
      // räknas INTE som medgivande — de är genererade och kan bära ett läckt pris.
      anvandarText: topic,
    });

    // Generera EN caption med given krok-vinkel + grinda mot AI-språk (regenerera 2 ggr).
    // Krok-vinkeln läggs som variant-suffix på underlaget (TEXT-1).
    // G-1c: genOne lämnar tillbaka sitt genererings-id. Lokalt per anrop, inte i en
    // delad variabel: A/B-läget kör tre varianter PARALLELLT och en gemensam `let`
    // hade gett dem varandras id:n.
    const genOne = async (vinkelInstruktion: string, skarpning = ""): Promise<{ text: string; generationId: string | null }> => {
      const prompt = vinkelInstruktion ? `${bygg.user}\n\n=== KROK-VINKEL ===\n${vinkelInstruktion}` : bygg.user;
      // KVALITET-3/11: CTA-skärpningen läggs SIST i systemprompten (väger tyngst) och
      // bara i omgenereringen — första försöket ska aldrig veta att den finns.
      const bas = skarpning ? `${bygg.system}\n\n${skarpning}` : bygg.system;
      let out = "";
      let sisteGenerationId: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const sys = attempt === 0 ? bas : `${bas}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående förslag innehöll ett förbjudet uttryck. Skriv om HELT och undvik varje form av "handlar om", "kraftfull", "banbrytande", "nästa nivå", "holistisk", "skalbar". Var konkret och mänsklig.`;
        const svar = await generateWithUsage({
          model: "gemini-2.5-flash", systemInstruction: sys, prompt,
          temperature: attempt === 0 ? 0.9 : 0.7,
          maxOutputTokens: longer ? 700 : 500,
          skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
          // G-1: även omtagen loggas. En promptversion som ofta fastnar i
          // floskelgrinden är sämre än en som inte gör det — det syns bara i datan.
          generering: {
            syfte: "caption",
            promptVersion: bygg.meta.promptVersion,
            funnel: bygg.meta.funnel,
            lager: bygg.meta.lager,
          },
        });
        out = svar.text.trim();
        sisteGenerationId = svar.generationId ?? sisteGenerationId;
        if (!hasBanned(out)) break;
      }
      return { text: hasBanned(out) ? sanitizeCaption(out) : out, generationId: sisteGenerationId };
    };

    // Tal som får förekomma: profilens verifierade siffror + det användaren själv skrev.
    // Håkans beslut 1/8: kravet gäller VARJE siffra, även jämförelser med omvärlden
    // ("en vanlig TV klarar 400 nits"). Saknas talet skrivs påståendet generellt.
    // OBS: profiltexten heter `bygg.profilText`. `b` är request-bodyn (any) — läser man
    // `b.profilText` blir det undefined utan att TypeScript klagar, och DÅ flaggas varje
    // siffra som obackad. Det hände i DoD-körning 3: DT:s äkta "offert inom 24 timmar"
    // fälldes. En tom grindkälla är ett tyst fel som ser ut som en sträng regel.
    const tillatnaTal = new Set<string>([
      ...talTokens(bygg.profilText),
      ...talTokens(topic),
      ...talTokens(headline),
      ...talTokens(headline2),
      ...talTokens(body),
    ]);

    // KVALITET-3/punkt 11 — CTA-golvets efterhandskontroll.
    // Promptregeln räcker inte: skarp drift gav en caption med korrekt imperativ-CTA och
    // nästa med ett konstaterande plus hashtags. Kontrollen körs på den FÄRDIGA texten
    // (efter saneraText, alltså exakt det användaren ser) och utlöser EXAKT en
    // omgenerering. Fail-open: går det ändå inte levereras bästa försöket, aldrig tomt.
    const genMedCtaGolv = async (
      vinkelInstruktion: string,
      etikett: string,
    ): Promise<{ caption: string; ctaOmgenererad: boolean; ctaGodkand: boolean; generationId: string | null; minnesTraffar: string[]; minnesOmgenererad: boolean }> => {
      const f = await genOne(vinkelInstruktion);
      // G-1c: id:t för den SENASTE genereringen i den här varianten. Alla försök här
      // delar samma prompt (samma `bygg`), så promptversionen är densamma oavsett
      // vilket försök som till slut blev texten — och det är promptversionen mätningen
      // frågar efter. Att spåra exakt vilket omtag som vann hade krävt att
      // sakerstallCaptions fail-open-val läckte ut, utan att svara på en enda ny fråga.
      let valdId = f.generationId;
      const forsta = await saneraText(f.text, clientId);
      const r = await sakerstallCaption(
        forsta,
        tillatnaTal,
        async (skarpning) => {
          const o = await genOne(vinkelInstruktion, skarpning);
          valdId = o.generationId ?? valdId;
          return saneraText(o.text, clientId);
        },
        etikett,
      );
      // T-6b-GRIND (Håkans fynd 10/8): fälls ett uppfunnet minne om en enskild kund görs
      // EXAKT en omgenerering med förbudet plus alternativet. Håller texten sig fortfarande
      // inte lämnas varianten UTAN caption — den slängs av anroparen. Fail-open är fel väg
      // här: en påhittad scen om en verklig människas hälsa är värre än en variant mindre.
      let text = r.text;
      let minnesTraffar = hittaUppfunnetMinne(text);
      let minnesOmgenererad = false;
      if (minnesTraffar.length) {
        console.error(`[suggest-caption] ${etikett}: uppfunnet minne (${minnesTraffar.join(" | ")}) — genererar om`);
        minnesOmgenererad = true;
        try {
          const o = await genOne(vinkelInstruktion, MINNE_SKARPNING);
          const sanerad = await saneraText(o.text, clientId);
          const igen = hittaUppfunnetMinne(sanerad);
          if (!igen.length) {
            // Omtaget måste också klara CTA-golvet — annars byter vi ett fel mot ett annat.
            const r2 = await sakerstallCaption(sanerad, tillatnaTal, async (sk) => {
              const o2 = await genOne(vinkelInstruktion, `${MINNE_SKARPNING}

${sk}`);
              return saneraText(o2.text, clientId);
            }, `${etikett}/minne`);
            if (!hittaUppfunnetMinne(r2.text).length) {
              text = r2.text;
              valdId = o.generationId ?? valdId;
              minnesTraffar = [];
            } else {
              minnesTraffar = hittaUppfunnetMinne(r2.text);
            }
          } else {
            minnesTraffar = igen;
          }
        } catch (e) {
          console.error(`[suggest-caption] ${etikett}: omgenereringen mot uppfunnet minne failade:`, e);
        }
      }
      if (minnesTraffar.length) {
        console.error(`[suggest-caption] ${etikett}: KASSERAD — minnet stod kvar efter omtag (${minnesTraffar.join(" | ")})`);
        return { caption: "", ctaOmgenererad: r.omgenererad, ctaGodkand: r.godkand, generationId: valdId, minnesTraffar, minnesOmgenererad };
      }
      return { caption: text, ctaOmgenererad: r.omgenererad, ctaGodkand: r.godkand, generationId: valdId, minnesTraffar: [] as string[], minnesOmgenererad };
    };

    // A/B-läge: distinkta krok-vinklar så varianterna faktiskt skiljer sig (spec Fas D).
    const ANGLAR: { angle: string; instruktion: string }[] = [
      { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag." },
      { angle: "Påstående", instruktion: "Öppna med ett djärvt, konkret PÅSTÅENDE (en sanning eller en vanlig myt du motbevisar)." },
      // T-6b: berättelse-vinkeln var kända syndaren för fabricerade minnen ("Jag minns en
      // fastighetsägare...") — suffixet får aldrig UPPMANA till påhitt, bara till grundat material.
      // ★ KUNDRÖSTER ÄR INTE EN BERÄTTELSEKÄLLA. Den tidigare lydelsen sa "ENDAST hämtad ur
      //   story-bank ELLER KUNDRÖSTER" och därefter "hitta aldrig på ett specifikt minne".
      //   Det är två motstridiga meningar, och modellen följde tillståndet: den tog
      //   "Jag har gett upp. Det finns ingen som lyssnar" ur For Balances customer voice och
      //   byggde ett specifikt minne runt orden — "Jag minns en kvinna som kom hit och sa…".
      //
      //   Skillnaden som instruktionen missade: story-banken innehåller HÄNDELSER som
      //   faktiskt inträffat. Kundröster är SPRÅK — en sammanfattning av hur många kunder
      //   uttrycker sig, utan person, tillfälle eller plats. Att göra en scen av dem är att
      //   uppfinna en händelse, oavsett att orden är äkta.
      { angle: "Berättelse", instruktion: "Öppna med en kort BERÄTTELSE/scen hämtad ENBART ur varumärkesprofilens story-bank, alltså händelser som faktiskt inträffat. Kundröster och customer voice får ALDRIG bli en scen: de är språk, inte händelser, och har varken person, tidpunkt eller plats. Saknas story-bank: öppna med en generell igenkänningsscen utan huvudperson ('Vi möter ofta...', 'Många som hör av sig...'). Skriv ALDRIG 'jag minns en kund', 'en kvinna som kom hit', ett datum, en plats eller ett ordagrant citat från en enskild person." },
      { angle: "Siffra", instruktion: "Öppna med en konkret SIFFRA eller ett resultat som skapar nyfikenhet (hitta inte på — bara om innehållet ger det, annars en tydlig observation)." },
    ];

    // T-6b-grind (Håkans fynd 10/8): berättelse-vinkeln ber om en händelse ur story-banken —
    // men KLIPPORDNING i prompt-core klipper "Story-bank" FÖRST när profilen är för lång.
    // Saknas den i den färdiga prompten är uppdraget "berätta om en kund" en beställning på
    // ett påhitt, och modellen tog närmaste sak som liknade en händelse: en kundrecension.
    const finnsStorybank = harStorybank(bygg.profilText);
    const anglarIBruk = finnsStorybank
      ? ANGLAR
      : ANGLAR.map((a) => (a.angle === "Berättelse" ? { ...a, instruktion: BERATTELSE_UTAN_STORYBANK } : a));

    const n = Math.min(4, Math.max(0, Number((b as { variants?: number }).variants) || 0));
    if (n >= 2) {
      const valda = anglarIBruk.slice(0, n);
      // Sanering + CTA-golv sker inuti genMedCtaGolv, per variant. Varje variant får
      // sin EGNA enda omgenerering — en variant som klarar golvet rörs aldrig.
      //
      // CTA-2 (Håkans fynd 10/8): kroken varierade, avslutet gjorde det inte. Alla tre
      // varianter slutade "Skicka en bild på platsen så får du en offert inom 24 timmar"
      // — profilens starkaste CTA vinner varje gång när ingenting säger något annat. Och
      // varianterna körs PARALLELLT, så de kan inte undvika varandra: vägen framåt måste
      // delas ut per variant, inte önskas. Golvet är orört — sista meningen är fortfarande
      // en uppmaning som namnger en väg, det är VILKEN väg som skiljer sig.
      const variants = await Promise.all(
        valda.map(async (v, i) => {
          // CTA-3: nivån bestämmer vilka vägar som ens får delas ut. På tofu kan ingen
          // variant få "skriv till oss" — steget är för stort för ett första möte.
          const vag = ctaVagForVariant(i, bygg.meta.funnel);
          return {
            angle: v.angle,
            ctaVag: vag.namn,
            ...(await genMedCtaGolv(vinkelMedVag(v.instruktion, vag, perspektivForVariant(i)), `variant ${v.angle}/${vag.namn}`)),
          };
        }),
      );
      // En kasserad variant har tom caption och filtreras bort som förut. Blev ALLA
      // kasserade är det inte "inga förslag" — det är ett besked: profilen saknar
      // berättelser att skriva ur, och då ska ytan säga var de fylls i i stället för att
      // visa en tom lista (samma regel som G-9: en nolla är inte ett mätvärde).
      const kvar = variants.filter((v) => v.caption);
      if (!kvar.length) {
        const kasserade = variants.flatMap((v) => v.minnesTraffar);
        if (kasserade.length) {
          return NextResponse.json({
            error: "Förslagen började berätta om en enskild kund som om den fanns i era anteckningar. Skriv in en riktig kundberättelse under Brand-profil → Kundberättelser, eller ta ett annat ämne — jag hittar inte på en person.",
            minnesTraffar: kasserade,
          }, { status: 502 });
        }
      }
      return NextResponse.json({ variants: kvar });
    }

    const enda = await genMedCtaGolv("", "caption");
    if (!enda.caption) {
      return NextResponse.json({
        error: "Texten började berätta om en enskild kund som om den fanns i era anteckningar. Skriv in en riktig kundberättelse under Brand-profil → Kundberättelser, eller ta ett annat ämne — jag hittar inte på en person.",
        minnesTraffar: enda.minnesTraffar,
      }, { status: 502 });
    }
    return NextResponse.json(enda);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
