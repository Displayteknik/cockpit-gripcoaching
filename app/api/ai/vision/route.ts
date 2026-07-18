import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/ai/vision { imageBase64, mime, prompt? } → { text }
// Generell bildanalys via Gemini vision (inline). Klistra in en skärmbild av ett mejl, en chatt,
// ett offertsvar → få en kort sammanfattning i klartext. Ingen lagring. Återanvändbar i alla verktyg.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY saknas" }, { status: 500 });

  let b: { imageBase64?: string; mime?: string; prompt?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  // Tål både rå base64 och data-URL ("data:image/png;base64,....").
  let data = b.imageBase64 || "";
  let mime = b.mime || "image/png";
  const m = data.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (m) {
    mime = m[1];
    data = m[2];
  }
  if (!data) return NextResponse.json({ error: "imageBase64 saknas" }, { status: 400 });
  if (data.length > 12 * 1024 * 1024) return NextResponse.json({ error: "Bild för stor" }, { status: 400 });

  const prompt =
    b.prompt ||
    "Detta är en skärmbild kopplad till en säljaffär (t.ex. ett mejl, en chatt eller ett offertsvar från kunden). " +
      "Sammanfatta i 1–3 meningar på svenska: vad kunden säger/gör, kundens ton, och ev. invändning eller nästa steg. " +
      "Ta ALLTID med eventuella datum du ser (när mejlet/meddelandet skickades, utlovade tider, deadlines) — de säger mycket om tempot. " +
      "Läs av text ordagrant där det är relevant. Skriv bara sammanfattningen, inga rubriker.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: mime, data } }, { text: prompt }],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
  };

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return NextResponse.json({ error: `Bildanalys misslyckades: ${res.status}` }, { status: 500 });
  const j = await res.json();
  const text = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  if (!text) return NextResponse.json({ error: "Tomt svar från Gemini" }, { status: 500 });
  return NextResponse.json({ text });
}
