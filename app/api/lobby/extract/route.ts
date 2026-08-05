import { NextRequest, NextResponse } from "next/server";
import { anropaProvider } from "@/lib/ai-usage";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/lobby/extract { imageBase64, mime } → strukturerad kontakt-JSON.
// Klistra in en skärmbild av ett mejl / LinkedIn-chatt / visitkort → Gemini vision
// plockar ut rätt person (avsändaren, inte du själv) + fält. Porterad från Coachens
// extract-contact.ts. Till skillnad från /api/ai/vision (fri sammanfattning) ger denna
// strukturerad JSON som blir en ny lobby-kontakt.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

  let b: { imageBase64?: string; mime?: string; text?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  // Två ingångar, ETT svarsformat: en inklistrad skärmbild eller ett inklistrat mejl.
  // Texten finns för kunder som mejlar direkt i stället för att fylla i formuläret —
  // resultatet ska bli ett lead lika komplett som ett formulärinskick.
  const text = (b.text || "").trim();
  let data = b.imageBase64 || "";
  let mime = b.mime || "image/png";
  const m = data.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) { mime = m[1]; data = m[2]; }

  if (!data && !text) return NextResponse.json({ error: "Klistra in en bild eller ett mejl" }, { status: 400 });
  if (data && data.length > 12 * 1024 * 1024) return NextResponse.json({ error: "Bild för stor" }, { status: 400 });
  if (text.length > 40000) return NextResponse.json({ error: "Texten är för lång" }, { status: 400 });

  const validMime = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) ? mime : "image/png";
  const today = new Date().toISOString().slice(0, 10);

  const kalla = text
    ? "det inklistrade mejlet nedan"
    : "bilden (visitkort, e-post, LinkedIn, SMS, m.m.)";

  const prompt = `Dagens datum: ${today}

Extrahera kontaktinformation från ${kalla}.

IDENTIFIERA RÄTT PERSON:
- E-post: kontakten är AVSÄNDAREN (From-fältet och signaturen längst ner), INTE mottagaren.
- LinkedIn: profil-ägaren eller personen du chattar MED (inte du själv).
- Visitkort: personen på kortet.
- SMS/iMessage: den andra personen i konversationen.

Signaturen har ALLTID högsta prioritet för namn/titel/företag.

Returnera ENBART ett rått JSON-objekt (utan markdown-block):
{
  "name": "",
  "company": "",
  "title": "",
  "platform": "linkedin" | "fb" | "ig" | "email" | "phone" | "web" | "other",
  "email": "",
  "phone": "",
  "profile_url": "",
  "last_message": "",
  "next_step": "",
  "next_contact_date": "YYYY-MM-DD eller ''",
  "notes": ""
}

Regler:
- profile_url: om en profil-/chattlänk syns (linkedin.com/in/…, instagram.com/…, facebook.com/…, en hemsida) → ta med den, annars ''
- Kontaktformulär på webbsida → platform "web"
- Fyll i alla fält du kan identifiera med säkerhet
- Fält som inte går att identifiera = tom sträng ''
- last_message max 300 tecken, next_step max 100, notes max 200
- Hitta ALDRIG på uppgifter. Står det inget telefonnummer i texten så är fältet tomt.${
    text ? `\n\nMEJLET:\n"""\n${text}\n"""` : ""
  }`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  // Texten ligger i prompten; bilden skickas som inlineData. Skickar man en tom inlineData
  // svarar Gemini med 400, därför byggs delarna villkorat.
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (data) parts.push({ inlineData: { mimeType: validMime, data } });
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
  };

  // KOSTNAD-1: går genom lib/ai-usage (mätning, felklassning, budgetgrind).
  const svar = await anropaProvider<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>({
    provider: "gemini",
    model: "gemini-2.5-flash",
    flow: text ? "lobby-mejllasning" : "lobby-bildlasning",
    url,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  if (svar.budgetstopp) return NextResponse.json({ error: svar.fel }, { status: 429 });
  if (!svar.ok) {
    return NextResponse.json(
      { error: svar.fel || `${text ? "Mejlet" : "Bilden"} kunde inte läsas: ${svar.status}` },
      { status: 500 },
    );
  }
  const j = svar.data;
  let raw = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return NextResponse.json({ error: "Inget JSON i svar" }, { status: 500 });
  try {
    return NextResponse.json(JSON.parse(match[0]));
  } catch {
    return NextResponse.json({ error: "JSON parse misslyckades" }, { status: 500 });
  }
}
