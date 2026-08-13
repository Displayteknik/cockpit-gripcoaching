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

// GET — status för aktiv klient (utan att läcka token)
export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data } = await sb.from("clients").select("ghl_location_id, ghl_pit").eq("id", clientId).maybeSingle();
    return NextResponse.json({
      connected: !!(data?.ghl_location_id && data?.ghl_pit),
      locationId: data?.ghl_location_id || "",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST { locationId, pit } — validerar mot MySales INNAN sparning. Fel token sparas aldrig.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const locationId = (b.locationId || "").toString().trim();
    const pit = (b.pit || "").toString().trim();
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

    // EN NYCKEL RÄCKER: samma nyckel till coach_users-raderna för samma location, så Fokus
    // och kundregistret slutar läsa en egen (och i praktiken död) nyckel.
    let coachRader = 0;
    try {
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
      accounts: check.accounts.length,
      kanaler: check.accounts.map((a) => ({ platform: a.platform, namn: a.name, utgangen: a.isExpired })),
      behorigheter,
      coachRader,
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
