// Studio — payload-kontrakt (samma för alla mallar, se docs/studio/PLAN.md §3.3 i KICKOFF).
// Deterministisk: mallen ritas ENBART från detta objekt. AI rör aldrig layout.

export type StudioFormat = "1080x1350" | "1080x1080" | "1080x1920";

// Etikett för formatväljaren (client-säker).
export const FORMAT_LABELS: Record<StudioFormat, string> = {
  "1080x1350": "Porträtt 4:5",
  "1080x1080": "Kvadrat 1:1",
  "1080x1920": "Story 9:16",
};

// Stående format (visar fot, mer vertikal luft). 1:1 är det enda icke-stående.
export function isPortraitFormat(f: StudioFormat): boolean {
  return f !== "1080x1080";
}

// 9:16 = story/reel-mått. Bild-aspect + publiceringstyp härleds från detta.
export function isStoryFormat(f: StudioFormat): boolean {
  return f === "1080x1920";
}

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

// En karusell-slide (ark-karusell). kind styr layouten: hook = omslag/krok,
// point = innehållspunkt, cta = avslutande uppmaning.
export interface StudioSlide {
  kind: "hook" | "point" | "cta";
  headline: string;
  body: string;
  imageUrl: string; // valfri; tom = ingen bild
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
  slides: StudioSlide[]; // ark-karusell: N slides → N PNG. Tom för icke-karusell-mallar.
  videoUrl: string; // reel: uppladdad video (studio-videos). Studio-rendern = 9:16-cover. Tom = ingen video.
}

export const MAX_SLIDES = 10;

export function emptySlide(kind: StudioSlide["kind"] = "point"): StudioSlide {
  return { kind, headline: "", body: "", imageUrl: "" };
}

export const DEFAULT_OVERRIDES: StudioOverrides = {
  fontScale: 1, headlineColor: "", bodyColor: "", imageScale: 1, imageX: 0, hideBrush: false, hideBadge: false,
};

export const FORMAT_DIMENSIONS: Record<StudioFormat, { w: number; h: number }> = {
  "1080x1350": { w: 1080, h: 1350 },
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
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
  const format: StudioFormat =
    raw.format === "1080x1080" ? "1080x1080" : raw.format === "1080x1920" ? "1080x1920" : "1080x1350";
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
    slides: normalizeSlides(raw.slides),
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : "",
  };
}

// Publiceringstyp härledd ur format + video: 9:16 + video = reel, 9:16 utan = story, annars post.
export function derivePostType(format: StudioFormat, videoUrl: string): "post" | "story" | "reel" {
  if (isStoryFormat(format)) return videoUrl ? "reel" : "story";
  return "post";
}

function normalizeSlides(raw: unknown): StudioSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_SLIDES).map((s): StudioSlide => {
    const o = (s || {}) as Partial<StudioSlide>;
    const kind: StudioSlide["kind"] = o.kind === "hook" || o.kind === "cta" ? o.kind : "point";
    return {
      kind,
      headline: typeof o.headline === "string" ? o.headline : "",
      body: typeof o.body === "string" ? o.body : "",
      imageUrl: typeof o.imageUrl === "string" ? o.imageUrl : "",
    };
  });
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
