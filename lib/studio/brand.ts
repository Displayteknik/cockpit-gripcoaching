import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

// Studio — laddar kundens brand.json (exakta hex, typsnitt, fot-texter, asset-paths).
// Server-side only (läser filsystemet). Källa: clients/<slug>/brand.json.

export interface StudioBrand {
  clientId: string;
  name: string;
  colors: {
    greenDark: string;
    greenDeep: string;
    greenLight: string;
    mint: string;
    yellow: string;
    black: string;
    white: string;
  };
  fonts: {
    headline: string;
    body: string;
    logo: string;
  };
  footer: {
    tagline: string;
    address: string;
    bookingLabel: string;
    bookingUrl: string;
  };
  assets: {
    logo: string;
    zeiss: string;
    brush?: string; // legacy — penselrutan ritas numera som färgbar vektor (BrushBox)
    qr: string;
    footer?: string; // valfri exakt fot-crop ur kundens egen bild → 100% trogen fot
  };
}

export async function loadBrand(slug: string): Promise<StudioBrand> {
  const safeSlug = slug.replace(/[^a-z0-9_-]/gi, ""); // path-traversal-skydd
  const file = path.join(process.cwd(), "clients", safeSlug, "brand.json");

  let brand: StudioBrand;
  try {
    brand = JSON.parse(await fs.readFile(file, "utf8")) as StudioBrand;
  } catch {
    // Ingen brand.json → bygg en neutral brand från clients-tabellen (multi-klient).
    brand = await fallbackBrand(safeSlug);
  }

  // 100%-läge: om en exakt fot-crop finns (public/clients/<slug>/footer.png) används den
  // rakt av istället för den kod-byggda foten. Zero-config — droppa bara filen.
  if (!brand.assets.footer) {
    const footerPng = path.join(process.cwd(), "public", "clients", safeSlug, "footer.png");
    if (existsSync(footerPng)) brand.assets.footer = `/clients/${safeSlug}/footer.png`;
  }
  return brand;
}

// Neutral fallback-brand från clients-tabellen (namn + primary_color) för klienter
// utan egen brand.json. Låter Studio-mallar fungera för alla klienter, inte bara Opticur.
async function fallbackBrand(slug: string): Promise<StudioBrand> {
  let name = slug;
  let primary = "#1A6B3C";
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await sb.from("clients").select("name, primary_color").eq("slug", slug).maybeSingle();
    if (data?.name) name = data.name;
    if (data?.primary_color) primary = data.primary_color;
  } catch { /* defaults */ }

  return {
    clientId: slug,
    name,
    colors: {
      greenDark: primary,
      greenDeep: shade(primary, -0.25),
      greenLight: shade(primary, 0.35),
      mint: "#7ECECA",
      yellow: "#F2B01E",
      black: "#1A1A1A",
      white: "#FFFFFF",
    },
    fonts: { headline: "Inter", body: "Inter", logo: "Playfair Display" },
    footer: { tagline: "", address: "", bookingLabel: "", bookingUrl: "" },
    assets: { logo: "", zeiss: "", qr: "" },
  };
}

// Ljusar/mörkar en hex-färg (t ∈ [-1,1]).
function shade(hex: string, t: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const p = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    const v = t < 0 ? c * (1 + t) : c + (255 - c) * t;
    return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  };
  return `#${p(0)}${p(2)}${p(4)}`;
}
