import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

// Studio brand v2 — ROLL-baserade tokens (inte kulörnamn). Mallar refererar aldrig
// "gul", alltid en roll (accent/primary/…). Källa i prioritet:
//   1) clients/<slug>/brand.json  = premium-override (Opticur, handgjord) → adapter
//   2) studio_brand_kits-rad (DB) = kundens grafiska profil (normalfallet)
//   3) clients-raden              = neutral fallback (namn + primary_color)

export interface BrandColors {
  primary: string;
  primaryDeep: string;
  primaryLight: string;
  accent: string;
  support: string;
  ink: string;
  paper: string;
}

export interface BrandElements {
  brush: { enabled: boolean; color: keyof BrandColors };
  shapes: { enabled: boolean; style: "rounded" | "sharp" | "organic" };
  lines: { enabled: boolean; weight: "thin" | "bold" };
  badge: { enabled: boolean; shape: "starburst" | "circle" | "tag" };
  underline: { enabled: boolean };
}

export interface BrandImageStyle {
  mode: "photo" | "illustration" | "mixed";
  prompt: string;
  negative: string;
  people: boolean;
  colorGrade: "warm" | "cool" | "neutral";
}

export interface StudioBrand {
  clientId: string;
  name: string;
  colors: BrandColors;
  forbiddenColors: string[];
  fonts: { headline: string; body: string; logo: string };
  elements: BrandElements;
  imageStyle: BrandImageStyle;
  footer: { show: boolean; tagline: string; address: string; ctaLabel: string; ctaUrl: string; qrUrl: string };
  donts: string[];
  assets: {
    logo: string;
    logoOnDark?: string;
    icon?: string;
    qr?: string;
    zeiss?: string; // legacy Opticur
    brush?: string; // legacy — penselrutan ritas numera som vektor
    footer?: string; // exakt fot-crop (Opticur footer.png)
  };
}

// Rå kit-jsonb från studio_brand_kits (allt valfritt — normaliseras).
export interface BrandKit {
  colors?: Partial<BrandColors> & { forbidden?: string[] };
  fonts?: { headline?: string; body?: string; logo?: string };
  logo?: { primaryUrl?: string; onDarkUrl?: string; iconUrl?: string };
  elements?: Partial<BrandElements>;
  imageStyle?: Partial<BrandImageStyle>;
  footer?: { show?: boolean; tagline?: string; address?: string; ctaLabel?: string; ctaUrl?: string; qrUrl?: string };
  donts?: string[];
}

const ALLOWED_FONTS = ["Inter", "Archivo", "Poppins", "Anton", "Playfair Display"];

// ── Publik ingång ────────────────────────────────────────────────
export async function loadBrand(slug: string): Promise<StudioBrand> {
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, "");
  const file = path.join(process.cwd(), "clients", safeSlug, "brand.json");

  let brand: StudioBrand;
  try {
    brand = adaptLegacyBrand(JSON.parse(await fs.readFile(file, "utf8")), safeSlug);
  } catch {
    const kit = await fetchKit(safeSlug);
    brand = kit ? brandFromKit(safeSlug, kit.name, kit.primary, kit.kit) : await neutralBrand(safeSlug);
  }

  // Exakt fot-crop (public/clients/<slug>/footer.png) har alltid företräde.
  if (!brand.assets.footer) {
    const footerPng = path.join(process.cwd(), "public", "clients", safeSlug, "footer.png");
    if (existsSync(footerPng)) brand.assets.footer = `/clients/${safeSlug}/footer.png`;
  }
  return brand;
}

// Bygger StudioBrand direkt ur ett kit (används av UI-live-preview via render-route).
export function brandFromKit(slug: string, name: string, primary: string, kit: BrandKit): StudioBrand {
  const c = kit.colors || {};
  const colors: BrandColors = {
    primary: c.primary || primary || "#1A6B3C",
    primaryDeep: c.primaryDeep || shade(c.primary || primary || "#1A6B3C", -0.28),
    primaryLight: c.primaryLight || shade(c.primary || primary || "#1A6B3C", 0.35),
    accent: c.accent || "#F2B01E",
    support: c.support || "#7ECECA",
    ink: c.ink || "#1A1A1A",
    paper: c.paper || "#FFFFFF",
  };
  return {
    clientId: slug,
    name,
    colors,
    forbiddenColors: kit.colors?.forbidden || [],
    fonts: {
      headline: pickFont(kit.fonts?.headline, "Inter"),
      body: pickFont(kit.fonts?.body, "Inter"),
      logo: kit.fonts?.logo && ALLOWED_FONTS.includes(kit.fonts.logo) ? kit.fonts.logo : "",
    },
    elements: normalizeElements(kit.elements),
    imageStyle: normalizeImageStyle(kit.imageStyle),
    footer: {
      show: kit.footer?.show ?? true,
      tagline: kit.footer?.tagline || "",
      address: kit.footer?.address || "",
      ctaLabel: kit.footer?.ctaLabel || "",
      ctaUrl: kit.footer?.ctaUrl || "",
      qrUrl: kit.footer?.qrUrl || "",
    },
    donts: Array.isArray(kit.donts) ? kit.donts : [],
    assets: {
      logo: kit.logo?.primaryUrl || "",
      logoOnDark: kit.logo?.onDarkUrl || "",
      icon: kit.logo?.iconUrl || "",
      qr: kit.footer?.qrUrl || "",
    },
  };
}

// ── Legacy brand.json (Opticur) → v2 roll-tokens ────────────────
interface LegacyBrand {
  clientId: string; name: string;
  colors: { greenDark: string; greenDeep: string; greenLight: string; mint: string; yellow: string; black: string; white: string };
  fonts: { headline: string; body: string; logo: string };
  footer: { tagline: string; address: string; bookingLabel: string; bookingUrl: string };
  assets: { logo: string; zeiss?: string; brush?: string; qr?: string; footer?: string };
}

function adaptLegacyBrand(raw: LegacyBrand, slug: string): StudioBrand {
  const lc = raw.colors;
  return {
    clientId: raw.clientId || slug,
    name: raw.name || slug,
    colors: {
      primary: lc.greenDark,
      primaryDeep: lc.greenDeep,
      primaryLight: lc.greenLight,
      accent: lc.yellow,
      support: lc.mint,
      ink: lc.black,
      paper: lc.white,
    },
    forbiddenColors: [],
    fonts: raw.fonts,
    elements: normalizeElements({ brush: { enabled: true, color: "accent" }, badge: { enabled: true, shape: "starburst" } }),
    imageStyle: normalizeImageStyle(undefined),
    footer: {
      show: true,
      tagline: raw.footer.tagline,
      address: raw.footer.address,
      ctaLabel: raw.footer.bookingLabel,
      ctaUrl: raw.footer.bookingUrl,
      qrUrl: raw.assets.qr || "",
    },
    donts: [],
    assets: {
      logo: raw.assets.logo,
      zeiss: raw.assets.zeiss,
      brush: raw.assets.brush,
      qr: raw.assets.qr,
      footer: raw.assets.footer,
    },
  };
}

// ── Neutral fallback (clients-raden) ────────────────────────────
async function neutralBrand(slug: string): Promise<StudioBrand> {
  const { name, primary } = await fetchClientBasics(slug);
  return brandFromKit(slug, name, primary, {});
}

// ── DB-hjälpare ─────────────────────────────────────────────────
async function sbService() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function fetchClientBasics(slug: string): Promise<{ name: string; primary: string }> {
  try {
    const sb = await sbService();
    const { data } = await sb.from("clients").select("name, primary_color").eq("slug", slug).maybeSingle();
    return { name: data?.name || slug, primary: data?.primary_color || "#1A6B3C" };
  } catch {
    return { name: slug, primary: "#1A6B3C" };
  }
}

async function fetchKit(slug: string): Promise<{ name: string; primary: string; kit: BrandKit } | null> {
  try {
    const sb = await sbService();
    const { data: client } = await sb.from("clients").select("id, name, primary_color").eq("slug", slug).maybeSingle();
    if (!client?.id) return null;
    const { data: row } = await sb.from("studio_brand_kits").select("kit").eq("client_id", client.id).maybeSingle();
    if (!row?.kit || Object.keys(row.kit).length === 0) return null;
    return { name: client.name || slug, primary: client.primary_color || "#1A6B3C", kit: row.kit as BrandKit };
  } catch {
    return null;
  }
}

// ── Normaliserare ───────────────────────────────────────────────
function normalizeElements(e?: Partial<BrandElements>): BrandElements {
  return {
    brush: { enabled: e?.brush?.enabled ?? false, color: (e?.brush?.color as keyof BrandColors) || "accent" },
    shapes: { enabled: e?.shapes?.enabled ?? false, style: e?.shapes?.style || "rounded" },
    lines: { enabled: e?.lines?.enabled ?? false, weight: e?.lines?.weight || "thin" },
    badge: { enabled: e?.badge?.enabled ?? false, shape: e?.badge?.shape || "starburst" },
    underline: { enabled: e?.underline?.enabled ?? false },
  };
}

function normalizeImageStyle(s?: Partial<BrandImageStyle>): BrandImageStyle {
  return {
    mode: s?.mode || "photo",
    prompt: s?.prompt || "",
    negative: s?.negative || "",
    people: s?.people ?? true,
    colorGrade: s?.colorGrade || "neutral",
  };
}

function pickFont(f: string | undefined, fallback: string): string {
  return f && ALLOWED_FONTS.includes(f) ? f : fallback;
}

// Ljusar/mörkar en hex-färg (t ∈ [-1,1]).
export function shade(hex: string, t: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const p = (i: number) => {
    const cc = parseInt(h.slice(i, i + 2), 16);
    const v = t < 0 ? cc * (1 + t) : cc + (255 - cc) * t;
    return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  };
  return `#${p(0)}${p(2)}${p(4)}`;
}
