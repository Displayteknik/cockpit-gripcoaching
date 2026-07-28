// Nyhetsbrev-generator: blogg (eller fritext) → nyhetsbrev i klientens röst.
// AI skriver TEXT (ämnesrader, intro, sektioner, CTA-text) — layouten (HTML) byggs
// deterministiskt här, precis som Studio. AI hittar aldrig på länkar; CTA-URL:en
// sätts av anroparen (bloggens publika URL eller bokningslänk).
import { generateJSON } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule, NEUTRAL_DIRECTIVES } from "@/lib/studio/kit";
import { contentCompassBlock, type CompassParams } from "@/lib/content-compass/prompt";
import type { NewsletterContent } from "@/lib/newsletter-render";

export { renderNewsletterHtml, renderNewsletterText, type NewsletterContent, type RenderOpts } from "@/lib/newsletter-render";

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

export interface NewsletterGenOpts {
  clientId: string;
  title: string;
  articleText: string;
  brandName?: string;
  compass?: CompassParams | null;
}

export async function generateNewsletter(opts: NewsletterGenOpts): Promise<NewsletterContent> {
  const [profile, directives] = await Promise.all([
    getProfileAsMarkdown().catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => NEUTRAL_DIRECTIVES),
  ]);
  const brand = opts.brandName || "kunden";
  const compassText = opts.compass ? contentCompassBlock(opts.compass) : "";

  const system = [
    `Du skriver ett nyhetsbrev (e-post) för ${brand}, byggt på en bloggartikel. Kondensera artikeln till ett nyhetsbrev som ger värde i inkorgen och lockar att läsa hela artikeln.`,
    "Skriv som en människa, varmt och konkret. Det ska kännas som ett personligt brev, inte en annons.",
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, tonalitet, målgrupp och ord HÅRT på denna ===\n${profile.slice(0, 6000)}` : "",
    compassText ? `\n${compassText}` : "",
    dontsRule(directives.donts),
    "\n=== REGLER ===",
    "- ämnesrader: 4 varianter, olika vinklar, max ~60 tecken, aldrig clickbait eller VERSALER.",
    "- preheader: en rad som kompletterar ämnesraden (max ~90 tecken).",
    "- intro: 1 stycke som fångar direkt (koppla till läsarens vardag).",
    "- sections: 2 till 4 korta sektioner som kondenserar artikelns kärna. Varje har en kort heading och 1 till 3 meningar. Ge konkret värde, inte bara teaser.",
    "- cta_text: kort knapptext som leder till att läsa hela artikeln (t.ex. 'Läs hela guiden').",
    "- signoff: en varm avslutning (t.ex. 'Vi ses i butiken, / Anna').",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt. Inga emoji-väggar, ingen säljhype.`,
    "\n=== SVAR: ENDAST JSON ===",
    `{"subjects":["..."],"preheader":"...","greeting":"Hej!","intro":"...","sections":[{"heading":"...","body":"..."}],"cta_text":"...","signoff":"..."}`,
  ].filter(Boolean).join("\n");

  const prompt = `ARTIKELNS TITEL: ${opts.title || "(utan titel)"}\n\nARTIKELTEXT:\n${opts.articleText.slice(0, 8000)}\n\nSkriv nyhetsbrevet nu. Returnera enbart JSON.`;

  const raw = await generateJSON<Partial<NewsletterContent>>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt,
    temperature: 0.8,
    maxOutputTokens: 2500,
  });

  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    subjects: Array.isArray(raw.subjects) ? raw.subjects.map(s).filter(Boolean).slice(0, 6) : [],
    preheader: s(raw.preheader),
    greeting: s(raw.greeting) || "Hej!",
    intro: s(raw.intro),
    sections: Array.isArray(raw.sections)
      ? raw.sections.map((x) => ({ heading: s((x as { heading?: string }).heading), body: s((x as { body?: string }).body) })).filter((x) => x.body).slice(0, 6)
      : [],
    cta_text: s(raw.cta_text) || "Läs mer",
    signoff: s(raw.signoff),
  };
}
