"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Lightbulb, FileEdit, CalendarClock, CheckCircle2, RefreshCw, Loader2,
  ImageIcon, PenSquare, Send, Share2, ArrowUpRight, LayoutGrid,
} from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/content/overview";
import { DashHero, LivePill, HeroChip, StatTile, TONES, type Tone } from "@/components/ui/dash";

interface ClientInfo { name: string; primary_color: string }

const SOURCE_LABEL: Record<string, string> = { studio: "Studio", social: "Inlägg", linkedin: "LinkedIn", blog: "Blogg" };
const STATUS_LABEL: Record<ContentStatus, string> = { idea: "Idé", draft: "Utkast", scheduled: "Schemalagd", published: "Publicerad" };
const STATUS_COLOR: Record<ContentStatus, string> = { idea: "#6b7280", draft: "#d97706", scheduled: "#2563eb", published: "#059669" };

const STEPS: { key: ContentStatus; label: string; icon: React.ComponentType<{ className?: string }>; tone: Tone }[] = [
  { key: "idea", label: "Idéer", icon: Lightbulb, tone: "slate" },
  { key: "draft", label: "Utkast", icon: FileEdit, tone: "amber" },
  { key: "scheduled", label: "Schemalagt", icon: CalendarClock, tone: "blue" },
  { key: "published", label: "Publicerat", icon: CheckCircle2, tone: "emerald" },
];

const CREATE = [
  { href: "/dashboard/studio", label: "Studio-inlägg", desc: "Bild, karusell, story, reel", icon: ImageIcon, tone: "violet" as Tone },
  { href: "/dashboard/studio/blogg", label: "Blogg", desc: "SEO-artikel → utkast", icon: PenSquare, tone: "emerald" as Tone },
  { href: "/dashboard/skapa", label: "Skapa inlägg", desc: "Instagram / Facebook", icon: Send, tone: "blue" as Tone },
  { href: "/dashboard/linkedin", label: "LinkedIn", desc: "Pelare → post-bank", icon: Share2, tone: "amber" as Tone },
];

export default function InnehallPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [counts, setCounts] = useState<Record<ContentStatus, number>>({ idea: 0, draft: 0, scheduled: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const primary = client?.primary_color || "#6366f1";

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

  return (
    <div className="space-y-6">
      <DashHero
        title="Innehåll"
        subtitle={`Idé → skapa → publicera → följ upp. Allt på ett ställe.${client ? ` · ${client.name}` : ""}`}
        accent={primary}
        icon={LayoutGrid}
        eyebrow={<LivePill label="Innehålls-navet" />}
        chips={!loading && (
          <>
            <HeroChip icon={FileEdit} label={`${counts.draft} utkast`} />
            <HeroChip icon={CalendarClock} label={`${counts.scheduled} schemalagt`} />
            <HeroChip icon={CheckCircle2} label={`${counts.published} publicerat`} />
          </>
        )}
        right={<button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/15 backdrop-blur hover:bg-white/15">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Uppdatera
        </button>}
      />

      {/* Stegkort */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s, i) => <StatTile key={s.key} i={i} label={s.label} value={loading ? null : (counts[s.key] ?? 0)} icon={s.icon} tone={s.tone} />)}
      </div>

      {/* Skapa nytt */}
      <section className="cw-reveal rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ animationDelay: "120ms" }}>
        <h2 className="mb-4 font-display text-lg font-bold text-gray-900">Skapa nytt</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CREATE.map((c) => {
            const t = TONES[c.tone];
            return (
              <a key={c.href} href={c.href} className="group relative overflow-hidden rounded-xl border border-gray-100 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.2)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: t.grad }} />
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: t.grad, boxShadow: `0 8px 20px -8px rgba(${t.rgb},.6)` }}>
                  <c.icon className="h-[18px] w-[18px] text-white" />
                </span>
                <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-gray-900">{c.label}<ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></div>
                <div className="mt-0.5 text-xs text-gray-400">{c.desc}</div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Senaste innehåll */}
      <section className="cw-reveal rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ animationDelay: "180ms" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-900">Senaste innehåll</h2>
          <a href="/dashboard/studio/kalender" className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: primary }}>
            <CalendarClock className="h-4 w-4" /> Kalender
          </a>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Laddar…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Inget innehåll ännu — börja med “Skapa nytt” ovan.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.slice(0, 15).map((it) => (
              <a key={`${it.source}-${it.id}`} href={it.editHref} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : <ImageIcon className="h-4 w-4 text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{it.title}</div>
                  <div className="text-xs text-gray-400">{SOURCE_LABEL[it.source] || it.source} · {it.channel}</div>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${STATUS_COLOR[it.status]}1a`, color: STATUS_COLOR[it.status] }}>
                  {STATUS_LABEL[it.status]}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
