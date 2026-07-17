import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { moduleIcon } from "@/lib/module-icons";
import type { EffectiveModule } from "@/lib/entitlements";

// Kundvyns "Dina verktyg" — ett kort per köpt modul, kundvänligt namn + en rad.
// Kampanjmoduler badgas synligt ("✨ Ingår just nu" + label). Server-komponent.
export default function CustomerModuleCards({
  modules,
  primaryColor,
}: {
  modules: EffectiveModule[];
  primaryColor: string;
}) {
  if (!modules.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-gray-900 text-lg">Dina verktyg</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => {
          const Icon = moduleIcon(m.icon);
          return (
            <Link
              key={m.id}
              href={m.href || "/k"}
              className="group relative bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {m.campaign && (
                <span
                  className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: `${primaryColor}1a`, color: primaryColor }}
                >
                  ✨ Ingår just nu
                </span>
              )}
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${primaryColor}14` }}
              >
                <Icon className="w-5 h-5" style={{ color: primaryColor }} />
              </span>
              <div className="font-semibold text-gray-900">{m.label}</div>
              {m.description && (
                <div className="text-sm text-gray-500 mt-1 leading-relaxed">{m.description}</div>
              )}
              {m.campaign && m.campaign_label && (
                <div className="text-xs mt-2 font-medium" style={{ color: primaryColor }}>
                  {m.campaign_label}
                </div>
              )}
              <div
                className="mt-3 text-sm font-semibold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: primaryColor }}
              >
                Öppna <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
