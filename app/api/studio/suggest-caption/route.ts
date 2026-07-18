import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
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
    const b = await req.json().catch(() => ({}));
    const headline = (b.headline || "").toString().slice(0, 200);
    const headline2 = (b.headline2 || "").toString().slice(0, 200);
    const body = (b.body || "").toString().slice(0, 400);
    const topic = (b.topic || "").toString().slice(0, 200);
    const postType = (b.postType || "post").toString();
    const slides: Slide[] = Array.isArray(b.slides) ? b.slides.slice(0, 12) : [];
    const profile = await getProfileAsMarkdown().catch(() => "");
    const directives = await getKitDirectives(await getActiveClientId());

    const isCarousel = slides.length > 0;
    const longer = isCarousel || postType === "reel";

    const system = [
      `Du skriver bildtexten (captionen) till ${TYPE_LABEL[postType] || "ett socialt inlägg"} (Instagram/Facebook) för ${client?.name || "kunden"}.`,
      "Detta är texten man LÄSER under/bredvid inlägget — inte text på bilden. Skriv som en människa, varmt och konkret.",
      profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, målgrupp och ord på denna ===\n${profile.slice(0, 5000)}` : "",
      "\n=== STRUKTUR (världsklass-caption) ===",
      "- RAD 1 = krok som stoppar scrollen (fristående, stark). Sedan en tom rad.",
      `- ${longer ? "2–4 korta stycken" : "1–2 korta stycken"} som ger konkret värde/berättelse. Radbryt för luft.`,
      isCarousel ? "- Knyt ihop karusellens poänger till en helhet (räkna inte bara upp dem)." : "",
      postType === "reel" ? "- Skriv så att den funkar till en reel: fånga i första raden, driv till att titta klart." : "",
      "- Avsluta med EN tydlig uppmaning (t.ex. boka, spara inlägget, skriv en kommentar, läs mer).",
      "- 3–5 relevanta hashtags på egen rad sist.",
      "\n=== SPRÅK ===",
      "- Svenska tecken å/ä/ö korrekt. Naturligt, mänskligt språk. Emoji sparsamt (0–2), bara om det passar rösten.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
      "- Inga telefonnummer/URL:er. Returnera ENDAST själva captionen (med radbrytningar), ingen förklaring.",
      dontsRule(directives.donts),
    ].filter(Boolean).join("\n");

    const contentBlock = isCarousel
      ? "Karusellens slides:\n" + slides.map((s, i) => `${i + 1}. [${s.kind || "slide"}] ${s.headline || ""}${s.body ? ` — ${s.body}` : ""}`).join("\n")
      : [headline ? `Rubrik på bilden: ${headline}.` : "", headline2 ? `Underrubrik: ${headline2}.` : "", body ? `Text på bilden: ${body}.` : ""].filter(Boolean).join("\n");

    const prompt = [
      topic ? `Ämne: ${topic}.` : "",
      contentBlock,
      "\nSkriv captionen nu — strukturerad enligt reglerna.",
    ].filter(Boolean).join("\n");

    // Generera + grinda mot AI-språk. Regenerera upp till 2 ggr med hårdare instruktion.
    let caption = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const sys = attempt === 0 ? system : `${system}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående förslag innehöll ett förbjudet uttryck. Skriv om HELT och undvik varje form av "handlar om", "kraftfull", "banbrytande", "nästa nivå", "holistisk", "skalbar". Var konkret och mänsklig.`;
      caption = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt, temperature: attempt === 0 ? 0.85 : 0.7, maxOutputTokens: longer ? 700 : 500 })).trim();
      if (!hasBanned(caption)) break;
    }
    // Sista säkerhet: byt mekaniskt ut ev. kvarvarande kliché (modellen släpper inte "handlar om").
    if (hasBanned(caption)) caption = sanitizeCaption(caption);
    return NextResponse.json({ caption });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
