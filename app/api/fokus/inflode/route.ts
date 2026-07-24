import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachContext } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Fokusmotorns Inflöde (spec §14) — ledande indikatorer: veckans aktiviteter per kanal
// (mål/utfall/quick-log) + KPI:er ur pipelinen & lobbyn. Porterad från standalone
// fokus-inflode.ts. Tenant server-side via bryggan; fokus_inflode skrivs till kanonisk
// tenant (ids[0]) för att undvika dubbletter. Opp-spegeln är dubblerad över DT:s 2 coach-
// users → räkna affärer på EN tenant (full deduppad siffra), lobby/quotes på alla ids.

const KANALER: Array<{ kanal: string; mal: number }> = [
  { kanal: "LinkedIn", mal: 20 },
  { kanal: "Instagram", mal: 10 },
  { kanal: "Facebook", mal: 5 },
  { kanal: "Hemsida", mal: 5 },
  { kanal: "ICP", mal: 10 },
];

function veckoNyckel(d: Date): string {
  const day = d.getUTCDay() || 7;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)));
  return mon.toISOString().slice(0, 10); // måndagens datum = unik veckonyckel
}

// Räkna rader best-effort — en saknad tabell/kolumn ska inte fälla hela Inflödet.
async function safeCount(q: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    const { count } = await q;
    return count || 0;
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  let body: { action?: string; kanal?: string; mal?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { action, kanal, mal } = body;

  const clientId = await getActiveClientId();
  const ctx = await resolveCoachContext(clientId);
  if (!ctx.ids.length) return NextResponse.json({ linked: false });
  const kanonisk = ctx.ids[0]; // kanonisk tenant för fokus_inflode-skrivning

  const sb = supabaseService();
  const now = new Date();
  const iso = veckoNyckel(now);

  // ── Mutationer: quick-log +1 eller sätt mål ──
  if (action === "log" || action === "setMal") {
    if (!kanal) return NextResponse.json({ error: "kanal krävs" }, { status: 400 });
    const { data: rad } = await sb
      .from("fokus_inflode")
      .select("mal, utfall")
      .eq("tenant_id", kanonisk)
      .eq("kanal", kanal)
      .eq("iso_vecka", iso)
      .maybeSingle();
    const std = KANALER.find((k) => k.kanal === kanal)?.mal ?? 0;
    const nyMal = action === "setMal" ? Math.max(0, Number(mal) || 0) : rad?.mal ?? std;
    const nyUtfall = action === "log" ? (rad?.utfall ?? 0) + 1 : rad?.utfall ?? 0;
    await sb
      .from("fokus_inflode")
      .upsert(
        { tenant_id: kanonisk, kanal, iso_vecka: iso, mal: nyMal, utfall: nyUtfall, updated_at: now.toISOString() },
        { onConflict: "tenant_id,kanal,iso_vecka" },
      );
  }

  // ── Läs: kanaler denna vecka (carry-over mål från förra veckan) ──
  const forra = veckoNyckel(new Date(now.getTime() - 7 * 86400000));
  const [{ data: dennaRader }, { data: forraRader }] = await Promise.all([
    sb.from("fokus_inflode").select("kanal, mal, utfall").eq("tenant_id", kanonisk).eq("iso_vecka", iso),
    sb.from("fokus_inflode").select("kanal, mal").eq("tenant_id", kanonisk).eq("iso_vecka", forra),
  ]);
  const denna = new Map(((dennaRader as { kanal: string; mal: number; utfall: number }[] | null) || []).map((r) => [r.kanal, r]));
  const forraMal = new Map(((forraRader as { kanal: string; mal: number }[] | null) || []).map((r) => [r.kanal, r.mal]));
  const kanaler = KANALER.map((k) => {
    const r = denna.get(k.kanal);
    const malV = r?.mal ?? forraMal.get(k.kanal) ?? k.mal;
    const utfallV = r?.utfall ?? 0;
    return { kanal: k.kanal, mal: malV, utfall: utfallV, underNiva: utfallV < malV };
  });

  // ── KPI:er ur riktig data ──
  const day = now.getUTCDay() || 7;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1))).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [prospekt, moten, offerter, ordrar] = await Promise.all([
    // Nya prospekt = lobby-kontakter skapade denna vecka (lobby ej dubblerad → alla ids).
    safeCount(sb.from("lobby_contacts").select("id", { count: "exact", head: true }).in("user_id", ctx.ids).gte("created_at", weekStart)),
    // Möten bokade denna vecka — opp-spegel dubblerad → EN tenant = deduppad siffra.
    safeCount(sb.from("fokus_opportunities").select("id", { count: "exact", head: true }).eq("tenant_id", kanonisk).ilike("steg_namn", "%möte bokat%").gte("steg_sedan", weekStart)),
    // Offerter skickade denna vecka (om_quotes, per user → alla ids).
    safeCount(sb.from("om_quotes").select("id", { count: "exact", head: true }).in("user_id", ctx.ids).eq("status", "skickad").gte("sent_at", weekStart)),
    // Ordrar denna månad — vunnen/order, EN tenant.
    safeCount(sb.from("fokus_opportunities").select("id", { count: "exact", head: true }).eq("tenant_id", kanonisk).or("steg_namn.ilike.%vunnen%,steg_namn.ilike.%order%").gte("steg_sedan", monthStart)),
  ]);

  return NextResponse.json({
    linked: true,
    vecka: iso,
    kanaler,
    kpi: {
      prospektsVecka: prospekt,
      motenBokade: moten,
      offerterSkickade: offerter,
      ordrarManad: ordrar,
    },
  });
}
