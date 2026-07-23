import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { generateJSON } from "@/lib/gemini";

export const runtime = "nodejs";

// POST /api/lobby/voice-update { transcript, contact } → { ...fält att ändra }.
// När en kontakt är öppen kan säljaren prata in en uppdatering ("hon vill ha offert,
// ring på fredag") → Gemini returnerar bara fälten som ska ändras. Porterad från
// Coachens voice-update-contact.ts. notes läggs TILL, ersätter inte.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let b: { transcript?: string; contact?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const transcript = (b.transcript || "").trim();
  const c = b.contact || {};
  if (!transcript) return NextResponse.json({ error: "transcript krävs" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Dagens datum: ${today}

Befintlig kontaktdata:
- Namn: ${c.name || ""}
- Företag: ${c.company || ""}
- Titel/Roll: ${c.title || ""}
- E-post: ${c.email || ""}
- Telefon: ${c.phone || ""}
- Plattform: ${c.platform || ""}
- Status: ${c.status || "new"}
- Nästa steg: ${c.next_step || ""}
- Nästa kontaktdatum: ${c.next_contact_date || ""}
- Senaste meddelande: ${c.last_message || ""}
- Anteckningar: ${c.notes || ""}

Användaren sa (röstinmatning): "${transcript}"

Tolka och returnera ENBART JSON med fält som ska ändras. Utelämna fält som inte berörs.

Möjliga fält:
- "name", "company", "title", "email"
- "phone" (formatera svenskt, t.ex. 070-895 46 72)
- "platform": "linkedin" | "fb" | "ig" | "email" | "phone" | "web" | "other"
- "status": "new" | "contacted" | "dialog" | "ready" | "passed"
- "next_step" (max 150 tecken)
- "next_contact_date": "YYYY-MM-DD" eller ""
- "last_message"
- "notes" (ny info att LÄGGA TILL, inte ersätta)

Regler:
- Telefon: tolka svenska ("noll sjuttio"=070)
- Statusmappning: okänd/ny=new, kontaktad=contacted, dialog=dialog, redo=ready, mysales/möte=passed
- "ring"/"mejla" → next_step, inte status
- Var generös men gissa INTE — bara fält du är säker på`;

  try {
    const updates = await generateJSON<Record<string, unknown>>({ prompt, maxOutputTokens: 2000, temperature: 0 });
    return NextResponse.json(updates);
  } catch (e) {
    return NextResponse.json({ error: "Gemini misslyckades", details: String(e).slice(0, 200) }, { status: 500 });
  }
}
