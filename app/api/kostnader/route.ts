import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import {
  ROD_FELKLASS,
  TENANT_TAK_SEK,
  felklassTeknisk,
  nollstallBudgetCache,
  type Felklass,
} from "@/lib/ai-usage";
import {
  aktuellPeriod,
  arFelprissatt,
  beslutaTopupOrder,
  laggTillCredits,
  sakerstallKonto,
  nollstallCreditPrisCache,
} from "@/lib/credits";
import { byggInkop, fraschaApiSaldon, harSaldoApi } from "@/lib/inkop";
import { byggMarginal } from "@/lib/inkop/marginal";

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

  // K3-INKÖP: saldon som har ett API hämtas vid sidladdning, högst en gång i timmen
  // (cachen är radens egen tidsstämpel). Går det fel skrivs orsaken, aldrig ett gissat
  // saldo. Hämtningen får aldrig fälla vyn.
  await fraschaApiSaldon();

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

  // ETAPP K2-3: creditsidan av samma bild. Credits och kronor ska stå SIDA VID SIDA —
  // divergerar de betyder det att creditpriserna är felsatta, och det syns bara här.
  const [{ data: konton }, { data: creditPriser }, { data: ordrar }] = await Promise.all([
    sb.from("credit_accounts").select("tenant_id, monthly_quota, extra_credits, period_start, used_this_period"),
    sb.from("credit_pricing").select("action, credits, label, active").order("credits"),
    sb.from("topup_orders")
      .select("id, tenant_id, credits, price_sek, status, created_at, decided_at, decided_by")
      .order("created_at", { ascending: false })
      .limit(50),
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

  // Konton per tenant. ⚠ Ett konto vars period inte nollställts än (cron har inte hunnit)
  // ska visa 0 använt, inte förra månadens siffra — annars ser adminvyn fel ut den 1:a.
  const period = aktuellPeriod();
  const kontoPerTenant = new Map(
    ((konton || []) as Array<{ tenant_id: string; monthly_quota: number; extra_credits: number; period_start: string; used_this_period: number }>)
      .map((k) => [k.tenant_id, {
        kvot: Number(k.monthly_quota) || 0,
        extra: Number(k.extra_credits) || 0,
        anvant: k.period_start === period ? Number(k.used_this_period) || 0 : 0,
        periodStart: k.period_start,
      }]),
  );

  const perTenant = gruppera((r) => r.tenant_id || "").map((g) => {
    const tak = takPerTenant.get(g.nyckel) || TENANT_TAK_SEK;
    const konto = kontoPerTenant.get(g.nyckel) || null;
    const creditSaldo = konto ? konto.kvot + konto.extra - konto.anvant : null;
    return {
      tenantId: g.nyckel || null,
      namn: g.nyckel ? namn.get(g.nyckel) || "Okänd klient" : "Utan klient (byråns egna körningar)",
      kostnad: g.kostnad,
      credits: konto,
      creditSaldo,
      // Larmet ur beställningen. Regeln bor i lib/credits — den är en bedömning, inte en formel.
      felprissatt: arFelprissatt(g.kostnad, tak, creditSaldo),
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
        ? `${felklassTeknisk(h.senaste_felklass, h.provider)} Senaste felet: ${new Date(h.senaste_fel!).toLocaleString("sv-SE")}.`
        : null,
    };
  });

  // Fasta abonnemang går inte att mäta per anrop men är verkliga pengar varje månad.
  // Utan dem visar vyn bara halva sanningen (Håkans krav 2/8: ALLA kostnader, överblickbart).
  const fastaRader = ((fasta || []) as Array<{ id: string; namn: string; kategori: string; belopp_sek: number; note: string | null; aktiv: boolean }>)
    .map((f) => ({ ...f, belopp_sek: Number(f.belopp_sek) || 0 }));
  const fastSumma = fastaRader.filter((f) => f.aktiv).reduce((s, f) => s + f.belopp_sek, 0);
  const prognos = (manad / dagarIn) * dagarKvar;

  // K3-INKÖP: leverantörssaldon och marginal per kund. Larmet kommer ur samma
  // byggare som Founder HQ:s morgonlista använder, aldrig ur en egen tröskel här.
  const [inkop, marginal] = await Promise.all([byggInkop(nu), byggMarginal(nu)]);

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
    creditPriser: (creditPriser || []).map((p) => ({ ...(p as object) })),
    ordrar: ((ordrar || []) as Array<{ tenant_id: string }>).map((o) => ({
      ...o,
      namn: namn.get(o.tenant_id) || "Okänd klient",
    })),
    period,
    inkop: {
      ...inkop,
      rader: inkop.rader.map((r) => ({ ...r, harApi: harSaldoApi(r.provider) })),
    },
    marginal,
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
    // ETAPP K2-3
    orderId?: string; godkann?: boolean;
    insattning?: { tenantId: string; credits: number; note: string };
    kvot?: { tenantId: string; credits: number };
    creditPris?: { action: string; credits: number };
    // K3-INKÖP
    konto?: {
      id: string;
      saldo_belopp?: number | null;
      forra_fakturan_sek?: number | null;
      forra_fakturan_datum?: string | null;
      betalkort_sista_fyra?: string | null;
      pafyllningssteg?: number | null;
      notering?: string | null;
    };
    trosklar?: { gulDagar?: number; rodDagar?: number; gulPrognosProcent?: number };
    mrrKoppling?: { mrrId: string; tenantId: string | null };
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

  // ── ETAPP K2-3: creditåtgärder ───────────────────────────────────────────

  if (b.orderId) {
    const ok = await beslutaTopupOrder(b.orderId, b.godkann !== false, "owner");
    if (!ok) return NextResponse.json({ error: "Beställningen är redan beslutad eller saknas" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (b.insattning) {
    const { tenantId, credits, note } = b.insattning;
    // Noteringen är OBLIGATORISK: en insättning utan skäl går inte att förklara i efterhand.
    if (!tenantId || !note?.trim()) return NextResponse.json({ error: "Klient och notering krävs" }, { status: 400 });
    const antal = Number(credits);
    if (!Number.isFinite(antal) || antal === 0) return NextResponse.json({ error: "Ange ett antal credits" }, { status: 400 });
    const ok = await laggTillCredits({ tenantId, credits: antal, typ: "manual_grant", note, createdBy: "owner" });
    if (!ok) return NextResponse.json({ error: "Insättningen gick inte igenom" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.kvot) {
    const antal = Number(b.kvot.credits);
    if (!b.kvot.tenantId || !Number.isFinite(antal) || antal < 0) {
      return NextResponse.json({ error: "Kvoten måste vara ett tal, noll eller mer" }, { status: 400 });
    }
    // Kontot kan saknas för en tenant som aldrig genererat media — skapa det först.
    await sakerstallKonto(b.kvot.tenantId);
    const { error } = await sb
      .from("credit_accounts")
      .update({ monthly_quota: antal, updated_at: new Date().toISOString() })
      .eq("tenant_id", b.kvot.tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.creditPris) {
    const antal = Number(b.creditPris.credits);
    if (!b.creditPris.action || !Number.isFinite(antal) || antal < 0) {
      return NextResponse.json({ error: "Priset måste vara ett tal, noll eller mer" }, { status: 400 });
    }
    const { error } = await sb
      .from("credit_pricing")
      .update({ credits: antal, updated_at: new Date().toISOString() })
      .eq("action", b.creditPris.action);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    nollstallCreditPrisCache(); // priset cachas 5 min — töm så ändringen gäller direkt
    return NextResponse.json({ ok: true });
  }

  // ── K3-INKÖP ─────────────────────────────────────────────────────────────

  // Ett leverantörskonto. Ett manuellt inskrivet saldo stämplas med tidpunkten, så
  // vyn alltid kan säga hur gammal siffran är i stället för att låta den se färsk ut.
  if (b.konto?.id) {
    const rad: Record<string, unknown> = { uppdaterad: new Date().toISOString() };
    const tal = (v: unknown): number | null | "fel" => {
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : "fel";
    };

    if (b.konto.saldo_belopp !== undefined) {
      const n = tal(b.konto.saldo_belopp);
      if (n === "fel") return NextResponse.json({ error: "Saldot måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.saldo_belopp = n;
      rad.saldo_kalla = "manuellt";
      rad.saldo_uppdaterad = new Date().toISOString();
      rad.saldo_fel = null;
    }
    if (b.konto.forra_fakturan_sek !== undefined) {
      const n = tal(b.konto.forra_fakturan_sek);
      if (n === "fel") return NextResponse.json({ error: "Fakturabeloppet måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.forra_fakturan_sek = n;
    }
    if (b.konto.pafyllningssteg !== undefined) {
      const n = tal(b.konto.pafyllningssteg);
      if (n === "fel") return NextResponse.json({ error: "Påfyllningssteget måste vara ett tal, noll eller mer" }, { status: 400 });
      rad.pafyllningssteg = n;
    }
    if (b.konto.forra_fakturan_datum !== undefined) {
      const s = String(b.konto.forra_fakturan_datum || "").slice(0, 10);
      rad.forra_fakturan_datum = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }
    if (b.konto.betalkort_sista_fyra !== undefined) {
      const s = String(b.konto.betalkort_sista_fyra || "").replace(/\D/g, "").slice(0, 4);
      rad.betalkort_sista_fyra = s || null;
    }
    if (b.konto.notering !== undefined) rad.notering = String(b.konto.notering || "").slice(0, 400) || null;

    const { error } = await sb.from("provider_accounts").update(rad).eq("id", b.konto.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Larmtrösklarna. De ligger i databasen så de går att skruva utan ny version, och så
  // att larmkedjan går att prova skarpt.
  if (b.trosklar) {
    const rad: Record<string, unknown> = { id: 1, uppdaterad: new Date().toISOString() };
    const grans = (v: unknown, min: number, max: number): number | null => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= min && n <= max ? n : null;
    };
    if (b.trosklar.gulDagar !== undefined) {
      const n = grans(b.trosklar.gulDagar, 1, 365);
      if (n === null) return NextResponse.json({ error: "Gulgränsen måste vara mellan 1 och 365 dagar" }, { status: 400 });
      rad.gul_dagar = n;
    }
    if (b.trosklar.rodDagar !== undefined) {
      const n = grans(b.trosklar.rodDagar, 1, 365);
      if (n === null) return NextResponse.json({ error: "Rödgränsen måste vara mellan 1 och 365 dagar" }, { status: 400 });
      rad.rod_dagar = n;
    }
    if (b.trosklar.gulPrognosProcent !== undefined) {
      const n = grans(b.trosklar.gulPrognosProcent, 100, 1000);
      if (n === null) return NextResponse.json({ error: "Prognosgränsen måste vara mellan 100 och 1000 procent" }, { status: 400 });
      rad.gul_prognos_procent = n;
    }
    const { error } = await sb.from("inkop_konfig").upsert(rad, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Kopplar en intäktsrad i HQ till en klient, så marginalen räknas på rätt kund i
  // stället för att gissa på namnlikhet. Enda skrivningen mot hq_mrr_entries härifrån:
  // resten av raden ägs fortfarande av Founder HQ.
  if (b.mrrKoppling?.mrrId) {
    const { error } = await sb
      .from("hq_mrr_entries")
      .update({ client_id: b.mrrKoppling.tenantId || null, uppdaterad: new Date().toISOString() })
      .eq("id", b.mrrKoppling.mrrId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
}
