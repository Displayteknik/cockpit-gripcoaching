import type { StudioPayload } from "./payload";

// Tweak-lager: mallarna läser overrides via dessa hjälpare. Tom/1 = mallens standard.
// Samma funktioner används i live-editorn och i export-rendern → WYSIWYG.

// Textstorlek: global skala × per-element-skala (rubrik/underrubrik/brödtext, "ruta för ruta").
// Utan roll = bara global skala (bakåtkompatibelt).
export function fs(base: number, p: StudioPayload, role?: "h1" | "h2" | "body"): number {
  const g = p.overrides?.fontScale || 1;
  const r =
    role === "h1" ? p.overrides?.h1Scale || 1 :
    role === "h2" ? p.overrides?.h2Scale || 1 :
    role === "body" ? p.overrides?.bodyScale || 1 : 1;
  return Math.round(base * g * r);
}
// Radavstånd: mallens bas × användarens radavstånd-multiplikator.
export function lh(base: number, p: StudioPayload): number {
  return Math.round(base * (p.overrides?.lineScale || 1) * 1000) / 1000;
}
export function hlColor(def: string, p: StudioPayload): string {
  return p.overrides?.headlineColor || def;
}
export function bodyColor(def: string, p: StudioPayload): string {
  return p.overrides?.bodyColor || def;
}
// object-position för fotot (horisontell panorering + befintlig vertikal fokuspunkt).
export function imgPosition(p: StudioPayload): string {
  const x = 50 + (p.overrides?.imageX || 0);
  return `${x}% ${p.imageFocusY}%`;
}
// object-fit-skala (inzoomning) via scale-transform på bilden.
export function imgScale(p: StudioPayload): number {
  return p.overrides?.imageScale || 1;
}
export function showBrush(p: StudioPayload): boolean {
  return !p.overrides?.hideBrush;
}
export function showBadge(p: StudioPayload): boolean {
  return p.badge.enabled && !p.overrides?.hideBadge;
}
// Typsnitt: override-font om vald, annars mallens default. Returnerar full font-family-sträng.
export function font(def: string, p: StudioPayload): string {
  return `${p.overrides?.fontFamily || def}, sans-serif`;
}
// Läsbar platta bakom texten (valfri) — gör vit text läsbar på rörigt foto.
// Tom = ingen platta (mallens standard). Spreadas in i textblockets style.
export function textPlate(p: StudioPayload): Record<string, string | number> {
  const bg = p.overrides?.textBg;
  if (!bg) return {};
  return {
    background: bg,
    padding: "0.3em 0.55em",
    borderRadius: 20,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    display: "inline-block",
  };
}
