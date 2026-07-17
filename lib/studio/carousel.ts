// Studio — karusell-generator. Skapar en sammanhållen slide-serie (hook → punkter → cta)
// grundad i varumärkesröst (getProfileAsMarkdown) + hook-playbook + kit-donts.
// Deterministisk render sker i ArkKarusell; AI rör bara text (aldrig layout).

import { generate } from "@/lib/gemini";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
import type { StudioSlide } from "@/lib/studio/payload";
import { MAX_SLIDES } from "@/lib/studio/payload";

const FORBIDDEN = ["kraftfull", "banbrytande", "game-changer", "handlar om", "nästa nivå", "holistisk", "skalbar"];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Antal PUNKT-slides (utöver hook + cta). points=3 → 5 slides totalt.
export async function generateCarousel(opts: {
  clientId: string; topic: string; points?: number; brandName?: string; industry?: string;
}): Promise<StudioSlide[]> {
  const points = Math.min(Math.max(2, opts.points ?? 3), MAX_SLIDES - 2);
  const [playbook, profile, directives] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    getProfileAsMarkdown().catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => ({ imageExtra: "", imageNegative: "", donts: [] as string[], colors: {}, formats: [] as string[] })),
  ]);
  const brand = opts.brandName || "kunden";

  const system = [
    `Du skriver en Instagram-karusell för ${brand}${opts.industry ? ` (${opts.industry})` : ""}. En sammanhållen serie: en KROK som stoppar scrollen, ${points} innehållspunkter som ger konkret värde, och ett AVSLUT med uppmaning.`,
    playbook ? `\n=== HOOK-PLAYBOOK (grunda kroken på detta) ===\n${playbook.slice(0, 2500)}` : "",
    dontsRule(directives.donts),
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst/målgrupp/ord på denna ===\n${profile.slice(0, 3500)}` : "",
    "\n=== REGLER ===",
    "- hook.headline: krok, MAX ~34 tecken, hel fras (aldrig fragment). hook.body: kort löfte, MAX ~70 tecken.",
    "- point.headline: punktens kärna, MAX ~34 tecken. point.body: 1–2 meningar, MAX ~120 tecken, konkret och användbart.",
    "- cta.headline: mjuk uppmaning/fråga, MAX ~40 tecken. cta.body: nästa steg, MAX ~90 tecken.",
    "- Bygg en logisk båge: kroken lovar, punkterna levererar, avslutet leder vidare.",
    "- FÖRBJUDET: emoji, symboler, hashtags, URL, telefonnummer, punktlistor inuti ett fält.",
    `- FÖRBJUDNA ord: ${FORBIDDEN.join(", ")}. Svenska tecken å/ä/ö korrekt. Skriv som människa.`,
    "\n=== SVAR: ENDAST strikt JSON-array (inga kodstaket), exakt denna ordning ===",
    `[{"kind":"hook","headline":"...","body":"..."},${Array.from({ length: points }).map(() => '{"kind":"point","headline":"...","body":"..."}').join(",")},{"kind":"cta","headline":"...","body":"..."}]`,
  ].join("\n");

  const prompt = `Ämne/vinkel: ${opts.topic}\n\nSkriv karusellen nu (${points + 2} slides: 1 hook, ${points} point, 1 cta).`;

  const raw = await generate({ model: "gemini-2.5-flash", systemInstruction: system, prompt, temperature: 0.8, maxOutputTokens: 2200, jsonMode: true });
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { const m = raw.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : []; }
  if (!Array.isArray(arr)) return [];

  const slides = arr
    .map((v: Record<string, unknown>): StudioSlide => {
      const k = str(v.kind);
      const kind: StudioSlide["kind"] = k === "hook" || k === "cta" ? k : "point";
      return { kind, headline: str(v.headline), body: str(v.body), imageUrl: "" };
    })
    .filter((s) => s.headline)
    .slice(0, MAX_SLIDES);

  return slides;
}
