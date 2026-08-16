import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { landatSek, tb, overGolv } from "@/lib/pris/kalkyl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Jämförelsetabell (PRIS2-3), portad från mysales-coach/al-artikel-kalkyl.ts. Samma
// artikel, alla inköpsvägar och fraktsätt sida vid sida med landad kostnad och TB.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

export async function GET(_req: Request, { params }: { params: Promise<{ artikelnummer: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { artikelnummer } = await params;
  const sb = supabaseService();

  const { data: artikel } = await sb.from("al_artiklar").select("id, artikelnummer, namn, kategori").eq("user_id", TENANT).eq("artikelnummer", artikelnummer).maybeSingle();
  if (!artikel) return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });

  const { data: kopplingar } = await sb.from("al_leverantorskoppling").select("produktnyckel, bekraftad").eq("user_id", TENANT).eq("artikel_id", artikel.id);
  const nycklar = (kopplingar || []).map((k) => k.produktnyckel);

  const { data: sl } = await sb.from("sl_prices").select("artikelnr, pris, prismodell, version").eq("user_id", TENANT).eq("katalog_kod", artikelnummer).eq("gallande", true).maybeSingle();
  const { data: golvRad } = await sb.from("sl_golv").select("golv_pct").eq("user_id", TENANT).eq("kategori", artikel.kategori === "fonsterskarm" ? "skyltfonster" : artikel.kategori).maybeSingle();
  const golv = golvRad?.golv_pct ?? 30;

  const rader: Array<{
    produktnyckel: string; bekraftad: boolean; sku: string; qty_tier: number; shipping_way: string;
    unit_price_usd: number; freight_per_unit_usd: number; landat_sek: number; ledtid: string | null;
    tb_kr: number | null; tb_pct: number | null; over_golv: boolean | null; kalla: string | null;
  }> = [];

  if (nycklar.length) {
    const { data: priser } = await sb
      .from("om_prices")
      .select("produktnyckel, sku, qty_tier, shipping_way, unit_price, freight_per_unit, ledtid, kallfil, price_list_id, om_price_lists!inner(calc_rate_at_import)")
      .eq("user_id", TENANT)
      .in("produktnyckel", nycklar);

    for (const p of priser || []) {
      const calcRate = Number((p as unknown as { om_price_lists?: { calc_rate_at_import?: number } }).om_price_lists?.calc_rate_at_import) || 0;
      const landat = calcRate ? landatSek(Number(p.unit_price), Number(p.freight_per_unit) || 0, calcRate) : NaN;
      const koppling = kopplingar?.find((k) => k.produktnyckel === p.produktnyckel);
      let tbKr: number | null = null, tbPct: number | null = null, overG: boolean | null = null;
      if (sl?.pris != null && !Number.isNaN(landat)) {
        const t = tb(Number(sl.pris), landat);
        tbKr = t.kr; tbPct = t.pct; overG = overGolv(t.pct, golv);
      }
      rader.push({
        produktnyckel: p.produktnyckel, bekraftad: !!koppling?.bekraftad, sku: p.sku,
        qty_tier: p.qty_tier, shipping_way: p.shipping_way, unit_price_usd: Number(p.unit_price),
        freight_per_unit_usd: Number(p.freight_per_unit) || 0, landat_sek: landat, ledtid: p.ledtid,
        tb_kr: tbKr, tb_pct: tbPct, over_golv: overG, kalla: p.kallfil,
      });
    }
  }
  rader.sort((a, b) => (a.landat_sek || Infinity) - (b.landat_sek || Infinity));

  return NextResponse.json({
    artikel: { artikelnummer: artikel.artikelnummer, namn: artikel.namn, kategori: artikel.kategori },
    saljpris: sl ? { artikelnr: sl.artikelnr, pris: sl.pris, prismodell: sl.prismodell, version: sl.version } : null,
    golv_pct: golv,
    rader,
  });
}
