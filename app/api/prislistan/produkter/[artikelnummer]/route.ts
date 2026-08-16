import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Produktdetalj — läser v_al_artikel (byggd i PRIS2-1-migrationen) rakt av. Vyn slår redan
// ihop artikel + gällande säljpris + leverantörskopplingar + datablad + tillval i ett svep.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";

export async function GET(_req: Request, { params }: { params: Promise<{ artikelnummer: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { artikelnummer } = await params;
  const sb = supabaseService();
  const { data, error } = await sb
    .from("v_al_artikel")
    .select("*")
    .eq("user_id", TENANT)
    .eq("artikelnummer", artikelnummer)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });

  // Signerade länkar till databladen (privat Storage-bucket, samma Supabase-projekt som
  // mysales-coach laddade upp till). Defensivt: en trasig fil ska aldrig fälla hela sidan.
  const datablad = Array.isArray(data.datablad) ? data.datablad : [];
  const databladMedLankar = await Promise.all(
    datablad.map(async (d: { titel: string; file_path: string }) => {
      try {
        const [bucket, ...resten] = d.file_path.split("/");
        const { data: signed } = await sb.storage.from(bucket).createSignedUrl(resten.join("/"), 3600);
        return { ...d, url: signed?.signedUrl || null };
      } catch {
        return { ...d, url: null };
      }
    }),
  );

  // Version-historik för säljpriset — även stängda versioner, så beslutsspåret syns.
  let historik: unknown[] = [];
  if (data.sl_artikelnr) {
    const { data: h } = await sb
      .from("sl_prices")
      .select("version, pris, prismodell, gallande, giltig_fran, giltig_till, motivering, kalla, beslut_av, tb_pct")
      .eq("user_id", TENANT)
      .eq("artikelnr", data.sl_artikelnr)
      .order("version", { ascending: false });
    historik = h || [];
  }

  return NextResponse.json({ artikel: { ...data, datablad: databladMedLankar }, historik });
}
