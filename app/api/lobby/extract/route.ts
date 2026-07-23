import { NextRequest, NextResponse } from "next/server";
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

  let b: { imageBase64?: string; mime?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  let data = b.imageBase64 || "";
  let mime = b.mime || "image/png";
  const m = data.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) { mime = m[1]; data = m[2]; }
  if (!data) return NextResponse.json({ error: "imageBase64 saknas" }, { status: 400 });
  if (data.length > 12 * 1024 * 1024) return NextResponse.json({ error: "Bild för stor" }, { status: 400 });

  const validMime = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) ? mime : "image/png";
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Dagens datum: ${today}

Extrahera kontaktinformation från bilden (visitkort, e-post, LinkedIn, SMS, m.m.).

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
- last_message max 300 tecken, next_step max 100, notes max 200`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: validMime, data } }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
  };

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return NextResponse.json({ error: `Bildanalys misslyckades: ${res.status}` }, { status: 500 });
  const j = await res.json();
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
