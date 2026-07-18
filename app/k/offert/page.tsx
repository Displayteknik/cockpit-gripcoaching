// Kundvyn av Offertmotorn (första skivan: read-only offert-lista). Tenant-låst via
// identitetsbryggan (klient → egna coach_users → egna sales_quotes). Kräver 'offert'-modul.
import { requireCustomerFeature } from "@/lib/customer-context";
import OffertClient from "@/components/OffertClient";

export const dynamic = "force-dynamic";

export default async function KOffert() {
  const session = await requireCustomerFeature("offert");
  return <OffertClient primaryColor={session.primary_color} />;
}
