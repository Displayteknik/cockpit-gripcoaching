"use client";

import { useState } from "react";
import { Search, Loader2, ExternalLink, Users, Hash, Image as ImageIcon, AlertCircle, ThumbsUp, ThumbsDown, Lightbulb, Zap } from "lucide-react";

interface Snapshot { followers?: number; following?: number; posts?: number; bio?: string; full_name?: string; verified?: boolean }
interface Analysis {
  positioning: string;
  bio_score: number;
  bio_feedback: string;
  content_strategy_guess: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: { priority: number; action: string; expected_impact: string }[];
  hooks_to_test: string[];
}

export default function AnalysatorPage() {
  const [handle, setHandle] = useState("");
  const [recent, setRecent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ snapshot: Snapshot; analysis: Analysis } | null>(null);

  async function analyze() {
    if (!handle.trim()) return;
    setLoading(true);
    setResult(null);
    const r = await fetch("/api/profile-analyzer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, recent_posts_text: recent }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) setResult(d);
    else alert("Fel: " + (d.error || "okänt"));
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-pink-600" />
          Profil-analysator
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Klistra in en Instagram-handle (din egen, kunds, eller konkurrent). Hämtar publik data + Gemini-analys: vad funkar, vad inte, konkreta rekommendationer.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Instagram-handle</label>
            <div className="flex gap-2">
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@instagramnamn" onKeyDown={(e) => e.key === "Enter" && analyze()} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none" />
              <button onClick={analyze} disabled={loading || !handle.trim()} className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Analysera
              </button>
            </div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">+ Lägg till senaste inläggens texter (frivilligt — ger djupare analys)</summary>
            <textarea value={recent} onChange={(e) => setRecent(e.target.value)} rows={6} placeholder="Klistra in 3–5 inläggs-bildtexter för djupare innehållsanalys..." className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </details>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          {/* Snapshot */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-display font-bold text-gray-900">@{handle.replace(/^@/, "")}</h2>
              {result.snapshot.verified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">✓ Verifierad</span>}
              <a href={`https://instagram.com/${handle.replace(/^@/, "")}`} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline ml-auto inline-flex items-center gap-1">
                Öppna profil <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <Stat icon={Users} label="Följare" value={result.snapshot.followers} color="pink" />
              <Stat icon={Users} label="Följer" value={result.snapshot.following} color="purple" />
              <Stat icon={ImageIcon} label="Inlägg" value={result.snapshot.posts} color="blue" />
            </div>
            {result.snapshot.full_name && <div className="text-sm font-medium text-gray-900">{result.snapshot.full_name}</div>}
            {result.snapshot.bio && (
              <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{result.snapshot.bio}</div>
            )}
          </div>

          {/* Positioning */}
          <Card title="Positionering" icon={Lightbulb} color="blue">
            <p className="text-sm text-gray-700">{result.analysis.positioning}</p>
          </Card>

          {/* Bio score */}
          <Card title={`Bio-betyg: ${result.analysis.bio_score}/100`} icon={Hash} color={result.analysis.bio_score >= 70 ? "emerald" : result.analysis.bio_score >= 50 ? "amber" : "red"}>
            <p className="text-sm text-gray-700">{result.analysis.bio_feedback}</p>
          </Card>

          {/* Content strategy */}
          <Card title="Innehållsstrategi (gissning)" icon={Lightbulb} color="purple">
            <p className="text-sm text-gray-700">{result.analysis.content_strategy_guess}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Styrkor" icon={ThumbsUp} color="emerald">
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                {result.analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
            <Card title="Svagheter" icon={ThumbsDown} color="red">
              <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                {result.analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          </div>

          <Card title="Konkreta rekommendationer" icon={Zap} color="amber">
            <div className="space-y-2">
              {result.analysis.recommendations.sort((a, b) => b.priority - a.priority).map((r, i) => (
                <div key={i} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-gray-900">{r.action}</div>
                    <span className="flex-shrink-0 text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">prio {r.priority}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">→ {r.expected_impact}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Hooks att testa" icon={Zap} color="purple">
            <ul className="text-sm text-gray-700 space-y-2">
              {result.analysis.hooks_to_test.map((h, i) => (
                <li key={i} className="bg-purple-50 border-l-4 border-purple-400 px-3 py-2 rounded">"{h}"</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {!result && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>OBS:</strong> Denna funktion läser bara <em>publik</em> data från Instagram (följare, bio, antal inlägg). Privata konton fungerar inte. Använd för att analysera dina egna konton, kunders eller konkurrenters.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; color: string }) {
  const colors: Record<string, string> = { pink: "text-pink-600 bg-pink-50 border-pink-100", purple: "text-purple-600 bg-purple-50 border-purple-100", blue: "text-blue-600 bg-blue-50 border-blue-100" };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value?.toLocaleString("sv-SE") ?? "—"}</div>
    </div>
  );
}

function Card({ title, icon: Icon, color, children }: { title: string; icon: React.ComponentType<{ className?: string }>; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { blue: "text-blue-600", purple: "text-purple-600", emerald: "text-emerald-600", red: "text-red-600", amber: "text-amber-600" };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${colors[color]}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}
