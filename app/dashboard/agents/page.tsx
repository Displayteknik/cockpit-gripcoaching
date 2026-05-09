"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, TrendingUp, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";

type TrendByType = {
  type: string;
  runs: number;
  avg_score: number;
  avg_spread: number;
  latest: string | null;
};

type Idea = {
  id: string;
  client_id: string;
  type: string;
  body: string;
  voice_score: number | null;
  variant_count: number;
  status: string;
  created_at: string;
};

export default function AgentsPage() {
  const [trend, setTrend] = useState<{ days: number; total_runs: number; by_type: TrendByType[] } | null>(null);
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [tr, ir] = await Promise.all([
        fetch("/api/agents/score-trend?days=14").then((r) => r.json()),
        fetch("/api/agents/ideas?status=pending").then((r) => r.json()),
      ]);
      if (tr.error) setError(tr.error);
      else setTrend(tr);
      if (ir.error) setError(ir.error);
      else setIdeas(ir.ideas);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updateIdea(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      const r = await fetch("/api/agents/ideas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (r.ok) await loadAll();
      else {
        const d = await r.json();
        setError(d?.error ?? "Kunde inte uppdatera");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            Agent-loop
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-indigo-600" />
          AI-experiment & idé-bank
        </h1>
        <p className="text-gray-600 text-sm mt-2 max-w-2xl">
          Automat-genererade utkast varje natt + score-trend per klient och typ. Godkänn det som
          låter rätt — det blir publicerbart material.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
      )}

      {/* TREND */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Score-trend (senaste 14 dagarna)
          </h2>
          {trend && <span className="text-xs text-gray-500">{trend.total_runs} körningar totalt</span>}
        </div>

        {!trend && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Laddar...
          </div>
        )}

        {trend && trend.by_type.length === 0 && (
          <div className="text-gray-500 text-sm">
            Ingen data än. Kör några specialister med <code>iterate: true</code> så fylls den på.
          </div>
        )}

        {trend && trend.by_type.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {trend.by_type.map((t) => (
              <div key={t.type} className="border border-gray-200 rounded-xl p-4">
                <div className="text-xs uppercase font-semibold text-gray-500 mb-1">{t.type}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{t.avg_score}</span>
                  <span className="text-xs text-gray-500">snitt-score</span>
                </div>
                <div className="text-xs text-gray-600 mt-2">
                  {t.runs} körningar · spread ±{t.avg_spread}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IDEAS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Idé-bank — väntar på godkännande
          </h2>
          {ideas && <span className="text-xs text-gray-500">{ideas.length} st</span>}
        </div>

        {!ideas && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Laddar...
          </div>
        )}

        {ideas && ideas.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
            Inga idéer än. Cron körs varje natt 02:30 och fyller på här.
          </div>
        )}

        {ideas && ideas.length > 0 && (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <div key={idea.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {idea.type}
                    </span>
                    {idea.voice_score !== null && (
                      <span className={`text-xs font-semibold ${idea.voice_score >= 80 ? "text-emerald-700" : idea.voice_score >= 65 ? "text-amber-700" : "text-red-700"}`}>
                        Score {idea.voice_score}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(idea.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateIdea(idea.id, "approved")}
                      disabled={busy === idea.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Godkänn
                    </button>
                    <button
                      onClick={() => updateIdea(idea.id, "rejected")}
                      disabled={busy === idea.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Avslå
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{idea.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MANUELL TRIGGER */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
        <div className="font-semibold text-amber-900 mb-1">Manuell trigger</div>
        <div className="text-amber-800">
          Cron körs 02:30 varje natt. För manuell trigger:
          <code className="block mt-2 bg-white border border-amber-200 rounded px-2 py-1 text-xs">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; https://cockpit.gripcoaching.se/api/agents/night-iterate
          </code>
        </div>
      </div>
    </div>
  );
}
