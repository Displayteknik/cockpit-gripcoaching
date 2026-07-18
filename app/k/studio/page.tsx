// Kundvyn av Studio (premium-makaren). customerMode döljer byrå-only (GHL-config,
// CLI-payload) och låser publicering till Instagram-direkt. Tenant-låst via
// customer-sessionen (getActiveClientId → kundens egen klient). Kräver 'skapa'-modulen.
import { requireCustomerFeature } from "@/lib/customer-context";
import StudioMaker from "@/components/StudioMaker";

export const dynamic = "force-dynamic";

export default async function KStudio() {
  await requireCustomerFeature("skapa");
  return <StudioMaker customerMode />;
}
