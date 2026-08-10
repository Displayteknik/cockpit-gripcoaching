import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { hamtaInstallningarForVy, sparaInstallningar, type SparaInput } from "@/lib/billing/installningar";
import { listaAvtal, sammanfatta, sparaAvtal, raderaAvtal, type SparaAvtalInput } from "@/lib/billing/avtal";
import { sattOverride, nollstallStatusCache } from "@/lib/billing/status";

export const runtime = "nodejs";

// BETAL-1 — ownervyns enda endpoint. Allt bakom requireAdmin.
//
// Hemligheter går ALDRIG ut härifrån: hamtaInstallningarForVy maskerar nycklarna innan
// de lämnar servern. Vyn kan alltså inte råka läcka dem till en logg eller en skärmdump.

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = supabaseService();
  const [installningar, avtal, { data: planer }, { data: handelser }, { data: fakturor }] = await Promise.all([
    hamtaInstallningarForVy(),
    listaAvtal(),
    sb.from("billing_plans").select("*").order("sort_order"),
    sb.from("billing_events")
      .select("id, stripe_event_id, typ, sammanfattning, hanterad, fel, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    sb.from("billing_invoices")
      .select("stripe_invoice_id, client_id, nummer, belopp_sek, status, faktura_datum, forfallodatum, hosted_invoice_url")
      .in("status", ["open", "uncollectible"])
      .order("faktura_datum", { ascending: false })
      .limit(50),
  ]);

  // Namn på obetalda fakturor, så listan går att läsa utan att slå upp id:n.
  const namnkarta = new Map(avtal.map((a) => [a.client_id, a.klient]));

  // Adressen räknas ut på SERVERN, inte ur webbläsarens adressfält. Öppnar Håkan vyn på
  // en förhandsvisningsadress ska han ändå få den riktiga att klistra in i Stripe.
  const { webhookAdress } = await import("@/lib/billing/adress");

  return NextResponse.json({
    installningar,
    webhook_adress: webhookAdress(),
    avtal,
    sammanfattning: sammanfatta(avtal),
    planer: planer || [],
    handelser: handelser || [],
    obetalda: ((fakturor || []) as Array<Record<string, unknown>>).map((f) => ({
      ...f,
      klient: namnkarta.get(f.client_id as string) || "Okänd kund",
    })),
  });
}

interface Body {
  installningar?: SparaInput;
  avtal?: SparaAvtalInput;
  radera_avtal?: string;
  plan?: { id: string; label?: string; beskrivning?: string; belopp_sek?: number; active?: boolean };
  override?: { client_id: string; varde: "frys" | "las_upp" | null; note?: string };
  atgard?: "testa_stripe" | "synka_planer" | "kor_dunning";
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = (await req.json().catch(() => ({}))) as Body;

  // ── Inställningar (inklusive Stripe-nycklar) ──────────────────────────────
  if (b.installningar) {
    const r = await sparaInstallningar(b.installningar);
    if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 400 });
    return NextResponse.json({ ok: true, besked: "Sparat." });
  }

  // ── Kundaffär ─────────────────────────────────────────────────────────────
  if (b.avtal) {
    const r = await sparaAvtal(b.avtal);
    if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 400 });
    return NextResponse.json({ ok: true, besked: "Affären är sparad." });
  }

  if (b.radera_avtal) {
    const ok = await raderaAvtal(b.radera_avtal);
    return NextResponse.json({ ok, besked: ok ? "Affären är borttagen." : "Det gick inte att ta bort." });
  }

  // ── Plan och pris ─────────────────────────────────────────────────────────
  if (b.plan?.id) {
    const patch: Record<string, unknown> = {};
    if (b.plan.label !== undefined) patch.label = b.plan.label.trim();
    if (b.plan.beskrivning !== undefined) patch.beskrivning = b.plan.beskrivning.trim() || null;
    if (b.plan.belopp_sek !== undefined) {
      const v = Number(b.plan.belopp_sek);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "Ogiltigt belopp." }, { status: 400 });
      patch.belopp_sek = v;
    }
    if (b.plan.active !== undefined) patch.active = !!b.plan.active;

    if (Object.keys(patch).length) {
      const { error } = await supabaseService().from("billing_plans").update(patch).eq("id", b.plan.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // ⚠ Priset i Stripe ändras INTE av detta. Ett pris går inte att skriva om i Stripe —
    // ett nytt måste skapas. Vyn säger det, så ingen tror att kunden nu debiteras det nya.
    return NextResponse.json({
      ok: true,
      besked: "Sparat. Har planen redan ett pris i Stripe gäller det gamla priset för befintliga kunder tills du skapar ett nytt.",
    });
  }

  // ── Ownerns överstyrning ──────────────────────────────────────────────────
  if (b.override?.client_id) {
    const ok = await sattOverride(b.override.client_id, b.override.varde, b.override.note);
    nollstallStatusCache(b.override.client_id);
    const text =
      b.override.varde === "frys" ? "Kunden är pausad." :
      b.override.varde === "las_upp" ? "Kunden är upplåst och automatiken rör den inte." :
      "Överstyrningen är borttagen, automatiken bestämmer igen.";
    return NextResponse.json({ ok, besked: ok ? text : "Det gick inte att spara." });
  }

  // ── Knappar som gör något mot Stripe ──────────────────────────────────────
  if (b.atgard === "testa_stripe") {
    const { testaKoppling } = await import("@/lib/billing/stripe");
    return NextResponse.json(await testaKoppling());
  }

  if (b.atgard === "synka_planer") {
    try {
      const { synkaPlanerTillStripe } = await import("@/lib/billing/stripe-ops");
      return NextResponse.json(await synkaPlanerTillStripe());
    } catch (e) {
      return NextResponse.json({ ok: false, besked: (e as Error).message }, { status: 400 });
    }
  }

  if (b.atgard === "kor_dunning") {
    const { korDunning } = await import("@/lib/billing/paminnelser");
    const r = await korDunning();
    return NextResponse.json({
      ok: true,
      besked: r.aktiv
        ? `Klart. ${r.granskade} granskade, ${r.paminnelser_skickade} påminnelser skickade, ${r.sparrade} pausade.`
        : "Automatiken är avstängd. Slå på den först om du vill att påminnelser ska gå ut.",
      rader: r.rader,
      utan_mottagare: r.utan_mottagare,
    });
  }

  return NextResponse.json({ error: "Okänd åtgärd." }, { status: 400 });
}
