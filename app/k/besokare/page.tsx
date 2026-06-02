// Kund-yta för besöksstatistik — serverside-spärr på modulen "besokare".
// Återanvänder /api/seo/analytics som redan scopas till kundens client_id via
// customer-cookien (satt av /k/[token]). Datan kommer från spårningspixeln.
import { requireCustomerFeature } from "@/lib/customer-context";
import BesokareClient from "./BesokareClient";

export const dynamic = "force-dynamic";

export default async function KBesokare() {
  const session = await requireCustomerFeature("besokare");
  return <BesokareClient primaryColor={session.primary_color} clientName={session.client_name} />;
}
