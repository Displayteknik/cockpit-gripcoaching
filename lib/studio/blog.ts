// Studio Fas 4 — bloggartikel-generator. Ämne → färdig SEO-artikel grundad i
// varumärkesröst + hook-playbook. Deterministisk struktur (H2/H3, intro, FAQ, CTA).
// AI skriver text — INTE layout. Output = ren body-HTML som GHL Blogs tar emot.

import { generate } from "@/lib/gemini";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";

export interface BlogArticle {
  title: string;
  metaTitle: string;
  metaDescription: string;
  urlSlug: string;
  html: string; // body-HTML (h2/h3/p/ul/ol) — ingen <body>-wrapper, ingen H1 (titeln är H1)
  tags: string[];
}

export interface BlogGenOpts {
  clientId: string;
  topic: string;
  wordCount?: number;
  brandName?: string;
  industry?: string;
}

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

export async function generateBlogArticle(opts: BlogGenOpts): Promise<BlogArticle> {
  const [playbook, profile] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    getProfileAsMarkdown().catch(() => ""),
  ]);
  const brand = opts.brandName || "kunden";
  const words = Math.min(Math.max(opts.wordCount || 800, 400), 2000);

  const system = [
    `Du är en svensk SEO-skribent som skriver en bloggartikel för ${brand}${opts.industry ? ` (${opts.industry})` : ""}.`,
    "Skriv som en kunnig människa — konkret, trovärdigt, utan AI-floskler. Ingen säljhype.",
    playbook ? `\n=== HOOK-PLAYBOOK (för inledningen) ===\n${playbook.slice(0, 2500)}` : "",
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, målgrupp, ord, tjänster på denna ===\n${profile.slice(0, 6000)}` : "",
    "\n=== SEO- OCH STRUKTURKRAV ===",
    `- Längd ca ${words} ord. Naturliga sökord (målgruppens egna ord), inte keyword-stuffing.`,
    "- html: ren body-HTML med <h2>/<h3>, <p>, <ul>/<ol>. INGEN <h1> (titeln blir H1). Ingen <html>/<body>/<head>.",
    "- Inled med en krok (enligt playbooken), leverera konkret nytta, avsluta med en <h2>Vanliga frågor</h2> (2–4 <h3>-frågor + svar) och en kort avslutande uppmaning att kontakta/boka.",
    "- metaTitle: ≤60 tecken, med huvudsökordet. metaDescription: 140–155 tecken, lockande.",
    "- urlSlug: gemener, bindestreck, inga å/ä/ö (å→a, ä→a, ö→o), inga stoppord i onödan.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt i all synlig text.`,
    "- Uppfinn inga siffror/priser/påståenden utanför profilen. Osäkert → skriv generellt, aldrig påhittat.",
    "\n=== SVAR: ENDAST strikt JSON, inga kodstaket ===",
    '{"title":"...","metaTitle":"...","metaDescription":"...","urlSlug":"...","html":"<h2>...</h2><p>...</p>","tags":["..."]}',
  ].join("\n");

  const prompt = `Ämne/vinkel: ${opts.topic.trim()}. Skriv artikeln nu enligt kraven.`;

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
  return {
    title,
    metaTitle: (str(obj.metaTitle) || title).slice(0, 60),
    metaDescription: str(obj.metaDescription).slice(0, 160),
    urlSlug: slugify(str(obj.urlSlug) || title),
    html: str(obj.html),
    tags: Array.isArray(obj.tags) ? obj.tags.map(str).filter(Boolean).slice(0, 6) : [],
  };
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
