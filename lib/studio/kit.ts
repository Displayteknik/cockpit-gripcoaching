import { supabaseService } from "@/lib/supabase-admin";
import type { BrandColors } from "@/lib/studio/brand";
import { NEUTRAL_SIGNATURE, normalizeSignature, signaturePrompt, type BrandSignature } from "@/lib/studio/signature";

// Kit-direktiv för AI-genereringar (bild + copy) — så allt innehåll följer kundens
// grafiska profil. Läser studio_brand_kits per client_id (uuid). Tomma defaults = neutralt.
export interface KitDirectives {
  imageExtra: string; // STIL: färg och ljus, aldrig motivet
  imageNegative: string; // saker att undvika i bild
  /**
   * ★ KUNDENS EGNA MOTIVREGLER (Håkans beställning 15/8: "min kund ska själv kunna lägga
   * till regler för bildskapande, det är en styrka").
   *
   * ⚠ VARFÖR FÄLTET MÅSTE VARA SKILT FRÅN `imageExtra`, mätt 15/8: kryssrutan "Får
   *   innehålla människor" skrev "no people in the image" i imageExtra — som läggs i en
   *   mening som börjar "Visual treatment (applies to colour and light only, NEVER CHANGE
   *   THE SUBJECT…)". En motivregel inuti en mening som förbjuder motivändringar är ingen
   *   regel alls, och samtidigt delade personrotationen ut "en kvinna som tittar på
   *   skärmen". Kunden kryssade i rutan och ingenting hände.
   */
  imageMotiv: string;
  /** Tolkat värde, inte råfältet: agenten skriver ibland "ibland" i en boolesk ruta. */
  personer: "alltid" | "ibland" | "aldrig";
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
  imageMotiv: "",
  personer: "ibland",
  donts: [],
  colors: {},
  formats: [],
  signature: NEUTRAL_SIGNATURE,
};

/**
 * Tolkar fältet "människor i bilder" språkoberoende.
 *
 * ⚠ MÄTT 15/8: Annas Blommor har `people: "ibland"` i databasen — brand-kit-agenten skriver
 *   svenska värden i ett fält formuläret sätter som boolean. Koden jämförde `=== false`, så
 *   ett agentsvar som "nej" eller "aldrig" hade ignorerats TYST. Exakt samma familj som
 *   färgtonsbuggen (`fargTon`), som redan är rättad av samma skäl.
 */
export function tolkaPersoner(varde: unknown): "alltid" | "ibland" | "aldrig" {
  if (varde === false) return "aldrig";
  if (varde === true) return "ibland"; // "får innehålla människor" = tillåtet, inte påbjudet
  const v = String(varde ?? "").toLowerCase().trim();
  if (!v) return "ibland";
  if (/aldrig|never|nej|no|inga|utan/.test(v)) return "aldrig";
  if (/alltid|always|krav|ska/.test(v)) return "alltid";
  return "ibland";
}

/**
 * BILD-7c: normaliserar profilens färgtemperatur.
 *
 * Fältet är fritext i praktiken — brand-kit-agenten skriver svenska värden ("varm-naturlig",
 * "sval och ren") medan formuläret skriver warm/cool/neutral. Den gamla likhetsjämförelsen
 * mot exakt "warm" gjorde att en tenant med "varm-naturlig" tyst tappade sin färgton och fick
 * en avmättad bild. Tolkningen är därför språkoberoende och gäller alla tenants.
 */
export function fargTon(varde: unknown): "warm" | "cool" | "" {
  const v = String(varde ?? "").toLowerCase();
  if (!v || /neutral/.test(v)) return "";
  if (/varm|warm|gyllen|golden|amber|solig/.test(v)) return "warm";
  if (/kall|sval|cool|cold|blå|blue|crisp/.test(v)) return "cool";
  return "";
}

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
    // BILD-7c: färgtemperaturen ur den grafiska profilen ska SYNAS i bilden. "warm
    // color grade" var för svagt — signaturens behandling ("muted desaturated palette")
    // stod senare i samma mening och vann, och varma varumärken fick avmättade bilder.
    // Raden säger nu vad tonen betyder konkret och att den går före en neutral/dämpad
    // behandling. Fortfarande bara färg och ljus — aldrig motivet.
    const grade = fargTon(im.colorGrade);
    if (grade === "warm") {
      parts.push("warm colour temperature throughout: golden sunlit light, warm skin tones, amber highlights — never desaturated, never washed out (this colour temperature takes precedence over any neutral or muted treatment)");
    } else if (grade === "cool") {
      parts.push("cool colour temperature throughout: crisp blue-grey daylight, clean cool highlights — never yellow or muddy (this colour temperature takes precedence over any neutral or muted treatment)");
    }
    // MOTIVREGLERNA byggs för sig — de får INTE hamna bland stilraderna ovan, som är
    // avgränsade till färg och ljus. Se kommentaren vid `imageMotiv`.
    const personer = tolkaPersoner(im.people);
    const motiv: string[] = [];
    if (personer === "aldrig") motiv.push("no people at all in the picture: build it around the room, the product, the light and the traces of work");
    if (personer === "alltid") motiv.push("there must be at least one real person in the picture, engaged in what the post is about");
    if (im.motiv) motiv.push(String(im.motiv));
    const cp = (kit.contentProfile || {}) as Record<string, any>;
    return {
      imageExtra: parts.join(", "),
      imageNegative: [sig.negativ, im.negative ? String(im.negative) : ""].filter(Boolean).join(", "),
      imageMotiv: motiv.join(". "),
      personer,
      donts: Array.isArray(kit.donts) ? kit.donts.map(String) : [],
      colors: (kit.colors || {}) as Partial<BrandColors>,
      formats: Array.isArray(cp.formats) ? cp.formats.map(String) : [],
      signature,
    };
  } catch {
    return NEUTRAL_DIRECTIVES;
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
  // Kundens egna motivregler ligger SIST och säger uttryckligen att de väger tyngst. De
  // står utanför stilmeningen — den förbjuder motivändringar, och det här ÄR motivregler.
  const motiv = d.imageMotiv
    ? ` THE CUSTOMER'S OWN IMAGE RULES, these override the guidance above where they conflict: ${d.imageMotiv}.`
    : "";
  const undvik = d.imageNegative ? ` Avoid: ${d.imageNegative}.` : "";
  return `${stil}${motiv}${undvik}`;
}

// Bygger en regel-rad för copy-generering ur donts.
export function dontsRule(donts: string[]): string {
  return donts.length ? `\nKUNDENS VILL-INTE-HA (följ strikt): ${donts.join("; ")}.` : "";
}
