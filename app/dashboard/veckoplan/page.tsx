"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Calendar,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  CalendarPlus,
} from "lucide-react";
import KnowledgeText from "@/components/KnowledgeText";

interface DayPlan {
  day: string;
  fourA: string;
  disc: string;
  funnel: string;
  format: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

interface WeekResponse {
  theme: string;
  voice_source_count: number;
  days: DayPlan[];
}

const FOURA_COLORS: Record<string, string> = {
  analytical: "border-blue-300 bg-blue-50",
  aspirational: "border-purple-300 bg-purple-50",
  actionable: "border-emerald-300 bg-emerald-50",
  authentic: "border-amber-300 bg-amber-50",
};

const FOURA_BADGE: Record<string, string> = {
  analytical: "bg-blue-600",
  aspirational: "bg-purple-600",
  actionable: "bg-emerald-600",
  authentic: "bg-amber-600",
};

export default function VeckoplanPage() {
  const [theme, setTheme] = useState("");
  const [generating, setGenerating] = useState(false);
  const [response, setResponse] = useState<WeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [savingAll, setSavingAll] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [scheduleAll, setScheduleAll] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    // Hitta nästa måndag om vi inte är där
    const day = d.getDay();
    if (day !== 1) {
      const daysToMonday = day === 0 ? 1 : 8 - day;
      d.setDate(d.getDate() + daysToMonday);
    }
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  async function saveAll() {
    if (!response) return;
    setSavingAll(true);
    setSavedCount(0);
    const startMs = scheduleAll ? new Date(startDate).getTime() : 0;
    for (let i = 0; i < response.days.length; i++) {
      const day = response.days[i];
      const payload: Record<string, unknown> = {
        hook: day.hook,
        body: day.body,
        cta: day.cta,
        hashtags: day.hashtags,
        format: day.format,
        platform: "instagram",
      };
      if (scheduleAll) {
        const d = new Date(startMs + i * 24 * 3600 * 1000);
        payload.scheduled_for = d.toISOString();
      }
      try {
        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSavedCount(i + 1);
      } catch {
        // fortsätt även om en dag fallerar
      }
    }
    setSavingAll(false);
  }

  async function generate() {
    if (!theme.trim()) {
      setError("Skriv ett veckotema");
      return;
    }
    setError(null);
    setGenerating(true);
    setResponse(null);
    try {
      const r = await fetch("/api/generate/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || "Generering misslyckades");
      } else {
        setResponse(d);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function toggle(i: number) {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpanded(next);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Veckoplan</h1>
        <p className="text-gray-500 text-sm mt-1">
          Sju inlägg på en gång — ett per dag enligt 4A-veckorytmen. Måndag/Tisdag = analytical, Onsdag/Torsdag = aspirational, Fredag/Lördag = actionable, Söndag = authentic.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Veckotema — vad ska veckans inlägg kretsa kring?
          </label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="t.ex. Vintersäsongen — säkerhet och förberedelser inför kallt väder"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating || !theme.trim()}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Skapar 7 inlägg... (45–60 sek)
            </>
          ) : (
            <>
              <Calendar className="w-5 h-5" />
              Generera hel vecka (7 inlägg)
            </>
          )}
        </button>

        {generating && (
          <div className="text-xs text-gray-500 text-center italic">
            AI:n läser din voice fingerprint, brand-profil och 4A-rollerna för varje dag — ge det en stund.
          </div>
        )}
      </div>

      {response && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <strong className="text-gray-900">{response.theme}</strong>
              {response.voice_source_count > 0 && (
                <span className="text-emerald-600">
                  · röst byggd från {response.voice_source_count} källor
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleAll}
                  onChange={(e) => setScheduleAll(e.target.checked)}
                  className="rounded"
                />
                Schemalägg från
              </label>
              {scheduleAll && (
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs outline-none focus:border-purple-500"
                />
              )}
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sparar {savedCount}/7...
                  </>
                ) : savedCount === 7 ? (
                  <>
                    <Check className="w-4 h-4" />
                    Alla 7 sparade
                  </>
                ) : (
                  <>
                    {scheduleAll ? <CalendarPlus className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {scheduleAll ? "Spara & schemalägg vecka" : "Spara hela veckan"}
                  </>
                )}
              </button>
            </div>
          </div>

          {response.days.map((day, i) => (
            <DayCard
              key={i}
              day={day}
              expanded={expanded.has(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({
  day,
  expanded,
  onToggle,
}: {
  day: DayPlan;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveDay(e: React.MouseEvent) {
    e.stopPropagation();
    setSaving(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: day.hook,
          body: day.body,
          cta: day.cta,
          hashtags: day.hashtags,
          format: day.format,
          platform: "instagram",
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function fullText() {
    const parts = [day.hook, "", day.body];
    if (day.cta) parts.push("", day.cta);
    if (day.hashtags.length) parts.push("", day.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
    return parts.join("\n");
  }

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const colorClass = FOURA_COLORS[day.fourA] || "border-gray-200 bg-white";
  const badgeColor = FOURA_BADGE[day.fourA] || "bg-gray-500";

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${colorClass}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/40"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className={`${badgeColor} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
            {day.day}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm text-gray-900 truncate">
              {day.hook || "(saknar hook)"}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {day.fourA} · DISC {day.disc} · {day.funnel} · {day.format}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={saveDay}
            disabled={saving}
            className="text-xs text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded hover:bg-white/80 flex items-center gap-1 disabled:opacity-50 font-medium"
            title="Spara som utkast"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? "Sparad" : "Spara"}
          </button>
          <button
            onClick={copy}
            className="text-xs text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-white/80 flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Kopierat" : "Kopiera"}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-white/80 border-t border-gray-200/60">
          <div className="pt-3">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-1">Hook</div>
            <div className="text-base font-display font-bold text-gray-900 leading-snug">
              <KnowledgeText text={day.hook} />
            </div>
          </div>

          {day.body && (
            <div>
              <div className="text-xs uppercase text-gray-400 font-semibold mb-1">Body</div>
              <div className="text-sm text-gray-800 leading-relaxed">
                <KnowledgeText text={day.body} />
              </div>
            </div>
          )}

          {day.cta && (
            <div>
              <div className="text-xs uppercase text-gray-400 font-semibold mb-1">CTA</div>
              <div className="text-sm font-medium text-gray-900">{day.cta}</div>
            </div>
          )}

          {day.hashtags.length > 0 && (
            <div className="text-xs text-blue-700 font-mono">
              {day.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
