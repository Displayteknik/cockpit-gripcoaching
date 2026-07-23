import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/lobby/suggest-reply { id } → { suggestions: [{ ton, text }] }
// Genererar 2–3 svarsförslag på det senaste meddelandet, i klientens röst
// (voice-fingerprint) och anpassat efter kanalen (kort för DM, längre för mejl).
// Detta är "förslag på svar"-verktyget porterat + samlat på leadet.
const KANAL_STIL: Record<string, string> = {
  linkedin: "LinkedIn-DM: kort, personligt, 2–4 meningar. Ingen hälsningsfras-formalia.",
  fb: "Facebook/Messenger: vardagligt och kort, 2–4 meningar.",
  ig: "Instagram-DM: kort, ledigt, 1–3 meningar.",
  email: "E-post: hälsning + 2–3 stycken + tydlig avslutning med nästa steg.",
  phone: "Manus inför ett samtal: 3–4 punkter att ta upp, inte en färdig text.",
  web: "Svar på en webbförfrågan: professionellt men varmt mejl, 2–3 stycken.",
  other: "Kort, personligt svar, 2–4 meningar.",
};

export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let b: { id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id krävs" }, { status: 400 });

  const clientId = await getActiveClientId();
  const ids = await resolveCoachUserIds(clientId);
  if (!ids.length) return NextResponse.json({ error: "Ingen Coach-koppling" }, { status: 403 });

  const sb = supabaseService();
  const { data: c } = await sb
    .from("lobby_contacts")
    .select("name, company, title, platform, status, last_message, next_step, notes")
    .eq("id", b.id)
    .in("user_id", ids)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Kontakten finns inte" }, { status: 404 });

  // Klientens röst (tyst fallback om ingen fingerprint hunnit byggas).
  let voiceBlock = "";
  try {
    voiceBlock = fingerprintToPromptBlock(await getVoiceFingerprint(clientId));
  } catch { /* utan röst → neutral men mänsklig ton */ }

  const kanal = (c.platform as string) || "other";
  const stil = KANAL_STIL[kanal] || KANAL_STIL.other;

  const prompt = `Du hjälper en säljare att svara en potentiell kund i deras EGEN röst.

${voiceBlock ? `SÄLJARENS RÖST (efterlikna denna):\n${voiceBlock}\n` : ""}
KONTAKT:
- Namn: ${c.name}
- Företag/roll: ${[c.title, c.company].filter(Boolean).join(", ") || "okänt"}
- Kanal: ${kanal}
- Status i pipelinen: ${c.status}
- Senaste meddelande från kontakten: ${c.last_message || "(inget meddelande sparat — skriv en öppnare som för dialogen framåt)"}
- Säljarens planerade nästa steg: ${c.next_step || "(ej satt)"}
- Anteckningar: ${c.notes || "(inga)"}

KANALSTIL: ${stil}

Skriv 3 olika svarsförslag med olika vinkel (t.ex. varmt/relationsbyggande, rakt/affärsdrivet, nyfiket/frågande).
Skriv på svenska. Låt som en människa — INGA AI-ord (kraftfull, banbrytande, game-changer, "handlar om", nästa nivå, holistisk, skalbar).
Använd riktiga svenska tecken å ä ö. Gissa inga fakta, priser eller namn som inte finns ovan.

Returnera ENBART JSON:
{ "suggestions": [ { "ton": "kort etikett, t.ex. Varmt", "text": "svaret" } ] }`;

  try {
    const data = await generateJSON<{ suggestions?: { ton: string; text: string }[] }>({
      model: "gemini-2.5-pro",
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    });
    const suggestions = (data.suggestions || []).filter((s) => s?.text).slice(0, 3);
    if (!suggestions.length) return NextResponse.json({ error: "Inga förslag kunde skapas" }, { status: 500 });
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json({ error: "Gemini misslyckades", details: String(e).slice(0, 200) }, { status: 500 });
  }
}
