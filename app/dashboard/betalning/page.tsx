import { CreditCard } from "lucide-react";
import BetalningAdmin from "./BetalningAdmin";

export const dynamic = "force-dynamic";

// BETAL-1 — ownerns betalvy. Allt om kundernas affärer, Stripe och spärren på ett ställe.
// Sidgrinden ligger i proxy.ts (/dashboard kräver admin-session), API-grinden i routen.
export default function DashboardBetalning() {
  return (
    <div className="pb-16">
      <div className="mb-7">
        <div className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-emerald-600" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Betalning och abonnemang</h1>
            <p className="text-sm text-gray-600">
              Kundernas affärer, nästa betalning, Stripe och påminnelser.
            </p>
          </div>
        </div>
      </div>

      <BetalningAdmin />
    </div>
  );
}
