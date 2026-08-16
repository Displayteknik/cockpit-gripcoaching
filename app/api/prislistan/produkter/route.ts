import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lätt endpoint för produkttabellen — bara artikellagret, ingen sajtkontroll eller
// luckanalys. /api/prislistan/granska gör det tyngre jobbet för översiktssidan.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = supabaseService();
  const [artiklar, kopplingar, datablad, tillval, saljpriser] = await Promise.all([
    sb.from("al_artiklar").select("*").eq("user_id", TENANT).order("artikelnummer"),
    sb.from("al_leverantorskoppling").select("artikel_id, bekraftad").eq("user_id", TENANT),
    sb.from("al_datablad").select("artikel_id").eq("user_id", TENANT),
    sb.from("al_artikel_tillval").select("artikel_id").eq("user_id", TENANT),
    sb.from("sl_prices").select("artikelnr, katalog_kod, pris, prismodell, enhet, fran_pris, tb_pct").eq("user_id", TENANT).eq("gallande", true),
  ]);

  if (artiklar.error) return NextResponse.json({ error: artiklar.error.message, produkter: [] }, { status: 200 });

  const saljprisFor = (artikelnummer: string) => (saljpriser.data || []).find((s) => s.katalog_kod === artikelnummer) || null;

  const produkter = (artiklar.data || []).map((a) => {
    const kopp = (kopplingar.data || []).filter((k) => k.artikel_id === a.id);
    const sp = saljprisFor(a.artikelnummer);
    return {
      id: a.id,
      artikelnummer: a.artikelnummer,
      namn: a.namn,
      kategori: a.kategori,
      tum: a.tum,
      ljusstyrka_nits: a.ljusstyrka_nits,
      ip_klass: a.ip_klass,
      miljo: a.miljo,
      status: a.status,
      leverantorskopplingar: kopp.length,
      leverantorskopplingBekraftad: kopp.some((k) => k.bekraftad),
      datablad: (datablad.data || []).filter((d) => d.artikel_id === a.id).length,
      tillval: (tillval.data || []).filter((t) => t.artikel_id === a.id).length,
      saljprisArtikelnr: sp?.artikelnr || null,
      saljpris: sp?.pris != null ? Number(sp.pris) : null,
      saljprismodell: sp?.prismodell || null,
      saljprisEnhet: sp?.enhet || null,
      franPris: sp?.fran_pris || false,
      tbPct: sp?.tb_pct != null ? Number(sp.tb_pct) : null,
    };
  });

  return NextResponse.json({ produkter, hamtad: new Date().toISOString() });
}
