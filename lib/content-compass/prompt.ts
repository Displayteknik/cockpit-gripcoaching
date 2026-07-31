// Content Compass — promptlager 2 till 5 som DATA (ett ställe att finslipa).
// Lager 1 (klientens röst) ligger kvar i knowledge/iterate. Detta bygger blocket som
// vävs in efter rösten och före guardrails. Ren data → ok att importera var som helst.
import { DISC_GUIDE, FOURA_GUIDE, FUNNEL_GUIDE, type FourA } from "@/lib/content-framework";
import type { FunnelLevel, DiscLetter } from "./data";

export interface CompassParams {
  funnel?: FunnelLevel | null;
  four_a?: FourA | null;
  disc?: DiscLetter[] | null;
}

// Lager 2 — inläggsanatomin (obligatorisk för ALLA inlägg, Compass färgar varje del).
export const POST_ANATOMY = {
  hook: "HOOK (rad 1 till 2): stoppa scrollen. Aldrig en rubrik som låter som en annons. Ton enligt DISC nedan.",
  story: "STORY/PROBLEM (mitten): känsla och igenkänning, läsaren ska känna 'det där är jag'. Form enligt 4A nedan.",
  nytta: "NYTTA/LÖSNING: kundens konkreta RESULTAT och transformation, inte era tjänster eller er metod.",
  cta: "CTA (sist): exakt EN uppmaning, aldrig två. Typ enligt funnel nedan.",
};
export const DISC_HOOK: Record<DiscLetter, string> = {
  D: "rak siffra eller kontroversiellt påstående",
  I: "vision eller känsloladdad fråga",
  S: "personlig igenkänning",
  C: "överraskande fakta",
};
export const FOURA_STORY: Record<FourA, string> = {
  analytical: "fakta som utmanar en vanlig uppfattning",
  aspirational: "transformationsberättelse, före till efter",
  actionable: "problemet som stegen löser",
  authentic: "personlig erfarenhet, ärlig och nära",
};
export const FUNNEL_CTA: Record<FunnelLevel, string> = {
  tofu: "engagemangs-CTA: kommentera, dela, följ, 'känner du igen dig?'",
  mofu: "mjukt nästa steg: 'DM:a GUIDE så skickar jag den', 'läs hela caset via länken'",
  bofu: "nyckelords-CTA enligt mallen nedan",
};

// Lager 3 till 5.
export const FUNNEL_RULES: Record<FunnelLevel, string> = {
  tofu: "TOFU: väck nyfikenhet och utbilda. Värde först, inget hårt sälj.",
  mofu: "MOFU: bevis, case, jämförelse. Mjuk CTA.",
  bofu: "BOFU: tydligt erbjudande med nyckelords-CTA. Lite friktion.",
};
export const FOURA_TEMPLATES: Record<FourA, string> = {
  analytical: "3 fakta om [område] och varför det påverkar läsaren",
  aspirational: "Från [problem] till [resultat] på [tid]",
  actionable: "3 steg för att [resultat] utan [hinder]",
  authentic: "Vad jag önskar jag visste när [situation]",
};
export const DISC_TONE: Record<DiscLetter, string> = {
  D: "resultat, siffror, korta meningar, rakt på",
  I: "energi, vision, känsla, du-tilltal",
  S: "trygghet, relation, vi-känsla, lugnt tempo",
  C: "fakta, detaljer, belägg, strukturerat",
};
export const BOFU_CTA_MALL = "Om du är [målgrupp] och du inte [problem], då kommer jag [lösning] så att du kan [drömmål]. Svara [NYCKELORD].";

// Bygger promptblocket (lager 2 till 5) för givna Compass-parametrar. Tom sträng om inget satt.
export function contentCompassBlock(p: CompassParams): string {
  const funnel = p.funnel || null;
  const fourA = p.four_a || null;
  const disc = (p.disc || []).filter(Boolean) as DiscLetter[];
  if (!funnel && !fourA && disc.length === 0) return "";

  const discTone = disc.map((d) => `${d} (${DISC_TONE[d]})`).join(", ") || "neutral";
  const discHook = disc.map((d) => `${d}: ${DISC_HOOK[d]}`).join("; ") || "";

  const lines: string[] = ["=== INLÄGGSANATOMI + CONTENT COMPASS (följ i ordning) ==="];
  // Lager 2 — anatomin
  lines.push(
    `1. ${POST_ANATOMY.hook}${discHook ? ` DISC-hook: ${discHook}.` : ""}`,
    `2. ${POST_ANATOMY.story}${fourA ? ` 4A-form: ${FOURA_STORY[fourA]}.` : ""}`,
    `3. ${POST_ANATOMY.nytta}`,
    `4. ${POST_ANATOMY.cta}${funnel ? ` Funnel-CTA: ${FUNNEL_CTA[funnel]}.` : ""}`,
  );
  // Lager 3 — funnel
  if (funnel) lines.push(`FUNNEL (${funnel.toUpperCase()}): ${FUNNEL_RULES[funnel]} ${FUNNEL_GUIDE[funnel.toUpperCase() as "TOFU" | "MOFU" | "BOFU"]}`);
  // Lager 4 — 4A-strukturmall
  if (fourA) lines.push(`4A (${fourA}): strukturmall "${FOURA_TEMPLATES[fourA]}". ${FOURA_GUIDE[fourA]}`);
  // Lager 5 — DISC-ton
  if (disc.length) lines.push(`DISC-TON: ${discTone}. ${disc.map((d) => DISC_GUIDE[d]).join(" ")}`);
  // BOFU-CTA-mall
  if (funnel === "bofu") lines.push(`BOFU-CTA-MALL: ${BOFU_CTA_MALL}`);

  // TEXT-1: skrivreglerna bäddas INTE längre in här — de ägs av lager 8 i prompt-core
  // (och skyddsnäten medSkrivregler/iterate lägger dem för omigrerade flöden). Att bära
  // dem här gav dubbelt ägarskap och gjorde blocket omöjligt att lägga före rösten.
  return lines.join("\n");
}
