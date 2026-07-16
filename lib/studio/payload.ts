// Studio — payload-kontrakt (samma för alla mallar, se docs/studio/PLAN.md §3.3 i KICKOFF).
// Deterministisk: mallen ritas ENBART från detta objekt. AI rör aldrig layout.

export type StudioFormat = "1080x1350" | "1080x1080";

export interface StudioBadge {
  enabled: boolean;
  line1: string;
  line2: string;
}

export interface StudioOverrides {
  fontScale: number; // global textskala, 0.7–1.4 (1 = mallens standard)
  headlineColor: string; // "" = mallens standard
  bodyColor: string; // "" = mallens standard
  imageScale: number; // 1 = cover, >1 = inzoomat
  imageX: number; // -50..50 horisontell panorering (%)
  hideBrush: boolean;
  hideBadge: boolean;
}

export interface StudioPayload {
  clientId: string;
  templateId: string;
  format: StudioFormat;
  headline1: string;
  headline2: string;
  body: string;
  badge: StudioBadge;
  imageUrl: string;
  imageFocusY: number; // 0–100 (%) — vertikal fokuspunkt för object-position
  brushColor: string; // penselrutans färg (hex); tom = mallens standard (brand.colors.yellow)
  overrides: StudioOverrides; // fri redigering ovanpå mallen (tweak-lager)
}

export const DEFAULT_OVERRIDES: StudioOverrides = {
  fontScale: 1, headlineColor: "", bodyColor: "", imageScale: 1, imageX: 0, hideBrush: false, hideBadge: false,
};

export const FORMAT_DIMENSIONS: Record<StudioFormat, { w: number; h: number }> = {
  "1080x1350": { w: 1080, h: 1350 },
  "1080x1080": { w: 1080, h: 1080 },
};

// UTF-8-säker base64 (åäö) — fungerar i node (render-route + export-CLI, båda server-side).
export function encodePayload(p: StudioPayload): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64");
}

export function decodePayload(b64: string): StudioPayload {
  const json = Buffer.from(b64, "base64").toString("utf8");
  return normalizePayload(JSON.parse(json));
}

// Fyller defaults + klampar så en trasig/ofullständig payload aldrig kraschar rendern.
export function normalizePayload(raw: Partial<StudioPayload>): StudioPayload {
  const format: StudioFormat = raw.format === "1080x1080" ? "1080x1080" : "1080x1350";
  const badge = raw.badge ?? { enabled: false, line1: "", line2: "" };
  return {
    clientId: raw.clientId || "opticur",
    templateId: raw.templateId || "opticur-foto-gul-ruta",
    format,
    headline1: raw.headline1 ?? "",
    headline2: raw.headline2 ?? "",
    body: raw.body ?? "",
    badge: {
      enabled: Boolean(badge.enabled),
      line1: badge.line1 ?? "",
      line2: badge.line2 ?? "",
    },
    imageUrl: raw.imageUrl ?? "",
    imageFocusY: clamp(Number(raw.imageFocusY ?? 50), 0, 100),
    brushColor: typeof raw.brushColor === "string" ? raw.brushColor : "",
    overrides: normalizeOverrides(raw.overrides),
  };
}

function normalizeOverrides(raw: Partial<StudioOverrides> | undefined): StudioOverrides {
  const o = raw || {};
  return {
    fontScale: clamp(Number(o.fontScale ?? 1), 0.6, 1.6),
    headlineColor: typeof o.headlineColor === "string" ? o.headlineColor : "",
    bodyColor: typeof o.bodyColor === "string" ? o.bodyColor : "",
    imageScale: clamp(Number(o.imageScale ?? 1), 1, 3),
    imageX: clamp(Number(o.imageX ?? 0), -50, 50),
    hideBrush: Boolean(o.hideBrush),
    hideBadge: Boolean(o.hideBadge),
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return (min + max) / 2;
  return Math.min(max, Math.max(min, n));
}
