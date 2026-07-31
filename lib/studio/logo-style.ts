import type { CSSProperties } from "react";
import type { StudioFormat } from "@/lib/studio/payload";

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
