// Klarspråks-etiketter för Content Compass. Kunden ska aldrig behöva kunna teorin
// (TOFU/MOFU/BOFU, 4A, DISC) — vi visar begripliga svenska ord, med facktermen kvar
// som andrahand i tooltip. Ren data → säker i klientkomponenter.
import type { FunnelLevel, DiscLetter } from "./data";
import type { FourA } from "@/lib/content-framework";

// Funnel: var i kundresan inlägget hör hemma.
export const FUNNEL_LABEL_SV: Record<FunnelLevel, string> = {
  tofu: "Väck intresse",
  mofu: "Bygg förtroende",
  bofu: "Dags att sälja",
};

// 4A: berättarform.
export const FOURA_LABEL_SV: Record<FourA, string> = {
  analytical: "Fakta",
  aspirational: "Inspiration",
  actionable: "Handling",
  authentic: "Personligt",
};

// DISC: ton och tilltal.
export const DISC_LABEL_SV: Record<DiscLetter, string> = {
  D: "Rakt och resultat",
  I: "Energi och vision",
  S: "Tryggt och nära",
  C: "Fakta och detalj",
};
