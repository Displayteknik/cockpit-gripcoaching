// Kundvyn av Ikigai-motorn (lead-magnet). Tenant-låst via kund-sessionen. Kräver 'ikigai'-modul.
import { requireCustomerFeature } from "@/lib/customer-context";
import IkigaiMaker from "@/components/IkigaiMaker";

export const dynamic = "force-dynamic";

export default async function KIkigai() {
  await requireCustomerFeature("ikigai");
  return <IkigaiMaker customerMode />;
}
