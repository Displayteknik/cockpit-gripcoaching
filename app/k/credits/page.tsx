import { requireCustomerFeature } from "@/lib/customer-context";
import { Coins } from "lucide-react";
import { CREDIT_MODUL } from "@/lib/credits";
import CreditsVy from "./CreditsVy";

export const dynamic = "force-dynamic";

// ETAPP K2-2 — kundens egen sida för bilder och video.
// Klarspråk: kunden ser aldrig kronor, och aldrig ord som "tenant", "ledger" eller
// plattformens interna namn. Credits förklaras med det de faktiskt ger: bilder och video.
export default async function KCredits() {
  const session = await requireCustomerFeature(CREDIT_MODUL);

  return (
    <div className="pb-12">
      <div className="mb-6">
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${session.primary_color}15`, color: session.primary_color }}
        >
          Bilder och video
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
          <Coins className="w-6 h-6" style={{ color: session.primary_color }} />
          Din månadskvot
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Varje bild och video du skapar drar från månadens kvot. Texter är alltid fria och drar ingenting.
        </p>
      </div>

      <CreditsVy primaryColor={session.primary_color} />
    </div>
  );
}
