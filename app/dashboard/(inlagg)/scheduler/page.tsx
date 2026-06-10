"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Loader2, Trash2, Send, Image as ImageIcon, AlertCircle, Check, X } from "lucide-react";

interface SocialPost { id: string; hook: string; caption: string; format: string; platform: string; image_url: string | null; slides: { image_url?: string }[] | null }

interface ScheduledPost {
  id: string;
  social_post_id: string;
  scheduled_at: string;
  platform: string;
  status: "queued" | "processing" | "published" | "failed";
  ig_media_id: string | null;
  error: string | null;
  hm_social_posts: SocialPost | null;
}

export default function SchedulerPage() {
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [datetime, setDatetime] = useState(getDefaultDateTime());
  const [igConnected, setIgConnected] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [s, p, ig] = await Promise.all([
      fetch("/api/scheduler").then((r) => r.json()),
      fetch("/api/social").then((r) => r.json()),
      fetch("/api/instagram/connect").then((r) => r.json()),
    ]);
    setScheduled(s);
    setPosts((p || []).filter((x: SocialPost) => x.platform === "instagram"));
    setIgConnected(ig.connected);
  }

  async function schedule() {
    if (!selectedPostId || !datetime) return;
    const r = await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: selectedPostId, scheduled_at: new Date(datetime).toISOString(), platform: "instagram" }),
    });
    if (r.ok) {
      setShowAdd(false);
      setSelectedPostId("");
      setDatetime(getDefaultDateTime());
      reload();
    } else {
      alert("Fel: " + (await r.text()));
    }
  }

  async function remove(id: string) {
    if (!confirm("Avschemalägg?")) return;
    await fetch(`/api/scheduler?id=${id}`, { method: "DELETE" });
    reload();
  }

  const queued = scheduled.filter((s) => s.status === "queued");
  const processing = scheduled.filter((s) => s.status === "processing");
  const published = scheduled.filter((s) => s.status === "published");
  const failed = scheduled.filter((s) => s.status === "failed");

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Schemaläggare
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Boka inlägg framåt. Vercel Cron kör <strong>var 5:e minut</strong> och autopublicerar via Instagram Graph API.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} disabled={!igConnected || posts.length === 0} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
          <Calendar className="w-4 h-4" />
          Schemalägg inlägg
        </button>
      </div>

      {!igConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Instagram inte anslutet.</strong> Gå till <a href="/dashboard/installningar" className="text-blue-600 underline">Inställningar → Instagram</a> och lägg in account ID + access token för att kunna autopublicera.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="I kö" value={queued.length} color="amber" />
        <Stat label="Bearbetar" value={processing.length} color="blue" />
        <Stat label="Publicerade" value={published.length} color="emerald" />
        <Stat label="Misslyckade" value={failed.length} color="red" />
      </div>

      {[
        { items: queued, title: "Kommande", icon: Clock, color: "amber" },
        { items: failed, title: "Misslyckade", icon: AlertCircle, color: "red" },
        { items: published.slice(0, 10), title: "Publicerade (senaste 10)", icon: Check, color: "emerald" },
      ].map((section) => section.items.length > 0 && (
        <div key={section.title}>
          <h2 className="font-display font-bold text-gray-900 mb-3 flex items-center gap-2">
            <section.icon className={`w-5 h-5 text-${section.color}-600`} />
            {section.title} ({section.items.length})
          </h2>
          <div className="space-y-2">
            {section.items.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                {s.hm_social_posts?.image_url ? (
                  <img src={s.hm_social_posts.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700 uppercase">{s.platform} · {s.hm_social_posts?.format}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="text-sm font-medium text-gray-900 mt-1 truncate">{s.hm_social_posts?.hook || s.hm_social_posts?.caption?.slice(0, 80)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />
                    {new Date(s.scheduled_at).toLocaleString("sv-SE")}
                  </div>
                  {s.error && <div className="text-xs text-red-600 mt-1">⚠ {s.error}</div>}
                  {s.ig_media_id && <div className="text-xs text-emerald-600 mt-0.5">✓ IG media: {s.ig_media_id}</div>}
                </div>
                {s.status !== "published" && (
                  <button onClick={() => remove(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Schemalägg inlägg</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Välj inlägg</label>
                <select value={selectedPostId} onChange={(e) => setSelectedPostId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  <option value="">— Välj —</option>
                  {posts.map((p) => (
                    <option key={p.id} value={p.id}>{p.format} · {p.hook?.slice(0, 60) || p.caption?.slice(0, 60)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Datum & tid</label>
                <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                <div className="text-xs text-gray-400 mt-1">Bäst tider för svenska konton: tis–tor 07:00, 12:00, 20:00</div>
              </div>
              <button onClick={schedule} disabled={!selectedPostId || !datetime} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Schemalägg
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultDateTime() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setHours(12, 0, 0, 0);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = { amber: "bg-amber-50 text-amber-700 border-amber-200", blue: "bg-blue-50 text-blue-700 border-blue-200", emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", red: "bg-red-50 text-red-700 border-red-200" };
  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { queued: "bg-amber-100 text-amber-700", processing: "bg-blue-100 text-blue-700 animate-pulse", published: "bg-emerald-100 text-emerald-700", failed: "bg-red-100 text-red-700" };
  const labels: Record<string, string> = { queued: "I kö", processing: "Bearbetar", published: "Publicerat", failed: "Misslyckades" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || "bg-gray-100"}`}>{labels[status] || status}</span>;
}
