import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { anropaProvider } from "@/lib/ai-usage";
import {
  TRANSKRIBERINGS_PROMPT,
  ROST_FELMEDDELANDE,
  ROST_TJANSTEFEL,
  ROST_FOR_KORT,
  MIN_LJUD_BYTES,
  rensaTranskription,
  ROST_ORSAKSTEXT,
  rostOrsak,
} from "@/lib/ai/transkription";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/ai/transcribe (multipart: audio) → { text }
// Generell röst→text via Gemini inline (dikterings-hjälp). Ingen lagring, ingen asset —
// tar en ljudblob direkt och returnerar transkriptionen. Återanvändbar i alla /k-verktyg.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Förväntar multipart/form-data med 'audio'" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "audio saknas" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 19 * 1024 * 1024)
    return NextResponse.json({ error: "Ljudfil för stor (>19 MB)" }, { status: 400 });
  // FIX-1/A1: ett avbrutet eller tomt klipp ska inte kosta ett modellanrop — och framför
  // allt inte få modellen att gissa. Tystnad UNDER golvet fångas här, tystnad ÖVER golvet
  // fångas av [INGET_TAL]-markören i svaret.
  if (buf.length < MIN_LJUD_BYTES)
    return NextResponse.json({ error: ROST_FOR_KORT }, { status: 422 });
  const base64 = buf.toString("base64");
  const mime = file.type || "audio/webm";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: base64 } },
          { text: TRANSKRIBERINGS_PROMPT },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
  };

  // KOSTNAD-1: går genom lib/ai-usage. Wrappern läser HELA svarskroppen och skriver den
  // till ai_usage_events — regeln från betalningsspärren 2026-08-01, då 403 "Lightning
  // dunning decision is deny" visades för användaren som "Kunde inte uppfatta rösten".
  const svar = await anropaProvider<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>({
    provider: "gemini",
    model: "gemini-2.5-flash",
    flow: "prata-in",
    url,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  if (svar.budgetstopp) return NextResponse.json({ error: svar.fel }, { status: 429 });
  if (!svar.ok) {
    console.error(`[transcribe] Gemini ${svar.status}: ${svar.raw.slice(0, 500)}`);
    // Betalning, nyckel och kvot är inget användaren kan tala sig ur.
    const tjanstefel = svar.felklass === "billing" || svar.felklass === "auth" || svar.felklass === "quota";
    return NextResponse.json(
      { error: tjanstefel ? ROST_TJANSTEFEL : ROST_FELMEDDELANDE },
      { status: 502 },
    );
  }
  const data = svar.data;
  // Alla parts sammanfogade — texten ligger inte alltid i den första.
  const raa = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .join("");
  // Skyddsnät: modellen ekar ibland tillbaka instruktionen när ljudet saknar tal.
  // Bara ett godkänt transkript får lämna routen — aldrig systeminstruktionen.
  const text = rensaTranskription(raa);
  if (!text) {
    // ROST-2: säg VILKET av de tre lägena det var. "Kunde inte uppfatta rösten" fick Håkan
    // att undra om tokens tagit slut (11/8) — och två av lägena är inte hans fel alls.
    const orsak = rostOrsak(raa);
    console.error(
      `[transcribe] underkänt transkript (orsak=${orsak}, mime=${mime}, bytes=${buf.length}, rått="${raa.slice(0, 120)}")`,
    );
    return NextResponse.json({ error: ROST_ORSAKSTEXT[orsak], orsak }, { status: 422 });
  }
  return NextResponse.json({ text });
}
