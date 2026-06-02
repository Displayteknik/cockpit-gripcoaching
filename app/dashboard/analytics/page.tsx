"use client";

import { useEffect, useState } from "react";
import { TrendingUp, RefreshCw, Loader2, Heart, MessageCircle, Bookmark, Share2, Eye, Users, Globe, MousePointer, ExternalLink } from "lucide-react";
import LineChart from "@/components/charts/LineChart";
import BarChart from "@/components/charts/BarChart";

interface Snapshot { id: string; followers: number; following: number; posts_count: number; snapshot_at: string }
interface PostMetric { id: string; ig_media_id: string; likes: number; comments: number; saves: number; shares: number; reach: number; impressions: number; captured_at: string }
interface SiteTraffic {
  visits_24h: number;
  visits_7d: number;
  visits_30d: number;
  top_paths: { key: string; count: number }[];
  top_referrers: { key: string; count: number }[];
  recent: { path: string | null; referrer: string | null; ts: string }[];
}

export default function AnalyticsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [metrics, setMetrics] = useState<PostMetric[]>([]);
  const [traffic, setTraffic] = useState<SiteTraffic | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [igConnected, setIgConnected] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [s, m, ig, t] = await Promise.all([
      fetch("/api/analytics/snapshots").then((r) => r.ok ? r.json() : []),
      fetch("/api/analytics/metrics").then((r) => r.ok ? r.json() : []),
      fetch("/api/instagram/connect").then((r) => r.json()),
      fetch("/api/seo/analytics").then((r) => r.ok ? r.json() : null),
    ]);
    setSnapshots(s);
    setMetrics(m);
    setIgConnected(ig.connected);
    setTraffic(t);
  }

  async function sync() {
    setSyncing(true);
    const r = await fetch("/api/instagram/sync", { method: "POST" });
    const d = await r.json();
    setSyncing(false);
    if (r.ok) {
      alert(`Synkat: ${d.profile?.followers_count} följare, ${d.insights_count} inläggs-metrics`);
      reload();
    } else {
      alert("Fel: " + (d.error || "okänt"));
    }
  }

  const followerData = snapshots.slice().reverse().map((s) => ({
    x: new Date(s.snapshot_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
    y: s.followers || 0,
  }));

  const recentMetrics = metrics.slice(0, 10);
  const engagementBars = recentMetrics.map((m) => ({
    label: m.ig_media_id?.slice(-6) || "?",
    value: (m.likes || 0) + (m.comments || 0) + (m.saves || 0) + (m.shares || 0),
  }));

  const totals = metrics.reduce((acc, m) => ({
    likes: acc.likes + (m.likes || 0),
    comments: acc.comments + (m.comments || 0),
    saves: acc.saves + (m.saves || 0),
    shares: acc.shares + (m.shares || 0),
    reach: acc.reach + (m.reach || 0),
    impressions: acc.impressions + (m.impressions || 0),
  }), { likes: 0, comments: 0, saves: 0, shares: 0, reach: 0, impressions: 0 });

  const latest = snapshots[0];
  const previous = snapshots[Math.min(snapshots.length - 1, 7)];
  const followerDelta = latest && previous ? latest.followers - previous.followers : 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-purple-600" />
            Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sajttrafik (pixel) + Instagram (Graph API). Två datakällor, ett ställe.
          </p>
        </div>
        <button onClick={sync} disabled={syncing || !igConnected} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Synka från Instagram
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ SAJTTRAFIK (PIXEL) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="font-display font-bold text-gray-900">Sajttrafik (pixel)</h2>
          </div>
          {traffic && traffic.visits_30d === 0 && (
            <span className="text-[11px] text-gray-400">Inga besök än — pixeln väntar på trafik</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <KPI icon={MousePointer} label="Besök 24h" value={traffic?.visits_24h ?? "—"} color="blue" />
          <KPI icon={MousePointer} label="Besök 7d" value={traffic?.visits_7d ?? "—"} color="blue" />
          <KPI icon={MousePointer} label="Besök 30d" value={traffic?.visits_30d ?? "—"} color="blue" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mest besökta sidor</h3>
            {!traffic || traffic.top_paths.length === 0 ? (
              <p className="text-xs text-gray-400">Ingen data än</p>
            ) : (
              <ul className="space-y-1.5">
                {traffic.top_paths.slice(0, 5).map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate font-mono text-xs" title={p.key}>{p.key || "/"}</span>
                    <span className="text-gray-500 font-semibold tabular-nums">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Var trafiken kommer ifrån</h3>
            {!traffic || traffic.top_referrers.length === 0 ? (
              <p className="text-xs text-gray-400">Ingen data än — eller alla besök är direkt</p>
            ) : (
              <ul className="space-y-1.5">
                {traffic.top_referrers.slice(0, 5).map((r, i) => {
                  const host = r.key.replace(/^https?:\/\//, "").split("/")[0];
                  return (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex items-center gap-1.5" title={r.key}>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                        {host || r.key}
                      </span>
                      <span className="text-gray-500 font-semibold tabular-nums">{r.count}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {traffic && traffic.recent.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Senaste 10 besöken</h3>
            <ul className="space-y-1 text-xs">
              {traffic.recent.slice(0, 10).map((v, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-400 tabular-nums w-16 shrink-0">{new Date(v.ts).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-mono truncate flex-1" title={v.path || ""}>{v.path || "/"}</span>
                  {v.referrer && <span className="text-gray-400 truncate max-w-[120px]" title={v.referrer}>← {v.referrer.replace(/^https?:\/\//, "").split("/")[0]}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ INSTAGRAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center gap-2 pt-2">
        <Eye className="w-4 h-4 text-pink-600" />
        <h2 className="font-display font-bold text-gray-900 text-base">Instagram</h2>
      </div>

      {!igConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Anslut Instagram i <a href="/dashboard/installningar" className="text-blue-600 underline">Inställningar</a> för att komma igång.
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Users} label="Följare nu" value={latest?.followers ?? "—"} sub={followerDelta !== 0 ? `${followerDelta > 0 ? "+" : ""}${followerDelta} (7d)` : ""} color="purple" />
        <KPI icon={Heart} label="Likes (alla mätta)" value={totals.likes} color="pink" />
        <KPI icon={Eye} label="Räckvidd" value={totals.reach} color="blue" />
        <KPI icon={Bookmark} label="Saves" value={totals.saves} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Följartillväxt" subtitle={snapshots.length === 0 ? "Synka för att börja samla data" : `${snapshots.length} mätpunkter`}>
          {snapshots.length > 1 ? <LineChart data={followerData} color="#7c3aed" label="följare" /> : <Empty />}
        </Card>
        <Card title="Engagement per inlägg" subtitle="Likes + kommentarer + saves + shares">
          {engagementBars.length > 0 ? <BarChart data={engagementBars} color="#ec4899" /> : <Empty />}
        </Card>
      </div>

      <Card title={`Senaste inlägg (${recentMetrics.length})`}>
        {recentMetrics.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 px-2">Media-ID</th>
                  <th className="text-right py-2 px-2"><Heart className="w-3 h-3 inline" /></th>
                  <th className="text-right py-2 px-2"><MessageCircle className="w-3 h-3 inline" /></th>
                  <th className="text-right py-2 px-2"><Bookmark className="w-3 h-3 inline" /></th>
                  <th className="text-right py-2 px-2"><Share2 className="w-3 h-3 inline" /></th>
                  <th className="text-right py-2 px-2">Räckvidd</th>
                  <th className="text-left py-2 px-2">Synkad</th>
                </tr>
              </thead>
              <tbody>
                {recentMetrics.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50">
                    <td className="py-2 px-2 font-mono text-xs text-gray-600">{m.ig_media_id?.slice(-10) || "—"}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.likes}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.comments}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.saves}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{m.shares}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-600">{m.reach}</td>
                    <td className="py-2 px-2 text-xs text-gray-400">{new Date(m.captured_at).toLocaleDateString("sv-SE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-display font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Empty() { return <div className="text-center text-sm text-gray-400 py-6">Ingen data — synka från Instagram</div>; }

function KPI({ icon: Icon, label, value, sub, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; sub?: string; color: string }) {
  const colors: Record<string, string> = { purple: "text-purple-600 bg-purple-50 border-purple-100", pink: "text-pink-600 bg-pink-50 border-pink-100", blue: "text-blue-600 bg-blue-50 border-blue-100", emerald: "text-emerald-600 bg-emerald-50 border-emerald-100" };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors[color]} mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold font-display text-gray-900">{typeof value === "number" ? value.toLocaleString("sv-SE") : value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-emerald-600 mt-0.5 font-medium">{sub}</div>}
    </div>
  );
}
