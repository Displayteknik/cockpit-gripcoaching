// Studio — payload-kontrakt (samma för alla mallar, se docs/studio/PLAN.md §3.3 i KICKOFF).
// Deterministisk: mallen ritas ENBART från detta objekt. AI rör aldrig layout.

import { normalizeImageEdit, type ImageEdit } from "@/lib/studio/image-edit";

export type StudioFormat = "1080x1350" | "1080x1080" | "1080x1920";

// Etikett för formatväljaren (client-säker).
export const FORMAT_LABELS: Record<StudioFormat, string> = {
  "1080x1350": "Porträtt",
  "1080x1080": "Kvadrat",
  "1080x1920": "Story",
};

// Stående format (visar fot, mer vertikal luft). 1:1 är det enda icke-stående.
export function isPortraitFormat(f: StudioFormat): boolean {
  return f !== "1080x1080";
}

// 9:16 = story/reel-mått. Bild-aspect + publiceringstyp härleds från detta.
export function isStoryFormat(f: StudioFormat): boolean {
  return f === "1080x1920";
}

// Manuellt loggval i editorn. "" = auto (serverns mätning bestämmer).
export type LogoVariantVal = "" | "ljus" | "mork" | "platta";
export const LOGO_VARIANT_LABELS: Record<LogoVariantVal, string> = {
  "": "Auto",
  ljus: "Ljus bakgrund",
  mork: "Mörk bakgrund",
  platta: "Platta bakom",
};

export interface StudioBadge {
  enabled: boolean;
  line1: string;
  line2: string;
}

export interface StudioOverrides {
  fontScale: number; // global textskala, 0.7–1.4 (1 = mallens standard) — multipliceras ovanpå per-element
  h1Scale: number; // rubrik-storlek (per ruta), 1 = mallens standard
  h2Scale: number; // underrubrik-storlek (per ruta)
  bodyScale: number; // brödtext-/punktstorlek (per ruta)
  fontFamily: string; // "" = mallens standard, annars Inter/Playfair Display/Archivo/Poppins/Anton
  headlineColor: string; // "" = mallens standard
  bodyColor: string; // "" = mallens standard
  textBg: string; // "" = ingen, annars hex-färg på platta bakom texten (läsbarhet på foto)
  lineScale: number; // radavstånd-multiplikator (1 = mallens standard)
  imageScale: number; // 1 = cover, >1 = inzoomat
  imageX: number; // -50..50 horisontell panorering (%)
  hideBrush: boolean;
  hideBadge: boolean;
  /**
   * KARUSELL-2 (Håkans besked 11/8): "de där 00 01 och liknande ser jag ingen mening att visa,
   * dessutom fel hela tiden". Punktsiffran på bilden är därför AV som standard. Den som vill
   * numrera sina punkter tänder den här — uträkningen (punktNummer) är orörd och används
   * fortfarande av editorns etiketter.
   */
  visaPunktNummer?: boolean;
  // KVALITET-3/6b: manuellt loggval som overridar autovalet (BILD-5a/6b).
  // "" = auto (mät bakgrunden), "ljus" = ljus bakgrund → mörk originallogga,
  // "mork" = mörk bakgrund → vit variant, "platta" = auto-variant + platta bakom.
  // Automatik som grund, sista ordet till människan.
  logoVariant: LogoVariantVal;
  // Fritt placerbara textrutor (B2): offset i % av canvasmått från mallens naturliga
  // position. 0 = mallens standard. Läses av både live-editor och export-render (WYSIWYG).
  h1X: number; h1Y: number;
  h2X: number; h2Y: number;
  bodyX: number; bodyY: number;
  // Redigerbar fotplatta-text (t.ex. opticur-skarm-split): "" = mallens härledda standard
  // (stad + telefon ur brand-profilen), annars användarens eget värde för just detta inlägg.
  footerText: string;
  // Fotplattans textstorlek (samma roll-mönster som h1Scale/h2Scale/bodyScale), 1 = mallens
  // standard. Egen skala i stället för att återanvända bodyScale — fotplattan är ett separat
  // element, inte inläggets brödtext, och ska kunna justeras utan att röra den.
  footerScale: number;
}

// En karusell-slide (ark-karusell). kind styr layouten: hook = omslag/krok,
// point = innehållspunkt, cta = avslutande uppmaning.
export interface StudioSlide {
  kind: "hook" | "point" | "cta";
  /**
   * G-2:s dramaturgi-roller, som ETIKETT. `kind` styr fortfarande layouten — insats och
   * bevis ritas som en punkt, och det ska de.
   *
   * ⚠ Hakans fynd 10/8: valde han 3 punkter fick han 7 slides, och editorn radade upp
   * FEM chip markta "Punkt" med varsitt nummer. Insatsen och beviset ar inte hans
   * punkter, men de sag ut sa. Faltet finns for att etiketten ska kunna saga sanningen
   * utan att rendering, export eller slide-merge behover rora sig.
   */
  roll?: "insats" | "bevis";
  headline: string;
  body: string;
  imageUrl: string; // valfri; tom = ingen bild
}

// OPTICUR-1 Etapp B: fri storlek i pixlar ("Egen storlek/Skärm"), t.ex. en infartsskärm
// 1200x900. Namnet är valfritt — sätts när måttet sparas för återanvändning (kit.screenFormats).
export interface CustomSize {
  w: number;
  h: number;
  name?: string;
}

export interface StudioPayload {
  clientId: string;
  templateId: string;
  format: StudioFormat;
  // Satt = fri storlek styr canvasmåttet i stället för `format` (som ändå håller ett
  // giltigt värde av bakåtkompatibilitetsskäl, men ignoreras när customSize finns).
  // Läs ALLTID mått via effectiveDims(payload) — aldrig FORMAT_DIMENSIONS[payload.format]
  // direkt, annars uppstår exakt samma bugg som BESKÄR-1 (en väg som inte känner till den
  // andra källan för sanning).
  customSize: CustomSize | null;
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
  brief: string; // grafikbrief: vad bilden ska föreställa. Ritas ALDRIG ut — styr Bildhjälpen.
  // BILD-1: bildredigering i Skriv eget-läget (beskärning/hela-bilden). null = orört råfoto.
  imageEdit: ImageEdit | null;
}

export const MAX_SLIDES = 10;

/**
 * Punkt-slidens stora nummer. Räknar BARA punkter — krok och avslut hoppas över, så
 * läsaren av det färdiga inlägget ser 01, 02, 03 som en lista och inte "02, 04, 05".
 * Returnerar null för slides som inte är punkter.
 *
 * ⚠ Numret är alltså INTE slidens plats i ordningen. Slide 6 kan visa "04". I editorn
 * stod de två siffrorna bredvid varandra utan förklaring och lästes som en enda — därför
 * visas punktnumret vid etiketten där också. Uträkningen bor här så mallen och editorn
 * aldrig kan räkna olika.
 */
export function punktNummer(slides: StudioSlide[], i: number): number | null {
  // Insats och bevis ar kind "point" i datan men INTE anvandarens punkter. De far
  // darfor inget nummer, och de raknas inte heller upp de andra: valjer man 3 punkter
  // ska de heta 01, 02, 03 aven nar dramaturgin lagt till slides omkring dem.
  const arPunkt = (s: StudioSlide | undefined) => s?.kind === "point" && !s.roll;
  if (!arPunkt(slides[i])) return null;
  return slides.slice(0, i + 1).filter(arPunkt).length;
}

export function emptySlide(kind: StudioSlide["kind"] = "point"): StudioSlide {
  return { kind, headline: "", body: "", imageUrl: "" };
}

export const DEFAULT_OVERRIDES: StudioOverrides = {
  fontScale: 1, h1Scale: 1, h2Scale: 1, bodyScale: 1, fontFamily: "", headlineColor: "", bodyColor: "", textBg: "", lineScale: 1, imageScale: 1, imageX: 0, hideBrush: false, hideBadge: false, visaPunktNummer: false,
  logoVariant: "",
  h1X: 0, h1Y: 0, h2X: 0, h2Y: 0, bodyX: 0, bodyY: 0,
  footerText: "",
  footerScale: 1,
};

// Typsnitt som får väljas i editorn (self-hostade → live = export). "" = mallens standard.
export const STUDIO_FONTS = ["Inter", "Playfair Display", "Archivo", "Poppins", "Anton", "Kalnia", "Caveat"] as const;

export const FORMAT_DIMENSIONS: Record<StudioFormat, { w: number; h: number }> = {
  "1080x1350": { w: 1080, h: 1350 },
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1920": { w: 1080, h: 1920 },
};

export const CUSTOM_SIZE_MIN = 200;
export const CUSTOM_SIZE_MAX = 4096;

// Vanliga mått som snabbknappar i "Egen storlek"-väljaren (B1) — fritt fält är kärnan,
// de här är bara genvägar för de vanligaste skärmarna/formaten.
export const CUSTOM_SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "1200×900 (4:3-skärm)", w: 1200, h: 900 },
  { label: "1920×1080 (16:9)", w: 1920, h: 1080 },
  { label: "1080×1920 (9:16)", w: 1080, h: 1920 },
];

function normalizeCustomSize(raw: unknown): CustomSize | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<CustomSize>;
  const w = Math.round(clamp(Number(o.w), CUSTOM_SIZE_MIN, CUSTOM_SIZE_MAX));
  const h = Math.round(clamp(Number(o.h), CUSTOM_SIZE_MIN, CUSTOM_SIZE_MAX));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { w, h, ...(typeof o.name === "string" && o.name.trim() ? { name: o.name.trim().slice(0, 60) } : {}) };
}

// EN källa för canvasmåttet — läs ALLTID via denna, aldrig FORMAT_DIMENSIONS[format] direkt.
// customSize (Etapp B, fri storlek) vinner över det fasta formatet när den finns.
export function effectiveDims(payload: Pick<StudioPayload, "format" | "customSize">): { w: number; h: number } {
  return payload.customSize ?? FORMAT_DIMENSIONS[payload.format];
}

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
    // ALDRIG defaulta till en riktig klient (opticur) — det läcker den klientens brand/footer
    // in i andras inlägg. Tom clientId → neutral brand. Neutral generisk mall, ej klient-exklusiv.
    clientId: raw.clientId || "",
    templateId: raw.templateId || "ark-textkort",
    format,
    customSize: normalizeCustomSize(raw.customSize),
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
    brief: typeof raw.brief === "string" ? raw.brief.slice(0, 600) : "",
    imageEdit: normalizeImageEdit(raw.imageEdit),
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
    // Rollen foljer med om den finns. Gamla sparade karuseller saknar den helt och
    // beter sig precis som forut.
    const roll = o.roll === "insats" || o.roll === "bevis" ? o.roll : undefined;
    return {
      kind,
      ...(roll ? { roll } : {}),
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
    h1Scale: clamp(Number(o.h1Scale ?? 1), 0.5, 2),
    h2Scale: clamp(Number(o.h2Scale ?? 1), 0.5, 2),
    bodyScale: clamp(Number(o.bodyScale ?? 1), 0.5, 2),
    fontFamily: typeof o.fontFamily === "string" ? o.fontFamily : "",
    headlineColor: typeof o.headlineColor === "string" ? o.headlineColor : "",
    bodyColor: typeof o.bodyColor === "string" ? o.bodyColor : "",
    textBg: typeof o.textBg === "string" ? o.textBg : "",
    lineScale: clamp(Number(o.lineScale ?? 1), 0.8, 1.8),
    imageScale: clamp(Number(o.imageScale ?? 1), 1, 3),
    imageX: clamp(Number(o.imageX ?? 0), -50, 50),
    hideBrush: Boolean(o.hideBrush),
    hideBadge: Boolean(o.hideBadge),
    visaPunktNummer: Boolean(o.visaPunktNummer),
    logoVariant: o.logoVariant === "ljus" || o.logoVariant === "mork" || o.logoVariant === "platta" ? o.logoVariant : "",
    h1X: clamp(Number(o.h1X ?? 0), -100, 100),
    h1Y: clamp(Number(o.h1Y ?? 0), -100, 100),
    h2X: clamp(Number(o.h2X ?? 0), -100, 100),
    h2Y: clamp(Number(o.h2Y ?? 0), -100, 100),
    bodyX: clamp(Number(o.bodyX ?? 0), -100, 100),
    bodyY: clamp(Number(o.bodyY ?? 0), -100, 100),
    footerText: typeof o.footerText === "string" ? o.footerText.slice(0, 120) : "",
    footerScale: clamp(Number(o.footerScale ?? 1), 0.5, 2),
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return (min + max) / 2;
  return Math.min(max, Math.max(min, n));
}
