// Nyhetsbrev-generator: blogg (eller fritext) → nyhetsbrev i klientens röst.
// AI skriver TEXT (ämnesrader, intro, sektioner, CTA-text) — layouten (HTML) byggs
// deterministiskt här, precis som Studio. AI hittar aldrig på länkar; CTA-URL:en
// sätts av anroparen (bloggens publika URL eller bokningslänk).
import { generateJSON } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import type { CompassParams } from "@/lib/content-compass/prompt";
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
  const brand = opts.brandName || "kunden";

  // TEXT-1 T-2: prompten byggs av prompt-core (brand-profil, röst, winning, anatomi/compass
  // och skrivregler ägs av kärnan). Uppdraget = flödets rollrad + hårda regler.
  const uppdrag = [
    `Du skriver ett nyhetsbrev (e-post) för ${brand}, byggt på en bloggartikel. Kondensera artikeln till ett nyhetsbrev som ger värde i inkorgen och lockar att läsa hela artikeln.`,
    "Skriv som en människa, varmt och konkret. Det ska kännas som ett personligt brev, inte en annons.",
    "\n=== REGLER ===",
    "- ämnesrader: 4 varianter, olika vinklar, max ~60 tecken, aldrig clickbait eller VERSALER.",
    "- preheader: en rad som kompletterar ämnesraden (max ~90 tecken).",
    "- intro: 1 stycke som fångar direkt (koppla till läsarens vardag).",
    "- sections: 2 till 4 korta sektioner som kondenserar artikelns kärna. Varje har en kort heading och 1 till 3 meningar. Ge konkret värde, inte bara teaser.",
    "- cta_text: kort knapptext som leder till att läsa hela artikeln (t.ex. 'Läs hela guiden').",
    "- signoff: en varm avslutning (t.ex. 'Vi ses i butiken, / Anna').",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt. Inga emoji-väggar, ingen säljhype.`,
  ].join("\n");

  const b = await byggTextPrompt({
    clientId: opts.clientId,
    syfte: "nyhetsbrev",
    kanal: "mejl",
    uppdrag,
    underlag: `ARTIKELNS TITEL: ${opts.title || "(utan titel)"}\n\nARTIKELTEXT:\n${opts.articleText.slice(0, 8000)}\n\nSkriv nyhetsbrevet nu. Returnera enbart JSON.`,
    compass: opts.compass || undefined,
    jsonSchema: `{"subjects":["..."],"preheader":"...","greeting":"Hej!","intro":"...","sections":[{"heading":"...","body":"..."}],"cta_text":"...","signoff":"..."}`,
  });

  const raw = await generateJSON<Partial<NewsletterContent>>({
    model: "gemini-2.5-pro",
    systemInstruction: b.system,
    prompt: b.user,
    temperature: 0.8,
    maxOutputTokens: 2500,
    skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
  });

  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  // T-5 (2): enhetlig sanering på ALLA textbärande fält — nyhetsbrevet saknade
  // sanering helt (10 % tankstreck i mätningen). Flaggan avgörs i prompt-core.
  const ren = (t: string) => saneraText(t, opts.clientId);
  const [subjects, preheader, greeting, intro, sections, cta_text, signoff] = await Promise.all([
    Promise.all((Array.isArray(raw.subjects) ? raw.subjects.map(s).filter(Boolean).slice(0, 6) : []).map(ren)),
    ren(s(raw.preheader)),
    ren(s(raw.greeting)),
    ren(s(raw.intro)),
    Promise.all(
      (Array.isArray(raw.sections)
        ? raw.sections.map((x) => ({ heading: s((x as { heading?: string }).heading), body: s((x as { body?: string }).body) })).filter((x) => x.body).slice(0, 6)
        : []
      ).map(async (x) => ({ heading: await ren(x.heading), body: await ren(x.body) })),
    ),
    ren(s(raw.cta_text)),
    ren(s(raw.signoff)),
  ]);
  return {
    subjects,
    preheader,
    greeting: greeting || "Hej!",
    intro,
    sections,
    cta_text: cta_text || "Läs mer",
    signoff,
  };
}
