import { NextResponse } from "next/server";
import { stripeKlientOrNull } from "@/lib/billing/stripe";
import { hamtaInstallningar } from "@/lib/billing/installningar";
import { hanteraHandelse } from "@/lib/billing/webhook";

export const runtime = "nodejs";
// Kroppen måste läsas RÅ och obearbetad: signaturen räknas på exakt de byte Stripe
// skickade. Minsta omformatering (t.ex. JSON.parse och tillbaka) gör signaturen ogiltig.
export const dynamic = "force-dynamic";

// BETAL-1 (B-2) — Stripes webhook.
//
// ★ Routen är publik i proxy:n eftersom Stripe inte skickar någon cookie. Den är i
// stället grindad HÅRT här, på signaturen: utan giltig signatur mot vår webhook-hemlighet
// avvisas anropet. Samma mönster som Metas Instagram-webhook.
//
// Vi svarar 200 även när hanteringen fallerar, så länge signaturen stämmer. Skälet:
// en 500 får Stripe att skicka om händelsen i timmar. Felet loggas på raden i
// billing_events i stället, där det syns i ownervyn och går att köra om.

export async function POST(req: Request) {
  const signatur = req.headers.get("stripe-signature");
  if (!signatur) {
    return NextResponse.json({ error: "saknar signatur" }, { status: 400 });
  }

  const stripe = await stripeKlientOrNull();
  const { stripe_webhook_secret } = await hamtaInstallningar();
  if (!stripe || !stripe_webhook_secret) {
    // Fail-closed: utan hemlighet kan vi inte veta att anropet kommer från Stripe.
    console.error("[stripe-webhook] webhook-hemlighet saknas — anropet avvisas");
    return NextResponse.json({ error: "webhook ej konfigurerad" }, { status: 503 });
  }

  const rakropp = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rakropp, signatur, stripe_webhook_secret);
  } catch (e) {
    console.error("[stripe-webhook] signaturen stämmer inte:", (e as Error).message);
    return NextResponse.json({ error: "ogiltig signatur" }, { status: 400 });
  }

  const utfall = await hanteraHandelse(event);
  return NextResponse.json({ mottagen: true, hanterad: utfall.hanterad, besked: utfall.besked });
}
