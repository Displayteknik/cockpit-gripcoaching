import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { anropaProvider } from "@/lib/ai-usage";
import { fordelningsPrompt, tolkaFordelning, type FaltSpec } from "@/lib/ai/faltfordelning";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/ai/rost-till-falt — { text, falt: FaltSpec[] } → { varden, oplacerat }
//
// ROST-1 (Håkans fynd 11/8): mikrofonen lade allt i fältet den stod under. Sa han "Elisabeth
// Andersson" i "Lägg till kontakt" hamnade namnet i ANTECKNINGAR och namnrutan stod tom.
// Skärmdumpsvägen kunde fylla varje fält sedan tidigare — rösten hade aldrig fått samma
// behandling. Den här routen är det ledet: transkriptionen in, fält ut.
//
// Routen ÄGER inte prompten (lib/ai/faltfordelning) och den ÄGER inte fälten (anroparen
// skickar sitt schema). Den gör en sak: frågar modellen och skär bort allt som inte får finnas.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  // Fail-open: utan nyckel får anroparen tillbaka texten som "oplacerat" och beter sig som
  // före ROST-1 — dikteringen får ALDRIG försvinna för att fördelningen inte kunde göras.
  const b = await req.json().catch(() => ({}));
  const text = String((b as { text?: unknown }).text || "").trim();
  const falt = Array.isArray((b as { falt?: unknown }).falt) ? ((b as { falt: FaltSpec[] }).falt) : [];
  if (!text) return NextResponse.json({ error: "text saknas" }, { status: 400 });
  if (!falt.length) return NextResponse.json({ varden: {}, oplacerat: text });
  if (!apiKey) return NextResponse.json({ varden: {}, oplacerat: text });

  // Schemat kommer från klienten och ska behandlas som data: bara de fält vi kan beskriva,
  // och ett tak så en trasig anropare inte kan bygga en oändlig prompt.
  const rensat: FaltSpec[] = falt
    .filter((f) => f && typeof f.nyckel === "string" && typeof f.etikett === "string")
    .slice(0, 20)
    .map((f) => ({
      nyckel: f.nyckel.slice(0, 40),
      etikett: f.etikett.slice(0, 80),
      typ: f.typ === "val" || f.typ === "datumtid" || f.typ === "lang-text" ? f.typ : "text",
      alternativ: Array.isArray(f.alternativ) ? f.alternativ.slice(0, 20).map((a) => String(a).slice(0, 40)) : undefined,
      hjalp: typeof f.hjalp === "string" ? f.hjalp.slice(0, 120) : undefined,
    }));

  const idag = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" });

  try {
    const svar = await anropaProvider<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>({
      provider: "gemini",
      model: "gemini-2.5-flash",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fordelningsPrompt(rensat, idag) }] },
          contents: [{ role: "user", parts: [{ text: text.slice(0, 4000) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 500,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: "application/json",
          },
        }),
      },
    });
    if (!svar.ok) return NextResponse.json({ varden: {}, oplacerat: text });
    const raw = svar.data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || "";
    const fordelning = tolkaFordelning(raw, rensat);
    // Tolkade modellen ingenting alls är hela texten oplacerad — inte förlorad.
    if (!Object.keys(fordelning.varden).length && !fordelning.oplacerat) {
      return NextResponse.json({ varden: {}, oplacerat: text });
    }
    return NextResponse.json(fordelning);
  } catch {
    return NextResponse.json({ varden: {}, oplacerat: text });
  }
}
