// BETAL-1 — Stripes webhooks. Vad som händer när Stripe hör av sig.
//
// ★ IDEMPOTENS FÖRST. Varje händelse skrivs i billing_events med UNIQUE på
// stripe_event_id INNAN den hanteras. Stripe skickar om händelser vid nätverksstrul,
// och utan den spärren skulle en påfyllning kunna krediteras två gånger.
//
// Ordningen i hanteraren är därför alltid: skriv raden → om raden redan fanns, avbryt →
// hantera → markera hanterad.
//
// Server-only (nodejs runtime).

import type Stripe from "stripe";
import { supabaseService } from "../supabase-admin";
import { oreTillKronor, stripeTidTillDatum } from "./stripe";
import { klientFranStripeKund } from "./stripe-ops";
import { registreraBetalning, registreraMisslyckadBetalning, nollstallStatusCache } from "./status";
import { laggTillCredits } from "../credits";

export const HANTERADE_TYPER = [
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "checkout.session.completed",
  // BETAL-1b: dragning på sparat kort. Krediteringen sker redan direkt i routen, men
  // händelsen hanteras även här som skyddsnät — tappar servern anslutningen mitt i
  // dragningen har kunden ändå betalat, och då ska tokens komma fram.
  "payment_intent.succeeded",
] as const;

interface Utfall {
  hanterad: boolean;
  besked: string;
  clientId: string | null;
}

/** En rad svenska om vad som hände, för ownervyns händelselista. */
function sammanfatta(typ: string, clientNamn: string | null, extra: string): string {
  const kund = clientNamn ? ` för ${clientNamn}` : "";
  switch (typ) {
    case "invoice.paid": return `Betalning inkommen${kund}${extra}`;
    case "invoice.payment_failed": return `Betalning misslyckades${kund}${extra}`;
    case "customer.subscription.updated": return `Abonnemanget ändrades${kund}${extra}`;
    case "customer.subscription.deleted": return `Abonnemanget avslutades${kund}`;
    case "checkout.session.completed": return `Köp genomfört${kund}${extra}`;
    case "payment_intent.succeeded": return `Kortbetalning genomförd${kund}${extra}`;
    default: return `${typ}${kund}`;
  }
}

async function klientnamn(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  try {
    const { data } = await supabaseService().from("clients").select("name").eq("id", clientId).maybeSingle();
    return (data as { name: string } | null)?.name || null;
  } catch {
    return null;
  }
}

/**
 * Hela hanteringen av en verifierad Stripe-händelse.
 * Kastar aldrig: en ohanterad händelse loggas med felet och kan köras om från ownervyn,
 * men Stripe ska få 200 så den inte spammar oss med samma händelse i timmar.
 */
export async function hanteraHandelse(event: Stripe.Event): Promise<Utfall> {
  const sb = supabaseService();

  // 1. Skriv raden först. Kollisionen på stripe_event_id ÄR idempotensspärren.
  const { error: insertFel } = await sb.from("billing_events").insert({
    stripe_event_id: event.id,
    typ: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
    hanterad: false,
  });

  if (insertFel) {
    // 23505 = unique_violation → vi har redan sett och hanterat den här händelsen.
    if (insertFel.code === "23505") {
      return { hanterad: true, besked: "Händelsen var redan hanterad.", clientId: null };
    }
    console.error("[billing] kunde inte logga händelsen:", insertFel.message);
  }

  let clientId: string | null = null;
  let extra = "";

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_failed": {
        const faktura = event.data.object as Stripe.Invoice;
        clientId = await klientFranFaktura(faktura);
        await sparaFaktura(faktura, clientId);
        extra = ` på ${oreTillKronor(faktura.amount_due)} kr`;

        if (event.type === "invoice.paid") {
          // ★ Automatisk återaktivering. Ingen manuell knapp, ingen fördröjning.
          if (clientId) {
            await registreraBetalning(clientId);
            nollstallStatusCache(clientId);
          }
        } else if (clientId) {
          await registreraMisslyckadBetalning(clientId, faktura.id);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const pren = event.data.object as Stripe.Subscription;
        clientId = (pren.metadata?.client_id as string) || (await klientFranStripeKund(kundIdAv(pren.customer)));
        await sparaAbonnemang(pren, clientId, event.type === "customer.subscription.deleted");
        extra = ` (${pren.status})`;
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        clientId = (session.metadata?.client_id as string) || (await klientFranStripeKund(kundIdAv(session.customer)));

        // Bara betalda sessioner krediterar. En session kan vara "complete" med
        // payment_status "unpaid" när betalningen är fördröjd.
        if (session.payment_status !== "paid") {
          extra = " (väntar på betalning)";
          break;
        }

        const credits = Number(session.metadata?.credits) || 0;
        if (clientId && session.metadata?.syfte === "topup" && credits > 0) {
          await laggTillCredits({
            tenantId: clientId,
            credits,
            typ: "topup",
            note: `Påfyllning köpt och betald via Stripe (${credits} tokens).`,
            createdBy: "stripe",
            // Referensen gör krediteringen idempotent mot direktdragningen.
            externReferens: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || session.id,
          });
          extra = `, ${credits} tokens tillagda`;

          // Kortet sparades vid köpet (setup_future_usage). Gör det till standardkort
          // om kunden inte redan har ett, så nästa påfyllning kan dras direkt.
          try {
            const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
            const kundId = kundIdAv(session.customer);
            if (pi && kundId) {
              const { stripeKlient } = await import("./stripe");
              const { sattStandardkortOmSaknas } = await import("./stripe-ops");
              const intent = await (await stripeKlient()).paymentIntents.retrieve(pi);
              const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
              if (pm) await sattStandardkortOmSaknas(kundId, pm);
            }
          } catch (e) {
            console.error("[billing] kunde inte spara kortet som standard:", (e as Error).message);
          }
        } else if (session.metadata?.syfte === "abonnemang") {
          extra = ", abonnemang tecknat";
          if (clientId) await registreraBetalning(clientId);
        }
        break;
      }

      case "payment_intent.succeeded": {
        // Skyddsnät för direktdragningen. Har routen redan krediterat gör laggTillCredits
        // ingenting, tack vare den unika referensen — men tappade servern anslutningen
        // mitt i dragningen kommer tokens fram den här vägen i stället.
        const intent = event.data.object as Stripe.PaymentIntent;
        clientId = (intent.metadata?.client_id as string) || (await klientFranStripeKund(kundIdAv(intent.customer)));
        const credits = Number(intent.metadata?.credits) || 0;

        if (clientId && intent.metadata?.syfte === "topup" && credits > 0) {
          await laggTillCredits({
            tenantId: clientId,
            credits,
            typ: "topup",
            note: `Påfyllning betald med kort (${credits} tokens).`,
            createdBy: "stripe",
            externReferens: intent.id,
          });
          extra = `, ${credits} tokens`;
        } else {
          // Abonnemangets egna betalningar går via invoice.paid. Ingen dubbelhantering.
          return { hanterad: true, besked: "Betalningen hör till en faktura och hanteras där.", clientId };
        }
        break;
      }

      default:
        return { hanterad: false, besked: `Händelsetypen ${event.type} hanteras inte.`, clientId: null };
    }

    const namn = await klientnamn(clientId);
    await sb
      .from("billing_events")
      .update({ hanterad: true, client_id: clientId, sammanfattning: sammanfatta(event.type, namn, extra) })
      .eq("stripe_event_id", event.id);

    return { hanterad: true, besked: "Klart.", clientId };
  } catch (e) {
    const fel = (e as Error).message;
    console.error("[billing] kunde inte hantera händelsen:", fel);
    await sb.from("billing_events").update({ fel, client_id: clientId }).eq("stripe_event_id", event.id);
    return { hanterad: false, besked: fel, clientId };
  }
}

// ── Hjälpare ────────────────────────────────────────────────────────────────

function kundIdAv(kund: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!kund) return null;
  return typeof kund === "string" ? kund : kund.id;
}

async function klientFranFaktura(faktura: Stripe.Invoice): Promise<string | null> {
  const franMetadata = faktura.metadata?.client_id as string | undefined;
  if (franMetadata) return franMetadata;
  return klientFranStripeKund(kundIdAv(faktura.customer));
}

async function sparaFaktura(faktura: Stripe.Invoice, clientId: string | null): Promise<void> {
  if (!faktura.id) return;
  const moms = oreTillKronor(faktura.total_taxes?.reduce((s, t) => s + (t.amount || 0), 0) ?? 0);
  const total = oreTillKronor(faktura.total);

  await supabaseService().from("billing_invoices").upsert(
    {
      stripe_invoice_id: faktura.id,
      client_id: clientId,
      nummer: faktura.number || null,
      belopp_ex_moms_sek: oreTillKronor(faktura.subtotal),
      moms_sek: moms,
      belopp_sek: total,
      valuta: faktura.currency || "sek",
      status: faktura.status || null,
      faktura_datum: stripeTidTillDatum(faktura.created),
      betald_datum: faktura.status === "paid" ? stripeTidTillDatum(faktura.status_transitions?.paid_at) : null,
      forfallodatum: stripeTidTillDatum(faktura.due_date),
      hosted_invoice_url: faktura.hosted_invoice_url || null,
      invoice_pdf_url: faktura.invoice_pdf || null,
    },
    { onConflict: "stripe_invoice_id" },
  );
}

async function sparaAbonnemang(pren: Stripe.Subscription, clientId: string | null, avslutat: boolean): Promise<void> {
  if (!clientId) return;
  const sb = supabaseService();
  const rad = pren.items?.data?.[0];
  const planId = (pren.metadata?.plan_id as string) || (rad?.price?.metadata?.plan_id as string) || null;

  // period_end ligger på raden i nyare Stripe-versioner och på abonnemanget i äldre.
  const periodSlut =
    (rad as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
    (pren as unknown as { current_period_end?: number }).current_period_end ??
    null;

  await sb.from("billing_subscriptions").upsert(
    {
      client_id: clientId,
      stripe_subscription_id: pren.id,
      plan_id: planId,
      stripe_status: pren.status,
      belopp_sek: oreTillKronor(rad?.price?.unit_amount),
      intervall: rad?.price?.recurring?.interval || null,
      current_period_end: stripeTidTillDatum(periodSlut),
      cancel_at_period_end: !!pren.cancel_at_period_end,
    },
    { onConflict: "client_id" },
  );

  // Avtalet följer med: en kund som tecknat i Stripe ska inte längre ha ett manuellt
  // datum som säger något annat än det Stripe faktiskt debiterar.
  const { data } = await sb.from("billing_avtal").select("client_id").eq("client_id", clientId).maybeSingle();
  const avtalPatch: Record<string, unknown> = {
    client_id: clientId,
    kalla: "stripe",
    betalsatt: "stripe",
    ...(planId ? { plan_id: planId } : {}),
    ...(avslutat ? { status: "avslutad" } : {}),
  };
  if (data) {
    await sb.from("billing_avtal").update(avtalPatch).eq("client_id", clientId);
  } else {
    await sb.from("billing_avtal").insert({
      ...avtalPatch,
      belopp_sek: oreTillKronor(rad?.price?.unit_amount) || null,
      intervall: rad?.price?.recurring?.interval === "year" ? "ar" : "manad",
      status: avslutat ? "avslutad" : "aktiv",
    });
  }
}
