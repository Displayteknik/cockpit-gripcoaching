// Kundvyn av Fokusmotorn (read-only säljöversikt). Tenant-låst via identitetsbryggan.
// Kräver 'fokus'-modul.
import { requireCustomerFeature } from "@/lib/customer-context";
import FokusClient from "@/components/FokusClient";

export const dynamic = "force-dynamic";

export default async function KFokus() {
  const session = await requireCustomerFeature("fokus");
  return <FokusClient primaryColor={session.primary_color} />;
}
