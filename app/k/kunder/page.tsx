import { requireCustomerFeature } from "@/lib/customer-context";
import Kundregister from "@/components/Kundregister";

export const dynamic = "force-dynamic";

// KUNDREGISTER-1 — kundvyns läsande kundlista.
//
// DEL 4-tillägget (HELG-1, 2026-08-21): egen entitlement ("kundregister") i stället för
// att åka på DM-modulen. Styrd pilot — PÅ bara för Displayteknik och For Balance
// (migrations/kundregister1_pilotmodul.sql), AV för alla andra tills piloten är godkänd.
export default async function KundvyKunder() {
  await requireCustomerFeature("kundregister");

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
