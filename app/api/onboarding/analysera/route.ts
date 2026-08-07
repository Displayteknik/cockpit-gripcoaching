import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { analyseraSajt, SkrapningMisslyckades } from "@/lib/onboard";
import { domanAv } from "@/lib/onboard/provisionera";

export const runtime = "nodejs";

// Skrapning av 6-8 sidor + AI-härledning tar 20-40 sekunder mot en verklig sajt.
// Standardtaket hade klippt körningen mitt i och gett ett svar som såg ut som ett fel
// i sajten i stället för i vår tidsgräns.
export const maxDuration = 60;

/**
 * ONBOARD-1 steg 1-5: klistra in en webbadress, få ett granskningsbart förslag.
 *
 * ★ IDEMPOTENS: samma domän ger samma körning. Har sajten redan provisionerats
 *   (status 'klar') skapas ingen ny körning — vi svarar med den befintliga och låter
 *   UI:t visa att kontot redan finns. Det är kravet "samma sajt två gånger skapar
 *   inga dubbletter", och det måste gälla redan här, inte först vid provisioneringen:
 *   annars kan två analyser hinna bli två konton.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { url?: string; epost?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const url = (body.url || "").trim();
  if (!url) return NextResponse.json({ error: "Ange kundens webbadress." }, { status: 400 });

  const epost = (body.epost || "").trim().toLowerCase() || null;
  const doman = domanAv(url);
  const sb = supabaseService();

  // Finns redan en körning för domänen?
  const { data: fanns, error: lasFel } = await sb
    .from("onboarding_korningar")
    .select("id, status, analys, forslag, client_id, ghl_location_id")
    .eq("doman", doman)
    .neq("status", "fel")
    .maybeSingle();

  if (lasFel) {
    return NextResponse.json(
      { error: `Kunde inte läsa onboarding-tabellen: ${lasFel.message}. Har migrations/onboarding_provisionering.sql körts?` },
      { status: 500 },
    );
  }

  if (fanns && fanns.status === "klar") {
    return NextResponse.json({
      id: fanns.id,
      redanKlar: true,
      analys: fanns.analys,
      forslag: fanns.forslag,
      client_id: fanns.client_id,
      ghl_location_id: fanns.ghl_location_id,
      meddelande: `${doman} är redan provisionerad. Inget nytt skapades.`,
    });
  }

  // ── Analysen ───────────────────────────────────────────────────────────────
  try {
    const analys = await analyseraSajt(url, { tenantId: null });

    const rad = {
      doman,
      url: analys.skrap.rotUrl,
      epost,
      status: "skrapad" as const,
      analys,
      forslag: analys.forslag,
      updated_at: new Date().toISOString(),
    };

    if (fanns) {
      const { error } = await sb.from("onboarding_korningar").update(rad).eq("id", fanns.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ id: fanns.id, analys });
    }

    const { data: ny, error } = await sb.from("onboarding_korningar").insert(rad).select("id").single();
    if (error) {
      // 23505 = någon annan hann skapa raden mellan vår läsning och vårt insert.
      if (error.code === "23505") {
        const { data: igen } = await sb
          .from("onboarding_korningar").select("id, analys").eq("doman", doman).neq("status", "fel").maybeSingle();
        if (igen) return NextResponse.json({ id: igen.id, analys: igen.analys });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: (ny as { id: string }).id, analys });
  } catch (e) {
    if (e instanceof SkrapningMisslyckades) {
      // 422 och inget sparat. Ett tomt förslag hade sett ut som ett svar.
      return NextResponse.json({ error: e.message, detaljer: e.detaljer }, { status: 422 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Analysen kunde inte köras." },
      { status: 500 },
    );
  }
}
