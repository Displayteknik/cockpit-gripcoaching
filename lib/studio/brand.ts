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
  const raw = await fs.readFile(file, "utf8");
  const brand = JSON.parse(raw) as StudioBrand;

  // 100%-läge: om en exakt fot-crop finns (public/clients/<slug>/footer.png) används den
  // rakt av istället för den kod-byggda foten. Zero-config — droppa bara filen.
  if (!brand.assets.footer) {
    const footerPng = path.join(process.cwd(), "public", "clients", safeSlug, "footer.png");
    if (existsSync(footerPng)) brand.assets.footer = `/clients/${safeSlug}/footer.png`;
  }
  return brand;
}
