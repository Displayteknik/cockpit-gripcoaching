// Studio — karusell-generator. Skapar en sammanhållen slide-serie (hook → punkter → cta)
// grundad i varumärkesröst (getProfileAsMarkdown) + hook-playbook + kit-donts.
// Deterministisk render sker i ArkKarusell; AI rör bara text (aldrig layout).

import { generate } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import type { CompassParams } from "@/lib/content-compass/prompt";
import type { StudioSlide } from "@/lib/studio/payload";
import { MAX_SLIDES } from "@/lib/studio/payload";

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Antal PUNKT-slides (utöver hook + cta). points=3 → 5 slides totalt.
// TEXT-1 T-2: opts.compass är nu Compass-parametrar (inte ett färdigrenderat block) —
// prompt-core bygger anatomi/compass-lagret, precis som röst, profil och kit-donts.
export async function generateCarousel(opts: {
  clientId: string; topic: string; points?: number; brandName?: string; industry?: string; compass?: CompassParams;
}): Promise<StudioSlide[]> {
  const points = Math.min(Math.max(2, opts.points ?? 3), MAX_SLIDES - 2);
  const brand = opts.brandName || "kunden";

  const uppdrag = [
    `Du skriver en Instagram-karusell för ${brand}${opts.industry ? ` (${opts.industry})` : ""}. En sammanhållen serie: en KROK som stoppar scrollen, ${points} innehållspunkter som ger konkret värde, och ett AVSLUT med uppmaning.`,
    "\n=== REGLER ===",
    "- hook.headline: krok, MAX ~34 tecken, hel fras (aldrig fragment). hook.body: kort löfte, MAX ~70 tecken.",
    "- point.headline: punktens kärna, MAX ~34 tecken. point.body: 1–2 meningar, MAX ~120 tecken, konkret och användbart.",
    "- cta.headline: mjuk uppmaning/fråga, MAX ~40 tecken. cta.body: nästa steg, MAX ~90 tecken.",
    "- Bygg en logisk båge: kroken lovar, punkterna levererar, avslutet leder vidare.",
    "- FÖRBJUDET: emoji, symboler, hashtags, URL, telefonnummer, punktlistor inuti ett fält.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt. Skriv som människa.`,
  ].join("\n");

  const b = await byggTextPrompt({
    clientId: opts.clientId,
    syfte: "karusell",
    kanal: "instagram",
    uppdrag,
    underlag: `Ämne/vinkel: ${opts.topic}\n\nSkriv karusellen nu (${points + 2} slides: 1 hook, ${points} point, 1 cta).`,
    compass: opts.compass,
    knowledge: ["hook-playbook"],
    jsonSchema: `[{"kind":"hook","headline":"...","body":"..."},${Array.from({ length: points }).map(() => '{"kind":"point","headline":"...","body":"..."}').join(",")},{"kind":"cta","headline":"...","body":"..."}]`,
  });

  const raw = await generate({
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
      varianter: points + 2, // hook + punkter + cta = antal slides anropet ska ge
    },
  });
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : []; }
  if (!Array.isArray(arr)) return [];

  // TEXT-1: enhetlig sanering — karusellen saknade sanering helt före migreringen.
  const slides = await Promise.all(
    arr
      .map((v: Record<string, unknown>): StudioSlide => {
        const k = str(v.kind);
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

  return slides;
}
