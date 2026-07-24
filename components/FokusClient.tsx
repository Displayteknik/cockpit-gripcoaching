"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import PipelineStegRad from "./PipelineStegRad";
import {
  Zap,
  Loader2,
  Building2,
  ExternalLink,
  Sparkles,
  X,
  Copy,
  Check,
  TrendingUp,
  Snowflake,
  RefreshCw,
  Mic,
  Square,
  Image as ImageIcon,
  CalendarClock,
  CalendarPlus,
  Phone,
  Mail,
  CheckCircle2,
  FileText,
} from "lucide-react";

// ── Typer speglar /api/fokus/board (prioriteringsmotorn) ──
type Farg = "neutral" | "amber" | "red" | "cold";
interface ScoredCard {
  id: string;
  namn: string;
  foretag: string;
  varde: number;
  stegNamn: string;
  typ: string;
  dagarISteget: number;
  dagarOverSla: number;
  prioritet: number;
  farg: Farg;
  okantVarde: boolean;
  ghlContactId?: string;
  lagesText: string;
  rekommenderatDrag: string;
}
interface Planering {
  id: string;
  kanal: string;
  dueAt: string;
  note: string | null;
}
interface Board {
  linked: boolean;
  antal?: number;
  syncedAt?: string | null;
  locationId?: string;
  prioritering?: {
    dagensDrag: ScoredCard[];
    avgor: ScoredCard[];
    pengalinjen: { frisk: number; risk: number; kallnar: number; totalt: number };
    antalKallnar: number;
  };
  planering?: Record<string, Planering>;
  attGoraIdag?: string[];
  stegKarta?: Record<string, { aktuellId: string; pipelineNamn: string; steg: { id: string; namn: string }[] }>;
}

// "idag" / "imorgon" / "18 jul" ur ett ISO-datum.
function planText(dueAt: string): string {
  const d = new Date(dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diff = Math.round((dd.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "idag";
  if (diff === 1) return "imorgon";
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}
interface CoachSvar {
  lagesbild: string;
  disc_hypotes: string;
  drag: { vad: string; varfor: string; oppning: string };
  utkast: { kanal: string; amnesrad: string | null; text: string };
  riskflagga: string | null;
  nasta_kontroll: number;
}

function kr(n?: number) {
  return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—";
}

// Färgzon → synliga UI-signaler (kant + badge).
const ZON: Record<Farg, { kant: string; chip: string; text: string; namn: string }> = {
  red: { kant: "#ef4444", chip: "bg-red-50 text-red-700", text: "text-red-600", namn: "Bråttom" },
  amber: { kant: "#f59e0b", chip: "bg-amber-50 text-amber-700", text: "text-amber-600", namn: "I risk" },
  neutral: { kant: "#10b981", chip: "bg-emerald-50 text-emerald-700", text: "text-emerald-600", namn: "Frisk" },
  cold: { kant: "#94a3b8", chip: "bg-slate-100 text-slate-600", text: "text-slate-500", namn: "Kallnar" },
};

const VARDE_PRESETS = [10000, 25000, 50000, 100000];

export default function FokusClient({ primaryColor = "#1A6B3C" }: { primaryColor?: string }) {
  const [loading, setLoading] = useState(true);
  const [b, setB] = useState<Board>({ linked: false });
  const [coachKort, setCoachKort] = useState<ScoredCard | null>(null);

  const ladda = useCallback(() => {
    setLoading(true);
    fetch("/api/fokus/board")
      .then((r) => r.json())
      .then(setB)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    ladda();
  }, [ladda]);

  const p = b.prioritering;
  const drag = p?.dagensDrag || [];
  const avgor = p?.avgor || [];
  const pl = p?.pengalinjen;
  const planering = b.planering || {};
  const attSet = new Set(b.attGoraIdag || []);
  const attGoraKort = [...drag, ...avgor].filter((c) => attSet.has(c.id));
  const dragKvar = drag.filter((c) => !attSet.has(c.id));
  const avgorKvar = avgor.filter((c) => !attSet.has(c.id));
  // "Väntar på offert": möte hållet men offert ej skickad (typ 'mote'). Lyfts UT ur
  // Dagens drag/Avgör till egen sektion — nästa steg mot offert/order i pipelinen.
  const vantarOffert = [...dragKvar, ...avgorKvar].filter((c) => c.typ === "mote");
  const dragUtanOffert = dragKvar.filter((c) => c.typ !== "mote");
  const avgorUtanOffert = avgorKvar.filter((c) => c.typ !== "mote");

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}
      >
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
              <Zap className="w-3.5 h-3.5" /> Fokusmotor
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Idag — dina viktigaste affärer</h1>
            <p className="text-white/80 mt-1.5 text-sm max-w-lg">
              Prioriterat efter värde, brådska och hur nära pengarna affären står. Ta toppen först.
            </p>
          </div>
          <button
            onClick={ladda}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
          </button>
        </div>
        {b.linked && pl && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-md">
            <HeroKpi label="Affärer" value={String(b.antal ?? 0)} />
            <HeroKpi label="I pipeline" value={kr(pl.totalt)} />
            <HeroKpi label="Kallnar" value={String(p?.antalKallnar ?? 0)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Laddar…
        </div>
      ) : !b.linked ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Ingen koppling än</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Dina affärer visas här när kontot är kopplat till MySales Coach.
          </p>
        </div>
      ) : (
        <>
          {/* Att göra idag — planerade kontakter som förfaller */}
          {attGoraKort.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="font-display font-bold text-gray-900 text-lg">Att göra idag</h2>
                <span className="text-xs text-gray-400">({attGoraKort.length})</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">Planerade kontakter som är dags nu. Beta av dem först.</p>
              <div className="space-y-3">
                {attGoraKort.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
                    planering={planering[c.id]}
                    stegInfo={b.stegKarta?.[c.id]}
                    attGora
                    onCoacha={() => setCoachKort(c)}
                    onSaved={ladda}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Pengalinjen */}
          {pl && pl.totalt > 0 && (
            <section className="space-y-3">
              <h2 className="font-display font-bold text-gray-900 text-lg">Pengalinjen</h2>
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                  <Seg v={pl.frisk} tot={pl.totalt} c="#10b981" />
                  <Seg v={pl.risk} tot={pl.totalt} c="#f59e0b" />
                  <Seg v={pl.kallnar} tot={pl.totalt} c="#94a3b8" />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs">
                  <Legend c="#10b981" label="Friskt" v={kr(pl.frisk)} />
                  <Legend c="#f59e0b" label="I risk" v={kr(pl.risk)} />
                  <Legend c="#94a3b8" label="Kallnar" v={kr(pl.kallnar)} />
                </div>
              </div>
            </section>
          )}

          {/* Väntar på offert — möte hållet, offert ej skickad. Nästa steg mot avslut. */}
          {vantarOffert.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: primaryColor }} />
                <h2 className="font-display font-bold text-gray-900 text-lg">Väntar på offert</h2>
                <span className="text-xs text-gray-400">({vantarOffert.length})</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                Mötet är hållet men ingen offert skickad. Skicka offerten för att flytta affären mot order.
              </p>
              <div className="space-y-3">
                {vantarOffert.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
                    planering={planering[c.id]}
                    stegInfo={b.stegKarta?.[c.id]}
                    onCoacha={() => setCoachKort(c)}
                    onSaved={ladda}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Dagens drag */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: primaryColor }} />
              <h2 className="font-display font-bold text-gray-900 text-lg">Dagens drag</h2>
              <span className="text-xs text-gray-400">({dragUtanOffert.length})</span>
            </div>
            {dragUtanOffert.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8 bg-white border border-gray-100 rounded-2xl">
                Inga aktiva affärer som kräver ett drag just nu. Snyggt jobbat.
              </div>
            ) : (
              <div className="space-y-3">
                {dragUtanOffert.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
                    planering={planering[c.id]}
                    stegInfo={b.stegKarta?.[c.id]}
                    onCoacha={() => setCoachKort(c)}
                    onSaved={ladda}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Avgör (kallnar) */}
          {avgorUtanOffert.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-slate-400" />
                <h2 className="font-display font-bold text-gray-900 text-lg">Avgör</h2>
                <span className="text-xs text-gray-400">({avgorUtanOffert.length})</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                Legat still länge. Ge sista stöten eller släpp — de blockerar toppen.
              </p>
              <div className="space-y-3">
                {avgorUtanOffert.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
                    planering={planering[c.id]}
                    stegInfo={b.stegKarta?.[c.id]}
                    onCoacha={() => setCoachKort(c)}
                    onSaved={ladda}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {coachKort && (
        <CoachPanel
          kort={coachKort}
          primaryColor={primaryColor}
          onClose={() => setCoachKort(null)}
          onRefresh={ladda}
        />
      )}
    </div>
  );
}

function HeroKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-lg font-bold text-white tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] text-white/70 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function Seg({ v, tot, c }: { v: number; tot: number; c: string }) {
  const pct = tot > 0 ? (v / tot) * 100 : 0;
  if (pct <= 0) return null;
  return <div style={{ width: `${pct}%`, background: c }} />;
}

function Legend({ c, label, v }: { c: string; label: string; v: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-600">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
      {label} <span className="font-semibold text-gray-900 tabular-nums">{v}</span>
    </span>
  );
}

function DragKort({
  c,
  primaryColor,
  locationId,
  planering,
  attGora,
  stegInfo,
  onCoacha,
  onSaved,
}: {
  c: ScoredCard;
  primaryColor: string;
  locationId?: string;
  planering?: Planering;
  attGora?: boolean;
  stegInfo?: { aktuellId: string; pipelineNamn: string; steg: { id: string; namn: string }[] };
  onCoacha: () => void;
  onSaved: () => void;
}) {
  const z = ZON[c.farg];
  const [sattVarde, setSattVarde] = useState(false);
  const [egen, setEgen] = useState("");
  const [sparar, setSparar] = useState(false);
  const [klarar, setKlarar] = useState(false);
  const deeplink =
    locationId && c.ghlContactId
      ? `https://app.mysales.se/location/${locationId}/customers/detail/${c.ghlContactId}`
      : null;

  const markKlar = async () => {
    if (!planering || klarar) return;
    setKlarar(true);
    try {
      const r = await fetch("/api/fokus/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planering.id, done: true }),
      });
      const d = await r.json();
      if (d.ok) onSaved();
      else alert(d.error || "Kunde inte markera klar");
    } catch {
      alert("Kunde inte markera klar");
    } finally {
      setKlarar(false);
    }
  };

  const spara = async (varde: number) => {
    if (sparar) return;
    setSparar(true);
    try {
      const r = await fetch("/api/fokus/set-varde", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oppId: c.id, varde }),
      });
      const d = await r.json();
      if (d.ok) {
        setSattVarde(false);
        onSaved();
      } else {
        alert(d.error || "Kunde inte spara värdet");
      }
    } catch {
      alert("Kunde inte spara värdet");
    } finally {
      setSparar(false);
    }
  };

  return (
    <div
      className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${attGora ? primaryColor : z.kant}`, borderColor: attGora ? `${primaryColor}55` : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-gray-900 truncate">{c.namn || "Namnlös affär"}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${z.chip}`}>{z.namn}</span>
          </div>
          {c.foretag && c.foretag !== c.namn && (
            <div className="text-sm text-gray-500 truncate mt-0.5">{c.foretag}</div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{c.okantVarde ? "—" : kr(c.varde)}</div>
          <div className="text-[11px] text-gray-400">prioritet {c.prioritet}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">{c.stegNamn}</span>
        <span className="text-gray-400">·</span>
        <span className="text-gray-500">{c.lagesText}</span>
      </div>

      {/* Planerad kontakt */}
      {attGora && planering ? (
        <div
          className="mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
          style={{ background: `${primaryColor}12` }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
            {planering.kanal === "mejl" ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {planering.kanal === "mejl" ? "Mejla" : "Ring"} nu
            <span className="text-xs font-normal text-gray-500">· planerat {planText(planering.dueAt)}</span>
          </div>
          <button
            onClick={markKlar}
            disabled={klarar}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
            style={{ background: primaryColor }}
          >
            {klarar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Klar
          </button>
        </div>
      ) : planering ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
          <CalendarClock className="w-3.5 h-3.5" />
          Planerat {planText(planering.dueAt)} · {planering.kanal === "mejl" ? "mejl" : "ring"}
        </div>
      ) : null}

      {/* Rekommenderat drag */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${primaryColor}1a` }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: primaryColor }} />
        </span>
        <span className="text-sm text-gray-700">{c.rekommenderatDrag}</span>
      </div>

      {/* Pipeline-stegrad — se & flytta affären i GHL direkt (klick eller dra) */}
      {stegInfo && stegInfo.steg.length > 1 && (
        <PipelineStegRad oppId={c.id} stegInfo={stegInfo} primaryColor={primaryColor} onMoved={onSaved} />
      )}

      {/* Sätt värde för 0 kr-affärer */}
      {c.okantVarde && (
        <div className="mt-3">
          {!sattVarde ? (
            <button
              onClick={() => setSattVarde(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              + Sätt ett värde på affären
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {VARDE_PRESETS.map((v) => (
                <button
                  key={v}
                  disabled={sparar}
                  onClick={() => spara(v)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {(v / 1000).toLocaleString("sv-SE")}k
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  value={egen}
                  onChange={(e) => setEgen(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Eget"
                  inputMode="numeric"
                  className="w-20 text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && egen) spara(Number(egen));
                  }}
                />
                <button
                  disabled={sparar || !egen}
                  onClick={() => spara(Number(egen))}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ background: primaryColor }}
                >
                  {sparar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Spara"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onCoacha}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: primaryColor }}
        >
          <Sparkles className="w-4 h-4" /> Coacha affären
        </button>
        <PlaneraKnapp kort={c} primaryColor={primaryColor} onDone={onSaved} redanPlanerad={!!planering} />
        {c.typ === "mote" && (
          <a
            href={`https://mysales-coach.netlify.app/offertmotorn?webblead=${encodeURIComponent(c.namn || c.foretag || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50"
            style={{ borderColor: `${primaryColor}55`, color: primaryColor }}
          >
            <FileText className="w-4 h-4" /> Skapa offert
          </a>
        )}
        {deeplink && (
          <a
            href={deeplink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Öppna i MySales <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// Planera en kontakt (ring/mejl) med datum → fokus_planering + GHL-uppgift → "Att göra idag".
function PlaneraKnapp({
  kort,
  primaryColor,
  onDone,
  redanPlanerad,
  block,
}: {
  kort: ScoredCard;
  primaryColor: string;
  onDone: () => void;
  redanPlanerad?: boolean;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kanal, setKanal] = useState<"ring" | "mejl">("ring");
  const [egetDatum, setEgetDatum] = useState("");
  const [sparar, setSparar] = useState(false);

  const isoOm = (dagar: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dagar);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  };

  const plan = async (dueAt: string) => {
    if (sparar || !dueAt) return;
    setSparar(true);
    try {
      const r = await fetch("/api/fokus/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oppId: kort.id, ghlContactId: kort.ghlContactId, kanal, dueAt, kontaktNamn: kort.namn }),
      });
      const d = await r.json();
      if (d.ok) {
        setOpen(false);
        onDone();
      } else {
        alert(d.error || "Kunde inte planera");
      }
    } catch {
      alert("Kunde inte planera");
    } finally {
      setSparar(false);
    }
  };

  return (
    <div className={block ? "" : "relative"}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg border ${
          redanPlanerad ? "border-indigo-200 text-indigo-700 bg-indigo-50" : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
        }`}
      >
        <CalendarPlus className="w-4 h-4" /> {redanPlanerad ? "Omplanera" : "Planera kontakt"}
      </button>
      {open && (
        <div className={`${block ? "mt-2" : "absolute z-20 mt-2 left-0"} w-72 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 space-y-3`}>
          <div className="flex items-center gap-1.5">
            {(["ring", "mejl"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKanal(k)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg border ${
                  kanal === k ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"
                }`}
                style={kanal === k ? { background: primaryColor } : undefined}
              >
                {k === "mejl" ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                {k === "mejl" ? "Mejla" : "Ring"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <PresetKnapp label="Idag" onClick={() => plan(isoOm(0))} disabled={sparar} />
            <PresetKnapp label="Imorgon" onClick={() => plan(isoOm(1))} disabled={sparar} />
            <PresetKnapp label="Om 3 dgr" onClick={() => plan(isoOm(3))} disabled={sparar} />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={egetDatum}
              onChange={(e) => setEgetDatum(e.target.value)}
              className="flex-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
            <button
              disabled={sparar || !egetDatum}
              onClick={() => plan(new Date(`${egetDatum}T09:00:00`).toISOString())}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              {sparar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Planera"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetKnapp({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── Kontext-input med röstinmatning + bildanalys (återanvänder /api/ai/transcribe + /api/ai/vision) ──
function CoachContextInput({
  value,
  onChange,
  onSubmit,
  submitLabel,
  placeholder,
  primaryColor,
  rows = 3,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  placeholder: string;
  primaryColor: string;
  rows?: number;
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [sekunder, setSekunder] = useState(0);
  const [jobbar, setJobbar] = useState<null | "röst" | "bild">(null);
  const [fel, setFel] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const append = (snippet: string) => {
    const s = snippet.trim();
    if (!s) return;
    onChange(value ? `${value.trim()} ${s}` : s);
  };

  const stadaMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => stadaMic(), []);

  const pickMime = () => {
    if (typeof MediaRecorder === "undefined") return "";
    for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"])
      if (MediaRecorder.isTypeSupported(t)) return t;
    return "";
  };

  const startaRost = async () => {
    setFel(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setFel("Webbläsaren stödjer inte röstinspelning");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        stadaMic();
        setRecording(false);
        if (blob.size < 1200) return; // för kort → strunta
        setJobbar("röst");
        try {
          const fd = new FormData();
          const ext = (mr.mimeType || "webm").includes("mp4") ? "m4a" : "webm";
          fd.append("audio", blob, `rost.${ext}`);
          const r = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
          const d = await r.json();
          if (d.text) append(d.text);
          else setFel(d.error || "Kunde inte transkribera");
        } catch {
          setFel("Kunde inte transkribera");
        } finally {
          setJobbar(null);
        }
      };
      mr.start();
      setRecording(true);
      setSekunder(0);
      timerRef.current = setInterval(() => setSekunder((s) => s + 1), 1000);
    } catch (e) {
      setFel((e as Error).message || "Kunde inte starta mic");
    }
  };

  const stoppaRost = () => {
    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
  };

  const analyseraBild = async (file: File | Blob) => {
    setFel(null);
    if (file.size > 8 * 1024 * 1024) {
      setFel("Bilden är för stor (max 8 MB)");
      return;
    }
    setJobbar("bild");
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("läsfel"));
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const d = await r.json();
      if (d.text) append(d.text);
      else setFel(d.error || "Kunde inte analysera bilden");
    } catch {
      setFel("Kunde inte analysera bilden");
    } finally {
      setJobbar(null);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const f = item.getAsFile();
      if (f) {
        e.preventDefault();
        analyseraBild(f);
      }
    }
  };

  const upptagen = jobbar !== null;

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        rows={rows}
        placeholder={placeholder}
        className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) analyseraBild(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        {/* Röst */}
        {recording ? (
          <button
            onClick={stoppaRost}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> Stoppa
            <span className="tabular-nums">
              {Math.floor(sekunder / 60)}:{String(sekunder % 60).padStart(2, "0")}
            </span>
          </button>
        ) : (
          <button
            onClick={startaRost}
            disabled={upptagen}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {jobbar === "röst" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
            {jobbar === "röst" ? "Skriver…" : "Prata in"}
          </button>
        )}
        {/* Bild */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upptagen || recording}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          {jobbar === "bild" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
          {jobbar === "bild" ? "Analyserar…" : "Bild"}
        </button>
        {!compact && <span className="text-[11px] text-gray-400">eller klistra in en skärmbild direkt (Ctrl+V)</span>}
        <div className="flex-1" />
        <button
          onClick={onSubmit}
          disabled={!value.trim() || upptagen || recording}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
          style={{ background: primaryColor }}
        >
          <Sparkles className="w-4 h-4" /> {submitLabel}
        </button>
      </div>
      {fel && <div className="text-[11px] text-red-600">{fel}</div>}
    </div>
  );
}

// ── Coach-panel (portal till body — /k-layoutens transform bryter annars position:fixed) ──
function CoachPanel({
  kort,
  primaryColor,
  onClose,
  onRefresh,
}: {
  kort: ScoredCard;
  primaryColor: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [svar, setSvar] = useState<CoachSvar | null>(null);
  const [insamling, setInsamling] = useState<string | null>(null);
  const [fraga, setFraga] = useState("");
  const [kopierad, setKopierad] = useState(false);
  const [kontakt, setKontakt] = useState<{ namn?: string; email?: string; telefon?: string; foretag?: string } | null>(null);

  useEffect(() => {
    if (!kort.ghlContactId) return;
    fetch(`/api/fokus/contact?contactId=${encodeURIComponent(kort.ghlContactId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.linked) setKontakt(d);
      })
      .catch(() => {});
  }, [kort.ghlContactId]);

  const kor = useCallback(
    async (medFraga?: string) => {
      setLoading(true);
      setInsamling(null);
      try {
        const r = await fetch("/api/fokus/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kort, fraga: medFraga || null }),
        });
        const d = await r.json();
        if (d.insamlingsfraga) setInsamling(d.insamlingsfraga);
        else if (d.svar) setSvar(d.svar);
      } catch {
        setInsamling("Kunde inte nå coachen just nu. Försök igen om en stund.");
      } finally {
        setLoading(false);
      }
    },
    [kort],
  );

  useEffect(() => {
    kor();
  }, [kor]);

  const kopiera = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setKopierad(true);
      setTimeout(() => setKopierad(false), 1500);
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: primaryColor }}>
              <Sparkles className="w-3.5 h-3.5" /> Säljcoach
            </div>
            <div className="font-display font-bold text-gray-900">{kort.namn}</div>
            {kort.foretag && kort.foretag !== kort.namn && <div className="text-sm text-gray-500">{kort.foretag}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Faktaruta — kontaktuppgifter + planera kontakt */}
        <div className="px-6 pt-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {kontakt?.telefon ? (
                <a href={`tel:${kontakt.telefon}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-800 hover:underline">
                  <Phone className="w-3.5 h-3.5" style={{ color: primaryColor }} /> {kontakt.telefon}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <Phone className="w-3.5 h-3.5" /> Tel saknas
                </span>
              )}
              {kontakt?.email && (
                <a href={`mailto:${kontakt.email}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:underline">
                  <Mail className="w-3.5 h-3.5" style={{ color: primaryColor }} /> {kontakt.email}
                </a>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarClock className="w-3.5 h-3.5" /> {kort.lagesText}
              </span>
            </div>
            <div className="mt-2.5">
              <PlaneraKnapp
                kort={kort}
                primaryColor={primaryColor}
                redanPlanerad={false}
                block
                onDone={() => {
                  onRefresh();
                  onClose();
                }}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Coachen tänker…
            </div>
          ) : insamling ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">{insamling}</p>
              <CoachContextInput
                value={fraga}
                onChange={setFraga}
                onSubmit={() => {
                  const q = fraga.trim();
                  if (q) {
                    kor(q);
                    setFraga("");
                  }
                }}
                submitLabel="Ge mig ett råd"
                placeholder="Skriv, prata in eller klistra in en skärmbild av vad som hänt sedan sist…"
                primaryColor={primaryColor}
                rows={3}
              />
            </div>
          ) : svar ? (
            <>
              <Block titel="Läget"><GlossText text={svar.lagesbild} /></Block>
              <Block titel="Hypotes"><GlossText text={svar.disc_hypotes} /></Block>
              <div className="rounded-2xl border border-gray-100 p-4 space-y-2" style={{ background: `${primaryColor}0a` }}>
                <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: primaryColor }}>
                  Gör så här
                </div>
                <div className="font-semibold text-gray-900"><GlossText text={svar.drag.vad} /></div>
                <p className="text-sm text-gray-600"><GlossText text={svar.drag.varfor} /></p>
                <p className="text-sm text-gray-800 italic">”{svar.drag.oppning}”</p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wide font-semibold text-gray-500">
                    Utkast · {svar.utkast.kanal}
                  </div>
                  <button
                    onClick={() => kopiera(svar.utkast.text)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900"
                  >
                    {kopierad ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {kopierad ? "Kopierat" : "Kopiera"}
                  </button>
                </div>
                {svar.utkast.amnesrad && (
                  <div className="text-sm text-gray-900 font-medium">Ämne: {svar.utkast.amnesrad}</div>
                )}
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{svar.utkast.text}</pre>
              </div>
              {svar.riskflagga && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">⚠ {svar.riskflagga}</div>
              )}
              <div className="pt-1 border-t border-gray-100">
                <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2 mt-3">Följdfråga</div>
                <CoachContextInput
                  value={fraga}
                  onChange={setFraga}
                  onSubmit={() => {
                    const q = fraga.trim();
                    if (q) {
                      kor(q);
                      setFraga("");
                    }
                  }}
                  submitLabel="Fråga"
                  placeholder="Ställ en följdfråga, prata in eller klistra in en skärmbild…"
                  primaryColor={primaryColor}
                  rows={2}
                  compact
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Block({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-1">{titel}</div>
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}

// ── Ordlista: markera facktermer (DISC) i coach-texten → hovra/tap för förklaring ──
const GLOSSARY: Record<string, { titel: string; def: string }> = {
  DISC: {
    titel: "DISC",
    def: "Fyra beteendestilar (D/I/S/C) som hjälper dig anpassa HUR du säljer till just den här personen. Det är en hypotes utifrån hur de beter sig — inte en sanning.",
  },
  D: {
    titel: "D-profil (Dominant)",
    def: "Resultatorienterad, rak, snabb. Vill ha korta besked och känna kontroll. Bemöt: kom till saken, ge tydliga alternativ, respektera deras tid.",
  },
  I: {
    titel: "I-profil (Inspirerande)",
    def: "Social, entusiastisk, relationsdriven. Gillar dialog och den stora bilden. Bemöt: bygg relation, var personlig, håll energin uppe.",
  },
  S: {
    titel: "S-profil (Stabil)",
    def: "Lugn, lojal, söker harmoni. Ogillar press och snabba svängar. Bemöt: ta det tryggt, förenkla beslutet, ta bort risk och stress.",
  },
  C: {
    titel: "C-profil (Analytisk)",
    def: "Noggrann, faktadriven, försiktig. Vill ha detaljer och bevis. Bemöt: ge fakta, referenser, riskreducering och skriftligt underlag.",
  },
};

const GLOSS_RE = /(DISC|[DISC]-(?:profil|profilen|personlighet|personligheten|person|personen|typ|typen))/g;

// Renderar en textsträng och gör kända termer klickbara/hoverbara med förklaring.
function GlossText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  GLOSS_RE.lastIndex = 0;
  let i = 0;
  while ((m = GLOSS_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const key = token.startsWith("DISC") ? "DISC" : token[0];
    const entry = GLOSSARY[key];
    if (entry) parts.push(<Term key={`t${i++}`} token={token} entry={entry} />);
    else parts.push(token);
    last = GLOSS_RE.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Term({ token, entry }: { token: string; entry: { titel: string; def: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="underline decoration-dotted decoration-gray-400 underline-offset-2 font-semibold text-gray-800 cursor-help"
        aria-label={`Vad betyder ${token}?`}
      >
        {token}
      </button>
      {open && (
        <span className="absolute left-0 top-full mt-1 z-30 w-64 rounded-xl bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-xl">
          <span className="font-semibold block mb-0.5">{entry.titel}</span>
          {entry.def}
        </span>
      )}
    </span>
  );
}
