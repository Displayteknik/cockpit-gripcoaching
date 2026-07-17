"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutGrid, Lightbulb, FileEdit, CalendarClock, CheckCircle2, RefreshCw, Loader2,
  ImageIcon, PenSquare, Send, Share2, ArrowRight,
} from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/content/overview";

interface ClientInfo { name: string; primary_color: string }

const SOURCE_LABEL: Record<string, string> = { studio: "Studio", social: "Inlägg", linkedin: "LinkedIn", blog: "Blogg" };
const STATUS_LABEL: Record<ContentStatus, string> = { idea: "Idé", draft: "Utkast", scheduled: "Schemalagd", published: "Publicerad" };
const STATUS_COLOR: Record<ContentStatus, string> = { idea: "#6b7280", draft: "#d97706", scheduled: "#2563eb", published: "#059669" };

const CREATE = [
  { href: "/dashboard/studio", label: "Studio-inlägg", desc: "Bild, karusell, story, reel", icon: ImageIcon },
  { href: "/dashboard/studio/blogg", label: "Blogg", desc: "SEO-artikel → utkast", icon: PenSquare },
  { href: "/dashboard/skapa", label: "Skapa inlägg", desc: "Instagram / Facebook", icon: Send },
  { href: "/dashboard/linkedin", label: "LinkedIn", desc: "Pelare → post-bank", icon: Share2 },
];

export default function InnehallPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [counts, setCounts] = useState<Record<ContentStatus, number>>({ idea: 0, draft: 0, scheduled: 0, published: 0 });
  const [loading, setLoading] = useState(true);

  const primary = client?.primary_color || "#10B981";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/content/overview");
      const d = await r.json();
      if (r.ok) { setItems(Array.isArray(d.items) ? d.items : []); if (d.counts) setCounts(d.counts); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
    refresh();
  }, [refresh]);

  const steps = useMemo(() => ([
    { key: "idea" as const, label: "Idéer", icon: Lightbulb, hint: "Ämnen och uppslag" },
    { key: "draft" as const, label: "Utkast", icon: FileEdit, hint: "Skapade, ej klara" },
    { key: "scheduled" as const, label: "Schemalagt", icon: CalendarClock, hint: "På väg ut" },
    { key: "published" as const, label: "Publicerat", icon: CheckCircle2, hint: "Ute nu" },
  ]), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
              <LayoutGrid className="w-6 h-6" style={{ color: primary }} />
            </span>
            <div>
              <h1 className="font-display font-bold text-2xl text-gray-900">Innehåll</h1>
              <p className="text-sm text-gray-500">Allt innehåll på ett ställe — idé, skapa, publicera, följ upp. {client ? `Klient: ${client.name}` : ""}</p>
            </div>
          </div>
          <button onClick={refresh} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Uppdatera
          </button>
        </div>

        {/* Stegkort med statusantal */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.key} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${STATUS_COLOR[s.key]}1a` }}>
                  <s.icon className="w-[18px] h-[18px]" style={{ color: STATUS_COLOR[s.key] }} />
                </span>
                <span className="text-3xl font-bold tabular-nums" style={{ color: STATUS_COLOR[s.key] }}>{counts[s.key] ?? 0}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-gray-900">{s.label}</div>
              <div className="text-xs text-gray-400">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* Skapa nytt */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-display font-bold text-gray-900 text-lg mb-4">Skapa nytt</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {CREATE.map((c) => (
              <a key={c.href} href={c.href} className="group rounded-xl border border-gray-200 hover:border-gray-300 p-4 transition-colors">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${primary}14` }}>
                  <c.icon className="w-[18px] h-[18px]" style={{ color: primary }} />
                </span>
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">{c.label}<ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                <div className="text-xs text-gray-400 mt-0.5">{c.desc}</div>
              </a>
            ))}
          </div>
        </section>

        {/* Senaste innehåll + länk till kalender */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-gray-900 text-lg">Senaste innehåll</h2>
            <a href="/dashboard/studio/kalender" className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: primary }}>
              <CalendarClock className="w-4 h-4" /> Kalender
            </a>
          </div>
          {loading ? (
            <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-400">Inget innehåll ännu — börja med “Skapa nytt” ovan.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.slice(0, 15).map((it) => (
                <a key={`${it.source}-${it.id}`} href={it.editHref} className="flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{it.title}</div>
                    <div className="text-xs text-gray-400">{SOURCE_LABEL[it.source] || it.source} · {it.channel}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${STATUS_COLOR[it.status]}1a`, color: STATUS_COLOR[it.status] }}>
                    {STATUS_LABEL[it.status]}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
