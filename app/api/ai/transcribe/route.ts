import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import {
  TRANSKRIBERINGS_PROMPT,
  ROST_FELMEDDELANDE,
  ROST_TJANSTEFEL,
  rensaTranskription,
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

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    // Logga HELA svarskroppen, inte bara statuskoden. 2026-08-01 var projektet
    // betalningsspärrat (403 "Lightning dunning decision is deny") och användaren fick
    // "Kunde inte uppfatta rösten" — felet såg ut som en trasig röstfunktion i stället
    // för ett spärrat konto. Utan kroppen i loggen går orsaken inte att se.
    const kropp = await res.text().catch(() => "");
    console.error(`[transcribe] Gemini ${res.status}: ${kropp.slice(0, 500)}`);
    // 4xx från API:t (spärr, kvot, ogiltig nyckel) är inget användaren kan tala sig ur.
    const tjanstefel = res.status === 401 || res.status === 403 || res.status === 429;
    return NextResponse.json(
      { error: tjanstefel ? ROST_TJANSTEFEL : ROST_FELMEDDELANDE },
      { status: 502 },
    );
  }
  const data = await res.json();
  // Alla parts sammanfogade — texten ligger inte alltid i den första.
  const raa = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("");
  // Skyddsnät: modellen ekar ibland tillbaka instruktionen när ljudet saknar tal.
  // Bara ett godkänt transkript får lämna routen — aldrig systeminstruktionen.
  const text = rensaTranskription(raa);
  if (!text) {
    console.error(`[transcribe] inget godkänt transkript (mime=${mime}, bytes=${buf.length})`);
    return NextResponse.json({ error: ROST_FELMEDDELANDE }, { status: 422 });
  }
  return NextResponse.json({ text });
}
