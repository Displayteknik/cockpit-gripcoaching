import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Slide { kind?: string; headline?: string; body?: string }

// AI-språk som aldrig får slinka igenom (samma grind som suggest-caption).
const BANNED = [/kraftfull/i, /banbrytande/i, /game-?changer/i, /handlar\s+(inte\s+)?om/i, /nästa\s+nivå/i, /holistisk/i, /skalbar/i];
function hasBanned(t: string): boolean {
  return BANNED.some((re) => re.test(t));
}
function sanitize(t: string): string {
  return t
    .replace(/\bhandlar\s+inte\s+om\b/gi, "gäller inte")
    .replace(/\bhandlar\s+om\b/gi, "gäller")
    .replace(/\bkraftfullt\b/gi, "starkt").replace(/\bkraftfulla\b/gi, "starka").replace(/\bkraftfull\b/gi, "stark")
    .replace(/\bbanbrytande\b/gi, "nyskapande")
    .replace(/\bnästa\s+nivå\b/gi, "längre")
    .replace(/\bholistiskt?\b/gi, "helhet").replace(/\bholistiska\b/gi, "helhets")
    .replace(/\bskalbar[t]?\b/gi, "lätt att växa");
}

const CHANNEL_KEYS = ["ig", "fb", "li"] as const;
type ChannelKey = (typeof CHANNEL_KEYS)[number];

const CHANNEL_LABEL: Record<ChannelKey, string> = { ig: "Instagram", fb: "Facebook", li: "LinkedIn" };

// Hur captionen ska anpassas per plattform (krok, längd, ton, hashtags).
const CHANNEL_GUIDE: Record<ChannelKey, string> = {
  ig: "Instagram: krok på rad 1 som stoppar scrollen, sedan tom rad. Varmt och konkret, radbryt för luft. Emoji sparsamt (0–2). Avsluta med EN uppmaning och 3–5 relevanta hashtags på sista raden.",
  fb: "Facebook: lite mer samtalston, gärna en fråga som bjuder in till kommentar. Kortare stycken. Nästan inga hashtags (0–1). Ingen hashtag-vägg. Uppmaningen i klartext, länkvänlig ton.",
  li: "LinkedIn: professionell och insiktsdriven, aldrig säljig. VIKTIGT: de första ~140 tecknen måste bära hela kroken (det som syns före '…se mer'). Ett stycke som ger en konkret insikt/lärdom, sedan ev. kort utveckling. Max 0–1 emoji. Avsluta med 2–3 branschhashtags.",
};

// POST /api/studio/adapt-channel — { caption?, headline?, headline2?, body?, topic?, slides[], postType, channels[] }
// Skriv EN gång → AI anpassar captionen per kanal (krok/längd/ton/hashtags). Returnerar
// { captions: { ig?, fb?, li? } } för de begärda kanalerna. Grinda mot AI-språk. /k-säker.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const b = await req.json().catch(() => ({}));
    const baseCaption = (b.caption || "").toString().slice(0, 1500);
    const headline = (b.headline || "").toString().slice(0, 200);
    const headline2 = (b.headline2 || "").toString().slice(0, 200);
    const body = (b.body || "").toString().slice(0, 400);
    const topic = (b.topic || "").toString().slice(0, 200);
    const postType = (b.postType || "post").toString();
    const slides: Slide[] = Array.isArray(b.slides) ? b.slides.slice(0, 12) : [];
    const channels: ChannelKey[] = (Array.isArray(b.channels) ? b.channels : CHANNEL_KEYS)
      .filter((c: unknown): c is ChannelKey => CHANNEL_KEYS.includes(c as ChannelKey));
    const wanted = channels.length ? channels : [...CHANNEL_KEYS];

    const profile = await getProfileAsMarkdown().catch(() => "");
    const directives = await getKitDirectives(await getActiveClientId());
    const isCarousel = slides.length > 0;

    const sourceBlock = baseCaption
      ? `Grund-caption att anpassa (behåll budskapet, ändra ton/längd/krok/hashtags per kanal):\n${baseCaption}`
      : isCarousel
        ? "Karusellens slides:\n" + slides.map((s, i) => `${i + 1}. [${s.kind || "slide"}] ${s.headline || ""}${s.body ? ` — ${s.body}` : ""}`).join("\n")
        : [headline ? `Rubrik på bilden: ${headline}.` : "", headline2 ? `Underrubrik: ${headline2}.` : "", body ? `Text på bilden: ${body}.` : "", topic ? `Ämne: ${topic}.` : ""].filter(Boolean).join("\n");

    const system = [
      `Du anpassar en social-caption per plattform för ${client?.name || "kunden"} (${postType === "reel" ? "reel" : postType === "story" ? "story" : isCarousel ? "karusell" : "inlägg med bild"}).`,
      "Samma kärnbudskap — men krok, längd, ton och hashtags formas efter varje plattforms sätt att läsa.",
      profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, målgrupp och ord på denna ===\n${profile.slice(0, 5000)}` : "",
      "\n=== ANPASSNING PER KANAL ===",
      ...wanted.map((c) => `- ${CHANNEL_LABEL[c]} → ${CHANNEL_GUIDE[c]}`),
      "\n=== SPRÅK ===",
      "- Svenska tecken å/ä/ö korrekt. Naturligt, mänskligt språk. Inga telefonnummer/URL:er.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
      dontsRule(directives.donts),
      "\n=== SVARFORMAT ===",
      `Returnera ENDAST giltig JSON med exakt dessa nycklar: ${wanted.map((c) => `"${c}"`).join(", ")}. Varje värde = den färdiga captionen för kanalen (med radbrytningar som \\n). Ingen text utanför JSON-objektet.`,
    ].filter(Boolean).join("\n");

    const prompt = `${sourceBlock}\n\nAnpassa nu captionen för: ${wanted.map((c) => CHANNEL_LABEL[c]).join(", ")}. Svara med JSON-objektet.`;

    let parsed: Partial<Record<ChannelKey, string>> = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const sys = attempt === 0 ? system : `${system}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående svar var ogiltigt eller innehöll ett förbjudet uttryck. Returnera ENBART giltig JSON och undvik varje form av "handlar om", "kraftfull", "banbrytande", "nästa nivå", "holistisk", "skalbar".`;
      const raw = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt, temperature: attempt === 0 ? 0.8 : 0.65, maxOutputTokens: 1400 })).trim();
      parsed = extractJson(raw);
      const values = wanted.map((c) => parsed[c] || "");
      if (values.some((v) => v) && !values.some((v) => hasBanned(v))) break;
    }

    const captions: Partial<Record<ChannelKey, string>> = {};
    for (const c of wanted) {
      let v = (parsed[c] || "").trim();
      if (!v) continue;
      if (hasBanned(v)) v = sanitize(v);
      captions[c] = v;
    }
    if (!Object.keys(captions).length) {
      return NextResponse.json({ error: "Kunde inte anpassa per kanal — försök igen." }, { status: 502 });
    }
    return NextResponse.json({ captions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Robust JSON-extraktion: klipp bort ev. ```json-fence och plocka första {...}-blocket.
function extractJson(raw: string): Partial<Record<ChannelKey, string>> {
  let s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    const obj = JSON.parse(s) as Record<string, unknown>;
    const out: Partial<Record<ChannelKey, string>> = {};
    for (const c of CHANNEL_KEYS) if (typeof obj[c] === "string") out[c] = obj[c] as string;
    return out;
  } catch {
    return {};
  }
}
