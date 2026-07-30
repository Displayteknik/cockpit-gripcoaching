import Link from "next/link";
import { ArrowLeft, Plug, Activity } from "lucide-react";
import MetaOwnerConnect from "@/components/MetaOwnerConnect";
import MetaConnectionsHealth from "@/components/MetaConnectionsHealth";

export const metadata = { title: "Meta / Facebook — Anslutningsmotorn" };

// ANSLUT-1: ägarnivå-sida. Ansluter Håkans Meta-konto en gång. Per-tenant IG-koppling
// (ANSLUT-2) sker på respektive tenants Inställningar via den anslutning som görs här.
export default function MetaSettingsPage() {
  return (
    <div className="space-y-6 pb-12 max-w-2xl">
      <div>
        <Link href="/dashboard/installningar" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Inställningar
        </Link>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Plug className="w-6 h-6 text-gray-700" /> Meta / Facebook
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Ägarnivå — körs en gång. Ansluter kontot som har åtkomst till klienternas Facebook-sidor och Instagram-konton.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <MetaOwnerConnect />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-gray-700" /> Kopplade konton
        </h2>
        <MetaConnectionsHealth />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600 space-y-2">
        <div className="font-semibold text-gray-800">Så funkar det</div>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Anslut Meta här (en gång).</li>
          <li>Gå till en tenants <strong>Inställningar → Instagram</strong> och välj sida i dropdownen.</li>
          <li>Tokenhälsovakten bevakar alla kopplingar dagligen och mejlar om något behöver åtgärdas.</li>
        </ol>
      </div>
    </div>
  );
}
