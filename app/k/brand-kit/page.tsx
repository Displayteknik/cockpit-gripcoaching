// Kund-yta för den grafiska profilen (färger, typsnitt, logga).
//
// Speglar /k/profil: samma sida som admin ser, serverside-spärrad på modulen. Färgerna
// åker på "profil"-modulen och inte på en egen — den som köpt Brand-profil äger sina
// färger, och ett eget modul-id hade krävt att varje befintlig kund fick nytt paket.
//
// `kundlage` döljer AI-knappen "Hämta från webbplatsen" — se kommentaren i själva sidan.
import { requireCustomerFeature } from "@/lib/customer-context";
import BrandKitPage from "@/app/dashboard/brand-kit/page";

export const dynamic = "force-dynamic";

export default async function KBrandKit() {
  await requireCustomerFeature("profil");
  return <BrandKitPage kundlage />;
}
