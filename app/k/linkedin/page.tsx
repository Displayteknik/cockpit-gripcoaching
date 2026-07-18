// Kundvyn av LinkedIn-motorn. Tenant-låst via kund-sessionen (getActiveClientId →
// kundens egen klient). Kräver 'linkedin'-modulen påslagen.
import { requireCustomerFeature } from "@/lib/customer-context";
import LinkedinMaker from "@/components/LinkedinMaker";

export const dynamic = "force-dynamic";

export default async function KLinkedin() {
  await requireCustomerFeature("linkedin");
  return <LinkedinMaker customerMode />;
}
