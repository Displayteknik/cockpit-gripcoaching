import { NextRequest, NextResponse } from "next/server";
import { generate, generateJSON } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stödjer flera lägen:
// mode=section → fyll i/förbättra en enskild sektion (field)
// mode=icp → kör ICP-wizard baserat på korta svar
// mode=tone → bygg tonregler utifrån exempelmeningar
interface AssistBody {
  mode: "section" | "icp" | "tone";
  field?: string;
  current?: string;
  context?: Record<string, string>;
  inputs?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssistBody;

    if (body.mode === "icp") {
      const inputs = body.inputs || {};
      const system = `Du är en konverteringsstrateg som bygger ICP (Ideal Customer Profile) för lokala småföretag. Skriv rakt, konkret, utan AI-språk. Svenska.

ANVÄND INTE: "handlar om", "kraftfull", "nästa nivå", "holistisk", "banbrytande".

Svara med JSON:
{
  "primary": "3–5 stycken — namn på segment, demografi, geografi, smärtpunkter, köpbeteende, var de hänger, triggers som får dem att köpa. Skriv som prosa med korta rader.",
  "secondary": "2–3 stycken — sekundärt segment i samma format.",
  "pain_points": "5–7 punkter med streck (-) framför varje. Formulerade som kunden själv skulle säga det.",
  "hashtags_base": "10–15 relevanta hashtags separerade med mellanslag."
}`;

      const prompt = `Företag: ${inputs.company_name || ""}
Bransch: ${inputs.industry || ""}
Plats: ${inputs.location || ""}
Vad säljer de: ${inputs.offer || ""}
Vem köper mest idag: ${inputs.current_buyers || ""}
Vem skulle de gärna sälja mer till: ${inputs.dream_buyers || ""}
Prisklass: ${inputs.price_range || ""}
Extra info: ${inputs.extra || ""}

Bygg ICP nu.`;

      const result = await generateJSON<{
        primary: string;
        secondary: string;
        pain_points: string;
        hashtags_base: string;
      }>({
        model: "gemini-2.5-pro",
        systemInstruction: system,
        prompt,
        temperature: 0.7,
      });
      return NextResponse.json(result);
    }

    if (body.mode === "tone") {
      const inputs = body.inputs || {};
      const system = `Du analyserar tonen i exempeltexter och skriver konkreta tonregler. Svenska. Raka punkter.

Svara med ren text — 6–10 regler som punktlista med (-) framför varje. Inkludera både "GÖR" och "GÖR INTE". Referera till konkreta ord eller meningsstrukturer från exemplen.`;

      const prompt = `Företag: ${inputs.company_name || ""}
Exempeltexter (så låter de när de är som bäst):
${inputs.examples || ""}

Ord de HATAR eller undviker:
${inputs.avoid || "(inga angivna)"}

Skriv tonreglerna nu.`;

      const text = await generate({
        model: "gemini-2.5-pro",
        systemInstruction: system,
        prompt,
        temperature: 0.6,
      });
      return NextResponse.json({ tone_rules: text });
    }

    // default: section assist
    const { field, current, context } = body;
    const ctxStr = context
      ? Object.entries(context).map(([k, v]) => `${k}: ${v}`).join("\n")
      : "";

    const system = `Du hjälper till att fylla i en brand-profil för ett företag. Svara RAKT och KONKRET, utan AI-språk ("handlar om", "kraftfull", "nästa nivå" etc). Svenska.

Du får veta vilket fält som fylls i, befintligt värde (eventuellt stickord), och kontexten kring företaget. Skriv ett bättre/färdigt innehåll som passar fältet. Ingen förklaring — bara själva innehållet.`;

    const prompt = `FÄLT: ${field}
NUVARANDE INNEHÅLL / STICKORD: ${current || "(tomt)"}
FÖRETAGSKONTEXT:
${ctxStr}

Skriv förbättrat innehåll för fältet "${field}" nu.`;

    const text = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt,
      temperature: 0.7,
    });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
