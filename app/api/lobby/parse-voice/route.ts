import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { generateJSON } from "@/lib/gemini";

export const runtime = "nodejs";

// POST /api/lobby/parse-voice { transcript } → tolkat intent + kontaktfält.
// Säljaren pratar in en anteckning ("Ringde Maria på Volvo, hon vill ha offert på tisdag")
// → Gemini avgör om det är en NY kontakt eller en aktivitet på en BEFINTLIG. Porterad
// från Coachens parse-voice.ts. Klienten matchar contact_name mot sina kontakter.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let b: { transcript?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const transcript = (b.transcript || "").trim();
  if (!transcript) return NextResponse.json({ error: "transcript krävs" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("sv-SE", { weekday: "long" });

  const prompt = `Dagens datum: ${today} (${weekday})

En säljare har talat in följande anteckning:
"${transcript}"

Analysera och avgör om det handlar om:
A) En NY kontakt som ska läggas till
B) En aktivitetsuppdatering på en BEFINTLIG kontakt (t.ex. "Johan svarade", "Ringde Maria")

Returnera ENBART JSON:
{
  "intent": "new_contact" | "log_activity",
  "contact_name": "Namn vid log_activity, annars ''",
  "activity_type": "dm_sent" | "response_received" | "meeting_booked" | "follow_up" | null,
  "name": "Fullständigt namn",
  "company": "Företag, annars ''",
  "title": "Titel, annars ''",
  "platform": "linkedin" | "fb" | "ig" | "email" | "phone" | "other",
  "last_message": "Vad hände, max 300 tecken",
  "next_step": "Vad ska göras härnäst, max 100 tecken",
  "next_contact_date": "YYYY-MM-DD om nämnt, annars ''",
  "notes": "Övrig kontext, max 200 tecken"
}

Regler:
- log_activity: säljaren rapporterar vad som HÄNDE med befintlig kontakt
- new_contact: ny person i systemet
- activity_type: dm_sent=skickade meddelande, response_received=svarade, meeting_booked=möte, follow_up=uppföljning
- Datum: "tisdag" + idag=${weekday} → räkna från ${today}
- Tomma fält = ''`;

  try {
    const data = await generateJSON({ prompt, maxOutputTokens: 2000, temperature: 0 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Gemini misslyckades", details: String(e).slice(0, 200) }, { status: 500 });
  }
}
