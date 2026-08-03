import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { ImportFel, tolkaProduktdatabas } from "@/lib/offert/xlsx-import";
import { hamtaAktivPrisbok, sparaPrisbok } from "@/lib/offert/inkopsdata";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/offert/inkop/import (multipart: file = produktdatabas.xlsx, torrkor?)
// Läser leverantörens produktdatabas och skriver den som en NY prisbok. Admin-grind: det här är
// inköpsdata, inte kunddata.
//
// `torrkor=1` tolkar filen och returnerar vad den skulle spara + varningar, utan att skriva.
// Det är bekräftelseskärmen — man ska kunna se vad som händer innan det händer.

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const clientId = await getActiveClientId();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Förväntar multipart/form-data med 'file'" }, { status: 400 });
  }
  const file = form.get("file");
  const torrkor = form.get("torrkor") === "1";
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file saknas" }, { status: 400 });

  const namn = (file as File).name || "produktdatabas.xlsx";
  if (!/\.xlsx$/i.test(namn)) {
    return NextResponse.json({ error: `Förväntar en .xlsx-fil, fick "${namn}".` }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 25 * 1024 * 1024) return NextResponse.json({ error: "Filen är för stor (max 25 MB)" }, { status: 400 });

  let tolkat;
  try {
    tolkat = await tolkaProduktdatabas(buf);
  } catch (e) {
    // ImportFel = layouten går inte att läsa. Vi gissar aldrig oss förbi den.
    const meddelande = e instanceof ImportFel ? e.message : "Kunde inte läsa filen: " + (e as Error).message;
    return NextResponse.json({ error: meddelande }, { status: 422 });
  }

  const sb = supabaseService();
  const { data: sedanTidigare } = await sb
    .from("offert_inkop_prisbok")
    .select("id, importerad_at, aktiv")
    .eq("client_id", clientId)
    .eq("kallfil_sha256", tolkat.sha256)
    .maybeSingle();

  const sammanfattning = {
    kallfil: namn,
    sha256: tolkat.sha256,
    radantal: tolkat.radantal,
    varningar: tolkat.varningar,
    produkter: tolkat.produkter.map((p) => ({
      produktnyckel: p.produktnyckel,
      produktnamn: p.produktnamn,
      leverantor: p.leverantor,
      storlek: p.storlek,
      ljusstyrka: p.ljusstyrka,
      miljo: p.miljo,
      trappor: tolkat.trappor.filter((t) => t.produktnyckel === p.produktnyckel).map((t) => t.antal),
      fraktsatt: [...new Set(tolkat.trappor.filter((t) => t.produktnyckel === p.produktnyckel).flatMap((t) => t.frakt.map((f) => f.fraktsatt)))],
    })),
  };

  if (torrkor) {
    return NextResponse.json({
      ok: true,
      torrkor: true,
      redanImporterad: sedanTidigare ? { importerad_at: sedanTidigare.importerad_at, aktiv: sedanTidigare.aktiv } : null,
      ...sammanfattning,
    });
  }

  // Samma fil två gånger ska inte ge två prisböcker — aktivera den befintliga i stället.
  if (sedanTidigare) {
    if (!sedanTidigare.aktiv) {
      await sb.from("offert_inkop_prisbok").update({ aktiv: false }).eq("client_id", clientId).eq("aktiv", true);
      await sb.from("offert_inkop_prisbok").update({ aktiv: true }).eq("id", sedanTidigare.id);
    }
    return NextResponse.json({
      ok: true,
      oforandrad: true,
      prisbokId: sedanTidigare.id,
      note: "Filen är identisk med en redan importerad version (samma sha256). Den är nu den aktiva prisboken — inget dubblerades.",
      ...sammanfattning,
    });
  }

  const foregaende = await hamtaAktivPrisbok(clientId);
  let prisbokId: string;
  try {
    ({ prisbokId } = await sparaPrisbok(clientId, tolkat, namn, null));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    prisbokId,
    ersatte: foregaende ? { id: foregaende.id, kallfil: foregaende.kallfil, importerad_at: foregaende.importerad_at } : null,
    ...sammanfattning,
  });
}
