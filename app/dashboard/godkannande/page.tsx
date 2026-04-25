"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Trash2, Check, X, Clock, MessageSquare, Loader2 } from "lucide-react";

interface ShareLink {
  id: string;
  token: string;
  resource_type: string;
  resource_id: string;
  recipient_email: string | null;
  recipient_name: string | null;
  status: string;
  comment: string | null;
  edits: Record<string, unknown> | null;
  created_at: string;
  decided_at: string | null;
  expires_at: string | null;
}

export default function GodkannandePage() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    const r = await fetch("/api/share");
    if (r.ok) setLinks(await r.json());
    setLoading(false);
  }

  async function remove(id: string) {
    if (!confirm("Ta bort delning?")) return;
    await fetch(`/api/share?id=${id}`, { method: "DELETE" });
    reload();
  }

  function copy(token: string) {
    const url = `${window.location.origin}/granska/${token}`;
    navigator.clipboard.writeText(url);
    alert("Länk kopierad: " + url);
  }

  const filtered = filter === "all" ? links : links.filter((l) => l.status === filter);
  const counts = {
    pending: links.filter((l) => l.status === "pending").length,
    approved: links.filter((l) => l.status === "approved").length,
    rejected: links.filter((l) => l.status === "rejected").length,
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          Godkännanden
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Delade utkast till kunden. Skapa delningslänkar från Social- eller Blogg-modulen, kopiera och skicka via mejl/SMS.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Väntar svar" value={counts.pending} color="amber" active={filter === "pending"} onClick={() => setFilter(filter === "pending" ? "all" : "pending")} />
        <Stat label="Godkända" value={counts.approved} color="emerald" active={filter === "approved"} onClick={() => setFilter(filter === "approved" ? "all" : "approved")} />
        <Stat label="Avvisade" value={counts.rejected} color="red" active={filter === "rejected"} onClick={() => setFilter(filter === "rejected" ? "all" : "rejected")} />
      </div>

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
          Inga delningar.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={l.status} />
                    <span className="text-xs text-gray-500 uppercase">{l.resource_type}</span>
                    {l.recipient_name && <span className="text-sm text-gray-700">→ {l.recipient_name}</span>}
                    {l.recipient_email && <span className="text-xs text-gray-500">{l.recipient_email}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Skapad {new Date(l.created_at).toLocaleString("sv-SE")}
                    {l.decided_at && ` · Beslutat ${new Date(l.decided_at).toLocaleString("sv-SE")}`}
                  </div>
                  {l.comment && (
                    <div className="mt-2 bg-blue-50 border-l-4 border-blue-400 px-3 py-2 rounded text-sm text-gray-800">
                      <div className="text-xs text-blue-700 font-semibold mb-0.5">Kund-kommentar:</div>
                      {l.comment}
                    </div>
                  )}
                  {l.edits && (
                    <div className="mt-2 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 rounded text-sm text-gray-800">
                      <div className="text-xs text-amber-700 font-semibold mb-0.5">Föreslagen ändring:</div>
                      <pre className="whitespace-pre-wrap font-body">{JSON.stringify(l.edits, null, 2)}</pre>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => copy(l.token)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Kopiera länk">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a href={`/granska/${l.token}`} target="_blank" rel="noopener" className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Öppna granskningslänk">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => remove(l.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, active, onClick }: { label: string; value: number; color: string; active: boolean; onClick: () => void }) {
  const colors: Record<string, string> = {
    amber: active ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-amber-200",
    emerald: active ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:border-emerald-200",
    red: active ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-red-200",
  };
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-xl border-2 bg-white transition-colors ${colors[color]}`}>
      <div className="text-2xl font-bold text-gray-900 font-display">{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
    pending: { color: "bg-amber-100 text-amber-700", label: "Väntar", Icon: Clock },
    approved: { color: "bg-emerald-100 text-emerald-700", label: "Godkänd", Icon: Check },
    rejected: { color: "bg-red-100 text-red-700", label: "Avvisad", Icon: X },
  };
  const m = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${m.color}`}>
      <m.Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}
