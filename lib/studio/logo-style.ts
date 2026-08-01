import type { CSSProperties } from "react";
import type { StudioFormat, LogoVariantVal } from "@/lib/studio/payload";

// BILD-5a — loggans synlighet (client-säker del, ingen sharp här).
// Minsta logg-höjd per format, i px på 1080-bred canvas. Konsekvent skala:
// större yta → större logga. Detta är renderhöjden; extremt breda wordmarks
// kapas av LOGO_MAX_WIDTH och kan då bli något lägre (contain).
export const LOGO_MIN_HEIGHT: Record<StudioFormat, number> = {
  "1080x1080": 64,
  "1080x1350": 72,
  "1080x1920": 88,
};

// ~42 % av canvasbredden — loggan får synas, inte ta över.
export const LOGO_MAX_WIDTH = 450;
export const FOOTER_LOGO_MAX_WIDTH = 380;

// Serverns kontrastbeslut (lib/studio/logo-contrast.ts). Mallarna konsumerar hinten;
// utan hint (t.ex. live-editorn, som är client-side) gäller mallens gamla fallback.
export interface LogoHint {
  url: string; // vald loggvariant (ljus/mörk) för zonens faktiska bakgrund
  plate: "dark" | "light" | null; // diskret platta när kontrasten ändå är för låg
}

/**
 * KVALITET-3/6b — vem bestämmer loggan?
 *
 * Ordning: 1) användarens manuella val, 2) serverns mätning (BILD-5a/6b), 3) mallens
 * gamla fallback. Rent och client-säkert, så samma beslut gäller i live-editorn (som
 * är pixlarna som publiceras) och i render-routen (preview + Playwright-export).
 *
 * "ljus" = ljus bakgrund → mörk originallogga. "mork" = mörk bakgrund → vit variant.
 * "platta" = behåll variantvalet, men lägg alltid en läsbar platta bakom.
 */
export function valjLogga(args: {
  val: LogoVariantVal | undefined;
  hint: LogoHint | null | undefined;
  ljusBakgrundLogga: string; // originalet — syns på ljus bakgrund
  morkBakgrundLogga: string; // vit variant — syns på mörk bakgrund
  fallback: string; // mallens gamla val när varken användare eller server sagt något
}): { url: string; plate: "dark" | "light" | null } {
  const { val, hint, ljusBakgrundLogga: ljus, morkBakgrundLogga: mork, fallback } = args;
  if (val === "ljus") return { url: ljus || mork || fallback, plate: null };
  if (val === "mork") return { url: mork || ljus || fallback, plate: null };
  if (val === "platta") {
    const url = hint?.url || fallback;
    // Platta i den färg som ger kontrast mot den logga som faktiskt visas:
    // vit variant → mörk platta, mörk originallogga → ljus platta.
    return { url, plate: url && url === mork ? "dark" : "light" };
  }
  if (hint?.url) return { url: hint.url, plate: hint.plate ?? null };
  return { url: fallback, plate: null };
}

export function logoImgStyle(format: StudioFormat, opts?: { overPhoto?: boolean; maxWidth?: number }): CSSProperties {
  return {
    height: LOGO_MIN_HEIGHT[format],
    width: "auto",
    maxWidth: opts?.maxWidth ?? LOGO_MAX_WIDTH,
    objectFit: "contain",
    display: "block",
    // Mjuk skugga på foto — lyfter loggan ur bilden utan att synas som effekt.
    filter: opts?.overPhoto ? "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" : undefined,
  };
}

// Halvtransparent, varumärkes-neutral platta bakom loggan (BILD-5a c).
export function logoPlateStyle(plate: "dark" | "light" | null | undefined): CSSProperties | undefined {
  if (!plate) return undefined;
  return {
    display: "inline-block",
    background: plate === "dark" ? "rgba(15,13,11,0.44)" : "rgba(255,255,255,0.62)",
    padding: "10px 16px",
    borderRadius: 14,
  };
}
