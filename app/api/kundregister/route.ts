import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { beskrivFarskhet } from "@/lib/farskhet";
import { mysalesKontaktUrl } from "@/lib/mysales";
import { synkaOchStatusKundregister } from "@/lib/kundregister/synk";
import { matcharTaggar, matcharKalla, visningsnamnForTagg } from "@/lib/kundregister/taggar";

export const runtime = "nodejs";
export const maxDuration = 60;

// KUNDREGISTER-1 — läsande kundlista ur tenantens MySales-kontakter.
//
// Cockpit LÄSER. Redigering sker i MySales, och varje rad bär sin djuplänk dit.
// Ingen skrivväg finns här med flit: två system som båda får ändra samma kontakt driver
// isär, och då vet ingen vilken som stämmer.
//
// ⚠ Svaret bär ALLTID `synkad` och `fel`, även när listan är full. En vy som visar
// speglad data utan att säga när den hämtades är lika trovärdig som en färsk — och det
// är precis vad som gjorde att Fokus visade tre dygn gammal pipeline utan att någon
// märkte det.

// Taket gäller RADER ur spegeln, och en tenant med två coach_users har två rader per
// person. 1200 rader räcker därför till ~600 kunder hos en delad location. Avkortningen
// skrivs alltid ut i vyn — en tyst gräns läses som "det här är alla".
const TAK = 1200;

interface SpegelRad {
  ghl_contact_id: string;
  namn: string | null;
  foretag: string | null;
  epost: string | null;
  telefon: string | null;
  taggar: string[] | null;
  kalla: string | null;
  senast_aktivitet: string | null;
  location_id: string | null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") || "").trim().toLowerCase();
  // DEL 4-tillägget (HELG-1, 2026-08-21): FLERVAL på både tagg och källa (komma-separerat).
  // Filtreras i minnet (matcharTaggar/matcharKalla), inte i frågan — samma skäl som
  // sökningen redan gör det: en OR-fråga över en array-kolumn plus en till fritextkolumn
  // blir snårig, och radantalet per tenant (max TAK) gör minnesfiltrering billigt.
  const valdaTaggar = (sp.get("tagg") || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const valdaKallor = (sp.get("kalla") || "").split(",").map((k) => k.trim()).filter(Boolean);

  // Samma synk-och-status-mönster som Fokus: hämta om spegeln är gammal, men låt ALDRIG
  // ett fel mot MySales stoppa läsningen av det vi redan har.
  const status = await synkaOchStatusKundregister(clientId);

  const sb = supabaseService();
  const { data, error } = await sb
    .from("kundregister_kontakter")
    .select("ghl_contact_id, namn, foretag, epost, telefon, taggar, kalla, senast_aktivitet, location_id")
    .in("tenant_id", status.ids.length ? status.ids : ["00000000-0000-0000-0000-000000000000"])
    .order("senast_aktivitet", { ascending: false, nullsFirst: false })
    .limit(TAK);
  if (error) {
    // Ett databasfel är INTE en tom lista. Skiljer vi inte på dem läser vyn "inga
    // kunder" och användaren tror att registret är tomt (samma regel som G-9).
    return NextResponse.json(
      { error: `Kunde inte läsa kundlistan: ${error.message}`, kontakter: null, synkad: null, fel: status.fel },
      { status: 500 },
    );
  }

  // ★ EN PERSON, EN RAD. Spegeln har med flit en rad per tenant — Displayteknik delar en
  // location över två coach_users, och båda måste ha sin rad (samma modell som
  // Fokus-spegeln). Men läsningen går över BÅDA tenanterna, så utan den här hopslagningen
  // visas varje kund dubbelt.
  //
  // Hittat genom att titta på den färdiga sidan: 137 kontakter i MySales blev "274 av 274
  // kunder" och varje namn stod två gånger. DoD:n missade det för att den räknade RADER —
  // synken rapporterade 137 unika id:n och såg helt frisk ut. Det är samma dubblering som
  // är känd i Fokus-spegeln, men där syns den bara internt; i en kundsynlig lista är den
  // ett fel som gör hela registret otroligt.
  const perKontakt = new Map<string, SpegelRad>();
  for (const r of ((data as SpegelRad[] | null) || [])) {
    if (!perKontakt.has(r.ghl_contact_id)) perKontakt.set(r.ghl_contact_id, r);
  }
  const rader = [...perKontakt.values()];

  // Kopplingen till DM & Pipeline: vilka av kontakterna som redan har ett kort där.
  // Läses i EN fråga och matchas på ghl_contact_id — aldrig på namn. Namnmatchning
  // slår ihop två personer som heter likadant, och det är en riktig människas uppgifter.
  const dmPerKontakt = new Map<string, string>();
  try {
    const { data: dm } = await sb
      .from("cockpit_dm_contacts")
      .select("id, ghl_contact_id")
      .eq("client_id", clientId)
      .not("ghl_contact_id", "is", null);
    for (const d of ((dm as Array<{ id: string; ghl_contact_id: string | null }> | null) || [])) {
      if (d.ghl_contact_id) dmPerKontakt.set(d.ghl_contact_id, d.id);
    }
  } catch {
    /* DM-kopplingen är en bonus i listan — den får aldrig fälla kundlistan */
  }

  // Taggarna OCH källorna som faktiskt förekommer, för filtren. Räknas ur det tenanten
  // HAR, inte ur en handskriven lista — en tagg eller källa som inte finns ska inte gå
  // att välja. Kundbegripligt namn läggs på HÄR (visningsnamnForTagg), filtreringen
  // nedan matchar alltid mot den RÅ taggen — formateringen får aldrig påverka vad som
  // faktiskt filtreras.
  const taggRakning = new Map<string, number>();
  const kallaRakning = new Map<string, number>();
  for (const r of rader) {
    for (const t of r.taggar || []) taggRakning.set(t, (taggRakning.get(t) || 0) + 1);
    if (r.kalla) kallaRakning.set(r.kalla, (kallaRakning.get(r.kalla) || 0) + 1);
  }
  const taggar = [...taggRakning.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"))
    .map(([namn, antal]) => ({ namn, visningsnamn: visningsnamnForTagg(namn), antal }));
  const kallor = [...kallaRakning.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"))
    .map(([namn, antal]) => ({ namn, antal }));

  // Sökning + taggfilter (flerval, OR) + källfilter (flerval, OR) — alla i minnet, i den
  // ordningen. Motivering för sökningen: träffen ska gälla namn, företag, e-post OCH
  // telefon samtidigt, och en or-fråga över fyra kolumner med användarens fritext är
  // precis den sortens sträng-hopfogning som blir ett injektionshål.
  const traffar = rader
    .filter((r) => !q || [r.namn, r.foretag, r.epost, r.telefon].some((f) => (f || "").toLowerCase().includes(q)))
    .filter((r) => matcharTaggar((r.taggar || []).map((t) => t.toLowerCase()), valdaTaggar))
    .filter((r) => matcharKalla(r.kalla || "", valdaKallor));

  const kontakter = traffar.map((r) => ({
    id: r.ghl_contact_id,
    namn: r.namn || "",
    foretag: r.foretag || "",
    epost: r.epost || "",
    telefon: r.telefon || "",
    taggar: r.taggar || [],
    kalla: r.kalla || "",
    senastAktivitet: r.senast_aktivitet,
    // Djuplänk till MySales. null när location eller kontakt saknas — anroparen döljer
    // knappen hellre än visar en halv länk som leder fel (lib/mysales).
    mysalesUrl: mysalesKontaktUrl(r.location_id, r.ghl_contact_id),
    dmKortId: dmPerKontakt.get(r.ghl_contact_id) || null,
  }));

  return NextResponse.json({
    kontakter,
    taggar,
    kallor,
    totalt: rader.length,
    visade: kontakter.length,
    avkortad: rader.length >= TAK,
    synkad: status.senastSynkad,
    farskhet: beskrivFarskhet(status.senastSynkad),
    fel: status.fel,
  });
}

// POST — "Synka nu". Tvingar en hämtning oavsett spegelns ålder.
export async function POST() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const status = await synkaOchStatusKundregister(clientId, true);
  return NextResponse.json({
    ok: !status.fel,
    synkad: status.senastSynkad,
    farskhet: beskrivFarskhet(status.senastSynkad),
    fel: status.fel,
  });
}
