"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Search, ExternalLink, Crown, Loader2, RefreshCw, Database, Activity } from "lucide-react";

interface CoachUser {
  id: string;
  display_name: string | null;
  brand: string | null;
  brand_color: string | null;
  ghl_location_id: string | null;
  ghl_connected: boolean;
  ghl_pipeline_name: string | null;
  status: "active" | "demo" | "setup" | "inactive";
  lobby_count: number;
  imported_prospects_count: number;
  last_import_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Summary {
  total: number;
  active: number;
  setup: number;
  demo: number;
  inactive: number;
  total_lobby_contacts: number;
  total_imported_prospects: number;
}

const STATUS_STYLE: Record<CoachUser["status"], { label: string; cls: string }> = {
  active:   { label: "Aktiv",     cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  setup:    { label: "Setup",     cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  demo:     { label: "Demo",      cls: "bg-blue-500/15 text-blue-300 ring-blue-500/30" },
  inactive: { label: "Inaktiv",   cls: "bg-slate-500/15 text-slate-400 ring-slate-500/30" },
};

const COACH_BASE = "https://mysales-coach.netlify.app";

export default function MySalesKunderPage() {
  const [users, setUsers] = useState<CoachUser[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CoachUser["status"]>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cockpit/coach-users", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setSummary(data.summary || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${u.display_name || ""} ${u.brand || ""} ${u.id} ${u.ghl_location_id || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, filter, search]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-blue" />
            MySales pionjärer
          </h1>
          <p className="text-sm text-gray-500 mt-1">Alla användare av MySales Coach · status, aktivitet, anslutning</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Uppdatera
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <SummaryCard label="Totalt" value={summary.total} onClick={() => setFilter("all")} active={filter === "all"} />
          <SummaryCard label="Aktiva" value={summary.active} color="emerald" onClick={() => setFilter("active")} active={filter === "active"} />
          <SummaryCard label="Setup" value={summary.setup} color="amber" onClick={() => setFilter("setup")} active={filter === "setup"} />
          <SummaryCard label="Demo" value={summary.demo} color="blue" onClick={() => setFilter("demo")} active={filter === "demo"} />
          <SummaryCard label="Inaktiva" value={summary.inactive} color="slate" onClick={() => setFilter("inactive")} active={filter === "inactive"} />
          <SummaryCard label="∑ Kontakter" value={summary.total_lobby_contacts} icon={<Activity className="w-3.5 h-3.5" />} />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök namn, brand, location ID…"
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Pionjär</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Lobby</th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Prospekt</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Senaste import</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Pipeline</th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Öppna som</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  Laddar pionjärer...
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                  Inga pionjärer matchar filtret.
                </td></tr>
              )}
              {!loading && filtered.map((u) => {
                const s = STATUS_STYLE[u.status];
                const name = u.display_name || u.brand || u.id.slice(0, 8) + "…";
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: u.brand_color || "#9ca3af" }} title={u.brand_color || ""} />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {u.brand && u.display_name ? `${u.brand} · ${u.display_name}` : name}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono truncate" title={u.id}>{u.id.slice(0, 18)}…</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ring-1 font-semibold uppercase tracking-wider ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{u.lobby_count}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{u.imported_prospects_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.last_import_at ? new Date(u.last_import_at).toLocaleDateString("sv-SE") : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[140px]" title={u.ghl_pipeline_name || ""}>
                      {u.ghl_pipeline_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`${COACH_BASE}/?coach=${u.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-teal-500/15 text-teal-700 border border-teal-500/30 hover:bg-teal-500/25 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Coach
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
        <Database className="w-3.5 h-3.5" />
        Datakälla: <code className="bg-gray-100 px-1.5 py-0.5 rounded">coach_users</code> + <code className="bg-gray-100 px-1.5 py-0.5 rounded">lobby_contacts</code>
        <span className="text-gray-400">·</span>
        Identitet (namn, brand, färg) sätts av varje pionjär i Coach → Inställningar.
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, color = "slate", icon, onClick, active,
}: {
  label: string; value: number; color?: "slate" | "emerald" | "amber" | "blue";
  icon?: React.ReactNode; onClick?: () => void; active?: boolean;
}) {
  const colorCls = {
    slate: "text-slate-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
  }[color];
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-xl border p-3.5 text-left transition ${
        active ? "border-brand-blue ring-2 ring-brand-blue/20" : "border-gray-200 hover:border-gray-300"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-2xl font-bold ${colorCls}`}>{value.toLocaleString()}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Wrapper>
  );
}
