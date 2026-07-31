// Bildgenerering — Imagen 4.0 Fast (Google) primärt, FLUX (fal.ai) om FAL_KEY finns,
// Pexels för stockfoton. Portad och anpassad från instagram-pro.
//
// ⚠️  REGEL (etablerad 2026-05-23 efter regression — se tasks/lessons.md):
//
//  1. ANVÄND ALDRIG `cinematic` som default-stil. Den ger dark moody noir som
//     blir skräckbild för vården/coaching/B2B-tjänster.
//  2. ALLA endpoints som anropar generateImageForPost() MÅSTE skicka
//     `brandContext` (från `getProfileAsMarkdown()`). Utan brand-voice vet
//     AI:n bara branschen, inte tonen.
//  3. Vid onboardning av ny bransch — lägg till case i BÅDA:
//     - defaultStyleForNiche()
//     - rulesForNiche()
//     Annars faller den nya branschen tillbaka på "editorial" default —
//     funkar men är inte optimerat.
//  4. När du lägger till ny stil — kolla rulesForNiche-listan så bannedConcrete
//     fortfarande hindrar det vi vill undvika för respektive bransch.

import { supabaseServer } from "./supabase-admin";
import { assertSafePublicUrl } from "./safe-url";
import { seasonPromptLineEn } from "./content/sasong";
import { stavningsgrind, type TextOrsak } from "./bildtext";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const FAL_KEY = process.env.FAL_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

// BILD-6a: tankstrecksregeln gäller även SCENOGRAFI — text på avbildade skärmar,
// skyltar, affischer och förpackningar (skarpt fall: en avbildad skärmannons visade
// "KRÄFTSKIVA – 8 AUGUSTI"). Läggs i bildprompternas hårda regler i alla vägar.
export const NO_DASH_IN_IMAGE_EN =
  "Any text appearing IN the image — including on depicted screens, signs, posters and packaging — " +
  "must never contain dashes (– or —). Write dates and ranges without them (e.g. 'KRÄFTSKIVA 8 AUGUSTI').";
export const NO_DASH_IN_IMAGE_SV =
  "Text som ändå syns i bilden — även på avbildade skärmar, skyltar, affischer och förpackningar — " +
  "får ALDRIG innehålla tankstreck (– eller —). Skriv datum och intervall utan (t.ex. 'KRÄFTSKIVA 8 AUGUSTI').";

// ── BILD-7a: avbildat exempelinnehåll ska ha RELEVANS *och* BUDSKAP ─────────
// Allt som porträtteras som exempelinnehåll i en genererad bild — skärmar, skyltar,
// menytavlor, affischer, dokument, förpackningar, produkter — är en del av budskapet,
// aldrig dekorativ utfyllnad. Skarpa fel bakom regeln: LED-skärmar med abstrakta
// färgvirvlar (ser omedelbart AI-genererat ut) och skyltfönster som visar något helt
// annat än vad tenanten säljer.
//
// Regeln är delad i två halvor med flit:
//   RELEVANS — gäller ALLTID, även i flöden som förbjuder läsbar text i bilden.
//   BUDSKAP  — gäller där avbildad skyltning tillåts bära text. Då ska skylten ha
//              BÅDE ett relevant motiv OCH en kort trovärdig rad (erbjudande, pris,
//              event eller tid) i en vertikal som är rimlig för tenanten.
// Plattformsregel: samma krav för blomsteraffär, bilhandlare och coach.
export const DEPICTED_RELEVANCE_EN =
  "DEPICTED EXAMPLE CONTENT: anything shown as content inside the scene — screens, displays, signs, menu boards, posters, documents, packaging, price tags, products — must be believable and relevant BOTH to this business and to the message of the post. It is never decorative filler: no abstract glowing swirls, no fantasy graphics, no placeholder artwork, no unrelated brands. When the business's own product or environment is visible, the image must at the same time demonstrate REAL USE of it.";
export const DEPICTED_RELEVANCE_SV =
  "AVBILDAT EXEMPELINNEHÅLL: allt som visas som innehåll i scenen — skärmar, skyltar, menytavlor, affischer, dokument, förpackningar, prislappar, produkter — ska vara trovärdigt och relevant både för verksamheten och för inläggets budskap. Det är aldrig dekorativ utfyllnad: inga abstrakta färgvirvlar, inga fantasigrafiker, inga platshållarmönster. När verksamhetens egen produkt eller miljö syns ska bilden samtidigt visa VERKLIG ANVÄNDNING av den.";

export const DEPICTED_MESSAGE_EN =
  "DEPICTED SIGNAGE MUST CARRY A MESSAGE: when a screen, sign, board, window display or poster is visible it must have BOTH a recognisable subject AND a short, believable message in Swedish — an offer, a price, an event or a time — that makes sense for this business. Examples of the principle: a menu screen shows the dish itself plus 'DAGENS LUNCH 129 KR'; a shop window shows what the shop actually sells plus a short campaign line. Keep it to two to five short, ordinary Swedish words, spelled correctly: use å, ä and ö ONLY in words that actually have them (write IDAG, not IDÅG; VÄLKOMMEN, not VÄKLLOMMEN) and never double or reorder letters. Never write a call to action that competes with the post's own — no 'RING NU', no phone numbers, no web addresses, no invented brand logos.";
export const DEPICTED_MESSAGE_SV =
  "AVBILDAD SKYLTNING SKA BÄRA ETT BUDSKAP: syns en skärm, skylt, tavla, skyltfönster eller affisch ska den ha BÅDE ett tydligt motiv OCH en kort trovärdig rad på svenska — ett erbjudande, ett pris, ett event eller en tid — som är rimlig för verksamheten. Principen: menyskärmen visar rätten plus \"DAGENS LUNCH 129 KR\"; skyltfönstret visar det butiken faktiskt säljer plus en kort kampanjrad. Håll det till två till fem korta, vanliga svenska ord, rättstavade: använd å, ä och ö BARA i ord som verkligen har dem (skriv IDAG, inte IDÅG; VÄLKOMMEN, inte VÄKLLOMMEN) och dubblera aldrig bokstäver. Skriv aldrig en uppmaning som konkurrerar med inläggets egen — inga \"RING NU\", inga telefonnummer, inga webbadresser.";

// ── BILD-8b: blickriktning och uppmärksamhet ────────────────────────────────
// Skarpt fel (Håkans skarptest 2026-07-31): butiksbild där kvinnan framför skärmen
// tittade BORT från skärmen — hela poängen med bilden föll. En person i samma bild som
// det som säljs ska vara vänd mot det och engagerad i det. Plattformsregel: samma krav
// för blomsteraffär, bilhandlare och coach. Undantag bara när inläggets eget budskap
// kräver det (t.ex. "vänd ryggen åt gammal vana").
export const PERSON_ATTENTION_EN =
  "PERSON AND SUBJECT MUST CONNECT: if a person appears together with the product, screen, sign or offer, they must be oriented towards it and visibly engaged — looking at the screen, reading the sign, holding or using the product. Never show the person looking away from or turned away from what the post is about. Their gaze, head and upper body should read as attention directed at it, and both the person and the thing must be clearly visible in the frame. Depart from this only if the post's own message explicitly requires it.";
export const PERSON_ATTENTION_SV =
  "PERSON OCH MOTIV SKA HÖRA IHOP: syns en person tillsammans med produkten, skärmen, skylten eller erbjudandet ska personen vara VÄND MOT det och synbart engagerad — tittar på skärmen, läser skylten, håller i eller använder produkten. Visa aldrig en person som tittar bort från eller står med ryggen mot det inlägget handlar om. Blick, huvud och överkropp ska läsas som uppmärksamhet riktad dit, och både personen och saken ska synas tydligt i bilden. Avvik bara om inläggets eget budskap uttryckligen kräver det.";

/** Hela BILD-7a-regeln för flöden där avbildad skyltning får bära text. */
export const DEPICTED_CONTENT_EN = `${DEPICTED_RELEVANCE_EN} ${DEPICTED_MESSAGE_EN} ${PERSON_ATTENTION_EN} ${NO_DASH_IN_IMAGE_EN}`;
export const DEPICTED_CONTENT_SV = `${DEPICTED_RELEVANCE_SV} ${DEPICTED_MESSAGE_SV} ${PERSON_ATTENTION_SV} ${NO_DASH_IN_IMAGE_SV}`;

export const IMAGE_STYLES = [
  { id: "cinematic", label: "Cinematic mörk", desc: "Filmisk, dramatisk belysning", prompt: "Cinematic commercial photography. Dramatic directional lighting with deep shadows. Film-grade color grading. Dark navy and warm accent tones. Shot on full-frame camera with 35mm lens." },
  { id: "editorial", label: "Editorial reportage", desc: "Tidskriftskänsla, autentiskt", prompt: "High-end editorial photography. Real environments, authentic moments. Magazine-quality composition. Natural but refined lighting. Storytelling through visual detail." },
  { id: "product", label: "Produkt / showroom", desc: "Premium produktfoto", prompt: "Premium product photography in professional environment. Three-point lighting setup. Reflective dark surface. Hero shot composition emphasizing form and quality." },
  { id: "nordic", label: "Nordiskt natur", desc: "Skog, snö, jämtlandskt", prompt: "Authentic Nordic wilderness photography. Pine forests, mountain backdrops, soft overcast light. Earthy palette. Documentary feel, no posed people." },
  { id: "urban", label: "Urban / gata", desc: "Stadsmiljö, neon", prompt: "Urban street photography. Neon reflections on wet surfaces. Moody city atmosphere. Shallow depth of field, 85mm lens feel." },
  { id: "minimal", label: "Minimalistisk", desc: "Ren, mycket luft", prompt: "Ultra minimal photography. Single subject on clean dark surface. Generous negative space. Soft directional light. Elegant simplicity." },
  { id: "tech", label: "Tech / digital", desc: "Futuristisk innovation", prompt: "Technology and innovation photography. Real devices, screens. Cyan and purple accent lighting. Futuristic but grounded — not abstract CGI." },
  { id: "lifestyle", label: "Livsstil", desc: "Vardag, autentiskt", prompt: "Lifestyle photography. Real moments, natural light. Warm tones. Genuine emotion. Documentary-style composition." },
] as const;

export type ImageStyleId = typeof IMAGE_STYLES[number]["id"];

export interface ImageFeedback { prompt: string; rating: 1 | -1; content_text?: string; image_style?: string }

/**
 * Industri-medvetna visuella regler. Default-stilen "cinematic mörk" är fel för
 * många branscher — vården, coaching, småföretagar-rådgivning behöver varma,
 * hoppfulla bilder, inte dramatiska skuggor.
 */
interface IndustryRules {
  styleHint: string;
  bannedConcrete: string;
  doConcrete: string;
  paletteHint: string;
  emotionalRegister: string;
}

function rulesForNiche(niche: string): IndustryRules {
  const n = (niche || "").toLowerCase();

  // Vård, optiker, terapi, hälsa, wellness
  if (/optik|ögon|syn|vård|läkare|terapi|hälsa|wellness|kropp|psykolog|fysio/.test(n)) {
    return {
      styleHint: "Warm editorial healthcare photography. Soft natural window light. Real clinic or optician practice environment. Caring human moment.",
      bannedConcrete: "NO extreme close-ups of isolated body parts (eyes, hands floating in darkness). NO horror or medical-thriller aesthetics. NO menacing shadows. NO clinical sterility. NO stock-photo fake smiles. NO darkness or moody noir.",
      doConcrete: "Show a real moment in a real practice: a professional examining a patient warmly, a person trying on glasses in soft light, a calming consultation space with daylight. People should look hopeful and at ease.",
      paletteHint: "Warm cream, soft beige, gentle amber, natural daylight. Avoid harsh contrast.",
      emotionalRegister: "Hopeful, trustworthy, calm, human. Reader should think 'I'd feel safe here.'",
    };
  }

  // Coaching, sälj, personlig utveckling, B2B-tjänster
  if (/coach|sälj|personlig utveckling|leadership|ledarskap|consulting|rådgiv/.test(n)) {
    return {
      styleHint: "Authentic lifestyle photography of professional work. Real office or meeting room. Documentary feel, not posed.",
      bannedConcrete: "NO generic businessman with arms crossed. NO suits-around-a-laptop stock shots. NO abstract handshakes. NO city skylines through windows.",
      doConcrete: "Show a real moment: someone genuinely engaged in their work, a focused conversation, hands writing in a notebook, natural body language.",
      paletteHint: "Warm neutrals, soft daylight, accents of brand color but never neon.",
      emotionalRegister: "Confident, focused, real. Reader should think 'this person knows what they're doing.'",
    };
  }

  // LED-skärmar, signage, displayteknik, hardware
  if (/led|skärm|display|signage|skylt|hardware|elektronik/.test(n)) {
    return {
      styleHint: "Premium commercial product photography in a real installation context. Professional studio or actual venue.",
      bannedConcrete: "NO abstract glowing pixels. NO generic CGI city lights. NO fake-looking renders.",
      doConcrete: "Show real LED screens in real environments: shopfront at twilight, event venue with crowd, professional showroom installation.",
      paletteHint: "Rich saturated colors with controlled contrast. Premium feel.",
      emotionalRegister: "Premium, impressive, real. Reader should think 'this is high quality.'",
    };
  }

  // Bil, fordon, mekanik
  if (/bil|fordon|motor|mekanik|verkstad/.test(n)) {
    return {
      styleHint: "Premium automotive editorial photography. Real workshop or showroom. Detail-oriented.",
      bannedConcrete: "NO generic car ads. NO empty roads. NO motion-blur driving shots.",
      doConcrete: "Show real craft: hands on engine detail, polished surface reflection, mechanic at work in good light.",
      paletteHint: "Deep blacks, chrome highlights, rich color depth.",
      emotionalRegister: "Crafted, premium, expert.",
    };
  }

  // Kreativ, konst, design
  if (/konst|design|kreativ|art|illustrat/.test(n)) {
    return {
      styleHint: "Editorial art photography. Studio or gallery context. Texture and detail focus.",
      bannedConcrete: "NO generic creative cliches (paint splatter, rainbow palettes). NO chaos.",
      doConcrete: "Show real artistic process: brush touching canvas, sculpture detail, exhibition installation.",
      paletteHint: "Refined palette, possibly monochromatic with accent. Lots of negative space.",
      emotionalRegister: "Considered, refined, intentional.",
    };
  }

  // Default — neutral premium
  return {
    styleHint: "Authentic commercial photography. Real environment, real moment.",
    bannedConcrete: "NO generic stock imagery. NO abstract metaphors. NO empty offices.",
    doConcrete: "Show a real subject the post discusses, in its real environment, with natural composition.",
    paletteHint: "Refined palette matching brand. Natural light.",
    emotionalRegister: "Professional, genuine, real.",
  };
}

/**
 * Steg 1 i bild-prompten: identifiera ETT konkret visuellt nyckelkoncept från texten.
 * Förhindrar generiska "warm healthcare scene"-bilder som inte kopplar till inlägget.
 */
async function extractVisualConcept(contentText: string, niche: string, rules: IndustryRules): Promise<string> {
  if (!GEMINI_KEY) return "";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read this blog/social post. Identify ONE concrete visual concept for a HERO IMAGE that matches the post's TONE and CONCLUSION — not its problem-opening.

POST: "${contentText.slice(0, 2000)}"
INDUSTRY: ${niche}

Industry visual rules:
- Do: ${rules.doConcrete}
- Avoid: ${rules.bannedConcrete}
- Emotional register required: ${rules.emotionalRegister}

CRITICAL RULES FOR PICKING THE CONCEPT:
1. The hero image must show HOPE, SOLUTION, or POSITIVE OUTCOME — NEVER the suffering or dramatic problem the post opens with.
2. If the post tells a "before → after" story, ALWAYS depict the AFTER (relief, solution, clarity), not the BEFORE (suffering, darkness, struggle).
3. If the post references dramatic imagery in the opening (eye-patches, dark rooms, hospital scenes, distressed people), DO NOT depict that literally — those are narrative devices, not the message.
4. The image should make a reader think "I want what this person has" — feel safe, hopeful, seen.
5. Anchor on the SOLUTION the brand offers (a calming consultation, a person trying on glasses with relief, hands receiving care).

The concept should be:
- A SPECIFIC moment showing the POSITIVE OUTCOME or solution moment
- Tonally aligned with: ${rules.emotionalRegister}
- Visual, concrete, immediately readable

Reply with ONE sentence describing the visual concept. Example for a healthcare/optician post about hidden eye problems: "A woman in her 50s sitting comfortably in a bright optician's consultation room, smiling softly while trying on a new pair of glasses, warm afternoon light through large windows, expression of relief and clarity."

ONE SENTENCE ONLY.` }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await r.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return txt && txt.length > 10 ? txt : "";
  } catch {
    return "";
  }
}

async function craftImagePromptWithAI(
  contentText: string,
  niche: string,
  stylePrompt: string,
  mode: "overlay" | "standalone",
  feedback?: ImageFeedback[],
  brandContext?: string,
  nyligenMotiv?: string[],
): Promise<string> {
  if (!GEMINI_KEY) return contentText;
  const rules = rulesForNiche(niche);

  // Steg 1: extrahera ett specifikt visuellt nyckelkoncept från posten
  const visualConcept = await extractVisualConcept(contentText, niche, rules);
  const conceptSection = visualConcept
    ? `\n\nKEY VISUAL CONCEPT EXTRACTED FROM THIS POST (anchor your scene to this — don't drift to a generic industry scene):\n"${visualConcept}"`
    : "";

  let feedbackSection = "";
  if (feedback?.length) {
    const liked = feedback.filter((f) => f.rating === 1).slice(-3);
    const disliked = feedback.filter((f) => f.rating === -1).slice(-3);
    if (liked.length) feedbackSection += `\n\nPROMPTS USER LIKED (mirror style/subject approach):\n${liked.map((f) => `- "${f.prompt}"`).join("\n")}`;
    if (disliked.length) feedbackSection += `\n\nPROMPTS USER DISLIKED (avoid this approach):\n${disliked.map((f) => `- "${f.prompt}"`).join("\n")}`;
  }

  const brandSection = brandContext ? `\n\nBRAND VOICE & POSITIONING:\n${brandContext.slice(0, 1500)}` : "";
  const fullContext = conceptSection + brandSection;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an elite visual content strategist for a brand-aware content engine. Write ONE image generation prompt (in English) for this post.

POST CONTENT (use as topic input, NOT a literal scene to depict): "${contentText.slice(0, 1200)}"
BRAND / INDUSTRY: ${niche || "business"}
${seasonPromptLineEn(new Date(), { nyligenMotiv })}
${fullContext}

INDUSTRY-SPECIFIC VISUAL RULES (these OVERRIDE the generic style hint below):
- Style hint: ${rules.styleHint}
- Banned for this industry: ${rules.bannedConcrete}
- What to show instead: ${rules.doConcrete}
- Palette: ${rules.paletteHint}
- Emotional register: ${rules.emotionalRegister}

Generic style baseline (apply only where it does not conflict with industry rules): ${stylePrompt}

IMAGE MODE: ${mode === "standalone" ? "Hero blog/social image — must be visually striking, self-explanatory, and tone-perfect for the brand." : "Background for text overlay — needs muted areas for white text but still on-brand."}

CRITICAL RULES (NEVER VIOLATE):
1. Match the EMOTIONAL TONE of the post. A hopeful post about solutions gets a hopeful image. A serious post about a problem still gets a dignified image, NEVER a creepy or menacing one.
2. If the post is about a sensitive health/wellness topic, the image must build trust and hope — not depict the problem in a scary or dramatic way.
3. NO text, words, letters, numbers in image.
4. NO extreme dramatic dark close-ups of body parts unless the industry rules explicitly allow it.
5. NEVER let the generic style baseline override the industry rules.
6. ${NO_DASH_IN_IMAGE_EN}
7. ${DEPICTED_RELEVANCE_EN}
8. ${PERSON_ATTENTION_EN}
${feedbackSection}

Write ONLY the prompt, 3-4 sentences, hyper-specific about: subject, environment, lighting, mood, composition.` }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.6, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await r.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (txt && txt.length > 20) return txt;
  } catch (e) {
    console.error("[images] craft prompt failed:", e);
  }
  return `Professional commercial photograph for a ${niche || "business"} brand related to: ${contentText.slice(0, 100)}. ${rules.styleHint} ${rules.doConcrete}. Photorealistic, high detail, no text in image.`;
}

export async function generateImagen(prompt: string, aspectRatio: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" = "1:1"): Promise<{ success?: boolean; image?: string; error?: string }> {
  if (!GEMINI_KEY) return { error: "GEMINI_API_KEY saknas" };
  // Imagen-modellerna (imagen-4.0-*) är stängda för nya nyckelanvändare → använd Gemini
  // native image ("Nano Banana"), samma motor som app/api/posts/[id]/nano-banana.
  const fullPrompt = `${prompt}\nBildformat/komposition: ${aspectRatio}.`;
  const models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];
  let lastError = "Ingen bild genererades";
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      if (!r.ok) { lastError = (await r.text()).slice(0, 200); continue; }
      const data = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data,
      );
      if (part?.inlineData?.data) {
        return { success: true, image: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` };
      }
    } catch (e) {
      lastError = "Nätverksfel: " + (e as Error).message;
    }
  }
  return { error: lastError };
}

// Gör om ett ämne/en bildtext (ofta prosa) till EN kort, konkret VISUELL scen som
// bildmodellen kan rita. Bildmodellen svarar "NO_IMAGE" på prosa/meddelanden — den
// behöver ett motiv. thinkingBudget:0 (annars bränns token-budgeten på tänk → avhugget).
// Faller tillbaka på ämnet självt om det inte går.
export async function visualScene(topic: string, niche: string, opts?: { textYta?: boolean }): Promise<string> {
  if (!GEMINI_KEY || !topic.trim()) return topic;
  try {
    // textYta: bilden ska innehålla en skylt/lapp där exakt text sätts efteråt (B3) —
    // då får scenen INTE förbjuda text, och ytan ska beskrivas. Texten själv nämns aldrig här.
    // BILD-7a: den gamla raden var ett blankt textförbud. Det stoppade aldrig modellen
    // från att rita skyltar (BILD-6a föddes ur en avbildad skärmannons) — det gjorde
    // bara skyltarna innehållslösa. Nu skiljs pålagd rubrik/CTA från skyltning som
    // naturligt hör hemma i miljön: det förra är förbjudet, det senare ska säga något.
    const textDel = opts?.textYta
      ? `Bilden ska innehålla en tydlig skylt, lapp eller yta där text kommer att sitta — beskriv motivet och var ytan är, men nämn INTE någon text. `
      : `Ingen pålagd rubrik, ingen uppmaning och ingen logotyp ovanpå bilden. `;
    // Motivet MÅSTE höra hemma i verksamheten. Skarpt fel: "Sluta köpa billigt" för ett
    // digital signage-företag gav en sliten tröja — modellen tog budskapet som generisk
    // metafor. Metaforer från andra branscher är förbjudna.
    // BILD-7a: skärmar/skyltar i motivet ska ha relevans OCH budskap. Den gamla raden
    // krävde bara "enkelt verkligt innehåll" — resultatet blev tomma menytavlor och
    // skyltfönster utan poäng. Nu ska scenen beskriva vad skylten visar OCH säger.
    const branschDel =
      `Motivet ska omisskännligt höra hemma i just denna verksamhet (${niche}) — visa verksamhetens miljö, produkter eller kunder. ` +
      `Använd ALDRIG metaforer eller motiv från andra branscher (kläder, kaffe, schack och liknande). ` +
      `Beskriv en VERKLIG vardagsmiljö, gärna med människor eller kunder när det passar — aldrig en steril arkitekturbild. ` +
      `${DEPICTED_RELEVANCE_SV} ${opts?.textYta ? "" : DEPICTED_MESSAGE_SV + " "}` +
      // BILD-8b: syns en person tillsammans med det som säljs ska scenen beskriva att
      // hon är vänd mot det (skarpt fel: kvinnan framför skärmen tittade bort).
      `${PERSON_ATTENTION_SV} ` +
      `Nämn i scenbeskrivningen vad en eventuell skärm/skylt visar och, om en person syns, att hon är vänd mot den. `;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          `Föreslå ETT konkret visuellt bildmotiv (ett riktigt foto) som passar detta inlägg för en ${niche}. ` +
          `Svara med EN kort mening: vad som syns, stämning, ljus. ` + branschDel + textDel +
          `Undvik vapen, knivar, blod eller något känsligt. Inlägg: "${topic.slice(0, 300)}"` }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) return topic;
    const data = await r.json();
    const t = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text?.trim();
    return t && t.length > 8 ? t : topic;
  } catch {
    return topic;
  }
}

// Motiv-grind: hör den genererade bilden hemma i verksamheten? Fail-closed kvalitetskoll
// efter generering (skarpt fel: sliten tröja föreslogs för ett digital signage-företag).
// Vid tveksamhet svarar modellen nej — hellre omtag/Sök foto än fel bransch i kundens flöde.
export async function motivPassar(image: string, niche: string): Promise<boolean> {
  if (!GEMINI_KEY || !image || !niche.trim()) return true;
  try {
    const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let inline: { mimeType: string; data: string };
    if (m) {
      inline = { mimeType: m[1], data: m[2] };
    } else {
      const r = await fetch(image);
      if (!r.ok) return true;
      const buf = Buffer.from(await r.arrayBuffer());
      inline = { mimeType: r.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") };
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inlineData: inline },
          { text: `Bilden ska användas i marknadsföring för en verksamhet inom: "${niche}". Hör motivet omisskännligt hemma i den verksamheten (dess miljö, produkter eller kunder)? En metafor från en annan bransch (t.ex. kläder, kaffe) räknas som NEJ. Svara ENDAST med JA eller NEJ.` },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) return true;
    const data = await r.json();
    const svar = (data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "").trim().toUpperCase();
    return !svar.startsWith("NEJ");
  } catch {
    return true;
  }
}

export type BildRoll = "problem" | "losning" | "neutral";

// Analysera en FÄRDIG bild (URL) → kort beskrivning + vilken roll den spelar i berättelsen.
// Används när bilden inte kom från Bildhjälpen (då finns redan en scenbeskrivning), t.ex.
// en uppladdad bild eller ett stockfoto. Rollen styr sedan vilka texter som föreslås:
// visar bilden PROBLEMET → problem/fråge-texter; visar den LÖSNINGEN → påstående/resultat.
export async function analyzeImageRole(imageUrl: string, caption?: string): Promise<{ description: string; role: BildRoll }> {
  if (!GEMINI_KEY || !imageUrl) return { description: "", role: "neutral" };
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return { description: "", role: "neutral" };
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length >= 19 * 1024 * 1024) return { description: "", role: "neutral" };
    const inline = { mimeType: imgRes.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inlineData: inline },
          { text:
            "Beskriv bilden på svenska i EN kort mening (vad syns, stämning, ljus). " +
            "Avgör sedan bildens roll i BERÄTTELSEN inlägget berättar: visar den ett PROBLEM/en brist (\"före\"-läget, det som ska bytas ut), " +
            "en LÖSNING/ett önskat resultat (\"efter\"-läget, det man vill ha), eller är den NEUTRAL. " +
            (caption ? `Inläggets text som ramar in bilden: "${caption.slice(0, 400)}". Väg in den: samma bild kan vara ett problem eller en lösning beroende på hur texten ramar in den. ` : "") +
            'Svara ENDAST med strikt JSON: {"description":"...","role":"problem|losning|neutral"}' },
        ] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) return { description: "", role: "neutral" };
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "";
    const obj = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const role: BildRoll = obj.role === "problem" || obj.role === "losning" ? obj.role : "neutral";
    return { description: typeof obj.description === "string" ? obj.description.trim() : "", role };
  } catch {
    return { description: "", role: "neutral" };
  }
}

// Klassa bildens roll UTIFRÅN en känd beskrivning (t.ex. scenen från Bildhjälpen) — utan
// att analysera pixlar. Billig textklassning, används när bilden genererades och vi redan
// vet vad den föreställer.
export async function classifyImageRoleFromText(description: string, caption?: string): Promise<BildRoll> {
  if (!GEMINI_KEY || !description.trim()) return "neutral";
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text:
          "En bild i ett marknadsinlägg föreställer följande. Avgör bildens roll: PROBLEM/brist (\"före\", något slitet/trist/frustrerande), " +
          "LÖSNING/önskat resultat (\"efter\", proffsigt/tilltalande), eller NEUTRAL. " +
          (caption ? `Inläggets text: "${caption.slice(0, 300)}". ` : "") +
          `Bild: "${description.slice(0, 300)}". ` +
          'Svara ENDAST med JSON: {"role":"problem|losning|neutral"}' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 }, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) return "neutral";
    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "";
    const role = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}").role;
    return role === "problem" || role === "losning" ? role : "neutral";
  } catch {
    return "neutral";
  }
}

// Redigera en befintlig bild via textinstruktion (bild-till-bild, "Nano Banana").
// Ex: "visa bara barnet, inte optikern, annars lika". Behåller komposition/stil/ljus
// och ändrar bara det instruktionen ber om. Returnerar data-URL (PNG/JPEG base64).
export async function editImagen(
  instruction: string,
  baseImageUrl: string,
): Promise<{ success?: boolean; image?: string; error?: string }> {
  if (!GEMINI_KEY) return { error: "GEMINI_API_KEY saknas" };
  if (!baseImageUrl) return { error: "Basbild saknas" };

  // Hämta basbilden server-side → base64 inline.
  let inline: { mimeType: string; data: string };
  try {
    const imgRes = await fetch(baseImageUrl);
    if (!imgRes.ok) return { error: "Kunde inte hämta basbilden" };
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length >= 19 * 1024 * 1024) return { error: "Basbilden är för stor (max 19 MB)" };
    inline = { mimeType: imgRes.headers.get("content-type") || "image/jpeg", data: buf.toString("base64") };
  } catch (e) {
    return { error: "Nätverksfel vid hämtning av basbild: " + (e as Error).message };
  }

  const fullPrompt =
    `Redigera bilden enligt instruktionen. Behåll allt annat oförändrat — samma komposition, ` +
    `stil, ljus, färgton och bildformat. Ändra endast det som efterfrågas. Inga texter, siffror eller bokstäver i bilden. ` +
    `${NO_DASH_IN_IMAGE_SV}\n` +
    // BILD-8b: gäller även redigering — finns personer i bilden ska de vara vända mot
    // det som säljs. Blickriktningen får aldrig försämras av en redigering.
    `${PERSON_ATTENTION_SV}\n` +
    `Instruktion: ${instruction}`;

  const parts = [
    { inlineData: inline },
    { text: fullPrompt },
  ];
  const models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"];
  let lastError = "Ingen bild genererades";
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      if (!r.ok) { lastError = (await r.text()).slice(0, 200); continue; }
      const data = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data,
      );
      if (part?.inlineData?.data) {
        return { success: true, image: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` };
      }
    } catch (e) {
      lastError = "Nätverksfel: " + (e as Error).message;
    }
  }
  return { error: lastError };
}

export async function generateFlux(prompt: string, aspect: "square" | "portrait" | "landscape" = "square"): Promise<{ success?: boolean; image?: string; error?: string }> {
  if (!FAL_KEY) return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  try {
    const size = aspect === "square" ? "square" : aspect === "portrait" ? "portrait_16_9" : "landscape_16_9";
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: size, num_images: 1 }),
    });
    const data = await r.json();
    if (data.images?.[0]?.url) return { success: true, image: data.images[0].url };
    return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  } catch {
    return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  }
}

/**
 * Plocka standard-stil baserat på bransch. Default-stilen "cinematic mörk" är
 * fel för vården/coaching/B2B-tjänster — vi vill ha "editorial" eller "lifestyle"
 * där, inte dramatiska skuggor.
 */
function defaultStyleForNiche(niche: string): ImageStyleId {
  const n = (niche || "").toLowerCase();
  if (/optik|ögon|syn|vård|läkare|terapi|hälsa|wellness|psykolog|fysio/.test(n)) return "editorial";
  if (/coach|sälj|personlig utveckling|leadership|ledarskap|consulting|rådgiv/.test(n)) return "lifestyle";
  if (/led|skärm|display|signage|skylt|hardware|elektronik/.test(n)) return "product";
  if (/konst|design|kreativ|art|illustrat/.test(n)) return "minimal";
  if (/bil|fordon|motor|mekanik|verkstad/.test(n)) return "product";
  if (/natur|skog|jämt|outdoor/.test(n)) return "nordic";
  return "editorial";
}

export async function generateImageForPost(opts: {
  contentText: string;
  niche?: string;
  styleId?: ImageStyleId;
  mode?: "overlay" | "standalone";
  aspect?: "square" | "portrait" | "landscape";
  feedback?: ImageFeedback[];
  brandContext?: string;
  /** BILD-7b: motiv från de senaste genereringarna → "välj ett annat den här gången". */
  nyligenMotiv?: string[];
  /** BILD-8a: stäng av stavningsgrinden (t.ex. batch-körningar utan tidsutrymme). */
  stavningsgrind?: boolean;
  /** BILD-8a: tak för hur länge grindens omtag får hålla på. */
  stavningsbudgetMs?: number;
}): Promise<{
  success?: boolean;
  image?: string;
  error?: string;
  engine?: string;
  prompt?: string;
  /** BILD-8a: vad stavningsgrinden gjorde (saknas när grinden inte kördes). */
  textkontroll?: { orsak: TextOrsak; avlast: string; fel: string[]; omtag: number; blank: boolean };
}> {
  const niche = opts.niche || "business";
  // Om ingen styleId angiven — välj smart baserat på bransch (INTE alltid "cinematic mörk")
  const resolvedStyleId = opts.styleId || defaultStyleForNiche(niche);
  const styleObj = IMAGE_STYLES.find((s) => s.id === resolvedStyleId) || IMAGE_STYLES[1];
  const mode = opts.mode || "standalone";

  const aiScene = await craftImagePromptWithAI(opts.contentText, niche, styleObj.prompt, mode, opts.feedback, opts.brandContext, opts.nyligenMotiv);
  const fullPrompt = `${aiScene}
CRITICAL: Absolutely NO text, NO words, NO letters, NO numbers in the image.
Photorealistic. Natural composition. 4K resolution feel.
${mode === "overlay" ? "Muted tones suitable for white text overlay — but never depressing." : "Beautiful composition, sharp focus, on-brand emotional tone."}`;

  const rita = (tillagg: string) =>
    FAL_KEY
      ? generateFlux(`${fullPrompt}${tillagg}`, opts.aspect || "square")
      : generateImagen(`${fullPrompt}${tillagg}`, opts.aspect === "portrait" ? "9:16" : opts.aspect === "landscape" ? "16:9" : "1:1");

  const result = await rita("");
  const engine = FAL_KEY ? "FLUX" : "Imagen";

  // BILD-8a: bildmodellen ritar skyltar även när prompten förbjuder text — och stavar
  // fel när den gör det. Grinden läser av, begär omtag, och ber till sist om TOM skylt.
  // Fail-open: allt som går fel tekniskt lämnar bilden orörd.
  if (result.image && opts.stavningsgrind !== false) {
    try {
      const grind = await stavningsgrind({
        bild: result.image,
        maxOmtag: 2,
        tidsbudgetMs: opts.stavningsbudgetMs,
        generera: ({ skarpning }) => rita(skarpning),
      });
      return {
        ...result,
        image: grind.image,
        engine,
        prompt: fullPrompt,
        textkontroll: {
          orsak: grind.utfall.orsak,
          avlast: grind.utfall.text,
          fel: grind.utfall.fel,
          omtag: grind.omtag,
          blank: grind.blank,
        },
      };
    } catch (e) {
      console.error("[images] stavningsgrind failade — bilden släpps igenom:", e);
    }
  }
  return { ...result, engine, prompt: fullPrompt };
}

export async function ensurePublicImageUrl(imageData: string): Promise<{ url?: string; error?: string }> {
  if (!imageData) return { error: "Ingen bild" };
  if (imageData.includes("supabase.co/storage/")) return { url: imageData };
  const sb = supabaseServer();

  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    try {
      await assertSafePublicUrl(imageData); // SSRF-skydd: ingen intern/privat adress
      const response = await fetch(imageData);
      if (!response.ok) return { error: "Kunde inte ladda ner bild" };
      const ct = response.headers.get("content-type") || "image/png";
      const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("images").upload(fileName, buffer, { contentType: ct, upsert: false });
      if (error) return { error: error.message };
      const { data } = sb.storage.from("images").getPublicUrl(fileName);
      return { url: data.publicUrl };
    } catch (e) {
      return { error: "Nätverksfel: " + (e as Error).message };
    }
  }

  if (imageData.startsWith("data:image/")) {
    try {
      const m = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) return { error: "Ogiltigt bildformat" };
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const buffer = Buffer.from(m[2], "base64");
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("images").upload(fileName, buffer, { contentType: `image/${ext}`, upsert: false });
      if (error) {
        if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
          return { error: 'Supabase Storage bucket "images" saknas. Skapa den i Supabase Dashboard → Storage.' };
        }
        return { error: error.message };
      }
      const { data } = sb.storage.from("images").getPublicUrl(fileName);
      return { url: data.publicUrl };
    } catch (e) {
      return { error: "Fel vid bilduppladdning: " + (e as Error).message };
    }
  }
  return { error: "Okänt bildformat" };
}

// Instagram Graph tar BARA emot JPEG för bildinlägg (verifierat mot Metas docs).
// Studio/Gemini renderar PNG → konvertera vid publicering och hosta som JPEG på
// den publika 'images'-bucketen. sharp finns i runtime (används i logo-assets).
export async function ensureJpegUrl(url: string): Promise<{ url?: string; error?: string }> {
  if (!url) return { error: "Ingen bild" };
  if (/\.jpe?g(\?|#|$)/i.test(url)) return { url }; // redan JPEG
  try {
    await assertSafePublicUrl(url); // SSRF-skydd
    const res = await fetch(url);
    if (!res.ok) return { error: "Kunde inte ladda ner bild för JPEG-konvertering" };
    const input = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default; // native-modul, dynamiskt (finns i runtime)
    const jpeg = await sharp(input).jpeg({ quality: 90 }).toBuffer();
    const sb = supabaseServer();
    const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from("images").upload(fileName, jpeg, { contentType: "image/jpeg", upsert: false });
    if (error) return { error: error.message };
    const { data } = sb.storage.from("images").getPublicUrl(fileName);
    return { url: data.publicUrl };
  } catch (e) {
    return { error: "JPEG-konvertering misslyckades: " + (e as Error).message };
  }
}

// Pexels stock photos
export interface StockPhoto { id: number; url: string; src: string; srcMedium: string; photographer: string; alt: string }

export type StockOrientation = "square" | "portrait" | "landscape";

// orientation är valfri och defaultar till "square" så alla befintliga anropare beter sig
// exakt som förut. Reels behöver "portrait" — utan den parametern gick det inte att hitta
// stående foton alls, vilket gjorde stock-spåret oanvändbart för 9:16.
export async function searchStockPhotos(
  topic: string,
  niche?: string,
  count = 12,
  orientation: StockOrientation = "square",
): Promise<{ photos: StockPhoto[]; query: string; error?: string }> {
  if (!PEXELS_KEY) return { photos: [], query: "", error: "PEXELS_API_KEY saknas" };

  let q = topic;
  if (GEMINI_KEY) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate ONE short English search query (2-4 words) for finding visual stock photos on Pexels.\n\nTopic: "${topic}"\n${niche ? `Niche: ${niche}` : ""}\n\nReply with ONLY the query.` }] }],
          generationConfig: { maxOutputTokens: 50, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const out = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (out && out.length > 0 && out.length < 60) q = out;
      }
    } catch (e) { console.error("[images] pexels query craft:", e); }
  }

  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${count}&orientation=${orientation}`, { headers: { Authorization: PEXELS_KEY } });
    if (!r.ok) return { photos: [], query: q, error: `Pexels-fel: ${r.status}` };
    const data = await r.json();
    const photos: StockPhoto[] = (data.photos || []).map((p: { id: number; url: string; src: { large2x?: string; large?: string; original?: string; medium?: string }; photographer: string; alt: string }) => ({
      id: p.id,
      url: p.url,
      src: p.src.large2x || p.src.large || p.src.original || "",
      srcMedium: p.src.medium || p.src.large || "",
      photographer: p.photographer || "Okänd",
      alt: p.alt || q,
    }));
    return { photos, query: q };
  } catch (e) {
    return { photos: [], query: q, error: "Pexels-nätverksfel: " + (e as Error).message };
  }
}
