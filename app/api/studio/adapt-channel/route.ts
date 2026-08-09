import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { CTA_SKARPNING, harCtaISlutet } from "@/lib/content/writing-rules";

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

    const clientId = await resolveClientId();
    const isCarousel = slides.length > 0;

    const sourceBlock = baseCaption
      ? `Grund-caption att anpassa (behåll budskapet, ändra ton/längd/krok/hashtags per kanal):\n${baseCaption}`
      : isCarousel
        ? "Karusellens slides:\n" + slides.map((s, i) => `${i + 1}. [${s.kind || "slide"}] ${s.headline || ""}${s.body ? ` — ${s.body}` : ""}`).join("\n")
        : [headline ? `Rubrik på bilden: ${headline}.` : "", headline2 ? `Underrubrik: ${headline2}.` : "", body ? `Text på bilden: ${body}.` : "", topic ? `Ämne: ${topic}.` : ""].filter(Boolean).join("\n");

    // TEXT-1 T-2: prompten byggs av prompt-core (brand-profil, röst, winning, anatomi/compass,
    // kit-donts och skrivregler ägs av kärnan). Uppdraget = kanalguiderna + språkregler.
    const uppdrag = [
      `Du anpassar en social-caption per plattform för ${client?.name || "kunden"} (${postType === "reel" ? "reel" : postType === "story" ? "story" : isCarousel ? "karusell" : "inlägg med bild"}).`,
      "Samma kärnbudskap — men krok, längd, ton och hashtags formas efter varje plattforms sätt att läsa.",
      "\n=== ANPASSNING PER KANAL ===",
      ...wanted.map((c) => `- ${CHANNEL_LABEL[c]} → ${CHANNEL_GUIDE[c]}`),
      "\n=== SPRÅK ===",
      "- Svenska tecken å/ä/ö korrekt. Naturligt, mänskligt språk. Inga telefonnummer/URL:er.",
      "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
    ].filter(Boolean).join("\n");

    // ⚠ G-3d: INGEN rotation här, med flit. Flödet ska bevara SAMMA kärnbudskap över
    // flera kanaler. Att undvika de senaste öppningarna hade dragit isär kanalerna från
    // varandra — motsatsen till uppdraget en rad ovanför.
    const bygg = await byggTextPrompt({
      clientId,
      syfte: "kanal-anpassning",
      uppdrag,
      underlag: `${sourceBlock}\n\nAnpassa nu captionen för: ${wanted.map((c) => CHANNEL_LABEL[c]).join(", ")}. Svara med JSON-objektet.`,
      compass: b.compass && typeof b.compass === "object" ? b.compass : undefined,
      jsonSchema: `Returnera ENDAST giltig JSON med exakt dessa nycklar: ${wanted.map((c) => `"${c}"`).join(", ")}. Varje värde = den färdiga captionen för kanalen (med radbrytningar som \\n). Ingen text utanför JSON-objektet.`,
    });

    // Ett anrop = alla begärda kanaler. skarpning läggs sist i systemprompten och
    // används bara av CTA-omgenereringen längre ned.
    const koraGenerering = async (skarpning: string): Promise<Partial<Record<ChannelKey, string>>> => {
      const bas = skarpning ? `${bygg.system}\n\n${skarpning}` : bygg.system;
      let ut: Partial<Record<ChannelKey, string>> = {};
      for (let attempt = 0; attempt < 3; attempt++) {
        const sys = attempt === 0 ? bas : `${bas}\n\n=== VIKTIGT (försök ${attempt + 1}) ===\nFöregående svar var ogiltigt eller innehöll ett förbjudet uttryck. Returnera ENBART giltig JSON och undvik varje form av "handlar om", "kraftfull", "banbrytande", "nästa nivå", "holistisk", "skalbar".`;
        const raw = (await generate({ model: "gemini-2.5-flash", systemInstruction: sys, prompt: bygg.user, temperature: attempt === 0 ? 0.8 : 0.65, maxOutputTokens: 1400, skrivregler: false /* prompt-core äger skrivregler-flaggan (TEXT-1) */ })).trim();
        ut = extractJson(raw);
        const values = wanted.map((c) => ut[c] || "");
        if (values.some((v) => v) && !values.some((v) => hasBanned(v))) break;
      }
      return ut;
    };

    // Sanering + kanalens hashtag-tak. Kontrollen nedan körs på exakt den text
    // användaren ser, inte på råsvaret.
    const kanalFor = (k: ChannelKey): "linkedin" | "facebook" | "instagram" =>
      k === "li" ? "linkedin" : k === "fb" ? "facebook" : "instagram";
    const stada = async (k: ChannelKey, raa: string): Promise<string> => {
      const v = raa.trim();
      if (!v) return "";
      return saneraText(hasBanned(v) ? sanitize(v) : v, clientId, kanalFor(k));
    };

    const parsed = await koraGenerering("");
    const captions: Partial<Record<ChannelKey, string>> = {};
    for (const c of wanted) {
      const v = await stada(c, parsed[c] || "");
      if (v) captions[c] = v;
    }
    if (!Object.keys(captions).length) {
      return NextResponse.json({ error: "Kunde inte anpassa per kanal — försök igen." }, { status: 502 });
    }

    // KVALITET-3/punkt 11 — CTA-golvets efterhandskontroll, per kanal.
    // Saknar någon kanalcaption en uppmaning i imperativ görs EXAKT EN omgenerering.
    // Bara de fällda kanalerna byts ut: en kanal som redan klarar golvet rörs aldrig.
    // Fail-open — misslyckas omgenereringen levereras bästa försöket ändå.
    const utanCta = (Object.keys(captions) as ChannelKey[]).filter((k) => !harCtaISlutet(captions[k] || ""));
    let ctaOmgenererad = false;
    if (utanCta.length) {
      ctaOmgenererad = true;
      console.warn(`[cta-golv] adapt-channel: ingen imperativ CTA i ${utanCta.join(", ")} — en omgenerering`);
      try {
        const nytt = await koraGenerering(CTA_SKARPNING);
        for (const k of utanCta) {
          const v = await stada(k, nytt[k] || "");
          if (v) captions[k] = v;
        }
      } catch (e) {
        console.warn(`[cta-golv] adapt-channel: omgenereringen kastade (${(e as Error).message}) — behåller första försöket`);
      }
      const kvar = (Object.keys(captions) as ChannelKey[]).filter((k) => !harCtaISlutet(captions[k] || ""));
      if (kvar.length) console.warn(`[cta-golv] adapt-channel: ${kvar.join(", ")} saknar CTA även efter omgenerering — levererar bästa försöket`);
    }
    return NextResponse.json({ captions, ctaOmgenererad });
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
