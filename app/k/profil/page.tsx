// Kund-yta för Brand-profil — serverside-spärr på modulen "profil".
import { requireCustomerFeature } from "@/lib/customer-context";
import ProfilPage from "@/app/dashboard/profil/page";

export const dynamic = "force-dynamic";

export default async function KProfil() {
  await requireCustomerFeature("profil");
  return <ProfilPage />;
}
