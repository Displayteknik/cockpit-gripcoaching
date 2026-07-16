// Studio — hook-driven textmotor. Kombinerar hook-playbook (Brendan Kane) + kundens
// varumärkesprofil + voice-fingerprint + winning examples via iterateGenerate (Anthropic),
// genererar flera varianter, filtrerar bort fragment/AI-språk och returnerar topp 3.
// Återanvänds av Fas 3 (captions) och Fas 4 (blogg) — EN kvalitetskälla för all Studio-text.

import { iterateGenerate } from "@/lib/iterate";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { getTemplateMeta } from "@/lib/studio/templates-meta";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";

export interface StudioCopySuggestion {
  hookType: string;
  headline1: string;
  headline2: string;
  body: string;
}

export interface StudioCopyOpts {
  clientId: string;
  templateId: string;
  format: string;
  topic?: string;
  brandName?: string;
  industry?: string;
}

const FORBIDDEN = [
  "kraftfull", "banbrytande", "game-changer", "handlar om",
  "nästa nivå", "holistisk", "skalbar",
];

// Dinglande funktionsord i slutet = troligt avhugget fragment ("En liten skäv förändrar").
const DANGLING = /\b(och|att|som|en|ett|för|med|på|till|av|den|det|är|kan|när|men|eller|så|de|vi|din|ditt)\s*$/i;

export async function generateStudioCopy(opts: StudioCopyOpts): Promise<StudioCopySuggestion[]> {
  const meta = getTemplateMeta(opts.templateId);
  const [playbook, profile, directives] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    getProfileAsMarkdown().catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => ({ imageExtra: "", imageNegative: "", donts: [], colors: {}, formats: [] })),
  ]);
  const brand = opts.brandName || "kunden";
  const industry = opts.industry ? ` (${opts.industry})` : "";
  const softMax = meta?.headlineSoftMax ?? 26;

  const systemPrompt = [
    `Du skriver text som ska tryckas PÅ EN BILD (affisch/social-media-inlägg) för ${brand}${industry}.`,
    "Det är INTE ett caption-inlägg — det är korta ord som ska rymmas i en grafisk mall.",
    playbook,
    profile
      ? `\n=== KLIENTENS VARUMÄRKESPROFIL — grunda ALLT (röst, målgrupp, ord) på denna, uppfinn inget utanför den ===\n${profile.slice(0, 6000)}`
      : "",
    "\n=== MALLENS FÄLT (tre korta fält, inget annat) ===",
    `Rubrik: "${meta?.fields.headline1 ?? "rubrik"}". Underrubrik: "${meta?.fields.headline2 ?? "underrubrik"}". Kort text: "${meta?.fields.body ?? "brödtext"}".`,
    "\n=== HÅRDA REGLER (affisch-format) ===",
    `- headline1: kort och slagkraftig, MAX ~${softMax} tecken (stor rubrik på bilden). Hel begriplig fras — aldrig ett avhugget fragment.`,
    "- headline2: en kort underrubrik/fråga, ~20–45 tecken, hel mening.",
    "- body: MYCKET kort — 1–2 korta meningar, MAX ~90 tecken totalt (ryms på 2 rader i en liten ruta). Konkret nytta + kort uppmaning att boka. Var koncis, klipp bort fyllnadsord.",
    "- FÖRBJUDET i alla fält: emoji, symboler (✅▶•), punktlistor, radbrytningslistor, signatur (t.ex. '— Ingela'), telefonnummer, URL, hashtag. Kontaktuppgifter finns REDAN i mallen.",
    "- Använd EN tydlig hook-typ och gör den scrollstoppande enligt playbooken (komprimerad till affisch-längd).",
    "- Gyllene-zonen-kedjan: rubrik väcker → underrubrik/text levererar → kort uppmaning att boka.",
    "- Målgruppens EGNA ord ur profilen. Svenska tecken å/ä/ö korrekt. Uppfinn inget utanför kundens värld.",
    dontsRule(directives.donts),
  ].join("\n");

  const userPrompt = [
    `Ämne/vinkel: ${opts.topic?.trim() || "välj den starkaste vinkeln för verksamheten"}. Postformat: ${opts.format}.`,
    "Vi kör flera parallella försök — välj EN distinkt hook-typ (fråga/statistik/konträr/berättelse/påstående) och en egen vinkel för ditt försök.",
    "Returnera ENDAST strikt JSON, inga kodstaket, inga kommentarer:",
    '{"hookType":"fråga|statistik|konträr|berättelse|påstående","headline1":"...","headline2":"...","body":"..."}',
  ].join("\n");

  const result = await iterateGenerate({
    systemPrompt,
    userPrompt,
    clientId: opts.clientId,
    category: "studio_copy",
    variants: 5,
    temperature: 0.85,
    maxTokens: 400,
  });

  const out: { s: StudioCopySuggestion; score: number }[] = [];
  const seen = new Set<string>();
  for (const v of result.all_variants) {
    const obj = parseJson(v.text);
    if (!obj) continue;
    const s: StudioCopySuggestion = {
      hookType: str(obj.hookType),
      headline1: str(obj.headline1),
      headline2: str(obj.headline2),
      body: str(obj.body),
    };
    if (!s.headline1 || !s.body) continue;
    if (![s.headline1, s.headline2, s.body].filter(Boolean).every(looksComplete)) continue;
    if (![s.headline1, s.headline2, s.body].every(noForbidden)) continue;
    if ([s.headline1, s.headline2, s.body].some(hasEmojiOrList)) continue; // affisch-format: rent
    if (hasContactInfo(s.body)) continue; // telefon/URL finns redan i mallens fot
    if (s.headline1.length > Math.round(softMax * 1.8) || s.body.length > 150) continue;
    const key = s.headline1.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ s, score: v.score?.total ?? 0 });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3).map((p) => p.s);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Hel mening? Avvisa avhuggna fragment (slutar på dinglande funktionsord).
function looksComplete(s: string): boolean {
  const t = s.trim().replace(/["'?!.…]+$/g, "").trim();
  if (t.length < 3) return false;
  return !DANGLING.test(t);
}

function noForbidden(s: string): boolean {
  const low = s.toLowerCase();
  return !FORBIDDEN.some((f) => low.includes(f));
}

// Affisch-format ska vara rent: ingen emoji/symbol/punktlista/radbrytningslista/signatur.
function hasEmojiOrList(s: string): boolean {
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2705}\u{25B6}\u{2714}\u{2022}]/u.test(s)) return true;
  if (/(^|\n)\s*[-*•▶✅]/.test(s)) return true; // punktlista
  if (/—\s*[A-ZÅÄÖ][a-zåäö]+\s*$/.test(s.trim())) return true; // signatur "— Ingela"
  return false;
}

// Telefon/URL i body → avvisa (kontaktuppgifter finns redan i mallens fot).
function hasContactInfo(s: string): boolean {
  if (/0\d[\d\s-]{5,}\d/.test(s)) return true; // svenskt telefonnummer
  if (/(https?:\/\/|www\.|\.se\b|\.com\b|opticur)/i.test(s)) return true;
  return false;
}
