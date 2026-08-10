import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { getCustomerSession } from "@/lib/customer-context";
import BetalningVy from "./BetalningVy";

export const dynamic = "force-dynamic";

// BETAL-1 (B-3) — kundens betalsida.
//
// Den enda /k-sidan en spärrad kund når. Därför får den ALDRIG gå via
// requireCustomerFeature: en modulgrind här skulle kunna låsa ute den kund som
// behöver sidan mest.
export default async function KBetalning() {
  const session = await getCustomerSession();
  if (!session) redirect("/k-utloggad");

  return (
    <div className="pb-12">
      <div className="mb-6">
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${session.primary_color}15`, color: session.primary_color }}
        >
          Ditt konto
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
          <CreditCard className="w-6 h-6" style={{ color: session.primary_color }} />
          Abonnemang och kvitton
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Här ser du vad du betalar, när nästa betalning dras och alla dina kvitton.
        </p>
      </div>

      <BetalningVy primaryColor={session.primary_color} />
    </div>
  );
}
