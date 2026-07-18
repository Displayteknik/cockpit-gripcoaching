"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Building2, ArrowRight } from "lucide-react";

interface Quote {
  id: string; quote_number?: string; customer_name?: string; customer_company?: string;
  status?: string; total?: number; created_at?: string; updated_at?: string; sent_at?: string; won_at?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Utkast", cls: "bg-gray-100 text-gray-600" },
  sent: { label: "Skickad", cls: "bg-blue-100 text-blue-700" },
  won: { label: "Vunnen", cls: "bg-emerald-100 text-emerald-700" },
  lost: { label: "Förlorad", cls: "bg-rose-100 text-rose-700" },
};

function kr(n?: number) {
  return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—";
}
function datum(s?: string) {
  return s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export default function OffertClient({ primaryColor = "#1A6B3C" }: { primaryColor?: string }) {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    fetch("/api/offert/quotes")
      .then((r) => r.json())
      .then((d) => { setLinked(!!d.linked); setQuotes(Array.isArray(d.quotes) ? d.quotes : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}>
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
            <FileText className="w-3.5 h-3.5" /> Offertmotor
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Dina offerter</h1>
          <p className="text-white/80 mt-1.5 text-sm">Offerterna du skapat i MySales Coach, samlade här.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Laddar offerter…</div>
      ) : !linked ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Ingen offert-koppling än</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Här samlas dina offerter när kontot är kopplat till MySales Coach. Hör av dig till din rådgivare så aktiverar vi det.</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Inga offerter än</div>
          <p className="text-sm text-gray-500 mt-1">Dina offerter dyker upp här när du skapat din första.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const st = q.status ? STATUS[q.status] : undefined;
            return (
              <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{q.quote_number || "Offert"}</span>
                    {st && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {q.customer_company || q.customer_name || "—"}{q.updated_at ? ` · ${datum(q.updated_at)}` : ""}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-gray-900 tabular-nums">{kr(q.total)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        Skapa och redigera offerter i MySales Coach <ArrowRight className="w-3 h-3" /> full offert-verkstad kommer hit inom kort.
      </p>
    </div>
  );
}
