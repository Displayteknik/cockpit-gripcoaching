import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PRIS2-2 — spara bekräftad prislista, portad från mysales-coach/om-save-pricelist.ts.
// Samma tabeller (om_suppliers/om_price_lists/om_prices), samma kursfrysning, samma
// marginalflagga (sl_flaggor) när en kopplad artikels inpris ändras.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

interface Tier { qty: number; unit_price: number; freight_per_unit?: number; shipping_way?: string; incoterm?: string }
interface Article { model_no: string; description?: string; category?: string; tiers: Tier[] }
interface Body {
  supplier: { name: string; contact_name?: string; contact_email?: string; contact_phone?: string; country?: string; incoterm?: string; payment_terms?: string; warranty?: string; production_days_note?: string };
  currency: string;
  validity_days?: number;
  articles: Article[];
  notes?: string;
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = supabaseService();
  const b = (await req.json()) as Body;
  if (!b.supplier?.name || !b.currency || !b.articles?.length) {
    return NextResponse.json({ error: "supplier.name, currency och articles krävs" }, { status: 400 });
  }

  let fx = 1;
  if (b.currency !== "SEK") {
    const { data: fxRow } = await sb.from("om_fx_rates").select("rate").eq("currency", b.currency).order("rate_date", { ascending: false }).limit(1).maybeSingle();
    if (!fxRow?.rate) return NextResponse.json({ error: `Ingen kurs för ${b.currency} i om_fx_rates` }, { status: 200 });
    fx = Number(fxRow.rate);
  }
  const calc = Math.round(fx * 1.03 * 10000) / 10000;

  const { data: existing } = await sb.from("om_suppliers").select("id").eq("user_id", TENANT).eq("name", b.supplier.name).limit(1).maybeSingle();
  let supplierId = existing?.id as string | undefined;
  if (!supplierId) {
    const { data: ins, error } = await sb
      .from("om_suppliers")
      .insert({
        user_id: TENANT, name: b.supplier.name, contact_name: b.supplier.contact_name || "", contact_email: b.supplier.contact_email || "",
        contact_phone: b.supplier.contact_phone || "", country: b.supplier.country || "", default_currency: b.currency,
        default_incoterm: b.supplier.incoterm || "", payment_terms: b.supplier.payment_terms || "", warranty_terms: b.supplier.warranty || "",
        production_days_note: b.supplier.production_days_note || "",
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Leverantör", detail: error.message }, { status: 500 });
    supplierId = ins.id;
  }

  const validUntil = b.validity_days ? new Date(Date.now() + b.validity_days * 864e5).toISOString().slice(0, 10) : null;
  const { data: pl, error: plErr } = await sb
    .from("om_price_lists")
    .insert({ user_id: TENANT, supplier_id: supplierId, currency: b.currency, fx_rate_at_import: fx, calc_rate_at_import: calc, valid_until: validUntil, notes: b.notes || "" })
    .select("id")
    .single();
  if (plErr) return NextResponse.json({ error: "Prislista", detail: plErr.message }, { status: 500 });

  const rows = b.articles.flatMap((a) =>
    (a.tiers || []).map((t) => ({
      user_id: TENANT, price_list_id: pl.id, sku: a.model_no, description: a.description || "",
      qty_tier: t.qty, unit_price: t.unit_price, freight_per_unit: t.freight_per_unit || 0, shipping_way: t.shipping_way || "",
      incoterm: t.incoterm || b.supplier.incoterm || "",
    })),
  );
  const { error: prErr } = await sb.from("om_prices").upsert(rows, { onConflict: "price_list_id,sku,qty_tier,shipping_way" });
  if (prErr) return NextResponse.json({ error: "Artikelpriser", detail: prErr.message }, { status: 500 });

  // Marginalflagga: en ändrad SKU som redan är kopplad till en artikel i artikellagret.
  const flaggor: string[] = [];
  try {
    const skus = [...new Set(b.articles.map((a) => a.model_no).filter(Boolean))];
    const { data: kandaNycklar } = await sb.from("om_prices").select("sku, produktnyckel").eq("user_id", TENANT).in("sku", skus);
    const nyckelForSku = new Map((kandaNycklar || []).filter((r) => r.produktnyckel).map((r) => [r.sku, r.produktnyckel]));
    const { data: kopplingar } = await sb.from("al_leverantorskoppling").select("produktnyckel, al_artiklar!inner(artikelnummer)").eq("user_id", TENANT);
    for (const k of kopplingar || []) {
      const sku = [...nyckelForSku.entries()].find(([, ny]) => ny === k.produktnyckel)?.[0];
      if (!sku) continue;
      const artikelnummer = (k as unknown as { al_artiklar?: { artikelnummer?: string } }).al_artiklar?.artikelnummer as string;
      const { data: sl } = await sb.from("sl_prices").select("artikelnr").eq("user_id", TENANT).eq("katalog_kod", artikelnummer).eq("gallande", true).maybeSingle();
      if (!sl?.artikelnr) continue;
      await sb.from("sl_flaggor").upsert(
        { user_id: TENANT, artikelnr: sl.artikelnr, typ: "kostnad", allvar: "varning", text: `Nytt inpris inläst för ${artikelnummer} (${sku}) — se över marginalen mot gällande säljpris.`, data: { sku, artikelnummer } },
        { onConflict: "user_id,artikelnr,typ" },
      );
      flaggor.push(sl.artikelnr);
    }
  } catch { /* al_* saknas eller inget kopplat än, ingen flagga, inget fel */ }

  return NextResponse.json({ ok: true, supplier_id: supplierId, price_list_id: pl.id, fx_rate: fx, calc_rate: calc, sparade_rader: rows.length, marginalflaggor: flaggor });
}
