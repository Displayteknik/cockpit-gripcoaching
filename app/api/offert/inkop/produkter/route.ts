import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { delademodellnr, sokProdukter, FRAKTSATT_ETIKETT, type Fraktsatt } from "@/lib/offert/inkopsdata";

export const runtime = "nodejs";

// GET /api/offert/inkop/produkter?q=&miljo=&storlek=
// Produkterna i den aktiva prisboken, med vilka trappor och fraktsätt som faktiskt är offererade.
// Listvyn visar aldrig ett landat pris för ett fraktsätt som saknas.

interface TrappRad {
  produktnyckel: string;
  antal: number;
  exw_styck: number | string;
  id: string;
}

export async function GET(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sp = new URL(req.url).searchParams;

  const { prisbok, produkter } = await sokProdukter(clientId, {
    q: sp.get("q") || undefined,
    miljo: sp.get("miljo") || undefined,
    storlek: sp.get("storlek") || undefined,
  });
  if (!prisbok) return NextResponse.json({ prisbok: null, produkter: [], delade: {} });

  const sb = supabaseService();
  const { data: trappRader } = await sb
    .from("offert_inkop_trappa")
    .select("id, produktnyckel, antal, exw_styck")
    .eq("client_id", clientId)
    .eq("prisbok_id", prisbok.id)
    .order("antal");
  const trappor = ((trappRader as TrappRad[] | null) || []).map((t) => ({ ...t, exw_styck: Number(t.exw_styck) }));

  const { data: fraktRader } = await sb
    .from("offert_inkop_frakt")
    .select("trappa_id, fraktsatt, frakt_styck")
    .eq("client_id", clientId);
  const fraktPerTrappa = new Map<string, { fraktsatt: Fraktsatt; frakt_styck: number }[]>();
  for (const f of (fraktRader as { trappa_id: string; fraktsatt: Fraktsatt; frakt_styck: number | string }[] | null) || []) {
    const lista = fraktPerTrappa.get(f.trappa_id) || [];
    lista.push({ fraktsatt: f.fraktsatt, frakt_styck: Number(f.frakt_styck) });
    fraktPerTrappa.set(f.trappa_id, lista);
  }

  const berikade = produkter.map((p) => {
    const egna = trappor.filter((t) => t.produktnyckel === p.produktnyckel);
    const rader = egna.map((t) => {
      const frakt = fraktPerTrappa.get(t.id) || [];
      const landat = frakt.map((f) => t.exw_styck + f.frakt_styck);
      return {
        trappa_id: t.id,
        antal: t.antal,
        exw_styck: t.exw_styck,
        fraktsatt: frakt.map((f) => ({ fraktsatt: f.fraktsatt, etikett: FRAKTSATT_ETIKETT[f.fraktsatt], frakt_styck: f.frakt_styck })),
        // null, inte 0, när inget fraktsätt är offererat. Ett landat pris finns helt enkelt inte då.
        lagsta_landat: landat.length ? Math.min(...landat) : null,
      };
    });
    return { ...p, trappor: rader, harNagonFrakt: rader.some((r) => r.lagsta_landat !== null) };
  });

  return NextResponse.json({
    prisbok,
    produkter: berikade,
    delade: await delademodellnr(clientId),
  });
}
