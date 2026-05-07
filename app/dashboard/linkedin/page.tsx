"use client";

import { useEffect, useState } from "react";
import { Sparkles, Copy, Check, Trash2, Plus, RefreshCw, ExternalLink, Edit3, Save, X, Wand2, Layers, Lightbulb, FileText, Inbox, BookOpen, Upload, BarChart3 } from "lucide-react";

type Tab = "pillars" | "ideas" | "writer" | "bank" | "history";

interface Pillar { id: string; name: string; description: string | null; sort_order: number }

interface Post {
  id: string;
  status: "idea" | "draft" | "approved" | "posted" | "archived";
  pillar: string | null;
  format: "text" | "carousel" | "video" | "poll" | "document";
  trust_gate: string | null;
  hook: string | null;
  body: string | null;
  hashtags: string | null;
  cta: string | null;
  length: "short" | "medium" | "long" | null;
  idea_seed: string | null;
  notes: string | null;
  posted_url: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<Post["status"], string> = {
  idea: "Idé",
  draft: "Utkast",
  approved: "Godkänt",
  posted: "Postat",
  archived: "Arkiverat",
};

const STATUS_COLOR: Record<Post["status"], string> = {
  idea: "bg-amber-100 text-amber-800 border-amber-200",
  draft: "bg-blue-100 text-blue-800 border-blue-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  posted: "bg-gray-100 text-gray-700 border-gray-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

const TRUST_COLOR: Record<string, string> = {
  know: "bg-sky-100 text-sky-800",
  like: "bg-pink-100 text-pink-800",
  trust: "bg-emerald-100 text-emerald-800",
  try: "bg-amber-100 text-amber-800",
  buy: "bg-rose-100 text-rose-800",
  repeat: "bg-violet-100 text-violet-800",
};

export default function LinkedInPage() {
  const [tab, setTab] = useState<Tab>("ideas");
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPillars, setLoadingPillars] = useState(false);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState<string | null>(null);
  const [seedingPillars, setSeedingPillars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const [ideaFilter, setIdeaFilter] = useState<string>("");
  const [ideaCount, setIdeaCount] = useState<number>(10);
  const [bankFilter, setBankFilter] = useState<string>("all");

  const refreshPillars = async () => {
    setLoadingPillars(true);
    try {
      const r = await fetch("/api/linkedin/pillars");
      const j = await r.json();
      setPillars(j.pillars ?? []);
    } finally { setLoadingPillars(false); }
  };

  const refreshPosts = async () => {
    const r = await fetch("/api/linkedin/posts");
    const j = await r.json();
    setPosts(j.posts ?? []);
  };

  useEffect(() => { refreshPillars(); refreshPosts(); }, []);

  const seedPillars = async () => {
    setSeedingPillars(true); setError(null);
    try {
      const r = await fetch("/api/linkedin/seed-pillars", { method: "POST" });
      const j = await r.json();
      if (j.error) setError(j.error); else await refreshPillars();
    } catch (e) { setError((e as Error).message); }
    finally { setSeedingPillars(false); }
  };

  const addPillar = async () => {
    const name = prompt("Pelarens namn (2-4 ord):");
    if (!name) return;
    const description = prompt("Kort beskrivning:") ?? "";
    await fetch("/api/linkedin/pillars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, sort_order: pillars.length }) });
    refreshPillars();
  };

  const deletePillar = async (id: string) => {
    if (!confirm("Ta bort pelaren?")) return;
    await fetch(`/api/linkedin/pillars?id=${id}`, { method: "DELETE" });
    refreshPillars();
  };

  const generateIdeas = async () => {
    setLoadingIdeas(true); setError(null);
    try {
      const r = await fetch("/api/linkedin/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: ideaCount, pillar: ideaFilter || undefined }),
      });
      const j = await r.json();
      if (j.error) setError(j.error); else await refreshPosts();
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingIdeas(false); }
  };

  const draftPost = async (postId: string, length: "short" | "medium" | "long") => {
    setLoadingDraft(postId); setError(null);
    try {
      const r = await fetch("/api/linkedin/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, length }),
      });
      const j = await r.json();
      if (j.error) setError(j.error); else { await refreshPosts(); setTab("bank"); }
    } catch (e) { setError((e as Error).message); }
    finally { setLoadingDraft(null); }
  };

  const updatePost = async (id: string, updates: Partial<Post>) => {
    await fetch("/api/linkedin/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }) });
    refreshPosts();
  };

  const deletePost = async (id: string) => {
    if (!confirm("Ta bort inlägget?")) return;
    await fetch(`/api/linkedin/posts?id=${id}`, { method: "DELETE" });
    refreshPosts();
  };

  const copyPost = async (post: Post) => {
    const text = post.body ?? "";
    const full = post.hashtags ? `${text}\n\n${post.hashtags}` : text;
    await navigator.clipboard.writeText(full);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const ideas = posts.filter((p) => p.status === "idea");
  const drafts = posts.filter((p) => p.status === "draft");
  const filteredBank = bankFilter === "all" ? posts.filter((p) => p.status !== "idea") : posts.filter((p) => p.status === bankFilter);

  const tabs: { id: Tab; label: string; icon: typeof Sparkles; count?: number }[] = [
    { id: "pillars", label: "Pelare", icon: Layers, count: pillars.length },
    { id: "ideas", label: "Idé-bank", icon: Lightbulb, count: ideas.length },
    { id: "writer", label: "Skrivare", icon: Wand2 },
    { id: "bank", label: "Post-bank", icon: Inbox, count: posts.filter((p) => p.status !== "idea").length },
    { id: "history", label: "Historik & analys", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900">LinkedIn-motor</h1>
            <p className="text-sm text-gray-600">Idéer, skrivande och post-bank — driven av "Från Okänd till Kund"-metodiken.</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      <nav className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${tab === t.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "pillars" && (
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Content-pelare = de teman du driver i 6-12 månader. AI:n fördelar idéer mellan dem.</p>
            <div className="flex gap-2">
              {pillars.length === 0 && (
                <button onClick={seedPillars} disabled={seedingPillars} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                  {seedingPillars ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generera pelare från brand-profil
                </button>
              )}
              <button onClick={addPillar} className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus className="w-4 h-4" /> Lägg till manuellt
              </button>
            </div>
          </div>

          {loadingPillars ? <div className="text-gray-500 text-sm">Laddar…</div> : pillars.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
              <BookOpen className="w-10 h-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Inga pelare ännu</h3>
              <p className="text-sm text-gray-600 mb-4">Klicka "Generera pelare från brand-profil" — AI:n läser klientens brand-profil och föreslår 4-6 pelare.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {pillars.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    {p.description && <p className="text-sm text-gray-600 mt-1">{p.description}</p>}
                  </div>
                  <button onClick={() => deletePillar(p.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "ideas" && (
        <section className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Antal idéer</label>
              <select value={ideaCount} onChange={(e) => setIdeaCount(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-gray-600 block mb-1">Fokuspelare (valfritt)</label>
              <select value={ideaFilter} onChange={(e) => setIdeaFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Fördela mellan alla</option>
                {pillars.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={generateIdeas} disabled={loadingIdeas || pillars.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 h-fit">
              {loadingIdeas ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generera {ideaCount} idéer
            </button>
            {pillars.length === 0 && <span className="text-xs text-amber-600 self-center">Skapa minst en pelare först</span>}
          </div>

          {ideas.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <Lightbulb className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Inga idéer ännu</h3>
              <p className="text-sm text-gray-600">Generera 10 idéer ovan så fyller AI:n bankenban med pelar-fördelade hooks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.map((p) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {p.pillar && <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{p.pillar}</span>}
                    {p.format && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{p.format}</span>}
                    {p.trust_gate && <span className={`text-xs px-2 py-0.5 rounded ${TRUST_COLOR[p.trust_gate] ?? "bg-gray-100"}`}>{p.trust_gate.toUpperCase()}</span>}
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">{p.hook}</p>
                  {p.idea_seed && <p className="text-sm text-gray-600 mb-2">{p.idea_seed}</p>}
                  {p.notes && <p className="text-xs text-gray-500 italic mb-3">Varför: {p.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => draftPost(p.id, "short")} disabled={loadingDraft === p.id} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white flex items-center gap-1">
                      {loadingDraft === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Skriv kort
                    </button>
                    <button onClick={() => draftPost(p.id, "medium")} disabled={loadingDraft === p.id} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white flex items-center gap-1">
                      {loadingDraft === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Skriv medium
                    </button>
                    <button onClick={() => draftPost(p.id, "long")} disabled={loadingDraft === p.id} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white flex items-center gap-1">
                      {loadingDraft === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Skriv lång
                    </button>
                    <button onClick={() => deletePost(p.id)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Skippa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "writer" && (
        <FreeWriter pillars={pillars} onCreated={() => { refreshPosts(); setTab("bank"); }} />
      )}

      {tab === "bank" && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            {(["all", "draft", "approved", "posted", "archived"] as const).map((s) => (
              <button key={s} onClick={() => setBankFilter(s)} className={`text-xs px-3 py-1.5 rounded-lg border ${bankFilter === s ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                {s === "all" ? "Allt" : STATUS_LABEL[s as Post["status"]]}
                <span className="ml-1.5 opacity-60">{s === "all" ? posts.filter((p) => p.status !== "idea").length : posts.filter((p) => p.status === s).length}</span>
              </button>
            ))}
          </div>

          {filteredBank.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-600">Inga inlägg här ännu.</div>
          ) : (
            <div className="space-y-3">
              {filteredBank.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onCopy={() => copyPost(p)}
                  copied={copiedId === p.id}
                  onUpdate={(u) => updatePost(p.id, u)}
                  onDelete={() => deletePost(p.id)}
                  onEdit={() => setEditingPost(p)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "history" && <HistoryTab />}

      {editingPost && <EditModal post={editingPost} onClose={() => setEditingPost(null)} onSave={async (u) => { await updatePost(editingPost.id, u); setEditingPost(null); }} />}
    </div>
  );
}

interface HistoryRow { id: string; posted_at: string | null; post_text: string | null; impressions: number | null; engagements: number | null }
interface AnalysisResult {
  summary: string;
  top_themes: { theme: string; performance: string; example_hook: string }[];
  hook_patterns: { pattern: string; works: boolean; reason: string }[];
  cadence_insight: string;
  recommendations: string[];
}

function HistoryTab() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/linkedin/import");
    const j = await r.json();
    setHistory(j.history ?? []);
  };
  useEffect(() => { refresh(); }, []);

  const submitImport = async () => {
    setImporting(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/linkedin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
      const j = await r.json();
      if (j.error) setErr(j.error);
      else { setMsg(`Importerade ${j.imported} inlägg.`); setRaw(""); refresh(); }
    } catch (e) { setErr((e as Error).message); }
    finally { setImporting(false); }
  };

  const runAnalyze = async () => {
    setAnalyzing(true); setErr(null);
    try {
      const r = await fetch("/api/linkedin/analyze", { method: "POST" });
      const j = await r.json();
      if (j.error) setErr(j.error); else setAnalysis(j.analysis);
    } catch (e) { setErr((e as Error).message); }
    finally { setAnalyzing(false); }
  };

  return (
    <section className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><Upload className="w-4 h-4" /> Importera LinkedIn-historik</h2>
        <p className="text-xs text-gray-600 mb-3">Klistra in från Excel (markera celler → kopiera → klistra in här). Behöver minst kolumnerna <code>post_text</code>, <code>posted_at</code> och gärna <code>impressions</code>/<code>engagements</code>. Headers stödjer svenska och engelska namn (visningar, engagemang, kommentarer, datum, post_url etc).</p>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8} placeholder="post_text	posted_at	impressions	engagements&#10;Tystnaden... Sitter och reflekterar...	2025-09-15	1240	87" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono" />
        {err && <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg mt-3">{err}</div>}
        {msg && <div className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg mt-3">{msg}</div>}
        <div className="flex gap-2 mt-3">
          <button onClick={submitImport} disabled={importing || !raw.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importera
          </button>
          <button onClick={runAnalyze} disabled={analyzing || history.length === 0} className="border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
            {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Analysera topp-25
          </button>
        </div>
      </div>

      {analysis && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Analys</h2>
          <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3">{analysis.summary}</p>
          {analysis.top_themes?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Topp-teman</h3>
              <div className="space-y-2">
                {analysis.top_themes.map((t, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between gap-2 mb-1">
                      <span className="font-medium text-gray-900">{t.theme}</span>
                      <span className="text-xs text-gray-600">{t.performance}</span>
                    </div>
                    <p className="text-xs text-gray-600 italic">"{t.example_hook}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.hook_patterns?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Hook-mönster</h3>
              <div className="space-y-1.5">
                {analysis.hook_patterns.map((p, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className={`${p.works ? "text-emerald-600" : "text-red-600"} font-bold`}>{p.works ? "✓" : "✗"}</span>
                    <span><b className="text-gray-900">{p.pattern}</b> — <span className="text-gray-600">{p.reason}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.cadence_insight && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Publiceringstakt</h3>
              <p className="text-sm text-gray-700">{analysis.cadence_insight}</p>
            </div>
          )}
          {analysis.recommendations?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Rekommendationer</h3>
              <ul className="text-sm text-gray-700 space-y-1.5">
                {analysis.recommendations.map((r, i) => <li key={i} className="flex gap-2"><span className="text-blue-600">→</span><span>{r}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Importerad historik ({history.length})</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Ingen historik importerad ännu.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-auto bg-gray-50 border border-gray-200 rounded-lg p-3">
            {history.slice(0, 50).map((h) => (
              <div key={h.id} className="text-xs border-b border-gray-200 last:border-0 pb-1.5 last:pb-0 flex gap-3">
                <span className="text-gray-500 w-20 flex-shrink-0">{h.posted_at?.slice(0, 10) ?? "?"}</span>
                <span className="text-gray-500 w-16 flex-shrink-0">{h.engagements ?? 0} eng</span>
                <span className="text-gray-700 truncate flex-1">{(h.post_text ?? "").slice(0, 100)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FreeWriter({ pillars, onCreated }: { pillars: Pillar[]; onCreated: () => void }) {
  const [hook, setHook] = useState("");
  const [angle, setAngle] = useState("");
  const [pillar, setPillar] = useState("");
  const [format, setFormat] = useState<"text" | "carousel" | "video" | "poll" | "document">("text");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/linkedin/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: hook || undefined, angle: angle || undefined, pillar: pillar || undefined, format, length }),
      });
      const j = await r.json();
      if (j.error) setErr(j.error); else { onCreated(); setHook(""); setAngle(""); }
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 max-w-3xl">
      <h2 className="text-lg font-display font-bold text-gray-900 mb-1">Fri-skrivaren</h2>
      <p className="text-sm text-gray-600 mb-5">Skriv en hook eller vinkel — AI:n bygger ett färdigt LinkedIn-inlägg i klientens röst.</p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Hook eller utgångspunkt (valfritt)</label>
          <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder='ex: "Trodde feedback handlade om sanningen. Jag hade fel."' className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Vinkel/idé (valfritt)</label>
          <textarea value={angle} onChange={(e) => setAngle(e.target.value)} rows={3} placeholder="Vad ska inlägget driva för poäng? Vilken erfarenhet ska det utgå från?" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Pelare</label>
            <select value={pillar} onChange={(e) => setPillar(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Välj fritt</option>
              {pillars.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="text">Textinlägg</option>
              <option value="carousel">Karusell</option>
              <option value="video">Video-script</option>
              <option value="poll">Poll</option>
              <option value="document">Dokument-post</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Längd</label>
            <select value={length} onChange={(e) => setLength(e.target.value as typeof length)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="short">Kort (100-150 ord)</option>
              <option value="medium">Medium (200-300 ord)</option>
              <option value="long">Lång (350-500 ord)</option>
            </select>
          </div>
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">{err}</div>}
        <button onClick={submit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2">
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Skriv inlägget
        </button>
      </div>
    </section>
  );
}

function PostCard({ post, onCopy, copied, onUpdate, onDelete, onEdit }: { post: Post; onCopy: () => void; copied: boolean; onUpdate: (u: Partial<Post>) => void; onDelete: () => void; onEdit: () => void }) {
  const linkedInComposeUrl = "https://www.linkedin.com/feed/?shareActive=true";
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5">
      <header className="flex flex-wrap gap-2 items-center justify-between mb-3">
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLOR[post.status]}`}>{STATUS_LABEL[post.status]}</span>
          {post.pillar && <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{post.pillar}</span>}
          {post.format && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{post.format}</span>}
          {post.trust_gate && <span className={`text-xs px-2 py-0.5 rounded ${TRUST_COLOR[post.trust_gate] ?? "bg-gray-100"}`}>{post.trust_gate.toUpperCase()}</span>}
          {post.length && <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{post.length}</span>}
        </div>
        <span className="text-xs text-gray-400">{new Date(post.updated_at).toLocaleString("sv-SE")}</span>
      </header>

      {post.hook && <p className="font-semibold text-gray-900 mb-2">{post.hook}</p>}
      {post.body && <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-64 overflow-auto">{post.body}</pre>}
      {post.hashtags && <p className="text-xs text-blue-700 mt-2">{post.hashtags}</p>}

      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={onCopy} className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white flex items-center gap-1.5">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Kopierat" : "Kopiera + hashtags"}
        </button>
        <a href={linkedInComposeUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" /> Öppna LinkedIn-skrivare
        </a>
        <button onClick={onEdit} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
          <Edit3 className="w-3.5 h-3.5" /> Redigera
        </button>
        {post.status === "draft" && (
          <button onClick={() => onUpdate({ status: "approved" })} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Godkänn
          </button>
        )}
        {post.status !== "posted" && (
          <button onClick={() => onUpdate({ status: "posted", posted_at: new Date().toISOString() })} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Markera som postat
          </button>
        )}
        <button onClick={onDelete} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
}

function EditModal({ post, onClose, onSave }: { post: Post; onClose: () => void; onSave: (u: Partial<Post>) => void }) {
  const [hook, setHook] = useState(post.hook ?? "");
  const [body, setBody] = useState(post.body ?? "");
  const [hashtags, setHashtags] = useState(post.hashtags ?? "");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <header className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Redigera inlägg</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Hook</label>
            <input value={hook} onChange={(e) => setHook(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Inläggets text</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Hashtags</label>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <footer className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Avbryt</button>
          <button onClick={() => onSave({ hook, body, hashtags })} className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Spara
          </button>
        </footer>
      </div>
    </div>
  );
}
