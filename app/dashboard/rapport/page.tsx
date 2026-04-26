"use client";

import { useEffect, useState } from "react";
import { FileBarChart, Loader2, Send, Mail, Eye, Clock, Plus } from "lucide-react";

interface Report {
  id: string;
  period_start: string;
  period_end: string;
  summary: string;
  html: string;
  sent_to: string | null;
  sent_at: string | null;
  created_at: string;
}

export default function RapportPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [shouldSend, setShouldSend] = useState(true);
  const [viewing, setViewing] = useState<Report | null>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const r = await fetch("/api/reports/weekly");
    if (r.ok) setReports(await r.json());
  }

  async function generate() {
    setLoading(true);
    const r = await fetch("/api/reports/weekly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        send: shouldSend,
        recipients: recipients.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) {
      let msg = "Rapport genererad.";
      if (shouldSend) {
        msg += d.email_status?.sent ? `\n✓ Mejl skickat till ${d.email_status.to.length} mottagare.` : `\n⚠ Mejl ej skickat: ${d.email_status?.reason || "okänt"}`;
      }
      alert(msg);
      reload();
    } else {
      alert("Fel: " + (d.error || "okänt"));
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-emerald-600" />
          Veckorapport
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Sammanfattar trafik, sökord, leads och innehåll. Gemini skriver en konsultmässig veckokoll. Mejlas till kund när du klickar.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-display font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-600" />
          Generera ny rapport
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Mottagare (kommaseparerade e-postadresser)
            </label>
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="kund@exempel.se, partner@exempel.se"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lämna tom för att använda klientens default <code className="bg-gray-100 px-1 rounded">report_recipients</code>.
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={shouldSend} onChange={(e) => setShouldSend(e.target.checked)} className="rounded" />
            Skicka mejl direkt (kräver RESEND_API_KEY i env)
          </label>

          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : shouldSend ? <Send className="w-4 h-4" /> : <FileBarChart className="w-4 h-4" />}
            {loading ? "Genererar..." : shouldSend ? "Generera & mejla nu" : "Generera (utan mejl)"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display font-bold text-gray-900 mb-3">Tidigare rapporter</h2>
        {reports.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
            Inga rapporter än. Generera den första ovan.
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(r.period_start).toLocaleDateString("sv-SE")} → {new Date(r.period_end).toLocaleDateString("sv-SE")}
                    </span>
                    {r.sent_at ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        <Mail className="w-3 h-3" />
                        Mejlat
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                        <Clock className="w-3 h-3" />
                        Ej mejlat
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Skapad {new Date(r.created_at).toLocaleString("sv-SE")}
                    {r.sent_to && ` · → ${r.sent_to}`}
                  </div>
                  <div className="text-sm text-gray-700 mt-2 line-clamp-2">
                    {r.summary.slice(0, 200)}…
                  </div>
                </div>
                <button onClick={() => setViewing(r)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-700">
                  <Eye className="w-3.5 h-3.5" />
                  Visa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-bold">Rapport {viewing.period_start} → {viewing.period_end}</h3>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
            </div>
            <div className="overflow-y-auto p-5 prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{viewing.summary}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
