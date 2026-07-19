"use client";

// Schema-översikt & kö (Fas C-avslut): visar klientens native-schemalagda inlägg/bloggar
// (studio_scheduled) med avboka + ändra tid. Delas av admin (/dashboard/studio) och kund
// (/k/studio) — kunden ser och styr sitt eget schema. GHL-schemalagda FB/LI ligger i GHL.
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Trash2, Check, RefreshCw, Clock } from "lucide-react";

interface Job {
  id: string;
  channel: string;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  scheduled_at: string;
  status: "queued" | "processing" | "published" | "failed";
  published_at: string | null;
  error: string | null;
}

const CHANNEL_LABEL: Record<string, string> = { "ig-graph": "Instagram", "ghl-social": "GHL", "cockpit-blog": "Blogg" };
const STATUS: Record<Job["status"], { label: string; color: string }> = {
  queued: { label: "Schemalagt", color: "#2563eb" },
  processing: { label: "Publicerar…", color: "#d97706" },
  published: { label: "Publicerat", color: "#059669" },
  failed: { label: "Misslyckades", color: "#dc2626" },
};

function fmt(d: string): string {
  try { return new Date(d).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default function ScheduleQueue({ primary, refreshKey = 0 }: { primary: string; refreshKey?: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [editId, setEditId] = useState("");
  const [editWhen, setEditWhen] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/studio/schedule");
      const d = await r.json();
      if (r.ok) setJobs(Array.isArray(d.jobs) ? d.jobs : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const cancel = useCallback(async (id: string) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/studio/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (r.ok) setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch { /* ignore */ } finally { setBusy(""); }
  }, []);

  const reschedule = useCallback(async (id: string) => {
    if (!editWhen) return;
    setBusy(id);
    try {
      const r = await fetch("/api/studio/schedule", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, scheduledAt: new Date(editWhen).toISOString() }),
      });
      if (r.ok) { setEditId(""); setEditWhen(""); await load(); }
    } catch { /* ignore */ } finally { setBusy(""); }
  }, [editWhen, load]);

  // Kommande/köade först, sedan senaste.
  const upcoming = jobs.filter((j) => j.status === "queued" || j.status === "processing");
  const done = jobs.filter((j) => j.status === "published" || j.status === "failed").slice(0, 8);

  const Row = ({ j }: { j: Job }) => {
    const st = STATUS[j.status];
    const editing = editId === j.id;
    return (
      <div className="flex items-center gap-3 py-2.5">
        <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
          {j.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={j.media_url} alt="" className="w-full h-full object-cover" />
          ) : <CalendarClock className="w-4 h-4 text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 truncate">{j.title || (j.caption || "").split("\n")[0] || "Inlägg"}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span>{CHANNEL_LABEL[j.channel] || j.channel}</span> · <Clock className="w-3 h-3" /> {fmt(j.scheduled_at)}
          </div>
          {j.status === "failed" && j.error && <div className="text-[11px] text-red-500 truncate">{j.error}</div>}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${st.color}1a`, color: st.color }}>{st.label}</span>
        {j.status === "queued" && (
          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <>
                <input type="datetime-local" value={editWhen} onChange={(e) => setEditWhen(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none" />
                <button onClick={() => reschedule(j.id)} disabled={busy === j.id || !editWhen} title="Spara ny tid"
                  className="p-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: primary }}>
                  {busy === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => { setEditId(""); setEditWhen(""); }} className="text-xs text-gray-400 hover:text-gray-600 px-1">Avbryt</button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditId(j.id); setEditWhen(j.scheduled_at.slice(0, 16)); }} title="Ändra tid"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50"><Clock className="w-3.5 h-3.5" /></button>
                <button onClick={() => cancel(j.id)} disabled={busy === j.id} title="Avboka"
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {busy === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5" style={{ color: primary }} />
          <h2 className="font-display font-bold text-gray-900 text-lg">Schemalagt</h2>
          {upcoming.length > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>{upcoming.length}</span>}
        </div>
        <button onClick={load} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Uppdatera
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">Dina inlägg och bloggar som publiceras automatiskt. Instagram & blogg schemaläggs nativt (utan GHL); Facebook/LinkedIn styrs i GHL.</p>

      {upcoming.length === 0 && done.length === 0 ? (
        <div className="text-sm text-gray-400 py-4">Inget schemalagt ännu. Sätt en tid i <strong>steg 5</strong> när du publicerar.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {upcoming.map((j) => <Row key={j.id} j={j} />)}
          {done.length > 0 && (
            <>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">Nyligen</div>
              {done.map((j) => <Row key={j.id} j={j} />)}
            </>
          )}
        </div>
      )}
    </section>
  );
}
