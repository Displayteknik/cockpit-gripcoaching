"use client";

// Kundvyn av innehållskalendern (/k/kalender). Content Compass i kundens röst:
// skapa hela veckans innehåll, se balansen, och överblicka allt planerat innehåll.
// Tenant-låst via kund-sessionen (API:erna resolvar kundens egen klient).
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileEdit, CheckCircle2, RefreshCw, Loader2, LayoutGrid, List as ListIcon, ImageIcon, ArrowRight, Trash2 } from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/content/overview";
import { DashHero, LivePill, HeroChip } from "@/components/ui/dash";
import { CompassBadges, funnelTintClass } from "@/components/content-compass/badges";
import ContentCalendar from "@/components/content-compass/ContentCalendar";
import WeekGenerator from "@/components/content-compass/WeekGenerator";
import BalanceMeter from "@/components/content-compass/BalanceMeter";

const SOURCE_LABEL: Record<string, string> = { studio: "Studio", social: "Inlägg", linkedin: "LinkedIn", blog: "Blogg" };
const STATUS_LABEL: Record<string, string> = { idea: "Idé", draft: "Utkast", scheduled: "Schemalagt", published: "Publicerat" };
const STATUS_COLOR: Record<ContentStatus, string> = { idea: "#6b7280", draft: "#d97706", scheduled: "#2563eb", published: "#059669" };

function fmt(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default function CustomerCalendar({ primary = "#1A6B3C", canStudio = true, canLinkedin = true, canBlog = true }: { primary?: string; canStudio?: boolean; canLinkedin?: boolean; canBlog?: boolean }) {
  const [vald, setVald] = useState<ContentItem | null>(null); // öppnad post i detaljvyn
  const [raderar, setRaderar] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/content/overview");
      const d = await r.json();
      if (r.ok) setItems(Array.isArray(d.items) ? d.items : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const groups = useMemo(() => ({
    scheduled: items.filter((i) => i.status === "scheduled").sort((a, b) => (a.when || "").localeCompare(b.when || "")),
    draft: items.filter((i) => i.status === "draft"),
    published: items.filter((i) => i.status === "published"),
  }), [items]);

  // Länka till rätt verkstad per källa, och bara till moduler kunden faktiskt har.
  // Ett blogginlägg ska öppnas i Blogg, inte i Studio med ett id Studion inte känner igen.
  const linkFor = (it: ContentItem): string => {
    if (it.source === "linkedin") return canLinkedin ? "/k/linkedin" : "/k";
    if (it.source === "blog") return canBlog ? "/k/blogg" : "/k";
    if (!canStudio) return "/k";
    // Bara studio_posts kan djuplänkas med id (Studion slår upp posten på ?post=).
    return it.source === "studio" ? `/k/studio?post=${it.id}` : "/k/studio";
  };

  const Row = ({ it }: { it: ContentItem }) => {
    const href = linkFor(it);
    return (
      <a href={href} className={`group flex items-center gap-3 py-2.5 hover:bg-gray-50 -mx-3 px-3 rounded-xl transition-colors ${funnelTintClass(it.funnel_level)}`}>
        <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center ring-1 ring-black/5">
          {it.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : <ImageIcon className="w-[18px] h-[18px] text-gray-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-900 truncate">{it.title}</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-xs text-gray-400 truncate tabular-nums">{SOURCE_LABEL[it.source] || it.source} · {it.channel}{it.when ? ` · ${fmt(it.when)}` : ""}</div>
            <CompassBadges funnel={it.funnel_level} four_a={it.four_a} disc={it.disc} />
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" style={{ color: primary }} />
      </a>
    );
  };

  const Section = ({ title, icon, color, list, hint }: { title: string; icon: React.ReactNode; color: string; list: ContentItem[]; hint: string }) => (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}1a` }}>{icon}</span>
        <h2 className="font-display font-bold text-gray-900 text-lg">{title}</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums" style={{ background: `${color}1a`, color }}>{list.length}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3 pl-12">{hint}</p>
      {list.length === 0 ? <div className="text-center text-sm text-gray-400 py-8">Inget här ännu. Skapa veckans innehåll högst upp så dyker det upp här.</div> : <div className="divide-y divide-gray-100">{list.map((it) => <Row key={`${it.source}-${it.id}`} it={it} />)}</div>}
    </section>
  );

  return (
    <div className="space-y-6">
      <DashHero
        title="Kalender"
        subtitle="Skapa hela veckans innehåll färdigprofilerat och se allt planerat på ett ställe."
        accent={primary}
        icon={CalendarClock}
        eyebrow={<LivePill label="Din innehållsplan" />}
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeekGenerator accent={primary} onDone={() => { setReloadKey((k) => k + 1); refresh(); }} />
        </div>
        <BalanceMeter reloadKey={reloadKey} />
      </div>

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === "calendar" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`} style={view === "calendar" ? { background: primary } : {}}><LayoutGrid className="w-4 h-4" /> Kalender</button>
        <button onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === "list" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`} style={view === "list" ? { background: primary } : {}}><ListIcon className="w-4 h-4" /> Lista</button>
      </div>

      {view === "calendar" ? (
        <section className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <ContentCalendar items={items} primary={primary} hrefFor={linkFor} onSelect={setVald} />
        </section>
      ) : (
        <>
          <Section title="Schemalagt" color={STATUS_COLOR.scheduled} icon={<CalendarClock className="w-5 h-5" style={{ color: STATUS_COLOR.scheduled }} />} list={groups.scheduled} hint="På väg ut, sorterat efter tid." />
          <Section title="Utkast" color={STATUS_COLOR.draft} icon={<FileEdit className="w-5 h-5" style={{ color: STATUS_COLOR.draft }} />} list={groups.draft} hint="Skapade, ej publicerade. Öppna i Studio för att lägga bild och publicera." />
          <Section title="Publicerat" color={STATUS_COLOR.published} icon={<CheckCircle2 className="w-5 h-5" style={{ color: STATUS_COLOR.published }} />} list={groups.published} hint="Ute nu." />
        </>
      )}

      {/* Detaljvy: klick på en post i kalendern öppnar den så den går att redigera eller radera. */}
      {vald && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setVald(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: primary }}>
                  {SOURCE_LABEL[vald.source] || vald.source}
                </div>
                <div className="font-display font-bold text-gray-900 leading-tight">{vald.title}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {STATUS_LABEL[vald.status]}{vald.when ? ` · ${fmt(vald.when)}` : ""} · {vald.channel}
                </div>
                <div className="mt-2"><CompassBadges funnel={vald.funnel_level} four_a={vald.four_a} disc={vald.disc} /></div>
              </div>
              <button onClick={() => setVald(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0" title="Stäng">✕</button>
            </div>
            {vald.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vald.imageUrl} alt="" className="w-full max-h-52 object-cover" />
            )}
            <div className="p-6 space-y-2.5">
              <a
                href={linkFor(vald)}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90"
                style={{ background: primary }}
              >
                Öppna och redigera <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={async () => {
                  if (!confirm(`Radera "${vald.title}"? Det går inte att ångra.`)) return;
                  setRaderar(true);
                  try {
                    const r = await fetch(`/api/content/item?source=${vald.source}&id=${encodeURIComponent(vald.id)}`, { method: "DELETE" });
                    if (r.ok) { setVald(null); await refresh(); }
                    else alert("Kunde inte radera posten.");
                  } finally { setRaderar(false); }
                }}
                disabled={raderar}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {raderar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Radera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
