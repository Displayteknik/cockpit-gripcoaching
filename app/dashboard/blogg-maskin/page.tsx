"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Lightbulb, Loader2, Play, Trash2, Plus, Check, AlertCircle, FileText, FileSearch, Send, Edit3 } from "lucide-react";

interface OutlineSection { heading: string; type: string; key_points: string[]; word_target: number }
interface Outline { title: string; meta_description: string; primary_keyword: string; word_target: number; sections: OutlineSection[]; faq: { question: string; short_answer: string }[] }
interface QueueItem {
  id: string;
  topic: string;
  angle: string | null;
  keyword: string | null;
  status: "queued" | "generating" | "draft" | "published" | "skipped";
  priority: number;
  blog_post_id: string | null;
  error: string | null;
  outline: Outline | null;
  outline_approved: boolean;
  created_at: string;
  generated_at: string | null;
}

interface Idea {
  topic: string;
  angle: string;
  keyword: string;
  priority: number;
}

export default function BloggMaskinPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [outlining, setOutlining] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState<QueueItem | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [newAngle, setNewAngle] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => { loadQueue(); }, []);

  async function loadQueue() {
    const r = await fetch("/api/blog/queue");
    if (r.ok) setQueue(await r.json());
  }

  async function suggestIdeas() {
    setLoadingIdeas(true);
    try {
      const r = await fetch("/api/blog/ideas", { method: "POST" });
      if (r.ok) setIdeas(await r.json());
      else alert("Kunde inte hämta idéer.");
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function addToQueue(idea: Idea) {
    await fetch("/api/blog/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(idea),
    });
    setIdeas((prev) => prev.filter((i) => i !== idea));
    loadQueue();
  }

  async function addAllIdeas() {
    if (!ideas.length) return;
    await fetch("/api/blog/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ideas),
    });
    setIdeas([]);
    loadQueue();
  }

  async function addManual() {
    if (!newTopic.trim()) return;
    await fetch("/api/blog/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: newTopic, angle: newAngle, keyword: newKeyword, priority: 7 }),
    });
    setNewTopic(""); setNewAngle(""); setNewKeyword("");
    loadQueue();
  }

  async function generateOutline(q: QueueItem) {
    setOutlining(q.id);
    try {
      const r = await fetch("/api/blog/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q.topic, angle: q.angle, keyword: q.keyword, queue_id: q.id }),
      });
      if (!r.ok) {
        const e = await r.json();
        alert("Fel: " + (e.error || "okänt"));
      } else {
        await loadQueue();
        const updated = (await (await fetch("/api/blog/queue")).json()).find((x: QueueItem) => x.id === q.id);
        if (updated) setShowOutline(updated);
      }
    } finally {
      setOutlining(null);
    }
  }

  async function approveOutline(q: QueueItem) {
    await fetch("/api/blog/queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id, outline_approved: true }),
    });
    setShowOutline(null);
    loadQueue();
  }

  async function generateNow(q: QueueItem) {
    setGenerating(q.id);
    try {
      const r = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q.topic, angle: q.angle, keyword: q.keyword, queue_id: q.id, outline: q.outline }),
      });
      if (!r.ok) {
        const err = await r.json();
        alert("Fel: " + (err.error || "okänt"));
      }
      loadQueue();
    } finally {
      setGenerating(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Ta bort från kön?")) return;
    await fetch(`/api/blog/queue?id=${id}`, { method: "DELETE" });
    loadQueue();
  }

  const queued = queue.filter((q) => q.status === "queued");
  const generated = queue.filter((q) => q.status === "draft" || q.status === "published");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          Blogg-maskin
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Schemalagt bygge: Vercel Cron kör <strong>måndag, onsdag, fredag kl 07:00</strong> och tar nästa köade ämne.
          Utkast läggs i blogg-tabellen och väntar på din publicering.
        </p>
      </div>

      {/* Idea generator */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            Idé-förslag från Gemini
          </h2>
          <div className="flex gap-2">
            {ideas.length > 0 && (
              <button onClick={addAllIdeas} className="text-sm text-emerald-700 font-medium hover:underline">
                Lägg till alla →
              </button>
            )}
            <button
              onClick={suggestIdeas}
              disabled={loadingIdeas}
              className="flex items-center gap-2 bg-white hover:bg-gray-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingIdeas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
              {ideas.length > 0 ? "Nya förslag" : "Föreslå 8 ämnen"}
            </button>
          </div>
        </div>
        {ideas.length === 0 ? (
          <p className="text-sm text-gray-500">Klicka för AI-genererade artikel-förslag baserat på lagret och redan publicerade ämnen.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ideas.map((idea, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-purple-100 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{idea.topic}</div>
                  {idea.angle && <div className="text-xs text-gray-500 mt-0.5">{idea.angle}</div>}
                  <div className="flex items-center gap-2 mt-1">
                    {idea.keyword && <span className="text-xs text-blue-600">🔍 {idea.keyword}</span>}
                    <span className="text-xs text-amber-600">prio {idea.priority}</span>
                  </div>
                </div>
                <button
                  onClick={() => addToQueue(idea)}
                  className="flex-shrink-0 p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                  title="Lägg till i kön"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual add */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-display font-bold text-gray-900 mb-3">Lägg till ämne manuellt</h2>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_1fr_auto] gap-2">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Ämne (t.ex. 'Vad kostar en LED-skärm?')"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
          />
          <input
            value={newAngle}
            onChange={(e) => setNewAngle(e.target.value)}
            placeholder="Vinkel (valfritt)"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
          />
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Sökord"
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
          />
          <button
            onClick={addManual}
            disabled={!newTopic.trim()}
            className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue-dark disabled:opacity-50 transition-colors"
          >
            Lägg till
          </button>
        </div>
      </div>

      {/* Queue */}
      <div>
        <h2 className="font-display font-bold text-gray-900 mb-3">I kö ({queued.length})</h2>
        {queued.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-400 text-sm">
            Kön är tom. Lägg till idéer ovan.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {queued.map((q) => (
              <div key={q.id} className="border-b border-gray-100 last:border-b-0 p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{q.topic}</div>
                  <div className="flex items-center gap-3 mt-1">
                    {q.angle && <span className="text-xs text-gray-500">{q.angle}</span>}
                    {q.keyword && <span className="text-xs text-blue-600">🔍 {q.keyword}</span>}
                    <span className="text-xs text-amber-600">prio {q.priority}</span>
                    {q.error && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {q.error}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!q.outline ? (
                    <button
                      onClick={() => generateOutline(q)}
                      disabled={outlining === q.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {outlining === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5" />}
                      Bygg disposition
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowOutline(q)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                      {q.outline_approved ? "Granska" : "Granska & godkänn"}
                    </button>
                  )}
                  <button
                    onClick={() => generateNow(q)}
                    disabled={generating === q.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    title={q.outline_approved ? "Skriv från godkänd disposition" : q.outline ? "Skriv från ej godkänd disposition" : "Skriv direkt utan disposition"}
                  >
                    {generating === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Skriv
                  </button>
                  <button
                    onClick={() => remove(q.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showOutline && showOutline.outline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowOutline(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-gray-900">Disposition</h3>
                <div className="text-xs text-gray-500">{showOutline.topic}</div>
              </div>
              <button onClick={() => setShowOutline(null)} className="text-gray-400 hover:text-gray-600 p-2">×</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Titel</div>
                <div className="font-display font-bold text-gray-900">{showOutline.outline.title}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Meta description</div>
                <div className="text-sm text-gray-700">{showOutline.outline.meta_description}</div>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{showOutline.outline.primary_keyword}</span>
                <span className="text-gray-500">~{showOutline.outline.word_target} ord</span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase mb-2">Sektioner</div>
                <div className="space-y-2">
                  {showOutline.outline.sections.map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-gray-900">{s.heading}</div>
                        <div className="text-xs text-gray-500">~{s.word_target} ord</div>
                      </div>
                      {s.key_points && s.key_points.length > 0 && (
                        <ul className="text-xs text-gray-600 mt-1 list-disc pl-5 space-y-0.5">
                          {s.key_points.map((kp, j) => <li key={j}>{kp}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {showOutline.outline.faq && showOutline.outline.faq.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-2">FAQ (AEO-bonus)</div>
                  <div className="space-y-2">
                    {showOutline.outline.faq.map((f, i) => (
                      <div key={i} className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="font-medium text-sm text-gray-900">{f.question}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{f.short_answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="text-xs text-gray-500">
                {showOutline.outline_approved ? "✓ Redan godkänd" : "Godkänn för bättre artikel"}
              </div>
              <div className="flex gap-2">
                <button onClick={() => generateOutline(showOutline)} disabled={outlining === showOutline.id} className="flex items-center gap-2 text-sm text-purple-700 hover:bg-purple-100 px-3 py-2 rounded-lg disabled:opacity-50">
                  {outlining === showOutline.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                  Bygg om
                </button>
                {!showOutline.outline_approved && (
                  <button onClick={() => approveOutline(showOutline)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700">
                    <Check className="w-4 h-4" />
                    Godkänn
                  </button>
                )}
                <button onClick={() => { setShowOutline(null); generateNow(showOutline); }} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90">
                  <Play className="w-4 h-4" />
                  Skriv artikeln
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated */}
      {generated.length > 0 && (
        <div>
          <h2 className="font-display font-bold text-gray-900 mb-3">Genererade ({generated.length})</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {generated.map((q) => (
              <div key={q.id} className="border-b border-gray-100 last:border-b-0 p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    {q.topic}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {q.generated_at ? `Genererad ${new Date(q.generated_at).toLocaleString("sv-SE")}` : ""}
                  </div>
                </div>
                <Link
                  href="/dashboard/blogg"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-brand-blue hover:bg-blue-50 rounded-lg text-xs font-medium transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Granska
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
