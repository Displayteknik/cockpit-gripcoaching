// Offertmotorn — deterministiskt underlag som läggs till AI:ns prompt innan den räknar.
//
// Två saker får modellen ALDRIG gissa: valutakursen och marknadsläget. Kursen hämtas därför
// live från Riksbanken och skrivs in färdigräknad, och marknadsbilden hämtas med sökgrundad
// generering och följer med som citerade källor. Går något av det inte att hämta skrivs det
// ut som saknat — en påhittad kurs är värre än ingen kurs.

import { calcRate, fxVarning, getRatesToSEK, type FxRates } from "./fx";
import { groundedGenerate } from "@/lib/gemini";

const VALUTOR = ["USD", "EUR", "CNY"] as const;

function tal(n: number, dec = 4): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Färdigräknad kalkylkurs per valuta, som text i prompten. Spot och buffert var för sig. */
export function fxBlock(fx: FxRates): string {
  const rader = VALUTOR.filter((cur) => fx.rates[cur]).map((cur) => {
    const spot = fx.rates[cur];
    return `${cur}: spotkurs ${tal(spot)} SEK. Kalkylkurs att räkna med (spot × ${fx.buffer}) = ${tal(calcRate(fx.rates, cur, fx.buffer))} SEK. Buffert ${tal((calcRate(fx.rates, cur, fx.buffer) - spot) * 100, 0)} öre.`;
  });
  const varning = fxVarning(fx);
  return [
    "=== VALUTAKURS (hämtad live från Riksbanken, använd exakt dessa tal) ===",
    `Noteringsdatum: ${fx.date || "okänt"}${fx.alderDagar != null ? ` (${fx.alderDagar} dygn gammalt)` : ""}`,
    ...rader,
    varning ? `VARNING: ${varning}` : "",
    "Räkna ALDRIG med en egen kurs. Skriv alltid ut vilken kurs och vilket datum du räknat med.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Sökfråga till marknadskollen, byggd på produkterna i affären. Tom sträng = hoppa över. */
export function marknadsFraga(produkter: string, kund?: string): string {
  const rent = produkter
    .split("\n")
    .map((r) => r.replace(/^[-*]\s*/, "").split("·")[0].trim())
    .filter((r) => r && !/^landad kostnad/i.test(r))
    .slice(0, 4)
    .join(", ");
  if (!rent) return "";
  return `marknadspris i Sverige ${new Date().getFullYear()} för: ${rent}${kund ? ` (kund: ${kund})` : ""}`;
}

export interface Marknadsunderlag {
  text: string;
  kallor: { title: string; uri: string }[];
  fel: string | null;
}

/** Marknadsbild via sökgrundad generering. Kastar aldrig — fel returneras som text. */
export async function hamtaMarknad(fraga: string, tenantId?: string | null): Promise<Marknadsunderlag> {
  if (!fraga) return { text: "", kallor: [], fel: "Ingen produkt att söka på." };
  try {
    const prompt = `Ge en marknads- och prisbild på svenska för: "${fraga}".
Svara i 4 till 6 punkter: typiskt prisspann i Sverige idag med siffror, vilka leverantörer eller kedjor som sätter nivån, vad som driver priset upp eller ner just nu, och vad en köpare typiskt jämför med. Ange årtal eller datum för varje prisuppgift. Är en siffra osäker, skriv att den är osäker i stället för att avrunda till något som låter bra.`;
    const { text, sources } = await groundedGenerate(prompt, { maxOutputTokens: 1200, flow: "offert-marknad", tenantId });
    if (!text) return { text: "", kallor: [], fel: "Marknadskollen gav tomt svar." };
    return { text, kallor: sources ?? [], fel: null };
  } catch (e) {
    return { text: "", kallor: [], fel: (e as Error).message };
  }
}

export function marknadsBlock(m: Marknadsunderlag): string {
  if (m.fel || !m.text) {
    return `=== MARKNADSBILD ===\nKunde inte hämtas: ${m.fel || "okänt fel"}. Skriv i marknadsanalysen att underlaget saknas. Hitta ALDRIG på marknadspriser.`;
  }
  const kallor = m.kallor.slice(0, 6).map((k) => `- ${k.title}: ${k.uri}`);
  return [
    "=== MARKNADSBILD (sökgrundad, hämtad nu) ===",
    m.text,
    kallor.length ? `\nKällor:\n${kallor.join("\n")}` : "",
    "\nSiffror härifrån är webbfynd, inte offerter. Skriv ut osäkerheten och ange källa när du lutar dig mot dem.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Hela det deterministiska underlaget för en offertkörning. */
export async function byggOffertunderlag(
  inputs: Record<string, string>,
  tenantId?: string | null,
): Promise<{ block: string; fxVarning: string | null }> {
  const fx = await getRatesToSEK();
  const marknad = await hamtaMarknad(marknadsFraga(inputs.produkter ?? "", inputs.kund), tenantId);
  return {
    block: `\n\n${fxBlock(fx)}\n\n${marknadsBlock(marknad)}`,
    fxVarning: fxVarning(fx),
  };
}
