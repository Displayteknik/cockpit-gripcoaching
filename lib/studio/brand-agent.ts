// Etapp E — auto-setup: analysera kundens webbplats och FÖRESLÅ ett brand kit.
// Föreslår bara det som faktiskt hittas (loggor/färger som förekommer på sajten).
// Osäkert → lämnas tomt. Sparas ALDRIG automatiskt — UI visar förslag för godkännande.

import { shade } from "@/lib/studio/brand";

const ALLOWED_FONTS = ["Inter", "Archivo", "Poppins", "Anton", "Playfair Display"];

export interface SiteAnalysis {
  colors: { primary?: string; primaryDeep?: string; primaryLight?: string; accent?: string };
  fonts: { headline?: string; body?: string };
  logo?: { primaryUrl?: string };
  found: { colorCandidates: string[]; fontsRaw: string[]; logoSource: string };
}

export async function analyzeSite(publicUrl: string, fallbackPrimary?: string): Promise<SiteAnalysis> {
  const origin = publicUrl.replace(/\/+$/, "");
  let html = "";
  try {
    const r = await fetch(origin, { redirect: "follow" });
    if (r.ok) html = await r.text();
  } catch { /* tom analys */ }

  const colorCandidates = topColors(html, fallbackPrimary);
  const fontsRaw = extractFonts(html);
  const logo = extractLogo(html, origin);

  const primary = colorCandidates[0] || fallbackPrimary;
  const accent = colorCandidates.find((c) => c !== primary && saturation(c) > 0.45) || colorCandidates[1];

  const headlineFont = matchFont(fontsRaw);
  return {
    colors: primary ? { primary, primaryDeep: shade(primary, -0.28), primaryLight: shade(primary, 0.35), accent } : {},
    fonts: headlineFont ? { headline: headlineFont, body: headlineFont === "Anton" || headlineFont === "Playfair Display" ? "Inter" : headlineFont } : {},
    logo: logo ? { primaryUrl: logo.url } : undefined,
    found: { colorCandidates, fontsRaw: fontsRaw.slice(0, 8), logoSource: logo?.source || "" },
  };
}

// ── Färger ──────────────────────────────────────────────────────
function topColors(html: string, fallback?: string): string[] {
  const counts = new Map<string, number>();
  const add = (hex: string) => { const h = normHex(hex); if (h) counts.set(h, (counts.get(h) || 0) + 1); };

  for (const m of html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(m[0]);
  for (const m of html.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) add(rgbToHex(+m[1], +m[2], +m[3]));

  const ranked = [...counts.entries()]
    .filter(([hex]) => { const s = saturation(hex); const l = lightness(hex); return s > 0.12 && l > 0.08 && l < 0.92; })
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  // Om klientens primary_color inte redan finns med, lägg den främst.
  if (fallback) { const f = normHex(fallback); if (f && !ranked.includes(f)) ranked.unshift(f); }
  // Dedupe nära-identiska
  const out: string[] = [];
  for (const c of ranked) { if (!out.some((o) => colorDist(o, c) < 28)) out.push(c); if (out.length >= 6) break; }
  return out;
}

// ── Typsnitt ────────────────────────────────────────────────────
function extractFonts(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)) {
    const first = m[1].split(",")[0].replace(/['"\\]/g, "").trim();
    if (first && !/inherit|initial|unset|none|var\(|sans-serif|serif|monospace|font ?awesome|icon/i.test(first)) out.add(first);
  }
  // Google Fonts-länkar
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/gi)) {
    out.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
  }
  return [...out];
}

function matchFont(raw: string[]): string | undefined {
  for (const r of raw) { const hit = ALLOWED_FONTS.find((f) => f.toLowerCase() === r.toLowerCase()); if (hit) return hit; }
  // Nära matchning på namn
  for (const r of raw) { const hit = ALLOWED_FONTS.find((f) => r.toLowerCase().includes(f.toLowerCase().split(" ")[0])); if (hit) return hit; }
  return undefined;
}

// ── Logga ───────────────────────────────────────────────────────
function extractLogo(html: string, origin: string): { url: string; source: string } | undefined {
  // 1) <img> med logo-heuristik
  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    if (/logo/i.test(tag)) { const src = attr(tag, "src"); if (src) return { url: abs(src, origin), source: "img[logo]" }; }
  }
  // 2) og:image
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) return { url: abs(og[1], origin), source: "og:image" };
  // 3) apple-touch-icon / icon
  const icon = html.match(/<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (icon) return { url: abs(icon[1], origin), source: "icon" };
  return undefined;
}

// ── Hjälpare ────────────────────────────────────────────────────
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m?.[1];
}
function abs(url: string, origin: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  return origin + (url.startsWith("/") ? "" : "/") + url;
}
function normHex(hex: string): string | null {
  let h = hex.replace("#", "").toLowerCase();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return "#" + h;
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0")).join("");
}
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lightness(hex: string): number { const [r, g, b] = rgb(hex); return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255; }
function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  if (mx === mn) return 0;
  return l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
}
function colorDist(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
