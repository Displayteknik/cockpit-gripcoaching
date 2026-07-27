"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, RotateCcw, Check } from "lucide-react";
import { DashHero } from "@/components/ui/dash";
import { CompassBadges } from "@/components/content-compass/badges";
import ContentToolbox from "@/components/content-compass/ContentToolbox";
import { STANDARD_SCHEDULE, DAY_KEYS, DAY_LABEL, type CompassDay, type CompassSchedule, type DayKey, type Cadence, type FunnelLevel, type DiscLetter } from "@/lib/content-compass/data";
import type { FourA } from "@/lib/content-framework";

const FOURA_OPTS: FourA[] = ["analytical", "aspirational", "actionable", "authentic"];
const FUNNEL_OPTS: FunnelLevel[] = ["tofu", "mofu", "bofu"];
const DISC_OPTS: DiscLetter[] = ["D", "I", "S", "C"];

export default function ContentCompassPage() {
  const [days, setDays] = useState<Record<DayKey, CompassDay>>(STANDARD_SCHEDULE);
  const [cadence, setCadence] = useState<Cadence>("7");
  const [activeDays, setActiveDays] = useState<DayKey[]>(DAY_KEYS); // fritt valda publiceringsdagar
  const [clientName, setClientName] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/content-compass");
      const d = await r.json();
      if (r.ok) {
        setDays(d.schedule || STANDARD_SCHEDULE);
        setCadence(d.cadence || "7");
        if (Array.isArray(d.activeDays) && d.activeDays.length) setActiveDays(d.activeDays as DayKey[]);
        setClientName(d.clientName || "");
        setIsDefault(!!d.isDefault);
      }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setDay = (k: DayKey, patch: Partial<CompassDay>) => {
    setDays((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
    setSaved(false);
  };
  const toggleDisc = (k: DayKey, letter: DiscLetter) => {
    setDays((prev) => {
      const cur = prev[k].disc;
      const next = cur.includes(letter) ? cur.filter((x) => x !== letter) : [...cur, letter];
      return { ...prev, [k]: { ...prev[k], disc: next.length ? next : cur } }; // minst en DISC
    });
    setSaved(false);
  };

  const save = useCallback(async () => {
    setSaving(true); setSaved(false);
    try {
      const r = await fetch("/api/content-compass", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: days, cadence, activeDays }),
      });
      if (r.ok) { setSaved(true); setIsDefault(false); }
    } finally { setSaving(false); }
  }, [days, cadence, activeDays]);

  const selCls = "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm capitalize";

  return (
    <div className="space-y-6">
      <DashHero
        title="Content Compass"
        subtitle={`Veckans profil per dag: funnel, 4A och DISC. AI:n skriver utifrån detta.${clientName ? ` Klient: ${clientName}` : ""}`}
        accent="#7c3aed"
      />

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Publiceringsdagar:</label>
            {/* Fritt dagval: valfritt antal, valfria dagar (t.ex. mandag, onsdag, fredag). */}
            <div className="inline-flex flex-wrap gap-1">
              {DAY_KEYS.map((k) => {
                const pa = activeDays.includes(k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setActiveDays((prev) => {
                        const next = prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k];
                        return next.length ? DAY_KEYS.filter((d) => next.includes(d)) : prev; // minst en dag
                      });
                      setSaved(false);
                    }}
                    title={DAY_LABEL[k]}
                    className={`w-10 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${pa ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                    style={pa ? { background: "#7c3aed" } : {}}
                  >
                    {DAY_LABEL[k].slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-gray-500">{activeDays.length} inlägg/vecka</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setDays(STANDARD_SCHEDULE); setSaved(false); }} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" /> Återställ till standard
            </button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: "#7c3aed" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? "Sparat" : "Spara schema"}
            </button>
          </div>
        </div>
        {isDefault && <p className="text-xs text-amber-600">Detta är standardschemat. Ändra och spara för att göra det till klientens eget.</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Laddar schema.</div>
        ) : (
          <div className="space-y-2">
            {DAY_KEYS.map((k) => {
              const day = days[k];
              return (
                <div key={k} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3">
                  <div className="w-24 font-display font-semibold text-sm text-gray-900">{DAY_LABEL[k]}</div>
                  <select value={day.four_a} onChange={(e) => setDay(k, { four_a: e.target.value as FourA })} className={selCls}>
                    {FOURA_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={day.funnel} onChange={(e) => setDay(k, { funnel: e.target.value as FunnelLevel })} className={`${selCls} uppercase`}>
                    {FUNNEL_OPTS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    {DISC_OPTS.map((letter) => {
                      const on = day.disc.includes(letter);
                      return (
                        <button key={letter} onClick={() => toggleDisc(k, letter)} type="button"
                          className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${on ? "text-white border-transparent" : "text-gray-400 border-gray-200 hover:bg-gray-50"}`}
                          style={on ? { background: letter === "D" ? "#ef4444" : letter === "I" ? "#f59e0b" : letter === "S" ? "#10b981" : "#3b82f6" } : {}}>
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                  <div className="ml-auto"><CompassBadges funnel={day.funnel} four_a={day.four_a} disc={day.disc} /></div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ContentToolbox accent="#7c3aed" />
    </div>
  );
}
