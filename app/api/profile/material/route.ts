// PROFIL-2 — ytan för kundberättelser och kundernas egna ord.
//
// Bakgrund: kvalitetsmätaren har sedan PROFIL-1 sagt "Lägg till 3 kundberättelser" och
// "Klistra in 5 riktiga kundcitat" — men det gick bara att fylla i via intake-flödet,
// som kunden inte når. Åtgärden pekade alltså på en dörr som inte fanns. Det är den
// farligaste kategorin vi har: ett löfte i gränssnittet utan täckning bakom.
//
// Modellen är INTE ny. Den speglar exakt vad intake/commit redan skriver, så samma
// material hamnar på samma ställe oavsett väg in:
//   Berättelser  → linkedin_posts (hook, idea_seed, notes), source_module = "profil"
//   Kundord      → customer_voice (phrase, category, context)
//
// ⚠ `source_module` skiljer manuell inmatning från intake med FLIT. Ursprunget är sant,
// och lib/profil/las räknar båda — annars hade kunden skrivit in tre berättelser och
// sett mätaren stå stilla.

import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** Kategorierna kunden kan välja för ett citat. Speglar intake-flödets egna värden. */
export const KUNDORD_KATEGORIER = ["vocabulary", "catchphrase", "objection", "transformation"] as const;
export type KundordKategori = (typeof KUNDORD_KATEGORIER)[number];

const MAX_FRAS = 600;
const MAX_HOOK = 250;
const MAX_TEXT = 2000;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// GET — allt material kunden själv kan redigera, nyast först.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const [berattelser, kundord] = await Promise.all([
      sb
        .from("linkedin_posts")
        .select("id, hook, idea_seed, notes, source_module, created_at")
        .eq("client_id", clientId)
        .in("source_module", ["intake", "profil"])
        .in("status", ["idea", "draft", "approved", "posted"])
        .order("created_at", { ascending: false })
        .limit(100),
      sb
        .from("customer_voice")
        .select("id, phrase, category, context, created_at")
        .eq("client_id", clientId)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return NextResponse.json({
      // `redigerbar` säger rakt ut vad kunden får röra: det hon skrivit själv. Material
      // ur intake visas men ändras där det skapades — annars går spårbarheten sönder.
      berattelser: (berattelser.data || []).map((b) => ({ ...b, redigerbar: b.source_module === "profil" })),
      kundord: kundord.data || [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — lägg till en berättelse eller ett kundord.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const typ = String(body.typ || "");
    const sb = supabaseService();

    if (typ === "berattelse") {
      const rubrik = str(body.rubrik, MAX_HOOK);
      const text = str(body.text, MAX_TEXT);
      if (!rubrik) return NextResponse.json({ error: "Skriv en kort rubrik för berättelsen" }, { status: 400 });
      if (text.length < 20) {
        // Kravet speglar mätarens eget: en berättelse som inte innehåller något konkret
        // hjälper inte texterna. Bättre att säga det här än att räkna in tomhet.
        return NextResponse.json({ error: "Berätta vad som hände — några meningar räcker" }, { status: 400 });
      }
      const { data, error } = await sb
        .from("linkedin_posts")
        .insert({
          client_id: clientId,
          status: "idea",
          format: "text",
          hook: rubrik,
          idea_seed: text,
          notes: str(body.resultat, MAX_TEXT) || null,
          source_module: "profil",
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ id: data.id });
    }

    if (typ === "kundord") {
      const fras = str(body.fras, MAX_FRAS);
      if (!fras) return NextResponse.json({ error: "Klistra in vad kunden sa" }, { status: 400 });
      const kategori = KUNDORD_KATEGORIER.includes(body.kategori) ? (body.kategori as KundordKategori) : "vocabulary";
      const { data, error } = await sb
        .from("customer_voice")
        .insert({
          client_id: clientId,
          phrase: fras,
          category: kategori,
          context: str(body.sammanhang, MAX_TEXT) || null,
          archived: false,
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ id: data.id });
    }

    return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE — ta bort eget material. Tenant-låst på BÅDA nycklarna.
export async function DELETE(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const { searchParams } = new URL(req.url);
    const typ = searchParams.get("typ") || "";
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
    const sb = supabaseService();

    if (typ === "berattelse") {
      // Bara det kunden skrivit själv. Intake-material rörs inte härifrån — det skulle
      // radera spårbarheten till sessionen det kom ur.
      const { data } = await sb
        .from("linkedin_posts")
        .delete()
        .eq("id", id)
        .eq("client_id", clientId)
        .eq("source_module", "profil")
        .select("id")
        .maybeSingle();
      if (!data) return NextResponse.json({ error: "Hittade inte berättelsen" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (typ === "kundord") {
      // Arkiveras, raderas inte: ett citat kan vara källa till en redan publicerad text,
      // och då ska historiken finnas kvar. Mätaren räknar bara oarkiverade.
      const { data } = await sb
        .from("customer_voice")
        .update({ archived: true })
        .eq("id", id)
        .eq("client_id", clientId)
        .select("id")
        .maybeSingle();
      if (!data) return NextResponse.json({ error: "Hittade inte citatet" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
