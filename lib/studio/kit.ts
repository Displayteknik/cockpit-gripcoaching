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

/**
 * Prompt-tillägget för bildgenerering. Stilen läggs SIST och är uttryckligen begränsad
 * till färg och ljusbehandling.
 *
 * Utan den avgränsningen tar stilen över motivet: en signatur som nämnde "dusk lighting"
 * gjorde varje bild till en nattbild, även när scenens text sa att butiken hade öppet.
 * Motivet bestäms av budskapet, stilen bestämmer bara hur det ser ut.
 */
export function imageDirectiveSuffix(d: KitDirectives): string {
  const bits: string[] = [];
  if (d.imageExtra) bits.push(d.imageExtra);
  const stil = bits.length
    ? ` Visual treatment (applies to colour and light only, never change the subject, the setting or the time of day described above): ${bits.join(". ")}.`
    : "";
  const undvik = d.imageNegative ? ` Avoid: ${d.imageNegative}.` : "";
  return `${stil}${undvik}`;
}

// Bygger en regel-rad för copy-generering ur donts.
export function dontsRule(donts: string[]): string {
  return donts.length ? `\nKUNDENS VILL-INTE-HA (följ strikt): ${donts.join("; ")}.` : "";
}
