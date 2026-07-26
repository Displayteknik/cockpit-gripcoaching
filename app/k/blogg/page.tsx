// Kund-yta för Blogg — serverside-spärr på modulen "blog". Återanvänder admin-blogg-
// skaparen (redan kund-orienterad: skriv fritt, Skrivhjälpen, tenant-scopad data).
import { requireCustomerFeature } from "@/lib/customer-context";
import StudioBloggPage from "@/app/dashboard/studio/blogg/page";

export const dynamic = "force-dynamic";

export default async function KBlogg() {
  await requireCustomerFeature("blog");
  return <StudioBloggPage customer />;
}
