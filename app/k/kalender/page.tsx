// Kundvyn av innehållskalendern (Content Compass). Kräver 'compass'-modulen
// (PÅ per tenant via tenant_modules → syns bara för kunder som har den, aldrig
// live-klienter utan modulen). Tenant-låst via kund-sessionen.
import { requireCustomerFeature } from "@/lib/customer-context";
import CustomerCalendar from "@/components/content-compass/CustomerCalendar";

export const dynamic = "force-dynamic";

export default async function KKalender() {
  const session = await requireCustomerFeature("compass");
  return <CustomerCalendar primary={session.primary_color} />;
}
