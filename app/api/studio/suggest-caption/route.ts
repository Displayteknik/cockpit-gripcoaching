import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { requireAdminOrCustomer } from "@/lib/api-auth";

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
    });

    // Generera EN caption med given krok-vinkel + grinda mot AI-språk (regenerera 2 ggr).
    // Krok-vinkeln läggs som variant-suffix på underlaget (TEXT-1).
    const genOne = async (vinkelInstruktion: string): Promise<string> => {
      const prompt = vinkelInstruktion ? `${bygg.user}\n\n=== KROK-VINKEL ===\n${vinkelInstruktion}` : bygg.user;
      let out = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        const sys = attempt === 0 ? bygg.system : `${bygg.system}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående förslag innehöll ett förbjudet uttryck. Skriv om HELT och undvik varje form av "handlar om", "kraftfull", "banbrytande", "nästa nivå", "holistisk", "skalbar". Var konkret och mänsklig.`;
        out = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt, temperature: attempt === 0 ? 0.9 : 0.7, maxOutputTokens: longer ? 700 : 500, skrivregler: false /* prompt-core äger skrivregler-flaggan (TEXT-1) */ })).trim();
        if (!hasBanned(out)) break;
      }
      return hasBanned(out) ? sanitizeCaption(out) : out;
    };

    // A/B-läge: distinkta krok-vinklar så varianterna faktiskt skiljer sig (spec Fas D).
    const ANGLAR: { angle: string; instruktion: string }[] = [
      { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag." },
      { angle: "Påstående", instruktion: "Öppna med ett djärvt, konkret PÅSTÅENDE (en sanning eller en vanlig myt du motbevisar)." },
      { angle: "Berättelse", instruktion: "Öppna med en kort BERÄTTELSE/scen (en kund, en situation) i första person." },
      { angle: "Siffra", instruktion: "Öppna med en konkret SIFFRA eller ett resultat som skapar nyfikenhet (hitta inte på — bara om innehållet ger det, annars en tydlig observation)." },
    ];

    const n = Math.min(4, Math.max(0, Number((b as { variants?: number }).variants) || 0));
    if (n >= 2) {
      const valda = ANGLAR.slice(0, n);
      const variants = await Promise.all(
        valda.map(async (v) => ({ angle: v.angle, caption: await genOne(v.instruktion) })),
      );
      // TEXT-1: enhetlig sanering via saneraText (flaggan avgörs i prompt-core).
      const sanerade = await Promise.all(
        variants.filter((v) => v.caption).map(async (v) => ({ ...v, caption: await saneraText(v.caption, clientId) })),
      );
      return NextResponse.json({ variants: sanerade });
    }

    const caption = await genOne("");
    return NextResponse.json({ caption: await saneraText(caption, clientId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
