// Studio — hook-driven textmotor. Kombinerar hook-playbook (Brendan Kane) + kundens
// varumärkesprofil + voice-fingerprint + winning examples via iterateGenerate (Anthropic),
// genererar flera varianter, filtrerar bort fragment/AI-språk och returnerar topp 3.
// Återanvänds av Fas 3 (captions) och Fas 4 (blogg) — EN kvalitetskälla för all Studio-text.

import { iterateGenerate } from "@/lib/iterate";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { getTemplateMeta } from "@/lib/studio/templates-meta";
import { getKitDirectives, dontsRule, NEUTRAL_DIRECTIVES } from "@/lib/studio/kit";
import { WRITING_RULES_BLOCK } from "@/lib/content/writing-rules";

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

// De fem hook-typerna. En per parallellt försök → tre distinkta förslag i stället för
// tre varianter av samma rubrik.
const HOOK_TYPES = ["fråga", "konträr", "berättelse", "påstående", "statistik"] as const;

// CTA hör i bildtexten och i mallens fot-knapp, aldrig i texten PÅ bilden.
const CTA_ORD = /\b(boka|ring|kontakta|hör av dig|mejla|maila|swisha|beställ|offert inom|slå en signal|besök oss|klicka)\b/i;

export async function generateStudioCopy(opts: StudioCopyOpts): Promise<StudioCopySuggestion[]> {
  const meta = getTemplateMeta(opts.templateId);
  const [playbook, profile, directives] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    getProfileAsMarkdown().catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => NEUTRAL_DIRECTIVES),
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
    "- body: EN hel mening (två korta om det behövs), MAX ~90 tecken. Skriv som du pratar, inte som en punktlista i löptext.",
    "- FÖRBJUDET i body: stapla fristående fragment efter varandra. Aldrig så här: 'Syns i dagsljus. En kontakt för allt. Offert inom 24 timmar.' Skriv EN sammanhängande tanke istället.",
    "- INGEN uppmaning/CTA i något fält (inte 'boka', 'ring', 'kontakta oss', 'offert inom X'). Mallens fot har redan en CTA-knapp och bildtexten bär uppmaningen. Texten PÅ bilden ska bara få läsaren att stanna och känna igen sig.",
    "- SIFFROR: använd bara tal, priser och procent som faktiskt STÅR i varumärkesprofilen ovan. Hitta ALDRIG på statistik ('400 % fler blickar'), procentsatser eller priser. Osäker på en siffra: skriv utan siffra.",
    "- VASSARE SPRÅK: konkret substantiv före abstrakt (skyltfönster, inte 'kommunikationsyta'), aktivt verb, vardagsord. Inga floskler, ingen svengelska, ingen myndighetston.",
    "- FÖRBJUDET i alla fält: emoji, symboler (✅▶•), punktlistor, radbrytningslistor, signatur (t.ex. '— Ingela'), telefonnummer, URL, hashtag. Kontaktuppgifter finns REDAN i mallen.",
    "- Använd EN tydlig hook-typ och gör den scrollstoppande enligt playbooken (komprimerad till affisch-längd).",
    "- Gyllene-zonen-kedjan: rubrik väcker → underrubrik skärper → body ger igenkänning eller konkret nytta.",
    "- Målgruppens EGNA ord ur profilen. Svenska tecken å/ä/ö korrekt. Uppfinn inget utanför kundens värld.",
    dontsRule(directives.donts),
    "",
    WRITING_RULES_BLOCK,
  ].join("\n");

  const userPrompt = [
    `Ämne/vinkel: ${opts.topic?.trim() || "välj den starkaste vinkeln för verksamheten"}. Postformat: ${opts.format}.`,
    "Returnera ENDAST strikt JSON, inga kodstaket, inga kommentarer:",
    '{"hookType":"fråga|statistik|konträr|berättelse|påstående","headline1":"...","headline2":"...","body":"..."}',
  ].join("\n");

  const result = await iterateGenerate({
    systemPrompt,
    userPrompt,
    clientId: opts.clientId,
    category: "studio_copy",
    variants: 7, // fler råförslag → större chans att ≥3 distinkta överlever filter + dedup
    // En hook-typ per försök. Utan detta väljer nästan alla varianter samma vinkel och
    // de tre förslagen blir varianter av samma rubrik.
    variantSuffixes: HOOK_TYPES.map(
      (h) => `DITT FÖRSÖK: använd hook-typen "${h}" och en egen vinkel som de andra försöken inte kan råka landa på. Sätt hookType till exakt "${h}".`,
    ),
    temperature: 0.9,
    maxTokens: 400,
  });

  const out: { s: StudioCopySuggestion; score: number }[] = [];
  const seen = new Set<string>();
  // Profilens siffror utan mellanslag → "21 000 kr" i profilen backar "21 000" i förslaget.
  const profilKomprimerad = profile.replace(/[\s ]/g, "");
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
    if (arStaplad(s.body)) continue; // telegramspråk: staplade fragment
    if ([s.headline1, s.headline2, s.body].some(harCta)) continue; // CTA hör i bildtext + fot-knapp
    if ([s.headline1, s.headline2, s.body].some((f) => harObackadSiffra(f, profilKomprimerad))) continue; // aldrig påhittade siffror
    if (s.headline1.length > Math.round(softMax * 1.8) || s.body.length > 150) continue;
    // Likhets-dedup: normalisera bort småord/skiljetecken så nästan-dubbletter
    // ("Vad säger blommorna?" vs "Vad säger dina blommor?") räknas som samma.
    const key = normalizeHeadline(s.headline1);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ s, score: v.score?.total ?? 0 });
  }
  out.sort((a, b) => b.score - a.score);
  // Topp 3 men prioritera OLIKA hook-typer så de tre känns distinkta, inte tre likadana frågor.
  const picked: StudioCopySuggestion[] = [];
  const usedHooks = new Set<string>();
  for (const p of out) {
    if (picked.length >= 3) break;
    if (!usedHooks.has(p.s.hookType)) { picked.push(p.s); usedHooks.add(p.s.hookType); }
  }
  for (const p of out) {
    if (picked.length >= 3) break;
    if (!picked.includes(p.s)) picked.push(p.s);
  }
  return picked;
}

// Normalisera en rubrik för likhets-jämförelse: gemener, bort skiljetecken + vanliga småord.
function normalizeHeadline(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/gi, " ")
    .replace(/\b(din|ditt|dina|en|ett|den|det|de|vi|er|ert|era|min|mitt|mina|och|som|är|för|på|att)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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

// Staplade fristående fragment = telegramspråk ("Syns i dagsljus. En kontakt. Offert inom 24 h.").
// Tre eller fler satser i en 90-teckens ruta är alltid stapling, aldrig en tanke.
function arStaplad(s: string): boolean {
  const satser = s.split(/[.!?:;]+/).map((d) => d.trim()).filter((d) => d.length > 1);
  return satser.length >= 3;
}

// CTA hör i bildtexten + mallens fot-knapp. Två uppmaningar bryter mot skrivregel 4.
function harCta(s: string): boolean {
  return CTA_ORD.test(s);
}

/**
 * Fail-closed siffergrind: riskabla tal (procent, kronor, tal >= 1000) MÅSTE finnas i
 * varumärkesprofilen. Stoppar påhittad statistik ("400 % fler blickar") men släpper igenom
 * äkta prisuppgifter ur profilen ("43 tum, 21 000 kr"). Saknas profil → alla riskabla tal
 * avvisas, hellre text utan siffra än en uppfunnen siffra i kundens namn.
 */
function harObackadSiffra(s: string, profilKomprimerad: string): boolean {
  const komp = s.replace(/[\s ]/g, "");
  const riskabla: string[] = [];
  for (const m of komp.matchAll(/(\d[\d.,]*)%/g)) riskabla.push(m[1]);
  for (const m of komp.matchAll(/(\d[\d.,]*)(?=kr|:-|sek)/gi)) riskabla.push(m[1]);
  for (const m of komp.matchAll(/\d[\d.,]*/g)) {
    if (Number(m[0].replace(/[.,]/g, "")) >= 1000) riskabla.push(m[0]);
  }
  return riskabla.some((tal) => !profilKomprimerad.includes(tal));
}
