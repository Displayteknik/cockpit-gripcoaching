// Kund-yta för besöksstatistik — serverside-spärr på modulen "besokare".
// Återanvänder /api/seo/analytics som redan scopas till kundens client_id via
// customer-cookien (satt av /k/[token]). Datan kommer från spårningspixeln.
import { requireCustomerFeature } from "@/lib/customer-context";
import { generateTrackingPixel } from "@/lib/setup-tools";
import BesokareClient from "./BesokareClient";

export const dynamic = "force-dynamic";

export default async function KBesokare() {
  const session = await requireCustomerFeature("besokare");
  // Spårnings-snutten kunden lägger i sin sajt-kod — det som får siffrorna att börja flöda.
  const pixel = await generateTrackingPixel({ client_id: session.client_id });
  const snippet = pixel.ok ? (pixel.data as { snippet: string }).snippet : "";
  return <BesokareClient primaryColor={session.primary_color} clientName={session.client_name} snippet={snippet} />;
}
