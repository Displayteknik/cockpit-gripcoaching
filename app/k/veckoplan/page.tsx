// Kund-yta för Veckoplan — serverside-spärr på modulen "veckoplan".
import { requireCustomerFeature } from "@/lib/customer-context";
import VeckoplanPage from "@/app/dashboard/(inlagg)/veckoplan/page";

export const dynamic = "force-dynamic";

export default async function KVeckoplan() {
  await requireCustomerFeature("veckoplan");
  return <VeckoplanPage />;
}
