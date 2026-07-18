"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

          {/* Dagens drag */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: primaryColor }} />
              <h2 className="font-display font-bold text-gray-900 text-lg">Dagens drag</h2>
              <span className="text-xs text-gray-400">({drag.length})</span>
            </div>
            {drag.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8 bg-white border border-gray-100 rounded-2xl">
                Inga aktiva affärer som kräver ett drag just nu. Snyggt jobbat.
              </div>
            ) : (
              <div className="space-y-3">
                {drag.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
                    onCoacha={() => setCoachKort(c)}
                    onSaved={ladda}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Avgör (kallnar) */}
          {avgor.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-slate-400" />
                <h2 className="font-display font-bold text-gray-900 text-lg">Avgör</h2>
                <span className="text-xs text-gray-400">({avgor.length})</span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                Legat still länge. Ge sista stöten eller släpp — de blockerar toppen.
              </p>
              <div className="space-y-3">
                {avgor.map((c) => (
                  <DragKort
                    key={c.id}
                    c={c}
                    primaryColor={primaryColor}
                    locationId={b.locationId}
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
        <CoachPanel kort={coachKort} primaryColor={primaryColor} onClose={() => setCoachKort(null)} />
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
  onCoacha,
  onSaved,
}: {
  c: ScoredCard;
  primaryColor: string;
  locationId?: string;
  onCoacha: () => void;
  onSaved: () => void;
}) {
  const z = ZON[c.farg];
  const [sattVarde, setSattVarde] = useState(false);
  const [egen, setEgen] = useState("");
  const [sparar, setSparar] = useState(false);
  const deeplink =
    locationId && c.ghlContactId
      ? `https://app.mysales.se/location/${locationId}/customers/detail/${c.ghlContactId}`
      : null;

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
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${z.kant}` }}
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

// ── Coach-panel (portal till body — /k-layoutens transform bryter annars position:fixed) ──
function CoachPanel({ kort, primaryColor, onClose }: { kort: ScoredCard; primaryColor: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [svar, setSvar] = useState<CoachSvar | null>(null);
  const [insamling, setInsamling] = useState<string | null>(null);
  const [fraga, setFraga] = useState("");
  const [kopierad, setKopierad] = useState(false);

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

        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Coachen tänker…
            </div>
          ) : insamling ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">{insamling}</p>
              <textarea
                value={fraga}
                onChange={(e) => setFraga(e.target.value)}
                rows={3}
                placeholder="Skriv en mening om vad som hänt sedan sist…"
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
              <button
                disabled={!fraga.trim()}
                onClick={() => kor(fraga.trim())}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
                style={{ background: primaryColor }}
              >
                <Sparkles className="w-4 h-4" /> Ge mig ett råd
              </button>
            </div>
          ) : svar ? (
            <>
              <Block titel="Läget">{svar.lagesbild}</Block>
              <Block titel="Hypotes">{svar.disc_hypotes}</Block>
              <div className="rounded-2xl border border-gray-100 p-4 space-y-2" style={{ background: `${primaryColor}0a` }}>
                <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: primaryColor }}>
                  Gör så här
                </div>
                <div className="font-semibold text-gray-900">{svar.drag.vad}</div>
                <p className="text-sm text-gray-600">{svar.drag.varfor}</p>
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
              <div className="flex items-center gap-2 pt-1">
                <input
                  value={fraga}
                  onChange={(e) => setFraga(e.target.value)}
                  placeholder="Följdfråga till coachen…"
                  className="flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && fraga.trim()) kor(fraga.trim());
                  }}
                />
                <button
                  disabled={!fraga.trim()}
                  onClick={() => kor(fraga.trim())}
                  className="text-sm font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ background: primaryColor }}
                >
                  Fråga
                </button>
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
