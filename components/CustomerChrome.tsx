"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ExternalLink, Menu, X, Sparkles, AlertTriangle } from "lucide-react";
import CustomerNav from "./CustomerNav";
import { TokenMatareKompakt, type Tokenlage } from "./TokenMatare";

export interface Statusbanner {
  ton: "info" | "varning" | "stopp";
  rubrik: string;
  text: string;
  knapp: string;
}

const nf = new Intl.NumberFormat("sv-SE");

// Responsiv kundportal-chrome: sidomeny som kollapsar till hamburger på mobil
// (kunder öppnar detta i telefonen). Speglar admin-dashboardens mönster.
//
// BETAL-1: saldot ska alltid synas. Portalen har inget sidhuvud på desktop, så mätaren
// sitter underst i sidomenyn (syns på varje sida) och som en liten siffra i mobilens
// sidhuvud (där sidomenyn är hopfälld).
export default function CustomerChrome({
  clientName, primaryColor, features, children, tokens = null, banner = null,
}: {
  clientName: string;
  primaryColor: string;
  features: string[];
  children: React.ReactNode;
  tokens?: Tokenlage | null;
  banner?: Statusbanner | null;
}) {
  const [open, setOpen] = useState(false);
  const initial = (clientName || "?").trim().charAt(0).toUpperCase();
  // Studio (Skapa inlägg) behöver bredden — form + förhandsvisning sida vid sida.
  // Bara den sidan vidgas; alla andra /k-sidor står kvar på max-w-5xl så live-klienter
  // (som inte har Studio) ser exakt samma portal som förut. Se feedback_live_client_no_disruption.
  const pathname = usePathname();
  const wide = pathname === "/k/studio";
  const kvar = tokens ? Math.max(0, tokens.tak - tokens.anvant) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-100 flex flex-col overflow-y-auto transition-transform`}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-display font-bold flex-shrink-0" style={{ background: primaryColor }}>{initial}</div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider font-bold" style={{ color: primaryColor }}>MySales Pro</div>
              <div className="font-display font-bold text-gray-900 text-sm leading-tight truncate">{clientName}</div>
            </div>
          </div>
        </div>

        <CustomerNav features={features} primaryColor={primaryColor} onNavigate={() => setOpen(false)} />

        <div className="p-4 border-t border-gray-100 space-y-3">
          {tokens && (
            <div onClick={() => setOpen(false)}>
              <TokenMatareKompakt tokens={tokens} primaryColor={primaryColor} />
            </div>
          )}
          <div>
            <a href="https://app.mysales.se" target="_blank" rel="noopener noreferrer" title="Öppnas i en ny flik" className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors mb-1">
              <ExternalLink className="w-4 h-4" /> Öppna MySales
            </a>
            <form action="/k-logout" method="post">
              <button type="submit" className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <LogOut className="w-4 h-4" /> Logga ut
              </button>
            </form>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between">
            <button onClick={() => setOpen(!open)} className="p-2 -ml-2 text-gray-700" aria-label="Meny">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="font-display font-bold text-sm text-gray-900 truncate">{clientName}</div>
            {kvar !== null ? (
              <Link href="/k/credits" className="flex items-center gap-1 text-xs font-semibold tabular-nums text-gray-600" title="Tokens kvar">
                <Sparkles className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                {nf.format(kvar)}
              </Link>
            ) : (
              <div className="w-9" />
            )}
          </div>
        </header>
        <main className="overflow-y-auto">
          <div className={`${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto px-4 sm:px-6 py-6 md:py-8`}>
            {banner && <Betalbanner banner={banner} />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Gul remsa högst upp när en betalning inte gått igenom. Full funktion kvar. */
function Betalbanner({ banner }: { banner: Statusbanner }) {
  const stopp = banner.ton === "stopp";
  return (
    <div
      className={`mb-6 flex flex-wrap items-start gap-3 rounded-2xl border px-5 py-4 ${
        stopp ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <AlertTriangle className={`mt-0.5 h-5 w-5 flex-shrink-0 ${stopp ? "text-red-600" : "text-amber-600"}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${stopp ? "text-red-800" : "text-amber-900"}`}>{banner.rubrik}</p>
        <p className={`mt-1 text-sm ${stopp ? "text-red-700" : "text-amber-800"}`}>{banner.text}</p>
      </div>
      <Link
        href="/k/betalning"
        className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity ${
          stopp ? "bg-red-600" : "bg-amber-600"
        }`}
      >
        {banner.knapp}
      </Link>
    </div>
  );
}
