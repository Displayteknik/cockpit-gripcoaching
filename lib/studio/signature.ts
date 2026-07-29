// Etapp S1 — SIGNATURSTIL per tenant. REN DATA, klientsäker.
//
// Skillnaden mot bildstilen i brand kit: bildstilen är ett förslag, signaturen är en
// REGEL. Den appliceras automatiskt på varje AI-bild, varje reel och varje overlay för
// tenanten, utan att någon behöver kryssa i något. Användaren ska inte kunna råka avvika.
//
// Genomslaget sker i getKitDirectives(), som Reels-motorn, Bildhjälpen och
// bloggomslagen redan anropar. Ny kod som glömmer signaturen får den ändå.

export type SignaturePreset = "mork-kontrast" | "ljus-luftig" | "neutral" | "";
export type LoggaHorn = "" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BrandSignature {
  enabled: boolean;
  preset: SignaturePreset;
  /** Färggradering som appliceras på ALLA bilder i rendering. 1 = orört. */
  grade: { brightness: number; contrast: number; saturation: number; vignette: number };
  /** Hook-raden sätts i versaler. */
  hookVersal: boolean;
  /** Accentlinjen över rubriken är obligatorisk. */
  accentlinje: boolean;
  /** Engelsk stilprompt som vävs in i VARJE AI-bild för tenanten. */
  bildprompt: string;
  bildNegativ: string;
  loggaHorn: LoggaHorn;
  /** 0 till 1. Subtil placering, inte en vattenstämpel. */
  loggaOpacitet: number;
}

export const NEUTRAL_SIGNATURE: BrandSignature = {
  enabled: false,
  preset: "",
  grade: { brightness: 1, contrast: 1, saturation: 1, vignette: 0 },
  hookVersal: false,
  accentlinje: true,
  bildprompt: "",
  bildNegativ: "",
  loggaHorn: "",
  loggaOpacitet: 0.85,
};

/**
 * Färdiga presets. Graderingen är medvetet ÅTERHÅLLEN: en reel ska se ut som ett
 * varumärke, inte som ett filter. Kraftiga värden gör foton smutsiga i komprimeringen.
 */
export const SIGNATURE_PRESETS: Record<Exclude<SignaturePreset, "">, { namn: string; beskrivning: string; grade: BrandSignature["grade"]; bildprompt: string; bildNegativ: string }> = {
  // VIKTIGT: en signatur beskriver BEHANDLING (färg, kontrast, var ljuset ligger),
  // aldrig MOTIV. Tid på dygnet, väder och om en butik är öppen eller stängd är
  // innehållsbeslut som styrs av scenens budskap. Första versionen sa "dusk or evening
  // lighting" och gjorde varje scen till en nattbild, även när texten sa "även när ni
  // har öppet" — stilen sket sig in i innehållet och gjorde budskapet obegripligt.
  "mork-kontrast": {
    namn: "Mörk och kontrastrik",
    beskrivning: "Dämpad omgivning, skärmens ljus bär bilden. För skyltning och teknik.",
    grade: { brightness: 0.94, contrast: 1.18, saturation: 0.88, vignette: 0.28 },
    // Andra överspecificeringen: "the brightest point in the frame" och "deep shadows"
    // tvingade fram natt även utan ordet dusk, eftersom allt annat måste mörkas ned för
    // att en skärm ska bli ljusast. En behandling får ändra FÄRG och KONTRAST, aldrig
    // exponeringen eller tiden på dygnet. Sista satsen är spärren.
    bildprompt:
      "cinematic colour treatment, elevated contrast, muted desaturated palette, screens and displays rendered bright and crisp, keeping the scene's own time of day and ambient light level exactly as described",
    bildNegativ: "busy colourful background, stock-photo smiling people, cluttered composition",
  },
  "ljus-luftig": {
    namn: "Ljus och luftig",
    beskrivning: "Mjuka toner, låg kontrast, mycket luft. För coaching och tjänst.",
    grade: { brightness: 1.05, contrast: 0.96, saturation: 0.95, vignette: 0 },
    bildprompt: "soft high-key treatment, low contrast, airy composition, generous negative space, gentle muted palette",
    bildNegativ: "harsh crushed shadows, heavy vignette, cluttered composition",
  },
  neutral: {
    namn: "Neutral",
    beskrivning: "Ingen gradering. Bilden som den är.",
    grade: { brightness: 1, contrast: 1, saturation: 1, vignette: 0 },
    bildprompt: "",
    bildNegativ: "",
  },
};

function tal(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSignature(raw: unknown): BrandSignature {
  const s = (raw || {}) as Partial<BrandSignature> & { grade?: Partial<BrandSignature["grade"]> };
  const preset = (["mork-kontrast", "ljus-luftig", "neutral"] as const).includes(s.preset as never)
    ? (s.preset as Exclude<SignaturePreset, "">)
    : "";
  const p = preset ? SIGNATURE_PRESETS[preset] : null;
  const g: Partial<BrandSignature["grade"]> = s.grade || {};
  return {
    enabled: Boolean(s.enabled),
    preset,
    grade: {
      // Presetens värden gäller om inget eget satts. Egna värden vinner.
      brightness: tal(g.brightness, p?.grade.brightness ?? 1, 0.6, 1.4),
      contrast: tal(g.contrast, p?.grade.contrast ?? 1, 0.6, 1.6),
      saturation: tal(g.saturation, p?.grade.saturation ?? 1, 0, 1.6),
      vignette: tal(g.vignette, p?.grade.vignette ?? 0, 0, 0.7),
    },
    hookVersal: Boolean(s.hookVersal),
    accentlinje: s.accentlinje !== false,
    bildprompt: typeof s.bildprompt === "string" && s.bildprompt ? s.bildprompt : p?.bildprompt || "",
    bildNegativ: typeof s.bildNegativ === "string" && s.bildNegativ ? s.bildNegativ : p?.bildNegativ || "",
    loggaHorn: (["top-left", "top-right", "bottom-left", "bottom-right"] as const).includes(s.loggaHorn as never)
      ? (s.loggaHorn as LoggaHorn)
      : "",
    loggaOpacitet: tal(s.loggaOpacitet, 0.85, 0.15, 1),
  };
}

/** Canvas- och CSS-kompatibel filtersträng. Tom när graderingen är neutral. */
export function gradeFilter(sig: BrandSignature): string {
  if (!sig.enabled) return "";
  const { brightness, contrast, saturation } = sig.grade;
  const d = [
    brightness !== 1 ? `brightness(${brightness})` : "",
    contrast !== 1 ? `contrast(${contrast})` : "",
    saturation !== 1 ? `saturate(${saturation})` : "",
  ].filter(Boolean);
  return d.join(" ");
}

/** Stilfragmentet som vävs in i varje AI-bildprompt för tenanten. */
export function signaturePrompt(sig: BrandSignature): { extra: string; negativ: string } {
  if (!sig.enabled) return { extra: "", negativ: "" };
  return { extra: sig.bildprompt || "", negativ: sig.bildNegativ || "" };
}
