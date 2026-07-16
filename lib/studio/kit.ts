import { supabaseService } from "@/lib/supabase-admin";
import type { BrandColors } from "@/lib/studio/brand";

// Kit-direktiv för AI-genereringar (bild + copy) — så allt innehåll följer kundens
// grafiska profil. Läser studio_brand_kits per client_id (uuid). Tomma defaults = neutralt.
export interface KitDirectives {
  imageExtra: string; // vävs in i bildprompt
  imageNegative: string; // saker att undvika i bild
  donts: string[]; // hårda regler för copy
  colors: Partial<BrandColors>; // roll-färger (för UI-swatches m.m.)
  formats: string[]; // contentProfile.formats (tom = alla)
}

export async function getKitDirectives(clientId: string): Promise<KitDirectives> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    const kit = (data?.kit || {}) as Record<string, any>;
    const im = (kit.imageStyle || {}) as Record<string, any>;
    const parts: string[] = [];
    if (im.mode === "illustration") parts.push("clean vector illustration, not a photo");
    else if (im.mode === "mixed") parts.push("photo or illustration");
    if (im.prompt) parts.push(String(im.prompt));
    if (im.colorGrade === "warm") parts.push("warm color grade");
    else if (im.colorGrade === "cool") parts.push("cool color grade");
    if (im.people === false) parts.push("no people in the image");
    const cp = (kit.contentProfile || {}) as Record<string, any>;
    return {
      imageExtra: parts.join(", "),
      imageNegative: im.negative ? String(im.negative) : "",
      donts: Array.isArray(kit.donts) ? kit.donts.map(String) : [],
      colors: (kit.colors || {}) as Partial<BrandColors>,
      formats: Array.isArray(cp.formats) ? cp.formats.map(String) : [],
    };
  } catch {
    return { imageExtra: "", imageNegative: "", donts: [], colors: {}, formats: [] };
  }
}

// Bygger ett prompt-tillägg för bildgenerering ur direktiven.
export function imageDirectiveSuffix(d: KitDirectives): string {
  const bits: string[] = [];
  if (d.imageExtra) bits.push(d.imageExtra);
  if (d.imageNegative) bits.push(`Avoid: ${d.imageNegative}`);
  return bits.length ? ` Bildstil: ${bits.join(". ")}.` : "";
}

// Bygger en regel-rad för copy-generering ur donts.
export function dontsRule(donts: string[]): string {
  return donts.length ? `\nKUNDENS VILL-INTE-HA (följ strikt): ${donts.join("; ")}.` : "";
}
