// lib/prompt-core.ts — ENDA stället där textprompter sätts ihop (TEXT-1).
// Princip: ingen text lämnar systemet utan full kontext. Varje textgenerering får
// samtliga lager i fast ordning (senare = väger tyngre, formatkrav allra sist):
//
//   1. Uppdrag (flödets rollrad + hårda regler)        — ägs av anroparen
//   2. Statisk kunskap (knowledge/*.md)                — utan profil-prepend
//   3. Brand-profil (hm_brand_profile + customer voice + story-bank)
//   4. Röst-fingerprint (client_voice_profile + råa exempel)
//   5. Vinnande exempel (client_assets, winning_example)
//      + ev. bildkontext ("grunda texten i inlägget")
//   6. Anatomi + Content Compass (POST_ANATOMY alltid; funnel/4A/DISC ur params
//      eller mjuk default per syfte — aldrig bofu som default)
//   7. Grafisk kontext (kit-donts) för bildnära syften
//   8. Globala skrivregler (styrs av clients.writing_rules_enabled)
//   9. JSON-formatkrav (styr ENDAST formen)
//
// Dubblettregel: varje lager finns EXAKT en gång. Därför hämtas brand-profilen med
// medVoice:false (lager 4–5 ägs här, inte av knowledge.ts) och statisk kunskap via
// getStaticKnowledge (ingen profil-prepend). Idempotensvakterna i gemini.ts/iterate.ts
// finns kvar som skyddsnät men ska aldrig behöva trigga.
//
// Spec: TEXT1-PLAN.md (godkänd 2026-07-31).

import type { VoiceFingerprint } from "@/lib/voice-fingerprint";
import type { CompassParams } from "@/lib/content-compass/prompt";
import {
  POST_ANATOMY,
  contentCompassBlock,
} from "@/lib/content-compass/prompt";
import type { FunnelLevel } from "@/lib/content-compass/data";
import {
  WRITING_RULES_BLOCK,
  sanitizeGenerated,
  skrivreglerPa,
  taBortFloskler,
  type HashtagKanal,
} from "@/lib/content/writing-rules";

export type TextSyfte =
  | "caption"
  | "studio-text"
  | "karusell"
  | "kanal-anpassning"
  | "linkedin"
  | "blogg"
  | "nyhetsbrev"
  | "veckoplan"
  | "enskilt"
  | "social"
  | "specialist"
  | "reel";

export interface ByggParams {
  clientId: string | null;
  syfte: TextSyfte;
  kanal?: "instagram" | "facebook" | "linkedin" | "webb" | "mejl";
  uppdrag: string;
  underlag?: string;
  compass?: CompassParams;
  bildKontext?: { caption?: string; bildbeskrivning?: string; bildRoll?: string };
  knowledge?: string[];
  jsonSchema?: string;
  /** Winning-example-kategori (subcategory i client_assets). Default härleds ur syftet. */
  kategori?: string;
  maxProfilTecken?: number;
}

export interface ByggdPrompt {
  system: string;
  user: string;
  fingerprint: VoiceFingerprint | null;
  winning: string[];
  /** Lager 3-texten (klippt profil) — för anroparens deterministiska grindar
   *  (t.ex. copy.ts fail-closed siffergrind) utan en andra DB-läsning. */
  profilText: string;
  meta: { lager: Record<string, boolean>; profilKlippt: string[] };
}

// ── Compass-default per syfte ─────────────────────────────────────────────────
// Endast funnel defaultas (mjukt). 4A/DISC lämnas osatta — en default där skulle
// tvinga alla texter i samma berättarform. BOFU sätts ALDRIG som default: sälj-CTA
// ska alltid vara ett aktivt val.
const DEFAULT_FUNNEL: Partial<Record<TextSyfte, FunnelLevel>> = {
  linkedin: "mofu",
  nyhetsbrev: "mofu",
  blogg: "mofu",
  caption: "tofu",
  "studio-text": "tofu",
  karusell: "tofu",
  social: "tofu",
  reel: "tofu",
  enskilt: "tofu",
};

// Winning-example-kategori per syfte (subcategory-filtret i fetchWinningExamples).
const KATEGORI: Partial<Record<TextSyfte, string>> = {
  "studio-text": "studio_copy",
  caption: "caption",
  karusell: "carousel",
  linkedin: "linkedin",
  blogg: "blog",
  nyhetsbrev: "newsletter",
  social: "post",
  enskilt: "post",
  veckoplan: "post",
  reel: "reel",
};

// Syften där texten sitter på/vid en bild → kit-donts vävs in (lager 7).
const BILDNARA: TextSyfte[] = ["caption", "studio-text", "karusell", "reel", "kanal-anpassning"];

// ── Anatomilagret — frikopplat från Compass ──────────────────────────────────
// "full": hela anatomin inkl. exakt en CTA. "pa-bild": text som trycks PÅ bilden —
// captionen bär CTA:n, annars får inlägget två uppmaningar (affischregeln ur copy.ts).
//
// CTA-GOLV (T-5): "exakt EN CTA" är en HÅRD regel som funnel-lagret aldrig kan
// upphäva — en satt eller defaultad funnel-nivå styr uppmaningens TON, aldrig dess
// EXISTENS. Golvet läggs därför sist i VARJE "full"-variant, oavsett compass-läge.
const CTA_GOLV =
  "HÅRD REGEL (CTA-golv): texten avslutas med exakt EN uppmaning (CTA), alltid sist — aldrig noll, aldrig två. En funnel-nivå styr uppmaningens TON, aldrig om den finns.";

export function anatomiBlock(variant: "full" | "pa-bild", compass?: CompassParams, mjukDefault?: FunnelLevel): string {
  if (variant === "pa-bild") {
    return [
      "=== INLÄGGSANATOMI FÖR TEXT PÅ BILD (följ i ordning) ===",
      `1. ${POST_ANATOMY.hook}`,
      `2. ${POST_ANATOMY.story}`,
      `3. ${POST_ANATOMY.nytta}`,
      "4. INGEN CTA i texten på bilden. Captionen bär uppmaningen — en affisch med egen uppmaning ger inlägget två.",
    ].join("\n");
  }
  const harParams = !!(compass && (compass.funnel || compass.four_a || (compass.disc || []).length));
  if (harParams) return `${contentCompassBlock(compass!)}\n${CTA_GOLV}`;
  if (mjukDefault) {
    const block = contentCompassBlock({ funnel: mjukDefault, four_a: null, disc: [] });
    return `${block}\n(Funnel-nivån ovan är förvald för den här innehållstypen — väg in den bara om inget annat framgår av ämnet.)\n${CTA_GOLV}`;
  }
  return [
    "=== INLÄGGSANATOMI (följ i ordning) ===",
    `1. ${POST_ANATOMY.hook}`,
    `2. ${POST_ANATOMY.story}`,
    `3. ${POST_ANATOMY.nytta}`,
    `4. ${POST_ANATOMY.cta}`,
    CTA_GOLV,
  ].join("\n");
}

// ── Profilklippning med fast prioritet ───────────────────────────────────────
// Tonregler, GÖR/GÖR INTE och USP överlever ALLTID klippet (Håkans tillägg till
// TEXT1-PLAN avsnitt 2). Story-bank klipps först (längst och minst ordförråds-tät),
// därefter övriga sektioner i omvänd viktordning. Customer Voice bär klientens
// eget ordförråd (röst-träffen sjönk när den klipptes tidigt — justeringsrundan v2)
// och klipps därför först EFTER Sekundär ICP. Klipp sker på hel sektion — aldrig
// mitt i mening.
const KLIPPORDNING = [
  "Story-bank",
  "Kundresa",
  "Konkurrenter",
  "Sekundär ICP",
  "Customer Voice",
  "Voice of Customer (kundord)",
  "Hashtag-bas",
  "Brand story",
  "Smärtpunkter kunden har",
  "Kontakt",
  "Grundare",
  "Plats",
];

export function klippProfil(md: string, max: number): { text: string; klippta: string[] } {
  if (!md || md.length <= max) return { text: md, klippta: [] };
  const klippta: string[] = [];
  let ut = md;
  for (const namn of KLIPPORDNING) {
    if (ut.length <= max) break;
    // Toppnivåblock: "# ═══ Namn ... ═══" t.o.m. nästa "# ═══" eller slutet.
    const topp = new RegExp(`\\n?# ═══ ${escapeRe(namn)}[^\\n]*═══\\n[\\s\\S]*?(?=\\n# ═══ |$)`);
    // Undersektion i brand-profilen: "## Namn" t.o.m. nästa "## "/"# " eller slutet.
    const under = new RegExp(`\\n?## ${escapeRe(namn)}\\n[\\s\\S]*?(?=\\n## |\\n# |$)`);
    const fore = ut;
    ut = ut.replace(topp, "");
    if (ut === fore) ut = ut.replace(under, "");
    if (ut !== fore) klippta.push(namn);
  }
  // Sista utväg om profilen ändå är för lång: hård klipp på sektionsgräns.
  if (ut.length > max) {
    const cut = ut.lastIndexOf("\n## ", max);
    ut = cut > 0 ? ut.slice(0, cut) : ut.slice(0, max);
    klippta.push("(hårdklipp på sektionsgräns)");
  }
  return { text: ut.trim(), klippta };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Kärnan ───────────────────────────────────────────────────────────────────
export async function byggTextPrompt(p: ByggParams): Promise<ByggdPrompt> {
  const delar: string[] = [p.uppdrag.trim()];
  const lager: Record<string, boolean> = { uppdrag: true };
  let profilKlippt: string[] = [];
  let profilText = "";
  let fingerprint: VoiceFingerprint | null = null;
  let winning: string[] = [];

  // 2. Statisk kunskap — getStaticKnowledge, ALDRIG getKnowledge (profil-prepend = dubblett).
  if (p.knowledge?.length) {
    const { getStaticKnowledge } = await import("@/lib/knowledge");
    const kunskap = (await getStaticKnowledge(...p.knowledge)).slice(0, 2500 * p.knowledge.length);
    if (kunskap) {
      delar.push(kunskap);
      lager.kunskap = true;
    }
  }

  if (p.clientId) {
    // 3. Brand-profil — medVoice:false: lager 4–5 ägs här.
    try {
      const { getProfileAsMarkdown } = await import("@/lib/knowledge");
      const raa = await getProfileAsMarkdown(p.clientId, { medVoice: false });
      if (raa) {
        // 9000 (höjt från 6000 i justeringsrundan v2): 6000 klippte bort röstbärande
        // sektioner för de fylligare profilerna och röst-träffen sjönk mätbart.
        const klippt = klippProfil(raa, p.maxProfilTecken ?? 9000);
        profilKlippt = klippt.klippta;
        profilText = klippt.text;
        delar.push(`=== KLIENTENS VARUMÄRKESPROFIL ===\n${klippt.text}`);
        lager.brandProfil = true;
      }
    } catch (e) {
      console.error("[prompt-core] brand-profil kunde inte hämtas:", e);
    }

    // 4. Röst-fingerprint. Fail-open som iterate: hellre text utan röst än inget svar.
    try {
      const { getVoiceFingerprint, fingerprintToPromptBlock } = await import("@/lib/voice-fingerprint");
      fingerprint = await getVoiceFingerprint(p.clientId);
      delar.push(fingerprintToPromptBlock(fingerprint));
      lager.rost = true;
    } catch (e) {
      console.error("[prompt-core] fingerprint kunde inte hämtas:", e);
    }

    // 5. Vinnande exempel.
    try {
      const { fetchWinningExamples } = await import("@/lib/voice-score");
      winning = await fetchWinningExamples(p.clientId, p.kategori ?? KATEGORI[p.syfte]);
      if (winning.length) {
        delar.push(
          "=== VINNANDE EXEMPEL (matcha denna kvalitet) ===\n" +
            winning.map((w, i) => `Exempel ${i + 1}:\n${w}`).join("\n\n"),
        );
        lager.vinnande = true;
      }
    } catch (e) {
      console.error("[prompt-core] winning examples kunde inte hämtas:", e);
    }
  }

  // Bildkontext — grunda texten i inlägget (mönstret ur B-paketet/copy.ts).
  if (p.bildKontext && (p.bildKontext.caption || p.bildKontext.bildbeskrivning)) {
    const b = p.bildKontext;
    delar.push(
      "=== GRUNDA TEXTEN I INLÄGGET ===\n" +
        [
          b.caption ? `Caption: ${b.caption}` : "",
          b.bildbeskrivning ? `Bilden föreställer: ${b.bildbeskrivning}` : "",
          b.bildRoll ? `Bildens roll: ${b.bildRoll}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
    );
    lager.bildKontext = true;
  }

  // 6. Anatomi + Compass — ALLTID (variant per syfte).
  const variant = p.syfte === "studio-text" ? "pa-bild" : "full";
  delar.push(anatomiBlock(variant, p.compass, DEFAULT_FUNNEL[p.syfte]));
  lager.anatomi = true;
  // Kanalmappning så anatomin inte krockar med blogg/nyhetsbrevs egna strukturblock.
  if (p.syfte === "blogg") delar.push("Anatomin mappas för blogg: hook = rubrik + ingress, story/nytta = brödtextens sektioner, CTA = avslutande sektion.");
  if (p.syfte === "nyhetsbrev") delar.push("Anatomin mappas för nyhetsbrev: hook = ämnesrad + intro, story/nytta = sektionerna, CTA = cta_text (exakt en).");

  // 7. Grafisk kontext för bildnära syften.
  if (p.clientId && BILDNARA.includes(p.syfte)) {
    try {
      const { getKitDirectives, dontsRule } = await import("@/lib/studio/kit");
      const kit = await getKitDirectives(p.clientId);
      const rad = dontsRule(kit.donts).trim();
      if (rad) {
        delar.push(rad);
        lager.grafisk = true;
      }
    } catch (e) {
      console.error("[prompt-core] kit-direktiv kunde inte hämtas:", e);
    }
  }

  // 8. Globala skrivregler — per-tenant-flaggan styr BÅDA lagren (prompt + sanering).
  if (await skrivreglerPa(p.clientId)) {
    delar.push(WRITING_RULES_BLOCK);
    lager.skrivregler = true;
  }

  // 9. Formatkrav — ALLTID sist. Styr formen, aldrig innehållsreglerna ovanför.
  if (p.jsonSchema) {
    delar.push(`=== SVARSFORMAT (styr ENDAST formen, aldrig innehållsreglerna ovan) ===\n${p.jsonSchema.trim()}`);
    lager.format = true;
  }

  return {
    system: delar.filter((d) => d && d.trim()).join("\n\n"),
    user: (p.underlag ?? "").trim(),
    fingerprint,
    winning,
    profilText,
    meta: { lager, profilKlippt },
  };
}

// ── Sanering — samma villkor överallt ────────────────────────────────────────
// Flaggan av → regel 1–4 hoppar över BÅDA lagren, men floskelgolvet (förbjudna
// AI-ord) körs ALLTID: det är plattformens kvalitetsgolv, inte en tenant-preferens.
export async function saneraText(
  text: string,
  clientId: string | null | undefined,
  kanal?: HashtagKanal,
): Promise<string> {
  if (!text) return text;
  if (await skrivreglerPa(clientId)) return sanitizeGenerated(text, { kanal });
  return taBortFloskler(text);
}
