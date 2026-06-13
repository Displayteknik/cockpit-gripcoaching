"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Compass, Loader2, Sparkles, Download, ArrowRight, ChevronDown, ChevronUp, RefreshCw, Trash2 } from "lucide-react";
import MarkdownView from "@/components/MarkdownView";
import IkigaiDiagram, { type IkigaiDiagramData } from "@/components/IkigaiDiagram";
import { downloadMarkdownPdf } from "@/lib/markdown-pdf";
import { QUADRANTS } from "@/lib/ikigai-questions";

interface Inputs {
  love: string; skill: string; need: string; pay: string;
  person_name: string; background: string; goal: string; audience: string; time_per_week: string;
}
const EMPTY: Inputs = { love: "", skill: "", need: "", pay: "", person_name: "", background: "", goal: "", audience: "", time_per_week: "" };

interface Result { markdown: string; diagram: IkigaiDiagramData | null; intake_session_id: string | null; brand_proposals_count: number; ikigai_session_id: string | null; }
interface HistoryRow { id: string; person_name: string | null; source: string; status: string; intake_session_id: string | null; created_at: string; }

export default function IkigaiPage() {
  const [inp, setInp] = useState<Inputs>(EMPTY);
  const [showContext, setShowContext] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const svgRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // Auto-spara utkast i webbläsaren så inget försvinner om sidan laddas om.
  useEffect(() => {
    try { const s = localStorage.getItem("ikigai_draft"); if (s) setInp((p) => ({ ...p, ...JSON.parse(s) })); } catch { /* ignorera */ }
  }, []);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; } // hoppa över första (innan restore hunnit)
    try { localStorage.setItem("ikigai_draft", JSON.stringify(inp)); } catch { /* ignorera */ }
  }, [inp]);

  const set = (k: keyof Inputs, v: string) => setInp((p) => ({ ...p, [k]: v }));

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/ikigai/sessions");
    const j = await r.json();
    setHistory(j.sessions ?? []);
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const ready = inp.love.trim() && inp.skill.trim() && inp.need.trim() && inp.pay.trim();

  const generate = async () => {
    if (!ready) return;
    setGenerating(true); setError(""); setResult(null);
    try {
      const r = await fetch("/api/ikigai/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inp),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kunde inte generera"); return; }
      setResult({ markdown: d.markdown, diagram: d.diagram ?? null, intake_session_id: d.intake_session_id, brand_proposals_count: d.brand_proposals_count ?? 0, ikigai_session_id: d.ikigai_session_id });
      loadHistory();
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  };

  const openHistory = async (id: string) => {
    setError(""); setGenerating(true); setResult(null);
    try {
      const r = await fetch(`/api/ikigai/sessions?id=${id}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kunde inte ladda"); return; }
      setInp({ ...EMPTY, ...(d.inputs || {}) });
      setResult({ markdown: d.result_markdown || "", diagram: d.diagram ?? null, intake_session_id: d.intake_session_id, brand_proposals_count: 0, ikigai_session_id: d.id });
    } finally { setGenerating(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Ta bort denna Ikigai-session?")) return;
    await fetch(`/api/ikigai/sessions?id=${id}`, { method: "DELETE" });
    loadHistory();
  };

  const reset = () => { try { localStorage.removeItem("ikigai_draft"); } catch {} setInp(EMPTY); setResult(null); setError(""); setShowContext(false); };

  // Serialisera Ikigai-SVG:t till en PNG-dataURL så det kan läggas in överst i PDF:en.
  const svgToPng = async (scale = 2): Promise<{ dataUrl: string; aspect: number } | null> => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return null;
    const vb = (svg as SVGSVGElement).viewBox.baseVal;
    const w = vb?.width || 640, h = vb?.height || 600;
    const xml = new XMLSerializer().serializeToString(svg);
    const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = w * scale; canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // JPEG istället för PNG → ingen alfakanal + komprimerat (annars blir PDF:en flera MB).
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), aspect: w / h };
    } catch { return null; }
  };

  const downloadPdf = async () => {
    if (!result?.markdown) return;
    const name = inp.person_name.trim() ? inp.person_name.trim().replace(/[^\w\sÅÄÖåäö-]/g, "").replace(/\s+/g, "-") : "ikigai";
    const headerImage = result.diagram ? (await svgToPng()) ?? undefined : undefined;
    downloadMarkdownPdf(result.markdown, `${name}-ikigai.pdf`, { headerImage });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Compass className="w-6 h-6 text-brand-blue" /> Ikigai-motorn
        </h1>
        <p className="text-sm text-gray-500 mt-1">Fyra fält in → en konkret nisch, ett MVP-erbjudande och en 14-dagars plan ut. Resultatet kan fylla på brand-profilen för den aktiva klienten.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr] gap-6">
        {/* Wizard */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <input
              value={inp.person_name} onChange={(e) => set("person_name", e.target.value)}
              placeholder="Vems Ikigai? (namn — valfritt)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
            {QUADRANTS.map((q) => (
              <div key={q.key}>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <q.icon className={`w-4 h-4 ${q.color}`} /> {q.label}
                </label>
                <p className="text-xs text-gray-500 mt-0.5 mb-1.5 leading-relaxed">{q.intro}</p>
                <textarea
                  value={inp[q.key]} onChange={(e) => set(q.key, e.target.value)} rows={3}
                  placeholder={q.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                />
                <p className="text-xs text-gray-400 italic mt-1 leading-relaxed">{q.example}</p>
              </div>
            ))}

            <button onClick={() => setShowContext((s) => !s)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
              {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Kontext (valfritt — gör planen vassare)
            </button>
            {showContext && (
              <div className="space-y-3 pt-1">
                <CtxField label="Bakgrund" value={inp.background} onChange={(v) => set("background", v)} placeholder="Vad gör du idag? Var kommer du ifrån?" />
                <CtxField label="Mål" value={inp.goal} onChange={(v) => set("goal", v)} placeholder="Vad vill du uppnå? Heltid, sidoinkomst, frihet?" />
                <CtxField label="Nätverk / befintlig publik" value={inp.audience} onChange={(v) => set("audience", v)} placeholder="Har du redan en publik, e-postlista, följare?" />
                <CtxField label="Tid per vecka" value={inp.time_per_week} onChange={(v) => set("time_per_week", v)} placeholder="ex: 5 timmar i veckan vid sidan av jobbet" />
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={generate} disabled={!ready || generating}
                className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Tänker..." : "Generera Ikigai"}
              </button>
              {(result || inp.love) && (
                <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">Börja om</button>
              )}
            </div>
            {!ready && <p className="text-xs text-gray-400">Fyll i alla fyra fälten för att generera.</p>}
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          </div>

          {/* Historik */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Tidigare ({history.length})</h3>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400">Inga sessioner ännu.</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 group">
                    <button onClick={() => openHistory(h.id)} className="flex-1 text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm">
                      <span className="font-medium text-gray-800">{h.person_name || "Namnlös"}</span>
                      <span className="text-xs text-gray-400 ml-2">{new Date(h.created_at).toLocaleDateString("sv-SE")}</span>
                      {h.status === "failed" && <span className="text-xs text-red-500 ml-2">misslyckad</span>}
                    </button>
                    <button onClick={() => remove(h.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resultat */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 min-h-[400px]">
          {!result && !generating && (
            <div className="text-center py-24 text-gray-400">
              <Compass className="w-9 h-9 mx-auto mb-3 text-gray-300" />
              Fyll i fälten till vänster så bygger jag Ikigai-kartan, nischen och planen.
            </div>
          )}
          {generating && !result && (
            <div className="py-24 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Hittar korsningarna och bygger planen...
            </div>
          )}
          {result && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-gray-100">
                <button onClick={downloadPdf} className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold">
                  <Download className="w-4 h-4" /> Ladda ner PDF
                </button>
                {result.intake_session_id && result.brand_proposals_count > 0 && (
                  <Link href={`/dashboard/profil?intake=${result.intake_session_id}`}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    Fyll brand-profilen ({result.brand_proposals_count} förslag) <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                {result.intake_session_id && result.brand_proposals_count === 0 && (
                  <span className="text-xs text-gray-400">Inga brand-förslag den här gången.</span>
                )}
              </div>
              {result.diagram && (
                <div ref={svgRef} className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-3 max-w-[680px] mx-auto">
                  <IkigaiDiagram data={result.diagram} />
                </div>
              )}
              <MarkdownView>{result.markdown}</MarkdownView>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CtxField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
    </div>
  );
}
