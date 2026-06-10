// Kund-yta för Skapa — återanvänder samma komponent som byrå-vyn.
// Customer-cookien sätts redan av /k/[token] så client_id-resolution fungerar.
// Serverside-spärr: kunden måste ha modulen "skapa" påslagen.
import { requireCustomerFeature } from "@/lib/customer-context";
import SkapaPage from "@/app/dashboard/(inlagg)/skapa/page";

export const dynamic = "force-dynamic";

export default async function KSkapa() {
  await requireCustomerFeature("skapa");
  return <SkapaPage />;
}
