import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import {
  ROD_FELKLASS,
  TENANT_TAK_SEK,
  felklassText,
  nollstallBudgetCache,
  type Felklass,
} from "@/lib/ai-usage";

export const runtime = "nodejs";

// KOSTNAD-1 K3 — underlaget till /dashboard/kostnader. ENDAST huvudadmin (owner):
// kostnadsdata spänner över alla tenants, så en klient-scopad admin får aldrig se den.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

interface Rad {
  created_at: string;
  tenant_id: string | null;
  provider: string;
  model: string;
  flow: string;
  estimated_cost_sek: number | string;
  status: string;
  error_class: string | null;
  http_status: number | null;
  error_body: string | null;
  latency_ms: number;
}

function manadensStart(): Date {
  const nu = new Date();
  return new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1));
}

export async function GET() {
  const denied = await ownerGrind();
  if (denied) return denied;

  const sb = supabaseService();
  const start = manadensStart();

  const [{ data: handelser }, { data: halsa }, { data: klienter }, { data: tenantTak }, { data: plattform }, { data: fasta }] =
    await Promise.all([
      sb.from("ai_usage_events")
        .select("created_at, tenant_id, provider, model, flow, estimated_cost_sek, status, error_class, http_status, error_body, latency_ms")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false })
        .limit(20000),
      sb.from("ai_provider_health").select("*"),
      sb.from("clients").select("id, name"),
      sb.from("ai_tenant_budget").select("tenant_id, tak_sek"),
      sb.from("ai_platform_budget").select("tak_sek, varning_procent").eq("id", 1).maybeSingle(),
      sb.from("fasta_kostnader").select("id, namn, kategori, belopp_sek, note, aktiv, sort_order").order("sort_order"),
    ]);

  const rader = (handelser || []) as Rad[];
  const kr = (r: Rad) => Number(r.estimated_cost_sek) || 0;

  const nu = new Date();
  const dagStart = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate())).toISOString();
  const veckoStart = new Date(Date.now() - 7 * 864e5).toISOString();

  const summa = (filter: (r: Rad) => boolean) => rader.filter(filter).reduce((s, r) => s + kr(r), 0);
  const manad = summa(() => true);
  const dagarIn = Math.max(1, nu.getUTCDate());
  const dagarKvar = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() + 1, 0)).getUTCDate();

  // Gruppering: kostnad, antal anrop och antal fel per nyckel.
  const gruppera = (nyckel: (r: Rad) => string) => {
    const m = new Map<string, { nyckel: string; kostnad: number; anrop: number; fel: number }>();
    for (const r of rader) {
      const k = nyckel(r);
      const g = m.get(k) || { nyckel: k, kostnad: 0, anrop: 0, fel: 0 };
      g.kostnad += kr(r);
      g.anrop += 1;
      if (r.status === "error") g.fel += 1;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.kostnad - a.kostnad);
  };

  const namn = new Map((klienter || []).map((c) => [(c as { id: string }).id, (c as { name: string }).name]));
  const takPerTenant = new Map(
    (tenantTak || []).map((t) => [(t as { tenant_id: string }).tenant_id, Number((t as { tak_sek: number }).tak_sek)]),
  );

  const perTenant = gruppera((r) => r.tenant_id || "").map((g) => {
    const tak = takPerTenant.get(g.nyckel) || TENANT_TAK_SEK;
    return {
      tenantId: g.nyckel || null,
      namn: g.nyckel ? namn.get(g.nyckel) || "Okänd klient" : "Utan klient (byråns egna körningar)",
      kostnad: g.kostnad,
      anrop: g.anrop,
      fel: g.fel,
      tak,
      procent: tak > 0 ? (g.kostnad / tak) * 100 : 0,
    };
  });

  const health = ((halsa || []) as Array<{
    provider: string; senaste_ok: string | null; senaste_fel: string | null;
    senaste_felklass: Felklass | null; senaste_httpstatus: number | null; senaste_svarskropp: string | null;
    fel_senaste_timmen: number; ok_senaste_timmen: number;
  }>).map((h) => {
    // RÖD = betalning eller nyckel, och bara när felet är NYARE än senaste lyckade anrop.
    // Ett gammalt betalningsfel som följts av lyckade anrop är löst, inte pågående.
    const felNyare = !!h.senaste_fel && (!h.senaste_ok || new Date(h.senaste_fel) > new Date(h.senaste_ok));
    const rod = felNyare && !!h.senaste_felklass && ROD_FELKLASS.includes(h.senaste_felklass);
    return {
      ...h,
      rod,
      text: rod && h.senaste_felklass
        ? `${felklassText(h.senaste_felklass, h.provider)} Senaste felet: ${new Date(h.senaste_fel!).toLocaleString("sv-SE")}.`
        : null,
    };
  });

  // Fasta abonnemang går inte att mäta per anrop men är verkliga pengar varje månad.
  // Utan dem visar vyn bara halva sanningen (Håkans krav 2/8: ALLA kostnader, överblickbart).
  const fastaRader = ((fasta || []) as Array<{ id: string; namn: string; kategori: string; belopp_sek: number; note: string | null; aktiv: boolean }>)
    .map((f) => ({ ...f, belopp_sek: Number(f.belopp_sek) || 0 }));
  const fastSumma = fastaRader.filter((f) => f.aktiv).reduce((s, f) => s + f.belopp_sek, 0);
  const prognos = (manad / dagarIn) * dagarKvar;

  return NextResponse.json({
    summa: {
      idag: summa((r) => r.created_at >= dagStart),
      vecka: summa((r) => r.created_at >= veckoStart),
      manad,
      prognos,
      fast: fastSumma,
      // Det Håkan faktiskt betalar den här månaden: uppmätt förbrukning plus abonnemang.
      totaltNu: manad + fastSumma,
      totaltPrognos: prognos + fastSumma,
    },
    fasta: fastaRader,
    health,
    perProvider: gruppera((r) => r.provider),
    perFlow: gruppera((r) => r.flow),
    perTenant,
    plattform: {
      tak: plattform ? Number((plattform as { tak_sek: number | null }).tak_sek) || null : null,
      varningProcent: plattform ? Number((plattform as { varning_procent: number }).varning_procent) : 90,
      manad,
    },
    fel: rader.filter((r) => r.status === "error").slice(0, 50),
    antalHandelser: rader.length,
  });
}

// PATCH — höj/sänk tak. { tenantId, tak } eller { plattformTak, varningProcent }.
export async function PATCH(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: {
    tenantId?: string; tak?: number; plattformTak?: number | null; varningProcent?: number;
    fastId?: string; belopp?: number; aktiv?: boolean;
    nyFast?: { namn: string; kategori?: string; belopp?: number };
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const sb = supabaseService();

  if (b.tenantId) {
    const tak = Number(b.tak);
    if (!Number.isFinite(tak) || tak < 0) return NextResponse.json({ error: "Taket måste vara ett tal, noll eller mer" }, { status: 400 });
    const { error } = await sb
      .from("ai_tenant_budget")
      .upsert({ tenant_id: b.tenantId, tak_sek: tak, uppdaterad: new Date().toISOString(), uppdaterad_av: "owner" }, { onConflict: "tenant_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Spärren cachar i 60 s — töm så ett höjt tak släpper direkt.
    nollstallBudgetCache(b.tenantId);
    return NextResponse.json({ ok: true });
  }

  if (b.plattformTak !== undefined || b.varningProcent !== undefined) {
    const rad: Record<string, unknown> = { id: 1, uppdaterad: new Date().toISOString(), uppdaterad_av: "owner" };
    if (b.plattformTak !== undefined) rad.tak_sek = b.plattformTak === null ? null : Number(b.plattformTak);
    if (b.varningProcent !== undefined) rad.varning_procent = Number(b.varningProcent);
    const { error } = await sb.from("ai_platform_budget").upsert(rad, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.fastId) {
    const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };
    if (b.belopp !== undefined) {
      const belopp = Number(b.belopp);
      if (!Number.isFinite(belopp) || belopp < 0) return NextResponse.json({ error: "Beloppet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.belopp_sek = belopp;
    }
    if (b.aktiv !== undefined) rad.aktiv = !!b.aktiv;
    const { error } = await sb.from("fasta_kostnader").update(rad).eq("id", b.fastId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.nyFast?.namn?.trim()) {
    const { error } = await sb.from("fasta_kostnader").insert({
      namn: b.nyFast.namn.trim().slice(0, 80),
      kategori: b.nyFast.kategori || "ovrigt",
      belopp_sek: Number(b.nyFast.belopp) || 0,
      sort_order: 200,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
}
