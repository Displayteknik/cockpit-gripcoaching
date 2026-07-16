import type { StudioPayload } from "./payload";

// Tweak-lager: mallarna läser overrides via dessa hjälpare. Tom/1 = mallens standard.
// Samma funktioner används i live-editorn och i export-rendern → WYSIWYG.

export function fs(base: number, p: StudioPayload): number {
  return Math.round(base * (p.overrides?.fontScale || 1));
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
