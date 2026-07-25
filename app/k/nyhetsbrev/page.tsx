// Kundvyn av Nyhetsbrev-modulen. Kräver 'newsletter'-modulen (PÅ per tenant via
// tenant_modules → syns bara för kunder som har den). Tenant-låst via kund-sessionen.
import { requireCustomerFeature } from "@/lib/customer-context";
import NewsletterMaker from "@/components/NewsletterMaker";

export const dynamic = "force-dynamic";

export default async function KNyhetsbrev() {
  await requireCustomerFeature("newsletter");
  return <NewsletterMaker customerMode />;
}
