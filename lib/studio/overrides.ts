import type { StudioPayload } from "./payload";
import { FORMAT_DIMENSIONS } from "./payload";

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
// B2: fritt placerad textruta. Offset i % av canvasmått → translate i px.
// 0/0 = mallens naturliga position (ingen transform alls → orörda mallar renderas exakt som förut).
// Spreadas i textblockets style i arketypen; noden märks data-drag="h1|h2|body" för dragglagret.
export function dragPos(p: StudioPayload, role: "h1" | "h2" | "body"): Record<string, string> {
  const o = p.overrides;
  const x = role === "h1" ? o?.h1X : role === "h2" ? o?.h2X : o?.bodyX;
  const y = role === "h1" ? o?.h1Y : role === "h2" ? o?.h2Y : o?.bodyY;
  if (!x && !y) return {};
  const { w, h } = FORMAT_DIMENSIONS[p.format] ?? { w: 1080, h: 1350 };
  return { transform: `translate(${Math.round(((x || 0) / 100) * w)}px, ${Math.round(((y || 0) / 100) * h)}px)` };
}

// Läsbar platta bakom texten (valfri) — gör vit text läsbar på rörigt foto.
// Tom = ingen platta (mallens standard). Spreadas in i textblockets style.
//
// Småfix 16/8 (3): plattan skulle rita ur textens EGNA mått, rad för rad, och följa
// fontstorlek/radavstånd/radbrytningar — men flödade utanför. `display: "inline-block"`
// var felet: en inline-block-box är EN odelbar enhet som browsern aldrig bryter över
// flera rader, så en lång rubrik body-ut ur sin platta i stället för att plattan följde
// varje textrad. `box-decoration-break: clone` (redan satt) är byggd för RIKTIGA inline-
// element: browsern klonar padding/bakgrund/radie på VARJE radfragment automatiskt när
// texten radbryter — det är exakt "textens faktiska mått rad för rad" utan att någon
// manuell mätning behövs. display: "inline" är den enda ändringen som krävdes.
export function textPlate(p: StudioPayload): Record<string, string | number> {
  const bg = p.overrides?.textBg;
  if (!bg) return {};
  return {
    background: bg,
    padding: "0.3em 0.55em",
    borderRadius: 20,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    display: "inline",
  };
}
