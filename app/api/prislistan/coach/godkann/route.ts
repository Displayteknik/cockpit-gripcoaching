import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { tb, overGolv } from "@/lib/pris/kalkyl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PRIS2-6 — godkänn ett prisförslag. Portad från mysales-coach/pris-coach-godkann.ts.
// Marginalvakten (sl_golv) är ett HÅRT stopp här, inte bara en varning i UI:t.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

interface Body {
  artikelnummer: string;
  nyttPris: number;
  motivering: string;
  beslutAv: string;
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = (await req.json()) as Body;
  if (!b.artikelnummer || typeof b.nyttPris !== "number" || !b.motivering || !b.beslutAv) {
    return NextResponse.json({ error: "artikelnummer, nyttPris, motivering och beslutAv krävs" }, { status: 400 });
  }

  const sb = supabaseService();
  const { data: gammal } = await sb.from("sl_prices").select("*").eq("user_id", TENANT).eq("katalog_kod", b.artikelnummer).eq("gallande", true).maybeSingle();
  if (!gammal) return NextResponse.json({ error: `Ingen gällande sl_prices-rad kopplad till ${b.artikelnummer}` }, { status: 404 });

  const { data: artikel } = await sb.from("al_artiklar").select("id, kategori").eq("user_id", TENANT).eq("artikelnummer", b.artikelnummer).maybeSingle();
  const { data: golvRad } = await sb.from("sl_golv").select("golv_pct").eq("user_id", TENANT).eq("kategori", artikel?.kategori === "fonsterskarm" ? "skyltfonster" : artikel?.kategori || "").maybeSingle();
  const golv = golvRad?.golv_pct ?? 30;

  const { data: koppling } = await sb.from("al_leverantorskoppling").select("produktnyckel").eq("user_id", TENANT).eq("artikel_id", artikel?.id || "").limit(1).maybeSingle();
  let landat: number | null = null;
  if (koppling) {
    const { data: priser } = await sb.from("om_prices").select("unit_price, freight_per_unit, price_list_id, om_price_lists!inner(calc_rate_at_import)").eq("user_id", TENANT).eq("produktnyckel", koppling.produktnyckel);
    for (const p of priser || []) {
      const rate = Number((p as unknown as { om_price_lists?: { calc_rate_at_import?: number } }).om_price_lists?.calc_rate_at_import) || 0;
      if (!rate) continue;
      const l = Math.round((Number(p.unit_price) + (Number(p.freight_per_unit) || 0)) * rate);
      if (landat === null || l < landat) landat = l;
    }
  }

  let tbResultat: { kr: number; pct: number } | null = null;
  if (landat != null) {
    tbResultat = tb(b.nyttPris, landat);
    if (!overGolv(tbResultat.pct, golv)) {
      return NextResponse.json(
        {
          error: `Blockerat av marginalvakten: förslaget ${b.nyttPris} kr ger TB ${tbResultat.pct}% mot golvet ${golv}% (bästa kända landat ${landat} kr).`,
          blockeratAvGolv: true,
          tb_pct: tbResultat.pct,
          golv,
        },
        { status: 409 },
      );
    }
  }

  const nyVersion = (gammal.version || 1) + 1;
  const nu = new Date().toISOString().slice(0, 10);

  const { error: e1 } = await sb.from("sl_prices").update({ gallande: false, giltig_till: nu }).eq("id", gammal.id);
  if (e1) return NextResponse.json({ error: "Kunde inte stänga gamla versionen", detail: e1.message }, { status: 500 });

  const { data: ny, error: e2 } = await sb
    .from("sl_prices")
    .insert({
      user_id: TENANT, artikelnr: gammal.artikelnr, benamning: gammal.benamning, kategori: gammal.kategori,
      katalog_kod: gammal.katalog_kod, prismodell: gammal.prismodell, pris: b.nyttPris, enhet: gammal.enhet,
      fran_pris: gammal.fran_pris, valuta: gammal.valuta, moms_ingar: gammal.moms_ingar, synlighet: gammal.synlighet,
      version: nyVersion, gallande: true, giltig_fran: nu,
      motivering: b.motivering, kalla: "agent", beslut_av: b.beslutAv,
      landat_sek: landat, tb_kr: tbResultat?.kr ?? null, tb_pct: tbResultat?.pct ?? null,
    })
    .select("id, artikelnr, pris, version")
    .single();
  if (e2) return NextResponse.json({ error: "Kunde inte skriva ny version", detail: e2.message }, { status: 500 });

  await sb.from("sl_flaggor").update({ atgardad_at: new Date().toISOString() }).eq("user_id", TENANT).eq("artikelnr", gammal.artikelnr).eq("typ", "golv").is("atgardad_at", null);

  return NextResponse.json({ ok: true, ny, tb: tbResultat, golv });
}
