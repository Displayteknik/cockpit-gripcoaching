// BILD-5a — automatiskt val av ljus/mörk loggvariant utifrån bakgrundens ljushet
// i loggzonen, + platt-beslut när kontrasten ändå är för låg. Server-side (sharp) —
// körs i render-routen app/studio/render/[templateId]/page.tsx, så preview (iframe),
// Playwright-export och publicering får samma beslut.

import sharp from "sharp";
import type { StudioPayload } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import type { LogoHint } from "@/lib/studio/logo-style";

// Ljus bakgrund ≥ 0.60 — harmonierar med isLightColor (0.62) i StudioBits.
const LIGHT_BG = 0.6;
// |logglum − bakgrundslum| under detta → platta bakom loggan.
const PLATE_CONTRAST = 0.3;

// Process-cacher: samma logga/bild återkommer i preview + export → hämta en gång.
const lumCache = new Map<string, Promise<number | null>>();

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

// Medelluminans i en relativ zon av bilden. Approximation: zonen mäts i källbilden
// (objectFit cover kan beskära något annorlunda) — gott nog för ljus/mörk-valet.
function zoneLuminance(url: string, zone: Zone): Promise<number | null> {
  const key = `zon:${url}:${zone.left},${zone.top},${zone.width},${zone.height}`;
  const hit = lumCache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<number | null> => {
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
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += info.channels) {
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

// Loggzonen i ark-overlay: övre vänstra området (top 44px, left 52px, logga ≤ 450px bred).
const OVERLAY_TOP_ZONE: Zone = { left: 0.03, top: 0.02, width: 0.55, height: 0.13 };

export async function computeLogoHint(
  templateId: string,
  payload: StudioPayload,
  brand: StudioBrand,
  slideIndex: number,
): Promise<LogoHint | null> {
  const light = brand.assets.logo || ""; // original — för ljus bakgrund
  const dark = brand.assets.logoOnDark || ""; // vit variant — för mörk bakgrund
  if (!light && !dark) return null;

  let bgLum: number | null = null;

  if (templateId === "ark-overlay") {
    if (payload.imageUrl) {
      bgLum = await zoneLuminance(payload.imageUrl, OVERLAY_TOP_ZONE);
      // scrim-full lägger 0.35 svart även upptill; scrim-bottom/band är transparenta där.
      if (bgLum != null && brand.content.overlayStyle === "scrim-full") bgLum *= 0.65;
      // Bilden gick inte att läsa → behåll dagens beteende (mörk-variant), ingen platta.
      if (bgLum == null) return { url: dark || light, plate: null };
    } else {
      // Ingen bild: gradient primary→primaryDeep, toppen ≈ primary.
      bgLum = hexLum(brand.colors.primary);
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
    bgLum = slide.kind === "point" && hasImg ? 0.12 : hexLum(bgHex);
  } else {
    return null;
  }

  const bgLight = bgLum >= LIGHT_BG;
  const url = bgLight ? light || dark : dark || light;
  const logoLum = await logoLuminance(url);
  const plate: LogoHint["plate"] =
    logoLum != null && Math.abs(logoLum - bgLum) < PLATE_CONTRAST
      ? logoLum >= 0.5
        ? "dark"
        : "light"
      : null;
  return { url, plate };
}
