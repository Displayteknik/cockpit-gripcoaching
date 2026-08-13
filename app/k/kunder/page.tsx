import { requireCustomerFeature } from "@/lib/customer-context";
import Kundregister from "@/components/Kundregister";

export const dynamic = "force-dynamic";

// KUNDREGISTER-1 — kundvyns läsande kundlista. Bakom samma modul-grind som övriga
// kundytor: syns bara för den som har DM-modulen, eftersom listan hör ihop med pipelinen.
export default async function KundvyKunder() {
  await requireCustomerFeature("dm");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Dina kunder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Alla kontakter från MySales, samlade. Sök, filtrera på tagg och öppna den du vill
          jobba med.
        </p>
      </div>
      <Kundregister dmBasHref="/k/dm" />
    </div>
  );
}
