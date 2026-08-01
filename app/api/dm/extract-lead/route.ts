import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { skarmdumpPrompt, tolka, type RaExtraktion } from "@/lib/dm/skarmdump";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/dm/extract-lead { imageBase64, mime } → färdig förifyllnad till DM-pipelinen.
// Skärmdump av Messenger / Instagram DM / LinkedIn → Gemini vision läser av bubblorna
// (placering = vem som skrev) → lib/dm/skarmdump tolkar deterministiskt: talarattribution,
// fas, konkret mötestid och påminnelse. Allt användaren annars hade skrivit in för hand.
//
// Skillnad mot /api/ai/vision (fri sammanfattning) och /api/lobby/extract (kontaktkort):
// denna returnerar ett färdigt formulär för DM-kontakten.
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
  if (data.length > 12 * 1024 * 1024) return NextResponse.json({ error: "Bilden är för stor" }, { status: 400 });
  const validMime = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) ? mime : "image/png";

  const nu = new Date();
  const prompt = skarmdumpPrompt(nu.toISOString().slice(0, 10));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: validMime, data } }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
  };

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return NextResponse.json({ error: "Kunde inte nå bildläsningen" }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: `Bildläsningen misslyckades: ${res.status}` }, { status: 502 });

  const j = await res.json();
  let raw = (j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const jsonBit = raw.match(/\{[\s\S]*\}/);
  if (!jsonBit) return NextResponse.json({ error: "Kunde inte läsa av bilden" }, { status: 502 });

  let ra: RaExtraktion;
  try {
    ra = JSON.parse(jsonBit[0]) as RaExtraktion;
  } catch {
    return NextResponse.json({ error: "Kunde inte läsa av bilden" }, { status: 502 });
  }

  const t = tolka(ra, nu);
  if (!t.namn && !t.anvandarnamn && t.bubblor.length === 0) {
    return NextResponse.json({ error: "Hittade ingen konversation i bilden" }, { status: 422 });
  }

  return NextResponse.json({
    // Färdigt formulär — inget av detta ska behöva skrivas in för hand.
    formular: {
      display_name: t.namn,
      ig_username: t.anvandarnamn,
      channel: t.kanal,
      source: "dm",
      stage: t.steg,
      notes: t.sammanfattning,
      next_action: t.nastaSteg,
      next_action_at: t.motestidISO,
      reminder_at: t.paminnelseISO,
    },
    tolkning: {
      fas: t.fas,
      utfall: t.utfall,
      varme: t.varme,
      foreslogAv: t.foreslogAv,
      bekraftadAv: t.bekraftadAv,
      motestidText: t.motestidText,
      motestidLasbar: t.motestidLasbar,
      paminnelseLasbar: t.paminnelseLasbar,
      telefon: t.telefon,
      mejl: t.mejl,
      bubblor: t.bubblor,
    },
  });
}
