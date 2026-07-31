// BILD-5a — automatiskt val av ljus/mörk loggvariant utifrån bakgrundens ljushet
// i loggzonen, + platt-beslut när kontrasten ändå är för låg. Server-side (sharp) —
// körs i render-routen app/studio/render/[templateId]/page.tsx, så preview (iframe),
// Playwright-export och publicering får samma beslut.

import sharp from "sharp";
import type { StudioPayload } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import type { LogoHint } from "@/lib/studio/logo-style";

// Ljus bakgrund (solid färg) ≥ 0.60 — harmonierar med isLightColor (0.62) i StudioBits.
const LIGHT_BG = 0.6;
// BILD-6b: foto-zoner bedöms stramare — hellre mörk logga "för tidigt" än tunn vit.
const IMAGE_LIGHT_BG = 0.55;
// |logglum − bakgrundslum| under detta → platta bakom loggan.
const PLATE_CONTRAST = 0.3;
// BILD-6b: blandad zon när spännvidden (p95−p05) är stor — medelvärdet döljer mixen.
const MIXED_SPAN = 0.45;

// Zonstatistik i stället för bara medel (BILD-6b): skarpt fall — mörkt parti + ljus
// solbelyst fasad gav medel ~0.5 → vit logga valdes och blev tunn över det ljusa.
export interface ZonStats {
  mean: number;
  p05: number; // mörkaste partiet (5:e percentilen — enstaka pixlar räknas inte)
  p95: number; // ljusaste partiet
}

// Blandad/tveksam bakgrund? Hög spännvidd, eller tydligt ljusa partier trots mörkt snitt.
export function arBlandadZon(z: ZonStats): boolean {
  return z.p95 - z.p05 >= MIXED_SPAN || (z.p95 >= 0.7 && z.p05 <= 0.4);
}

// Variantval (Håkans princip, BILD-6b): vid blandad/tveksam bakgrund → hellre den
// mörka originalloggan (ljus-bakgrundsvarianten) än en tunn vit som drunknar i ljusa
// partier. Plattbeslutet nedan täcker sedan zonens mörka partier.
export function valjLjusVariant(z: ZonStats, troskel: number): boolean {
  if (arBlandadZon(z)) return true;
  return z.mean >= troskel;
}

// Plattbeslut mot zonens VÄRSTA parti för vald logga: en ljus logga hotas av det
// ljusaste partiet (p95), en mörk av det mörkaste (p05) — aldrig bara medelvärdet.
export function plattBeslut(logoLum: number | null, z: ZonStats): "dark" | "light" | null {
  if (logoLum == null) return null;
  const varsta = logoLum >= 0.5 ? z.p95 : z.p05;
  return Math.abs(logoLum - varsta) < PLATE_CONTRAST ? (logoLum >= 0.5 ? "dark" : "light") : null;
}

function solidZon(lum: number): ZonStats {
  return { mean: lum, p05: lum, p95: lum };
}

// Process-cacher: samma logga/bild återkommer i preview + export → hämta en gång.
const lumCache = new Map<string, Promise<number | null>>();
const statsCache = new Map<string, Promise<ZonStats | null>>();

function hexLum(hex: string): number {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

interface Zone { left: number; top: number; width: number; height: number } // relativa 0..1

// Zonstatistik (medel + p05/p95) i en relativ zon av bilden. Approximation: zonen
// mäts i källbilden (objectFit cover kan beskära något annorlunda) — gott nog.
function zoneStats(url: string, zone: Zone): Promise<ZonStats | null> {
  const key = `zon:${url}:${zone.left},${zone.top},${zone.width},${zone.height}`;
  const hit = statsCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<ZonStats | null> => {
    const buf = await fetchBuffer(url);
    if (!buf) return null;
    try {
      const img = sharp(buf);
      const meta = await img.metadata();
      if (!meta.width || !meta.height) return null;
      const region = {
        left: Math.round(meta.width * zone.left),
        top: Math.round(meta.height * zone.top),
        width: Math.max(1, Math.round(meta.width * zone.width)),
        height: Math.max(1, Math.round(meta.height * zone.height)),
      };
      const { data, info } = await img
        .extract(region)
        .resize(32, 16, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const varden: number[] = [];
      for (let i = 0; i < data.length; i += info.channels) {
        varden.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
      }
      if (!varden.length) return null;
      varden.sort((a, b) => a - b);
      const mean = varden.reduce((s, x) => s + x, 0) / varden.length;
      return {
        mean,
        p05: varden[Math.floor(varden.length * 0.05)],
        p95: varden[Math.min(varden.length - 1, Math.floor(varden.length * 0.95))],
      };
    } catch {
      return null;
    }
  })();
  statsCache.set(key, p);
  return p;
}

// Loggans medelluminans över opaka pixlar (alpha > 40) — samma princip som isColorful
// i lib/studio/logo-assets.ts.
function logoLuminance(url: string): Promise<number | null> {
  const key = `logo:${url}`;
  const hit = lumCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<number | null> => {
    const buf = await fetchBuffer(url);
    if (!buf) return null;
    try {
      const { data, info } = await sharp(buf)
        .resize(48, 48, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i + 3] < 40) continue;
        sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        n++;
      }
      return n ? sum / n : null;
    } catch {
      return null;
    }
  })();
  lumCache.set(key, p);
  return p;
}

// Loggzonen i ark-overlay: loggans FAKTISKA ruta topp-vänster (top 44px, left 52px,
// logga ≤ 450px bred på 1080-kanvas). BILD-6b: stramad från 55 % bredd — den gamla
// zonen samplade långt förbi loggans högerkant och spädde ut det som ligger bakom den.
const OVERLAY_TOP_ZONE: Zone = { left: 0.04, top: 0.02, width: 0.45, height: 0.12 };

export async function computeLogoHint(
  templateId: string,
  payload: StudioPayload,
  brand: StudioBrand,
  slideIndex: number,
): Promise<LogoHint | null> {
  const light = brand.assets.logo || ""; // original — för ljus bakgrund
  const dark = brand.assets.logoOnDark || ""; // vit variant — för mörk bakgrund
  if (!light && !dark) return null;

  let zon: ZonStats | null = null;
  let troskel = LIGHT_BG;

  if (templateId === "ark-overlay") {
    if (payload.imageUrl) {
      const stats = await zoneStats(payload.imageUrl, OVERLAY_TOP_ZONE);
      // Bilden gick inte att läsa → behåll dagens beteende (mörk-variant), ingen platta.
      if (!stats) return { url: dark || light, plate: null };
      // scrim-full lägger 0.35 svart även upptill; scrim-bottom/band är transparenta där.
      const f = brand.content.overlayStyle === "scrim-full" ? 0.65 : 1;
      zon = { mean: stats.mean * f, p05: stats.p05 * f, p95: stats.p95 * f };
      troskel = IMAGE_LIGHT_BG;
    } else {
      // Ingen bild: gradient primary→primaryDeep, toppen ≈ primary.
      zon = solidZon(hexLum(brand.colors.primary));
    }
  } else if (templateId === "ark-karusell") {
    // Spegla ArkKarusells bakgrundslogik för loggraden nere.
    const slides = payload.slides.length
      ? payload.slides
      : [{ kind: "hook" as const, headline: "", body: "", imageUrl: payload.imageUrl }];
    const i = Math.min(Math.max(0, slideIndex), slides.length - 1);
    const slide = slides[i];
    const hasImg = Boolean(slide.imageUrl);
    const c = brand.colors;
    const bgHex = slide.kind === "hook" ? c.primary : slide.kind === "cta" ? c.primaryDeep : c.paper;
    // Point + bild: mörkt scrim (rgba 0.9) nedtill → alltid mörk loggzon.
    // Hook/cta + bild: scrimmen är bakgrundsfärgen (~85 % täckning) → färgen styr.
    zon = solidZon(slide.kind === "point" && hasImg ? 0.12 : hexLum(bgHex));
  } else {
    return null;
  }

  // BILD-6b: blandad/tveksam zon → hellre mörk originallogga (+ ev. platta) än tunn vit.
  const url = valjLjusVariant(zon, troskel) ? light || dark : dark || light;
  const logoLum = await logoLuminance(url);
  return { url, plate: plattBeslut(logoLum, zon) };
}
