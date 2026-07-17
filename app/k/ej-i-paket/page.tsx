import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-context";
import { getModuleRegistry } from "@/lib/entitlements";
import { Lock, ArrowLeft, ArrowRight } from "lucide-react";

// Kundvänlig "modulen ingår inte"-sida. Visas när en kund öppnar en URL till en
// modul de inte har (serverside-grinden i requireCustomerFeature skickar hit).
// Aldrig data, aldrig tekniskt fel — bara en vänlig förklaring + väg vidare.
export default async function EjIPaketPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const session = await getCustomerSession();
  const primary = session?.primary_color || "#1A6B3C";
  const registry = await getModuleRegistry();
  const mod = registry.find((x) => x.id === m);
  const namn = mod?.label || "Den här funktionen";

  return (
    <div className="max-w-xl mx-auto py-16">
      <div className="rounded-3xl border border-gray-100 bg-white p-8 md:p-10 shadow-sm text-center">
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5"
          style={{ background: `${primary}14` }}
        >
          <Lock className="w-7 h-7" style={{ color: primary }} />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {namn} ingår inte i ditt paket ännu
        </h1>
        <p className="text-gray-600 mt-3 leading-relaxed">
          {mod?.description
            ? `${mod.description} `
            : ""}
          Vill du börja använda {mod ? mod.label.toLowerCase() : "den här funktionen"}? Hör av dig till
          din rådgivare på MySales så öppnar vi den för dig.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
          <a
            href="https://app.mysales.se"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{ background: primary }}
          >
            Hör av dig till din rådgivare <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            href="/k"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-gray-600 border border-gray-200 font-semibold hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Tillbaka till översikten
          </Link>
        </div>
      </div>
    </div>
  );
}
