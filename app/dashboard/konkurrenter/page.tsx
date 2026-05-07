"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Search, Sparkles, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Target, Zap } from "lucide-react";

interface Competitor {
  id: string;
  name: string;
  url: string | null;
  instagram_handle: string | null;
  notes: string | null;
  last_audited: string | null;
  audit_data: { seo_score?: number; aeo_score?: number; pagespeed_mobile?: number; pagespeed_desktop?: number; word_count?: number } | null;
  intel: {
    positioning?: string;
    hooks_used?: string[];
    unique_angles?: string[];
    weaknesses?: string[];
    copy_patterns?: string[];
    gaps_to_exploit?: string[];
    steal_list?: { idea: string; how_to_apply: string; priority: number }[];
  } | null;
}

export default function KonkurrenterPage() {
  const [list, setList] = useState<Competitor[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newC, setNewC] = useState({ name: "", url: "", instagram_handle: "", notes: "" });
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const r = await fetch("/api/competitors");
    if (r.ok) setList(await r.json());
  }

  async function add() {
    if (!newC.name.trim()) return;
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newC),
    });
    setNewC({ name: "", url: "", instagram_handle: "", notes: "" });
    setShowAdd(false);
    reload();
  }

  async function analyze(c: Competitor) {
    if (!c.url) { alert("Ange URL för att analysera."); return; }
    setAnalyzing(c.id);
    try {
      const r = await fetch("/api/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_id: c.id, url: c.url }),
      });
      if (!r.ok) {
        const e = await r.json();
        alert("Fel: " + (e.error || "okänt"));
      }
      reload();
    } finally {
      setAnalyzing(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Ta bort konkurrent?")) return;
    await fetch(`/api/competitors?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-red-600" />
            Konkurrenter
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Spaning på vad som funkar för andra — och hur vi gör det bättre.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-blue-dark">
          <Plus className="w-4 h-4" />
          Ny konkurrent
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-display font-bold mb-3">Lägg till konkurrent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={newC.name} onChange={(e) => setNewC({ ...newC, name: e.target.value })} placeholder="Företagsnamn *" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={newC.url} onChange={(e) => setNewC({ ...newC, url: e.target.value })} placeholder="https://..." className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={newC.instagram_handle} onChange={(e) => setNewC({ ...newC, instagram_handle: e.target.value })} placeholder="@instagram" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={newC.notes} onChange={(e) => setNewC({ ...newC, notes: e.target.value })} placeholder="Anteckningar (valfritt)" className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} disabled={!newC.name.trim()} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">Lägg till</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Avbryt</button>
          </div>
        </div>
      )}

      {list.length === 0 && !showAdd && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400 text-sm">
          Inga konkurrenter än. Lägg till en för att börja spaningen.
        </div>
      )}

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-gray-900">{c.name}</h3>
                  {c.audit_data?.seo_score && <ScoreBadge label="SEO" value={c.audit_data.seo_score} />}
                  {c.audit_data?.aeo_score && <ScoreBadge label="AEO" value={c.audit_data.aeo_score} />}
                  {c.audit_data?.pagespeed_mobile != null && <ScoreBadge label="📱" value={c.audit_data.pagespeed_mobile} />}
                  {!c.url && <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">URL saknas</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  {c.url && <a href={c.url} target="_blank" rel="noopener" className="hover:text-blue-600 flex items-center gap-1">{c.url} <ExternalLink className="w-3 h-3" /></a>}
                  {c.instagram_handle && <span>{c.instagram_handle}</span>}
                  {c.last_audited && <span>Senast: {new Date(c.last_audited).toLocaleDateString("sv-SE")}</span>}
                </div>
                {c.notes && <div className="text-xs text-gray-500 mt-1">{c.notes}</div>}
                {analyzing === c.id && (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-purple-900">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                    <span className="font-medium">AI analyserar konkurrenten...</span>
                    <span className="text-purple-700/70">Kollar webbsida, SEO, IG, positionering — kan ta 20–40 sek.</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => analyze(c)}
                  disabled={analyzing === c.id || !c.url}
                  title={!c.url ? "Lägg till URL för att kunna analysera" : "Analysera konkurrenten med AI"}
                  className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzing === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {analyzing === c.id ? "Analyserar..." : "Analysera"}
                </button>
                {c.intel && (
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                    {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
                <button onClick={() => remove(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {expanded === c.id && c.intel && (
              <div className="border-t border-gray-100 p-5 space-y-4 bg-gray-50">
                {c.intel.positioning && (
                  <Section icon={Target} title="Positionering" color="blue">
                    <p className="text-sm text-gray-700">{c.intel.positioning}</p>
                  </Section>
                )}
                {c.intel.hooks_used && c.intel.hooks_used.length > 0 && (
                  <Section icon={Zap} title="Hooks de använder" color="purple">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      {c.intel.hooks_used.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </Section>
                )}
                {c.intel.unique_angles && c.intel.unique_angles.length > 0 && (
                  <Section icon={TrendingUp} title="Unika vinklar" color="emerald">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      {c.intel.unique_angles.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </Section>
                )}
                {c.intel.weaknesses && c.intel.weaknesses.length > 0 && (
                  <Section icon={AlertTriangle} title="Svagheter (vår vinst)" color="amber">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      {c.intel.weaknesses.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </Section>
                )}
                {c.intel.gaps_to_exploit && c.intel.gaps_to_exploit.length > 0 && (
                  <Section icon={Search} title="Innehållsluckor att fylla" color="red">
                    <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                      {c.intel.gaps_to_exploit.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </Section>
                )}
                {c.intel.steal_list && c.intel.steal_list.length > 0 && (
                  <Section icon={Sparkles} title="Steal-lista (anpassade idéer)" color="purple">
                    <div className="space-y-2">
                      {c.intel.steal_list.sort((a, b) => b.priority - a.priority).map((s, i) => (
                        <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-gray-900">{s.idea}</div>
                            <span className="flex-shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">prio {s.priority}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1"><strong>Så gör vi den bättre:</strong> {s.how_to_apply}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: { icon: React.ComponentType<{ className?: string }>; title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { blue: "text-blue-600", purple: "text-purple-600", emerald: "text-emerald-600", amber: "text-amber-600", red: "text-red-600" };
  return (
    <div>
      <h4 className="font-display font-bold text-sm flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colors[color]}`} />
        {title}
      </h4>
      {children}
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? "bg-emerald-100 text-emerald-700" : value >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${color}`}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}
