"use client";

import { useState } from "react";
import { LogOut, ArrowLeft, Menu, X } from "lucide-react";
import CustomerNav from "./CustomerNav";

// Responsiv kundportal-chrome: sidomeny som kollapsar till hamburger på mobil
// (kunder öppnar detta i telefonen). Speglar admin-dashboardens mönster.
export default function CustomerChrome({
  clientName, primaryColor, features, children,
}: {
  clientName: string; primaryColor: string; features: string[]; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const initial = (clientName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-100 flex flex-col overflow-y-auto transition-transform`}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-display font-bold flex-shrink-0" style={{ background: primaryColor }}>{initial}</div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: primaryColor }}>MySales Pro</div>
              <div className="font-display font-bold text-gray-900 text-sm leading-tight truncate">{clientName}</div>
            </div>
          </div>
        </div>

        <CustomerNav features={features} primaryColor={primaryColor} onNavigate={() => setOpen(false)} />

        <div className="p-4 border-t border-gray-100">
          <a href="https://app.mysales.se" className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors mb-1">
            <ArrowLeft className="w-4 h-4" /> Tillbaka till MySales
          </a>
          <form action="/k-logout" method="post">
            <button type="submit" className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <LogOut className="w-4 h-4" /> Logga ut
            </button>
          </form>
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
            <div className="w-9" />
          </div>
        </header>
        <main className="overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
