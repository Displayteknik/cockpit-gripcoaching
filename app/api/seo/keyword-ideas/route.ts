import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sökords-förslag: läser kundens verksamhets-profil och föreslår VAD de ska ranka på.
// Löser "jag vet inte vad jag ska synas för" — steget innan PAA (som kräver ett startord).
interface KeywordIdeas {
  groups: {
    title: string; // klarspråks-rubrik, t.ex. "Folk som är redo att köpa"
    note: string; // 1 mening om vad gruppen är bra för
    keywords: { keyword: string; why: string; intent: string }[];
  }[];
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const focus: string = (await req.json().catch(() => ({})))?.focus || "";
  const profile = await getProfileAsMarkdown();

  if (!profile && !focus.trim()) {
    return NextResponse.json(
      { error: "Vi saknar info om verksamheten. Skriv kort vad ni gör i fältet ovan, så föreslår vi sökord." },
      { status: 400 },
    );
  }

  const system = `Du är en svensk SEO-rådgivare som hjälper en företagare hitta vilka sökord de ska synas på i Google.

Du får företagets profil nedan. Föreslå sökord som RIKTIGA svenska kunder faktiskt söker på när de letar efter det företaget erbjuder — inte interna facktermer.

VIKTIGT:
- Skriv i KLARSPRÅK. Inga förkortningar (AEO, SERP, CTR) och ingen jargong.
- Tänk på hur en vanlig kund formulerar sig, inte hur branschen pratar.
- Variera mellan korta sökord och längre, mer specifika fraser.
- Ta med lokala varianter om orten är känd.
- Hitta ALDRIG på siffror om sökvolym.

FÖRETAGETS PROFIL:
${profile || "(profil saknas — utgå från användarens beskrivning)"}
${focus.trim() ? `\nANVÄNDAREN VILL SÄRSKILT SYNAS FÖR: ${focus.trim()}` : ""}

RETURNERA JSON (svenska):
{
  "groups": [
    {
      "title": "Klarspråks-rubrik för gruppen",
      "note": "En mening om vad sökorden i gruppen är bra för",
      "keywords": [
        { "keyword": "sökordet som en kund skriver", "why": "kort varför detta är värt att synas på", "intent": "köp|jämför|info|lokalt" }
      ]
    }
  ]
}

Skapa 3 grupper:
1. "Redo att köpa / boka" — kunder i beslutsläge.
2. "Jämför och funderar" — kunder som väger alternativ.
3. "Söker svar / lär sig" — kunder tidigt i resan (bra för att bygga förtroende).
Ge 4–7 sökord per grupp.`;

  try {
    const result = await generateJSON<KeywordIdeas>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: "Föreslå sökorden nu.",
      temperature: 0.6,
      maxOutputTokens: 3000,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Det tog för lång tid eller avbröts. Försök igen om en stund." },
      { status: 500 },
    );
  }
}
