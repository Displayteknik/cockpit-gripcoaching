import { supabaseService } from "@/lib/supabase-admin";
import type { BrandColors } from "@/lib/studio/brand";
import { NEUTRAL_SIGNATURE, normalizeSignature, signaturePrompt, type BrandSignature } from "@/lib/studio/signature";

// Kit-direktiv för AI-genereringar (bild + copy) — så allt innehåll följer kundens
// grafiska profil. Läser studio_brand_kits per client_id (uuid). Tomma defaults = neutralt.
export interface KitDirectives {
  imageExtra: string; // vävs in i bildprompt
  imageNegative: string; // saker att undvika i bild
  donts: string[]; // hårda regler för copy
  colors: Partial<BrandColors>; // roll-färger (för UI-swatches m.m.)
  formats: string[]; // contentProfile.formats (tom = alla)
  signature: BrandSignature; // S1 — signaturstilen, alltid ifylld (neutral när avstängd)
}

/**
 * Delad fallback. Använd den i stället för att skriva ett eget tomt objekt i varje
 * .catch() — annars måste sex anropare ändras varje gång KitDirectives får ett fält.
 */
export const NEUTRAL_DIRECTIVES: KitDirectives = {
  imageExtra: "",
  imageNegative: "",
  donts: [],
  colors: {},
  formats: [],
  signature: NEUTRAL_SIGNATURE,
};

export async function getKitDirectives(clientId: string): Promise<KitDirectives> {
  try {
    const sb = supabaseService();
    const { data } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
    const kit = (data?.kit || {}) as Record<string, any>;
    const im = (kit.imageStyle || {}) as Record<string, any>;
    const signature = normalizeSignature(kit.signature);
    const sig = signaturePrompt(signature);
    const parts: string[] = [];
    // S1: signaturen ligger FÖRST så den väger tyngst i prompten. Den är en regel,
    // inte ett förslag, och ska genomsyra varje bild tenanten genererar.
    if (sig.extra) parts.push(sig.extra);
    if (im.mode === "illustration") parts.push("clean vector illustration, not a photo");
    else if (im.mode === "mixed") parts.push("photo or illustration");
    if (im.prompt) parts.push(String(im.prompt));
    if (im.colorGrade === "warm") parts.push("warm color grade");
    else if (im.colorGrade === "cool") parts.push("cool color grade");
    if (im.people === false) parts.push("no people in the image");
    const cp = (kit.contentProfile || {}) as Record<string, any>;
    return {
      imageExtra: parts.join(", "),
      imageNegative: [sig.negativ, im.negative ? String(im.negative) : ""].filter(Boolean).join(", "),
      donts: Array.isArray(kit.donts) ? kit.donts.map(String) : [],
      colors: (kit.colors || {}) as Partial<BrandColors>,
      formats: Array.isArray(cp.formats) ? cp.formats.map(String) : [],
      signature,
    };
  } catch {
    return { imageExtra: "", imageNegative: "", donts: [], colors: {}, formats: [], signature: NEUTRAL_SIGNATURE };
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
