// Studio Fas 4/5 — stark bloggartikel-generator. Ämne → komplett SEO/E-E-A-T-artikel
// grundad i varumärkesröst + hook-playbook + klientens EGNA befintliga inlägg (interna
// länkar). AI skriver text — INTE layout. Output = ren body-HTML + FAQ (för JSON-LD) +
// omslagsbild-prompt. Modellen får BARA länka till riktiga URL:er vi skickar in.

import { generate } from "@/lib/gemini";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";

export interface InternalLink { title: string; url: string }

export interface BlogArticle {
  title: string;
  metaTitle: string;
  metaDescription: string;
  urlSlug: string;
  html: string; // body-HTML (h2/h3/p/ul/ol/a) — ingen H1, ingen <body>-wrapper
  faq: { q: string; a: string }[];
  tags: string[];
  coverImagePrompt: string; // för AI-bildgenerering
  coverImageAlt: string;
}

export interface BlogGenOpts {
  clientId: string;
  topic: string;
  wordCount?: number;
  brandName?: string;
  industry?: string;
  internalLinks?: InternalLink[]; // klientens riktiga inlägg att länka till
}

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

export async function generateBlogArticle(opts: BlogGenOpts): Promise<BlogArticle> {
  const [playbook, profile, directives] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    getProfileAsMarkdown().catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => ({ imageExtra: "", imageNegative: "", donts: [] as string[], colors: {}, formats: [] as string[] })),
  ]);
  const brand = opts.brandName || "kunden";
  const words = Math.min(Math.max(opts.wordCount || 900, 400), 2200);
  const links = (opts.internalLinks || []).slice(0, 12);

  const linkBlock = links.length
    ? links.map((l, i) => `${i + 1}. "${l.title}" → ${l.url}`).join("\n")
    : "(inga befintliga inlägg tillgängliga — hoppa över interna länkar)";

  const system = [
    `Du är en erfaren svensk SEO-skribent och ämnesexpert som skriver för ${brand}${opts.industry ? ` (${opts.industry})` : ""}.`,
    "Skriv som en kunnig människa med förstahandserfarenhet — konkret, trovärdigt, hjälpsamt. Ingen AI-floskel, ingen säljhype, inga tomma superlativ.",
    playbook ? `\n=== HOOK-PLAYBOOK (använd för inledningen) ===\n${playbook.slice(0, 2500)}` : "",
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, tonalitet, målgrupp, ord och tjänster HÅRT på denna ===\n${profile.slice(0, 6500)}` : "",
    "\n=== KLIENTENS BEFINTLIGA INLÄGG (för interna länkar — använd BARA dessa exakta URL:er) ===",
    linkBlock,
    "\n=== E-E-A-T & KVALITET (konstens alla regler) ===",
    "- Experience/Expertise: konkreta detaljer, exempel, siffror och avvägningar en riktig expert ger. Inga påhittade fakta/priser — osäkert → skriv generellt.",
    "- Trovärdighet: nyanserat, ärligt, ta upp för- och nackdelar. Svara på det läsaren faktiskt undrar.",
    "- Hjälpsamt-först: läsaren ska lämna sidan klokare. Sälj genom värde, inte hype.",
    "\n=== STRUKTUR (modern, skannbar) ===",
    "- Inled med en stark krok (enligt playbooken) + 1 kort stycke som lovar vad läsaren får ut.",
    "- Därefter <h2>-sektioner med beskrivande, sökordsnära rubriker. <h3> för undersektioner.",
    "- Använd <ul>/<ol> för listor, <strong> för nyckelbegrepp, korta stycken. Minst en konkret lista eller stegguide.",
    "- Väv in 2–4 INTERNA LÄNKAR med naturlig ankartext till relevanta av inläggen ovan: <a href=\"EXAKT-URL\">beskrivande ankartext</a>. Aldrig påhittade URL:er, aldrig 'läs mer'/'klicka här'.",
    "- Avsluta med <h2>Vanliga frågor</h2> (3–4 <h3>-frågor med svar) och ett kort avslutande stycke med uppmaning att höra av sig/boka.",
    `- Längd ca ${words} ord. Naturliga sökord (målgruppens egna ord), aldrig keyword-stuffing.`,
    "\n=== META & TEKNIK ===",
    "- metaTitle ≤60 tecken med huvudsökordet. metaDescription 140–155 tecken, lockande.",
    "- urlSlug: gemener, bindestreck, å→a ä→a ö→o, inga stoppord i onödan.",
    "- faq: SAMMA frågor/svar som i Vanliga frågor-sektionen (rå text, ingen HTML) — används för FAQ-schema.",
    "- coverImagePrompt: en engelsk fotoprompt för en redaktionell, verklig omslagsbild som passar ämnet och branschen (inga texter/logotyper i bilden). coverImageAlt: svensk alt-text.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt överallt.`,
    dontsRule(directives.donts),
    "\n=== SVAR: ENDAST strikt JSON, inga kodstaket ===",
    '{"title":"...","metaTitle":"...","metaDescription":"...","urlSlug":"...","html":"<h2>...</h2><p>... <a href=\\"...\\">...</a></p>","faq":[{"q":"...","a":"..."}],"tags":["..."],"coverImagePrompt":"...","coverImageAlt":"..."}',
  ].join("\n");

  const prompt = `Ämne/vinkel: ${opts.topic.trim()}. Skriv den kompletta artikeln nu enligt alla krav.`;

  const raw = await generate({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt,
    temperature: 0.8,
    maxOutputTokens: 8192,
    jsonMode: true,
  });

  const obj = parseJson(raw);
  if (!obj) throw new Error("Kunde inte tolka AI-svaret som artikel");

  const title = str(obj.title) || opts.topic;
  const faq = Array.isArray(obj.faq)
    ? obj.faq.map((f: Record<string, unknown>) => ({ q: str(f.q), a: str(f.a) })).filter((f: { q: string; a: string }) => f.q && f.a).slice(0, 6)
    : [];
  return {
    title,
    metaTitle: (str(obj.metaTitle) || title).slice(0, 60),
    metaDescription: str(obj.metaDescription).slice(0, 160),
    urlSlug: slugify(str(obj.urlSlug) || title),
    html: str(obj.html),
    faq,
    tags: Array.isArray(obj.tags) ? obj.tags.map(str).filter(Boolean).slice(0, 6) : [],
    coverImagePrompt: str(obj.coverImagePrompt),
    coverImageAlt: str(obj.coverImageAlt) || title,
  };
}

export interface SocialFromArticle { hookType: string; headline1: string; headline2: string; body: string }

// Repurposing: gör om en artikel till 3 sociala affisch-inlägg (olika hooks), grundat i
// artikeln + varumärkesröst. Affisch-text (kort), inte caption. Återanvänder samma kvalitetskrav.
export async function repurposeToSocial(opts: {
  clientId: string; title: string; articleText: string; brandName?: string; industry?: string;
}): Promise<SocialFromArticle[]> {
  const profile = await getProfileAsMarkdown().catch(() => "");
  const directives = await getKitDirectives(opts.clientId).catch(() => ({ imageExtra: "", imageNegative: "", donts: [] as string[], colors: {}, formats: [] as string[] }));
  const brand = opts.brandName || "kunden";

  const system = [
    `Du gör om en bloggartikel för ${brand}${opts.industry ? ` (${opts.industry})` : ""} till korta sociala affisch-inlägg (text PÅ en bild).`,
    dontsRule(directives.donts),
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst/målgrupp/ord på denna ===\n${profile.slice(0, 4000)}` : "",
    "\n=== REGLER (affisch-format) ===",
    "- headline1: kort slagkraftig rubrik, MAX ~26 tecken, hel fras (aldrig fragment).",
    "- headline2: kort underrubrik/fråga, ~20–45 tecken.",
    "- body: MYCKET kort, 1–2 meningar, MAX ~90 tecken. Konkret nytta + kort uppmaning.",
    "- FÖRBJUDET: emoji, symboler, punktlistor, signatur, telefonnummer, URL, hashtag.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt.`,
    "- Skapa 3 varianter, var och en med EN distinkt hook-typ (fråga/statistik/konträr/berättelse/påstående) och egen vinkel ur artikeln.",
    "\n=== SVAR: ENDAST strikt JSON-array, inga kodstaket ===",
    '[{"hookType":"fråga","headline1":"...","headline2":"...","body":"..."}, {...}, {...}]',
  ].join("\n");

  const prompt = `Artikelns rubrik: ${opts.title}\n\nArtikel (utdrag):\n${opts.articleText.slice(0, 3500)}\n\nSkapa 3 sociala affisch-inlägg nu.`;

  const raw = await generate({ model: "gemini-2.5-flash", systemInstruction: system, prompt, temperature: 0.85, maxOutputTokens: 1800, jsonMode: true });
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v: Record<string, unknown>) => ({
      hookType: str(v.hookType), headline1: str(v.headline1), headline2: str(v.headline2), body: str(v.body),
    }))
    .filter((s) => s.headline1 && s.body)
    .slice(0, 3);
}

// Bygger FAQPage JSON-LD (för AEO/rich results) ur faq-listan.
export function buildFaqJsonLd(faq: { q: string; a: string }[]): string {
  if (!faq.length) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[éè]/g, "e")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "artikel";
}

function parseJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; } }
    return null;
  }
}
