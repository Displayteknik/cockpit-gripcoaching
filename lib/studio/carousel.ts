// Studio — karusell-generator. Skapar en sammanhållen slide-serie (hook → punkter → cta)
// grundad i varumärkesröst (getProfileAsMarkdown) + hook-playbook + kit-donts.
// Deterministisk render sker i ArkKarusell; AI rör bara text (aldrig layout).

import { generateWithUsage } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { hamtaNyligen } from "@/lib/rotation";
import type { CompassParams } from "@/lib/content-compass/prompt";
import type { StudioSlide } from "@/lib/studio/payload";
import { MAX_SLIDES } from "@/lib/studio/payload";
import { karusellAnatomiText, karusellRoller, type KarusellUppsattning } from "@/lib/format-anatomi";

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Antal PUNKT-slides (utöver hook + cta). points=3 → 5 slides totalt.
// TEXT-1 T-2: opts.compass är nu Compass-parametrar (inte ett färdigrenderat block) —
// prompt-core bygger anatomi/compass-lagret, precis som röst, profil och kit-donts.
/**
 * G-1c: `generationId` följer med ut. Utan den kan ingen svara på om texten som
 * genererades faktiskt blev ett inlägg — och en mätning som bara ser genereringar,
 * aldrig utfall, kan inte skilja en bra promptversion från en som producerar skräp
 * användaren kastar.
 */
export interface KarusellResultat {
  slides: StudioSlide[];
  generationId: string | null;
}

export async function generateCarousel(opts: {
  clientId: string; topic: string; points?: number; brandName?: string; industry?: string; compass?: CompassParams;
  /**
   * FIX-1-REST (Håkans beslut 9/8): INSATS är PÅ som standard — den behöver ingen data
   * och fullbordar formeln (krok lovar, insatsen säger varför det spelar roll).
   *
   * G-4: BEVIS är inte längre hårt av — men inte heller hårt på. Den slås på när
   * tenanten FAKTISKT har verifierat material (lib/bevis), annars inte. Skälet står
   * kvar ordagrant: en bevis-slide utan bevis är en inbjudan att fabricera. Skillnaden
   * är att frågan nu går att ställa. Ett uttryckligt `medBevis` från anroparen vinner
   * över automatiken i BÅDA riktningarna.
   */
  medInsats?: boolean; medBevis?: boolean;
}): Promise<KarusellResultat> {
  const points = Math.min(Math.max(2, opts.points ?? 3), MAX_SLIDES - 2);
  const brand = opts.brandName || "kunden";

  // G-2: anatomin ligger som DATA i lib/format-anatomi, inte som fritext här. Ändras en
  // roll slår det igenom i prompten, i slide-räkningen och i JSON-schemat samtidigt —
  // tidigare kunde de tre glida isär utan att någon märkte det.
  // G-4: har tenanten något att belägga med? Frågan ställs FÖRE rollistan byggs, för
  // att svaret avgör om bevis-sliden finns över huvud taget.
  const { hamtaBevis } = await import("@/lib/bevis");
  const bevis = await hamtaBevis(opts.clientId);

  const uppsattning: KarusellUppsattning = {
    punkter: points,
    medInsats: opts.medInsats !== false,
    // Anroparens uttryckliga val vinner; annars styr materialet.
    medBevis: opts.medBevis ?? bevis.kanKravaBevis,
  };
  const roller = karusellRoller(uppsattning);

  const uppdrag = [
    `Du skriver en Instagram-karusell för ${brand}${opts.industry ? ` (${opts.industry})` : ""}. En sammanhållen serie som hänger ihop från första till sista sliden.`,
    "\n" + karusellAnatomiText(uppsattning),
    "\n=== REGLER ===",
    "- FÖRBJUDET: emoji, symboler, hashtags, URL, telefonnummer, punktlistor inuti ett fält.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt. Skriv som människa.`,
  ].join("\n");

  // G-3d (rotation): karusellens ingång är krok-slidens rubrik. Utan den här raden var
  // rotationsregeln en uppmaning utan underlag — prompten sa "upprepa inte samma vinkel"
  // och fick aldrig veta vilka vinklar som redan gått ut.
  const nyligen = await hamtaNyligen(opts.clientId, "karusell");

  const b = await byggTextPrompt({
    clientId: opts.clientId,
    syfte: "karusell",
    kanal: "instagram",
    uppdrag,
    underlag: `Ämne/vinkel: ${opts.topic}\n\nSkriv karusellen nu (${roller.length} slides i ordningen ${roller.join(" → ")}).`,
    compass: opts.compass,
    knowledge: ["hook-playbook"],
    nyligen,
    // Schemat byggs ur SAMMA rollista som anatomin. Förut räknades slides på tre ställen
    // med tre uttryck — nu kan de inte säga olika saker.
    jsonSchema: `[${roller.map((r) => `{"kind":"${r}","headline":"...","body":"..."}`).join(",")}]`,
  });

  // generateWithUsage i stället för generate: det är den enda vägen som lämnar tillbaka
  // generations-id:t (G-1c). Anropet är i övrigt identiskt.
  const svar = await generateWithUsage({
    model: "gemini-2.5-flash",
    systemInstruction: b.system,
    prompt: b.user,
    temperature: 0.8,
    maxOutputTokens: 2200,
    jsonMode: true,
    skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    // G-1: karusell är ett EGET format i loggen, inte bildstorleken den råkar ha.
    // G0 0.4 punkt 2: karusell och statisk bild blev samma rad eftersom formatet
    // härleddes ur URL:en — då gick de inte att jämföra.
    generering: {
      syfte: "karusell",
      format: "karusell",
      promptVersion: b.meta.promptVersion,
      funnel: b.meta.funnel,
      lager: b.meta.lager,
      varianter: roller.length, // samma räkning som anatomin och schemat använder
    },
  });
  const raw = svar.text;
  const generationId = svar.generationId ?? null;
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : []; }
  if (!Array.isArray(arr)) return { slides: [], generationId };

  // TEXT-1: enhetlig sanering — karusellen saknade sanering helt före migreringen.
  const slides = await Promise.all(
    arr
      .map((v: Record<string, unknown>): StudioSlide => {
        const k = str(v.kind);
        // ⚠ G-2, medveten gräns: payloadens slide-typ har tre roller (hook/point/cta) och
        // mallarna ritar tre. Insats och bevis styr alltså DRAMATURGIN i prompten men
        // landar som "point" i datan. Att införa dem som egna slide-typer kräver att
        // ArkKarusell, slide-merge och punktNummer ritar och räknar dem — eget steg.
        const kind: StudioSlide["kind"] = k === "hook" || k === "cta" ? k : "point";
        return { kind, headline: str(v.headline), body: str(v.body), imageUrl: "" };
      })
      .filter((s) => s.headline)
      .slice(0, MAX_SLIDES)
      .map(async (s) => ({
        ...s,
        headline: await saneraText(s.headline, opts.clientId, "instagram"),
        body: await saneraText(s.body, opts.clientId, "instagram"),
      })),
  );

  return { slides, generationId };
}
