// Kund-yta för DM & Pipeline — serverside-spärr på modulen "dm".
import { requireCustomerFeature } from "@/lib/customer-context";
import DmPage from "@/app/dashboard/(inlagg)/dm/page";

export const dynamic = "force-dynamic";

export default async function KDm() {
  await requireCustomerFeature("dm");
  // customerMode döljer Auto-svar-fliken. Systemet skickar aldrig åt kunden — kunden
  // skriver, systemet kommer ihåg. Se kommentaren i dashboard-sidan (FIX-1/B1).
  return <DmPage customerMode />;
}
