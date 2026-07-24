"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileEdit, CheckCircle2, Lightbulb, RefreshCw, Loader2, ExternalLink, ImageIcon, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon } from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/content/overview";
import { DashHero, LivePill, HeroChip } from "@/components/ui/dash";
import { CompassBadges, funnelTintClass, FourALabel, FunnelLabel, DiscDots } from "@/components/content-compass/badges";

interface ClientInfo { name: string; primary_color: string }

const SOURCE_LABEL: Record<string, string> = { studio: "Studio", social: "Inlägg", linkedin: "LinkedIn", blog: "Blogg" };
const STATUS_COLOR: Record<ContentStatus, string> = { idea: "#6b7280", draft: "#d97706", scheduled: "#2563eb", published: "#059669" };

function fmt(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default function KalenderPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const primary = client?.primary_color || "#10B981";

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/content/overview");
      const d = await r.json();
      if (r.ok) setItems(Array.isArray(d.items) ? d.items : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh, client]);

  const groups = useMemo(() => ({
    scheduled: items.filter((i) => i.status === "scheduled").sort((a, b) => (a.when || "").localeCompare(b.when || "")),
    draft: items.filter((i) => i.status === "draft"),
    published: items.filter((i) => i.status === "published"),
    idea: items.filter((i) => i.status === "idea"),
  }), [items]);

  // Kalendervy: gruppera per lokal dag + bygg månadens 42 celler (måndag först).
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const itemsByDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    for (const it of items) {
      if (!it.when) continue;
      const d = new Date(it.when);
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }, [items]);
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // måndag = 0
    const start = new Date(first); start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);
  const monthLabel = cursor.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const todayKey = dayKey(new Date());

  const Row = ({ it }: { it: ContentItem }) => (
    <a href={it.editHref} className={`flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors ${funnelTintClass(it.funnel_level)}`}>
      <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
        {it.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : <ImageIcon className="w-4 h-4 text-gray-300" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 truncate">{it.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="text-xs text-gray-400 truncate">{SOURCE_LABEL[it.source] || it.source} · {it.channel}{it.when ? ` · ${fmt(it.when)}` : ""}</div>
          <CompassBadges funnel={it.funnel_level} four_a={it.four_a} disc={it.disc} />
        </div>
      </div>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize" style={{ background: `${STATUS_COLOR[it.status]}1a`, color: STATUS_COLOR[it.status] }}>
        {it.source}
      </span>
    </a>
  );

  const Section = ({ title, icon, color, list, hint }: { title: string; icon: React.ReactNode; color: string; list: ContentItem[]; hint: string }) => (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="font-display font-bold text-gray-900 text-lg">{title}</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>{list.length}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      {list.length === 0 ? <div className="text-sm text-gray-400">Inget här ännu.</div> : <div className="divide-y divide-gray-100">{list.map((it) => <Row key={`${it.source}-${it.id}`} it={it} />)}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      <DashHero
        title="Kalender"
        subtitle={`Allt innehåll — Studio, inlägg, LinkedIn och blogg — samlat.${client ? ` · ${client.name}` : ""}`}
        accent={primary}
        icon={CalendarClock}
        eyebrow={<LivePill label="Publiceringsöversikt" />}
        chips={(
          <>
            <HeroChip icon={CalendarClock} label={`${groups.scheduled.length} schemalagt`} />
            <HeroChip icon={FileEdit} label={`${groups.draft.length} utkast`} />
            <HeroChip icon={CheckCircle2} label={`${groups.published.length} publicerat`} />
          </>
        )}
        right={<button onClick={refresh} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/15 backdrop-blur hover:bg-white/15">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Uppdatera
        </button>}
      />

      {/* Vy-växlare + månadsnavigering */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === "calendar" ? "text-white" : "text-gray-500 hover:text-gray-800"}`} style={view === "calendar" ? { background: primary } : {}}><LayoutGrid className="w-4 h-4" /> Kalender</button>
          <button onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === "list" ? "text-white" : "text-gray-500 hover:text-gray-800"}`} style={view === "list" ? { background: primary } : {}}><ListIcon className="w-4 h-4" /> Lista</button>
        </div>
        {view === "calendar" && (
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-gray-800 capitalize min-w-[130px] text-center">{monthLabel}</span>
            <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Idag</button>
          </div>
        )}
      </div>

      {view === "calendar" ? (
        <section className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"].map((d) => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const k = dayKey(d);
                const dayItems = itemsByDay.get(k) || [];
                const isToday = k === todayKey;
                return (
                  <div key={i} className={`min-h-[96px] rounded-lg border p-1.5 ${inMonth ? "bg-white border-gray-100" : "bg-gray-50/60 border-gray-50"}`}>
                    <div className={`text-xs mb-1 ${isToday ? "font-bold text-white inline-flex items-center justify-center w-5 h-5 rounded-full" : inMonth ? "text-gray-500" : "text-gray-300"}`} style={isToday ? { background: primary } : {}}>{d.getDate()}</div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 4).map((it) => (
                        <a key={`${it.source}-${it.id}`} href={it.editHref} title={it.title} className={`block rounded px-1.5 py-1 text-[11px] leading-tight hover:opacity-80 ${funnelTintClass(it.funnel_level) || "border-l-4 border-l-gray-200 bg-gray-50"}`}>
                          <div className="flex items-center gap-1"><FourALabel value={it.four_a} compact /><span className="truncate flex-1 text-gray-700">{it.title}</span></div>
                          {(it.funnel_level || (it.disc && it.disc.length)) && <div className="flex items-center gap-1 mt-0.5"><FunnelLabel level={it.funnel_level} /><DiscDots disc={it.disc} size={12} /></div>}
                        </a>
                      ))}
                      {dayItems.length > 4 && <div className="text-[10px] text-gray-400 pl-1">+{dayItems.length - 4} till</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
            <span className="font-semibold">Funnel:</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-slate-300 bg-slate-50" /> TOFU</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-amber-300 bg-amber-50" /> MOFU</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-emerald-400 bg-emerald-50" /> BOFU</span>
            <span className="font-semibold ml-2">DISC:</span><DiscDots disc={["D", "I", "S", "C"]} size={14} />
          </div>
        </section>
      ) : (
        <>
          <Section title="Schemalagt" color={STATUS_COLOR.scheduled} icon={<CalendarClock className="w-5 h-5" style={{ color: STATUS_COLOR.scheduled }} />} list={groups.scheduled} hint="På väg ut, sorterat efter tid." />
          <Section title="Utkast" color={STATUS_COLOR.draft} icon={<FileEdit className="w-5 h-5" style={{ color: STATUS_COLOR.draft }} />} list={groups.draft} hint="Skapade, ej publicerade — öppna i verkstaden." />
          <Section title="Publicerat" color={STATUS_COLOR.published} icon={<CheckCircle2 className="w-5 h-5" style={{ color: STATUS_COLOR.published }} />} list={groups.published} hint="Ute nu." />
          {groups.idea.length > 0 && (
            <Section title="Idéer" color={STATUS_COLOR.idea} icon={<Lightbulb className="w-5 h-5" style={{ color: STATUS_COLOR.idea }} />} list={groups.idea} hint="Uppslag att utveckla." />
          )}
        </>
      )}

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <ExternalLink className="w-3.5 h-3.5" /> Klicka på ett inlägg för att öppna det i rätt verkstad. Slutlig publicering sker där (GHL / IG / blogg).
      </p>
    </div>
  );
}
