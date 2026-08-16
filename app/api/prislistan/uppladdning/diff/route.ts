import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PRIS2-2 — diffvy mot befintligt, portad från mysales-coach/om-diff-pricelist.ts.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

interface Tier { qty: number; unit_price: number; freight_per_unit?: number; shipping_way?: string }
interface Article { model_no: string; tiers: Tier[] }

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = (await req.json()) as { articles: Article[] };
  if (!b.articles?.length) return NextResponse.json({ error: "articles krävs" }, { status: 400 });

  const sb = supabaseService();
  const skus = [...new Set(b.articles.map((a) => a.model_no).filter(Boolean))];
  const { data: befintliga } = await sb
    .from("om_prices")
    .select("sku, qty_tier, shipping_way, unit_price, freight_per_unit, produktnyckel, kallfil")
    .eq("user_id", TENANT)
    .in("sku", skus);

  const key = (sku: string, qty: number, way: string) => `${sku}::${qty}::${way || ""}`;
  const senaste = new Map((befintliga || []).map((r) => [key(r.sku, r.qty_tier, r.shipping_way || ""), r]));

  const nya: Array<{ sku: string; qty_tier: number; shipping_way: string; unit_price: number; freight_per_unit: number }> = [];
  const andrade: Array<{ sku: string; qty_tier: number; shipping_way: string; falt: string; fran: number; till: number; produktnyckel_kand: string | null }> = [];
  let oforandrade = 0;

  for (const a of b.articles) {
    for (const t of a.tiers || []) {
      const way = t.shipping_way || "";
      const bef = senaste.get(key(a.model_no, t.qty, way));
      if (!bef) { nya.push({ sku: a.model_no, qty_tier: t.qty, shipping_way: way, unit_price: t.unit_price, freight_per_unit: t.freight_per_unit || 0 }); continue; }
      let andrat = false;
      if (Number(bef.unit_price) !== Number(t.unit_price)) { andrade.push({ sku: a.model_no, qty_tier: t.qty, shipping_way: way, falt: "inpris", fran: Number(bef.unit_price), till: Number(t.unit_price), produktnyckel_kand: bef.produktnyckel }); andrat = true; }
      const befFrakt = Number(bef.freight_per_unit) || 0, nyFrakt = Number(t.freight_per_unit) || 0;
      if (befFrakt !== nyFrakt) { andrade.push({ sku: a.model_no, qty_tier: t.qty, shipping_way: way, falt: "frakt", fran: befFrakt, till: nyFrakt, produktnyckel_kand: bef.produktnyckel }); andrat = true; }
      if (!andrat) oforandrade++;
    }
  }

  const nycklar = [...new Set(andrade.map((a) => a.produktnyckel_kand).filter(Boolean))] as string[];
  const paverkarSaljpris: Array<{ produktnyckel: string; artikelnummer: string; sl_artikelnr: string | null }> = [];
  if (nycklar.length) {
    const { data: kopplingar } = await sb.from("al_leverantorskoppling").select("produktnyckel, artikel_id, al_artiklar!inner(artikelnummer)").eq("user_id", TENANT).in("produktnyckel", nycklar);
    for (const k of kopplingar || []) {
      const artikelnummer = (k as unknown as { al_artiklar?: { artikelnummer?: string } }).al_artiklar?.artikelnummer as string;
      const { data: sl } = await sb.from("sl_prices").select("artikelnr").eq("user_id", TENANT).eq("katalog_kod", artikelnummer).eq("gallande", true).maybeSingle();
      paverkarSaljpris.push({ produktnyckel: k.produktnyckel, artikelnummer, sl_artikelnr: sl?.artikelnr || null });
    }
  }

  return NextResponse.json({ nya, andrade, oforandrade, paverkarSaljpris });
}
