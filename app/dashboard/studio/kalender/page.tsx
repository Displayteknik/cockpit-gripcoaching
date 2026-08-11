"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileEdit, CheckCircle2, Lightbulb, RefreshCw, Loader2, ExternalLink, ImageIcon, LayoutGrid, List as ListIcon } from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/content/overview";
import { DashHero, LivePill, HeroChip } from "@/components/ui/dash";
import { CompassBadges, funnelTintClass } from "@/components/content-compass/badges";
import ContentCalendar from "@/components/content-compass/ContentCalendar";
import WeekGenerator from "@/components/content-compass/WeekGenerator";
import BalanceMeter from "@/components/content-compass/BalanceMeter";

interface ClientInfo { name: string; primary_color: string }

const SOURCE_LABEL: Record<string, string> = { studio: "Studio", social: "Inlägg", linkedin: "LinkedIn", blog: "Blogg" };
const STATUS_COLOR: Record<ContentStatus, string> = { idea: "#6b7280", draft: "#d97706", scheduled: "#2563eb", published: "#059669", failed: "#dc2626" };

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
  const [reloadKey, setReloadKey] = useState(0);
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

  // KALENDER-1 (Håkans krav 11/8): flytta ett inlägg genom att dra det.
  //
  // Optimistiskt: brickan hoppar direkt, för en flytt som laggar känns trasig. Går skrivningen
  // fel läggs det GAMLA datumet tillbaka och felet skrivs ut — en bricka som ligger kvar på fel
  // dag i vyn medan databasen säger något annat är värre än ett synligt fel.
  const [flyttFel, setFlyttFel] = useState("");
  const flytta = useCallback(async (it: ContentItem, nyttDatum: Date) => {
    const forra = it.when;
    const iso = nyttDatum.toISOString();
    setFlyttFel("");
    setItems((prev) => prev.map((x) => (x.id === it.id && x.source === it.source ? { ...x, when: iso, status: x.status === "draft" ? "scheduled" : x.status } : x)));
    try {
      const r = await fetch("/api/content/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: it.source, id: it.id, when: iso }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setItems((prev) => prev.map((x) => (x.id === it.id && x.source === it.source ? { ...x, when: forra, status: it.status } : x)));
        setFlyttFel(d.error || "Kunde inte flytta inlägget.");
        return;
      }
      // Läs om: statusen kan ha ändrats från utkast till schemalagt, och den räknas i grupperna.
      void refresh();
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === it.id && x.source === it.source ? { ...x, when: forra, status: it.status } : x)));
      setFlyttFel((e as Error).message);
    }
  }, [refresh]);

  const groups = useMemo(() => ({
    scheduled: items.filter((i) => i.status === "scheduled").sort((a, b) => (a.when || "").localeCompare(b.when || "")),
    draft: items.filter((i) => i.status === "draft"),
    published: items.filter((i) => i.status === "published"),
    idea: items.filter((i) => i.status === "idea"),
  }), [items]);

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

      {/* CC-4 Skapa veckans innehåll + CC-3 balansmätare (grindade på compass-modulen) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeekGenerator accent={primary} onDone={() => { setReloadKey((k) => k + 1); refresh(); }} />
        </div>
        <BalanceMeter reloadKey={reloadKey} />
      </div>

      {/* Vy-växlare + månadsnavigering */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          <button onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === "calendar" ? "text-white" : "text-gray-500 hover:text-gray-800"}`} style={view === "calendar" ? { background: primary } : {}}><LayoutGrid className="w-4 h-4" /> Kalender</button>
          <button onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${view === "list" ? "text-white" : "text-gray-500 hover:text-gray-800"}`} style={view === "list" ? { background: primary } : {}}><ListIcon className="w-4 h-4" /> Lista</button>
        </div>
      </div>

      {view === "calendar" ? (
        <section className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          {flyttFel && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{flyttFel}</div>
          )}
          <ContentCalendar items={items} primary={primary} onMove={flytta} />
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
