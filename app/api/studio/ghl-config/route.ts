import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { ghlListAccounts } from "@/lib/studio/ghl";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Studio ↔ MySales-koppling per klient. Token lagras men returneras ALDRIG.
//
// ★ EN NYCKEL RÄCKER (Håkans fråga 13/8: "en kod från private integration ska väl räcka?").
//
// Bakgrund: samma sorts nyckel låg på TVÅ ställen, och en kund kunde ha den ena men inte
// den andra:
//   · `clients.ghl_pit`            → Studio, publicering, kanalvalet
//   · `coach_users.ghl_api_token`  → Fokus, kundregistret
// Gitte hade den andra men inte den första, och därför stod alla tre kanalerna som
// "ej kopplad" trots att hennes Instagram var korrekt kopplad i MySales.
//
// Nu skrivs nyckeln till BÅDA vid sparning. Läsvägarna lämnas orörda (ingen fungerande väg
// rivs), men de pekar från och med nu på samma nyckel.
//
// ⚠ MÄTT 13/8: For Balance, AluCon och Makzy hade alla en nyckel i `coach_users` som gav
// 401 på ALLT — sociala konton, användare och kontakter. Därför testas varje behörighet
// för sig nedan och svaret säger vilka som fungerar. En nyckel som "sparades" utan att
// fungera är värre än ingen nyckel: den ser rätt ut i gränssnittet.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

interface Behorighet {
  namn: string;
  ok: boolean;
  status: number | null;
  /** Vad som slutar fungera utan den här behörigheten. */
  betyder: string;
}

/** Provar de tre behörigheter Cockpit faktiskt använder. Kastar aldrig. */
async function provaBehorigheter(locationId: string, pit: string): Promise<Behorighet[]> {
  const h = { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
  const prov: { namn: string; url: string; betyder: string }[] = [
    { namn: "Sociala konton", url: `${BASE}/social-media-posting/${locationId}/accounts`, betyder: "Kanalvalet och publiceringen till Facebook, Instagram, LinkedIn och Google" },
    { namn: "Användare", url: `${BASE}/users/?locationId=${locationId}`, betyder: "Publicering (MySales kräver en avsändare)" },
    { namn: "Kontakter", url: `${BASE}/contacts/?locationId=${locationId}&limit=1`, betyder: "Kundlistan" },
    { namn: "Affärer", url: `${BASE}/opportunities/pipelines?locationId=${locationId}`, betyder: "Fokus idag, DM och pipeline" },
  ];
  const ut: Behorighet[] = [];
  for (const p of prov) {
    try {
      const r = await fetch(p.url, { headers: h });
      ut.push({ namn: p.namn, ok: r.ok, status: r.status, betyder: p.betyder });
    } catch {
      ut.push({ namn: p.namn, ok: false, status: null, betyder: p.betyder });
    }
  }
  return ut;
}

// GET — status för aktiv klient (utan att läcka token).
//
// ★ Håkans invändning 13/8, och den var berättigad: "nu fanns ju bara ett ställe att klistra
// in på, då blev det ju fel". Han hade ett fält men ingen möjlighet att SE vad som gällde —
// alltså klistrade han in i blindo och kunde inte veta att det gjorde saken värre.
//
// Därför provas de sparade nycklarna direkt vid inläsning, båda två var för sig:
//   · `clients.ghl_pit`           → kanalerna, publiceringen, kundlistan
//   · `coach_users.ghl_api_token` → Fokus idag, DM-tavlan, leadflödet, onboardingen
// Rutan visar då sanningen innan man rör något. Fyra anrop per sidladdning på en
// inställningssida är billigt jämfört med att gissa.
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data } = await sb.from("clients").select("ghl_location_id, ghl_pit").eq("id", clientId).maybeSingle();
    const pit = data?.ghl_pit || "";

    // ★ MÄTT 13/8 på For Balance, och det är en riktig bugg: rutan sa "Ingen nyckel sparad"
    // trots att onboardingen lagt in en nyckel som FUNGERAR för kanalerna. Orsaken: Fokus-
    // nyckeln slogs upp på `ghl_location_id`, och For Balances klientrad hade inget location-
    // id alls. Nyckeln fanns, men på ett fält vi aldrig tittade i.
    //
    // `coach_users.id` ÄR klient-id:t (provisionera.ts skriver in raden så). Därför slås
    // raden upp på id först, och location-id läses därifrån när klientraden saknar det.
    // Då hittar rutan nyckeln OCH kan fylla i id-fältet åt användaren.
    let coachToken = "";
    let coachLocation = "";
    const { data: viaId } = await sb
      .from("coach_users")
      .select("ghl_api_token, ghl_location_id")
      .eq("id", clientId)
      .maybeSingle();
    const rad = viaId as { ghl_api_token: string | null; ghl_location_id: string | null } | null;
    if (rad) {
      coachToken = rad.ghl_api_token || "";
      coachLocation = rad.ghl_location_id || "";
    }
    const locationId = data?.ghl_location_id || coachLocation || "";
    // Displayteknik har TVÅ coach_users-rader på samma location, och bara den ena bär
    // klient-id:t. Hittades ingen nyckel via id letar vi därför på location också.
    if (!coachToken && locationId) {
      const { data: cu } = await sb
        .from("coach_users")
        .select("ghl_api_token")
        .eq("ghl_location_id", locationId)
        .not("ghl_api_token", "is", null)
        .limit(1);
      coachToken = ((cu as Array<{ ghl_api_token: string | null }> | null) || [])[0]?.ghl_api_token || "";
    }

    const [studio, fokus] = await Promise.all([
      pit && locationId ? provaBehorigheter(locationId, pit) : Promise.resolve([]),
      coachToken && locationId
        ? provaBehorigheter(locationId, coachToken)
        : Promise.resolve([]),
    ]);

    // Håkan 13/8: "varför inte tala om VAD som eventuellt ÄR inne så man kan se". Ett
    // ja/nej räcker inte — han ska kunna se VILKEN nyckel som ligger där och känna igen
    // den. Början av nyckeln räcker för att skilja två nycklar åt; resten visas aldrig.
    const borjan = (t: string) => (t ? `${t.slice(0, 12)}…` : "");

    return NextResponse.json({
      connected: !!(locationId && pit),
      locationId,
      // Sant när id:t kommer från onboardingen i stället för klientraden — då ska rutan
      // säga varifrån det kom, annars ser ett ifyllt fält ut som något användaren skrivit.
      locationFranOnboarding: !data?.ghl_location_id && !!coachLocation,
      // Två separata besked, för det ÄR två separata nycklar.
      studio: { finns: !!pit, borjan: borjan(pit), behorigheter: studio },
      fokus: {
        finns: !!coachToken,
        borjan: borjan(coachToken),
        sammaNyckel: !!pit && coachToken === pit,
        behorigheter: fokus,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { locationId, pit, mal?, tvinga? } — validerar mot MySales INNAN sparning.
// Fel token sparas aldrig.
//
// ★ NYCKEL-1d, Håkans beställning 13/8: "gör två fält där jag kan ha en total nyckel om jag
// vill det, och en nyckel för det sociala". Det ENA fältet gjorde valet åt honom — koden
// gissade utifrån behörigheterna vilken nyckel som skulle hamna var. Nu säger han det själv:
//
//   mal = "allt"     → nyckeln skrivs till BÅDA (kanalerna OCH Fokus/DM/leads/onboarding)
//   mal = "socialt"  → nyckeln skrivs BARA till clients.ghl_pit, Fokus-nyckeln rörs aldrig
//
// Utan `mal` gäller "allt", så äldre anropsställen (StudioMaker) beter sig som förut.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const locationId = (b.locationId || "").toString().trim();
    const pit = (b.pit || "").toString().trim();
    const mal: "allt" | "socialt" = b.mal === "socialt" ? "socialt" : "allt";
    const tvinga = b.tvinga === true;
    if (!locationId || !pit) return NextResponse.json({ error: "Location-id och nyckel krävs" }, { status: 400 });

    // Grindvillkoret är sociala konton: utan den kan Cockpit inte göra sitt huvudjobb, och
    // en nyckel som inte når dit ska inte sparas alls. Övriga rapporteras men stoppar inte.
    const check = await ghlListAccounts({ locationId, pit });
    if (check.error) {
      return NextResponse.json(
        { error: `Nyckeln fungerar inte mot MySales: ${check.error}`, sparad: false },
        { status: 400 },
      );
    }

    const behorigheter = await provaBehorigheter(locationId, pit);

    const sb = supabaseService();
    const { error } = await sb.from("clients").update({ ghl_location_id: locationId, ghl_pit: pit }).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Kanalfältet rör ALDRIG Fokus-nyckeln. Det är hela poängen med att det är ett eget fält:
    // vill man bara byta den nyckel som publicerar, ska inget annat kunna gå sönder av det.
    if (mal === "socialt") {
      return NextResponse.json({
        connected: true,
        mal,
        accounts: check.accounts.length,
        kanaler: check.accounts.map((a) => ({ platform: a.platform, namn: a.name, utgangen: a.isExpired })),
        behorigheter,
        coachRader: 0,
        speglad: false,
        notis: "Sparad för kanalerna, publiceringen och kundlistan. Fokus, DM och leads använder sin egen nyckel — den är orörd.",
      });
    }

    // TOTALNYCKELN skriver till båda — men en smalare nyckel får inte tyst slå ut en bredare.
    //
    // ⚠ FÖRSTA VERSIONEN SKREV ÖVER RAKT AV, och det var fel. Håkan påpekade att
    // affärsbehörigheten låg i en separat integration som lades in i onboarding-steget.
    // En ny nyckel med bara socialplanner + contacts slog då tyst ut Fokus idag och
    // DM-tavlan. Mätt efteråt: precis så blev det — pipelines svarade 401 direkt efter
    // speglingen, på en kund där Fokus dessförinnan fungerade.
    //
    // Regeln: klarar totalnyckeln affärerna skrivs den till båda direkt. Klarar den inte det
    // STANNAR den — men den stannar inte i vägen. Svaret säger vad som saknas och erbjuder
    // `tvinga`, så Håkan kan skriva över ändå när han vet vad han gör. Skillnaden mot förut
    // är att beslutet är hans och att han ser vad det kostar innan han tar det.
    const klararAffarer = behorigheter.find((b) => b.namn === "Affärer")?.ok === true;
    const skriv = klararAffarer || tvinga;
    let coachRader = 0;
    if (!skriv) console.warn("[ghl-config] totalnyckeln saknar affärsbehörighet — coach_users lämnas orörd");
    try {
      if (!skriv) throw new Error("hoppar över spegling");
      const { data: uppdaterade } = await sb
        .from("coach_users")
        .update({ ghl_api_token: pit })
        .eq("ghl_location_id", locationId)
        .select("id");
      coachRader = (uppdaterade as unknown[] | null)?.length ?? 0;
    } catch (e) {
      // Får aldrig fälla sparningen — Studio fungerar redan med raden ovan.
      console.error("[ghl-config] kunde inte spegla nyckeln till coach_users:", e);
    }

    return NextResponse.json({
      connected: true,
      mal,
      accounts: check.accounts.length,
      kanaler: check.accounts.map((a) => ({ platform: a.platform, namn: a.name, utgangen: a.isExpired })),
      behorigheter,
      coachRader,
      speglad: skriv,
      ...(skriv
        ? {}
        : {
            kanTvinga: true,
            varning:
              "Nyckeln saknar behörighet till affärerna, så Fokus idag och DM-tavlan använder fortfarande den nyckel som lades in vid onboardingen. " +
              "Lägg till Opportunities på integrationen i MySales och klistra in nyckeln igen, så räcker en enda.",
          }),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE — koppla från. Rör INTE coach_users: Fokus kan ha en egen giltig nyckel sedan
// tidigare, och att radera den här vore att slå av en funktion användaren inte bad om.
export async function DELETE() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    await sb.from("clients").update({ ghl_location_id: null, ghl_pit: null }).eq("id", clientId);
    return NextResponse.json({ connected: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
