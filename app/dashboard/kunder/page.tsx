import Kundregister from "@/components/Kundregister";

export const dynamic = "force-dynamic";

// KUNDREGISTER-1 — byråvyns kundlista. Samma komponent som kundvyn, samma spegel,
// samma läs-only-regel. Skillnaden är bara vilken DM-yta "I pipeline" leder till.
export default function ByravyKunder() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Kunder</h1>
        <p className="text-sm text-gray-500 mt-1">
          Den valda kundens kontakter i MySales. Cockpit läser — ändringar gör du i MySales.
        </p>
      </div>
      <Kundregister dmBasHref="/dashboard/dm" />
    </div>
  );
}
