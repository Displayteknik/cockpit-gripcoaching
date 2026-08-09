import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/lobby/suggest-reply { id } → { suggestions: [{ ton, text }] }
// Genererar 3 svarsförslag på det senaste meddelandet, i klientens röst och anpassat
// efter kanalen (kort för DM, längre för mejl).
//
// ★ AKUT-DM (2026-08-09, efter G-0 avsnitt 0.1): rutten byggde tidigare sin EGEN prompt
// med bara ett röstblock. Den saknade alltså sanningskravet, prisregeln, perspektivregeln
// och klientens förbjudna ord — och det här är den text i hela plattformen som går
// RAKAST till en riktig människa: en betalande kunds lead, i en inkorg, ofta utan att
// någon läser den lika noga som ett inlägg. Ett påhittat pris eller ett uppfunnet
// kundminne kostar mer här än i ett inlägg.
//
// Håkans beslut: full lagertäckning, men INGEN CTA-tvingning. Syftet "dm-svar" i
// prompt-core får därför dialoganatomin i stället för CTA-golvet.
const KANAL_STIL: Record<string, string> = {
  linkedin: "LinkedIn-DM: kort, personligt, 2–4 meningar. Ingen hälsningsfras-formalia.",
  fb: "Facebook/Messenger: vardagligt och kort, 2–4 meningar.",
  ig: "Instagram-DM: kort, ledigt, 1–3 meningar.",
  email: "E-post: hälsning + 2–3 stycken + tydlig avslutning med nästa steg.",
  phone: "Manus inför ett samtal: 3–4 punkter att ta upp, inte en färdig text.",
  web: "Svar på en webbförfrågan: professionellt men varmt mejl, 2–3 stycken.",
  other: "Kort, personligt svar, 2–4 meningar.",
};

// Lobbyns kanalnamn → prompt-core:s. phone och other saknar motsvarighet och lämnas
// osatta i stället för att tvingas in i fel fack.
const KANAL_MAP: Record<string, "instagram" | "facebook" | "linkedin" | "webb" | "mejl" | undefined> = {
  linkedin: "linkedin",
  fb: "facebook",
  ig: "instagram",
  email: "mejl",
  web: "webb",
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

  const kanal = (c.platform as string) || "other";
  const stil = KANAL_STIL[kanal] || KANAL_STIL.other;

  const uppdrag = [
    "Du skriver svarsförslag åt klienten i varumärkesprofilen nedan, till en potentiell kund som redan hört av sig.",
    "Skriv 3 förslag med olika vinkel: varmt/relationsbyggande, rakt/affärsdrivet, nyfiket/frågande.",
    `KANALSTIL: ${stil}`,
    "Svaret ska kunna klistras in som det är. Inga platshållare i hakparenteser, ingen instruktion till läsaren.",
    // Kontaktens uppgifter är det ENDA faktaunderlaget om personen. Sanningskravet
    // (lager 8c) förbjuder påhitt generellt; den här raden pekar ut var gränsen går här.
    "Uppgifterna om kontakten nedan är allt du vet om personen. Påstå aldrig något om vad de gjort, sagt, köpt eller behöver utöver det som står där.",
  ].join("\n");

  const underlag = [
    "KONTAKT:",
    `- Namn: ${c.name}`,
    `- Företag/roll: ${[c.title, c.company].filter(Boolean).join(", ") || "okänt"}`,
    `- Kanal: ${kanal}`,
    `- Status i pipelinen: ${c.status}`,
    `- Senaste meddelande från kontakten: ${c.last_message || "(inget meddelande sparat — skriv en öppnare som för dialogen framåt)"}`,
    `- Klientens planerade nästa steg: ${c.next_step || "(ej satt)"}`,
    `- Anteckningar: ${c.notes || "(inga)"}`,
  ].join("\n");

  // ⚠ G-3d: INGEN rotation här, med flit. Ett svar skrivs till EN person om det HEN
  // skrev. Att be modellen undvika sina senaste öppningar hade tvingat fram konstlad
  // variation i en inkorg — två personer som ställer samma fråga ska få samma raka svar,
  // inte ett omskrivet för variationens skull.
  const bygg = await byggTextPrompt({
    clientId,
    syfte: "dm-svar",
    kanal: KANAL_MAP[kanal],
    uppdrag,
    underlag,
    // Prisundantaget öppnas ENDAST om kontakten själv skrev ett pris i sitt meddelande.
    // Profilens egna priser räknas aldrig som medgivande — det är hela prisregeln.
    anvandarText: c.last_message || "",
    jsonSchema: `{ "suggestions": [ { "ton": "kort etikett, t.ex. Varmt", "text": "svaret" } ] }`,
  });

  try {
    const data = await generateJSON<{ suggestions?: { ton: string; text: string }[] }>({
      model: "gemini-2.5-pro",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      maxOutputTokens: 2000,
      temperature: 0.7,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
      // G-1: DM-svar är den text som går direkt till en betalande kunds lead. Att den
      // syns i mätningen är viktigare här än någon annanstans (G0, tyngsta fynd 4).
      generering: {
        syfte: "dm-svar",
        promptVersion: bygg.meta.promptVersion,
        funnel: bygg.meta.funnel,
        lager: bygg.meta.lager,
        varianter: 3,
      },
    });
    const raa = (data.suggestions || []).filter((s) => s?.text).slice(0, 3);
    if (!raa.length) return NextResponse.json({ error: "Inga förslag kunde skapas" }, { status: 500 });
    // Saneringen är samma sista station som alla andra textflöden har. Kanalen styr
    // hashtag-taket; ett DM ska ändå aldrig innehålla hashtags (dialoganatomin förbjuder).
    const suggestions = await Promise.all(
      raa.map(async (s) => ({ ton: s.ton, text: await saneraText(s.text, clientId) })),
    );
    return NextResponse.json({ suggestions });
  } catch (e) {
    return NextResponse.json({ error: "Gemini misslyckades", details: String(e).slice(0, 200) }, { status: 500 });
  }
}
