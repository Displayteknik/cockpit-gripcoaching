// Reels Creator — datamodell, mallar och konstanter. REN DATA, klientsäker.
// Importeras av både sidan (klientkomponent) och API-routen. Generatorn som anropar
// AI ligger i lib/studio/reels-generate.ts och får ALDRIG importeras härifrån —
// den drar in service-role-klienten och hör inte hemma i webbläsarbundeln.
// Samma uppdelning som lib/content-compass/data.ts mot prompt.ts.
//
// Plan och spec: docs/studio/REELS-PLAN.md

import type { DiscLetter, FunnelLevel } from "@/lib/content-compass/data";
import type { FourA } from "@/lib/content-framework";

// ── Konstanter ────────────────────────────────────────────────────────────────

export const REEL_SIZE = { w: 1080, h: 1920 } as const;

// Instagrams eget gränssnitt ligger ovanpå videon: profilbild och följ-indikator i
// toppen, caption/användarnamn/ljudetikett i botten, knapparna i högerkanten.
// Text utanför dessa marginaler blir överlappad. Siffror i pixlar på 1080x1920.
export const SAFE_ZONE = { top: 220, bottom: 450, side: 35 } as const;

export const MAX_WORDS_PER_LINE = 8;
export const MAX_REEL_MS = 30_000;

// ── Typer ─────────────────────────────────────────────────────────────────────

export type ReelSceneKind = "hook" | "problem" | "losning" | "fakta" | "cta";
export type ReelMediaSource = "uploaded" | "email" | "ai" | "stock" | "";
export type ReelTransition = "overton" | "svep" | "ingen";
export type ReelTemplateKey = "fore-efter" | "pris" | "erbjudande" | "fakta";

export interface ReelScene {
  kind: ReelSceneKind;
  overlay: { line1: string; line2: string };
  mediaUrl: string;
  mediaKind: "image" | "video";
  source: ReelMediaSource;
  imagePrompt: string;
  durationMs: number;
  transition: ReelTransition;
  kenBurns: { from: number; to: number; panX: number; panY: number };
  trimStartMs: number;
}

export interface ReelStoryboard {
  templateKey: ReelTemplateKey;
  templateName: string;
  title: string;
  scenes: ReelScene[];
  caption: string;
  durationMs: number;
  aiBekraftelseKravs: boolean;
  varningar: string[];
  /**
   * G-1c: genereringen som skrev manuset. Ligger i storyboarden och inte vid sidan av
   * den därför att storyboarden ÄR det som skickas till sparningen (`storyboard: sb`) —
   * id:t reser då med utan att en enda klientkomponent behöver ändras.
   */
  generationId?: string | null;
}

export interface ReelGenOpts {
  clientId: string;
  ide: string;
  templateKey: ReelTemplateKey;
  disc?: DiscLetter[];
}

export interface ReelSceneSpec {
  kind: ReelSceneKind;
  durationMs: number;
  transition: ReelTransition;
  roll: string; // vad scenen ska göra — går in i prompten
}

export interface ReelTemplate {
  key: ReelTemplateKey;
  name: string;
  hint: string;
  funnel: FunnelLevel;
  fourA: FourA;
  // Före/efter påstår en förändring hos en riktig kund. Med AI-bild krävs bekräftelse.
  kraverAktBekraftelse: boolean;
  scenes: ReelSceneSpec[];
}

// ── Mallarna (fasta scenstrukturer, 8 till 15 sek) ────────────────────────────

export const REEL_TEMPLATES: Record<ReelTemplateKey, ReelTemplate> = {
  "fore-efter": {
    key: "fore-efter",
    name: "Före och efter",
    hint: "Visa problemet, visa resultatet, be om nästa steg.",
    funnel: "mofu",
    fourA: "aspirational",
    kraverAktBekraftelse: true,
    scenes: [
      { kind: "problem", durationMs: 3000, transition: "overton", roll: "Visa läget FÖRE. Namnge problemet som tittaren känner igen sig i. Ingen lösning här." },
      { kind: "losning", durationMs: 5000, transition: "overton", roll: "Visa läget EFTER. Kundens konkreta resultat, inte er metod eller era tjänster." },
      { kind: "cta", durationMs: 2000, transition: "ingen", roll: "Exakt en uppmaning. Lågt motstånd, lätt att svara på." },
    ],
  },
  pris: {
    key: "pris",
    name: "Pris rakt ut",
    hint: "Fråga, produkt med priset stort, uppmaning.",
    funnel: "bofu",
    fourA: "actionable",
    kraverAktBekraftelse: false,
    scenes: [
      { kind: "hook", durationMs: 3000, transition: "svep", roll: "En rak fråga om vad tittaren tror att det kostar. Stoppa scrollen." },
      { kind: "fakta", durationMs: 5000, transition: "overton", roll: "Produkten med priset som huvudbudskap. line1 = priset, line2 = vad som ingår. Hitta ALDRIG på ett pris: saknas siffran, skriv [PRIS] som platshållare." },
      { kind: "cta", durationMs: 2500, transition: "ingen", roll: "Exakt en uppmaning kopplad till priset." },
    ],
  },
  erbjudande: {
    key: "erbjudande",
    name: "Erbjudande",
    hint: "Krok, vad kunden får, uppmaning.",
    funnel: "bofu",
    fourA: "actionable",
    kraverAktBekraftelse: false,
    scenes: [
      { kind: "hook", durationMs: 3000, transition: "overton", roll: "Krok som talar direkt till målgruppen. Fråga eller konkret påstående, aldrig en generalisering." },
      { kind: "losning", durationMs: 5000, transition: "overton", roll: "Vad kunden faktiskt får. Konkret och avgränsat, inga svepande löften." },
      { kind: "cta", durationMs: 2500, transition: "ingen", roll: "Exakt en uppmaning. Säg vad som händer när de gör den." },
    ],
  },
  fakta: {
    key: "fakta",
    name: "Tre fakta",
    hint: "Fråga, tre korta fakta, uppmaning.",
    funnel: "tofu",
    fourA: "analytical",
    kraverAktBekraftelse: false,
    scenes: [
      { kind: "hook", durationMs: 2500, transition: "svep", roll: "En fråga som tittaren inte kan svara på direkt. Väck nyfikenhet." },
      { kind: "fakta", durationMs: 3000, transition: "svep", roll: "Fakta 1. Konkret och överraskande. Inga påhittade siffror." },
      { kind: "fakta", durationMs: 3000, transition: "svep", roll: "Fakta 2. Ska ge ny information, inte upprepa fakta 1." },
      { kind: "fakta", durationMs: 3000, transition: "svep", roll: "Fakta 3. Den som sitter kvar hos tittaren." },
      { kind: "cta", durationMs: 2500, transition: "ingen", roll: "Exakt en uppmaning. Mjuk, det här är toppen av tratten." },
    ],
  },
};

export const REEL_TEMPLATE_LIST: ReelTemplate[] = Object.values(REEL_TEMPLATES);

export function reelDurationMs(t: ReelTemplate): number {
  return t.scenes.reduce((s, x) => s + x.durationMs, 0);
}

// Ken Burns per scen. Varannan zoomar in, varannan ut, med växlande panorering så
// att en reel med fem scener inte känns som samma rörelse fem gånger.
export function defaultKenBurns(i: number): ReelScene["kenBurns"] {
  const inat = i % 2 === 0;
  const panX = i % 4 === 0 ? 0 : i % 4 === 1 ? -3 : i % 4 === 2 ? 3 : 0;
  const panY = i % 3 === 0 ? 2 : -2;
  return inat ? { from: 1.0, to: 1.12, panX, panY } : { from: 1.12, to: 1.0, panX: -panX, panY: -panY };
}

export function ordCount(t: string): number {
  const rensad = String(t || "").trim();
  return rensad ? rensad.split(/\s+/).length : 0;
}

export function kapaOrd(t: string): string {
  const ord = String(t || "").trim().split(/\s+/).filter(Boolean);
  return ord.length <= MAX_WORDS_PER_LINE ? String(t || "").trim() : ord.slice(0, MAX_WORDS_PER_LINE).join(" ");
}
