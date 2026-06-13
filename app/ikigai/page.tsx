"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles, Download, ArrowRight, Check, Compass } from "lucide-react";
import MarkdownView from "@/components/MarkdownView";
import IkigaiDiagram, { type IkigaiDiagramData } from "@/components/IkigaiDiagram";
import { downloadMarkdownPdf } from "@/lib/markdown-pdf";
import { QUADRANTS } from "@/lib/ikigai-questions";

const BOOKING_URL = "https://gripcoaching.se";

interface Inputs { love: string; skill: string; need: string; pay: string; person_name: string; person_email: string; }
const EMPTY: Inputs = { love: "", skill: "", need: "", pay: "", person_name: "", person_email: "" };
interface Result { markdown: string; diagram: IkigaiDiagramData | null; }

export default function PublicIkigai() {
  const [inp, setInp] = useState<Inputs>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof Inputs, v: string) => setInp((p) => ({ ...p, [k]: v }));

  const ready = inp.love.trim() && inp.skill.trim() && inp.need.trim() && inp.pay.trim() && inp.person_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.person_email) && consent;

  const generate = async () => {
    if (!ready) return;
    setGenerating(true); setError(""); setResult(null);
    try {
      const r = await fetch("/api/ikigai/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inp) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Något gick fel. Försök igen."); return; }
      setResult({ markdown: d.markdown, diagram: d.diagram ?? null });
      setTimeout(() => document.getElementById("ikigai-resultat")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  };

  const svgToPng = async (scale = 2): Promise<{ dataUrl: string; aspect: number } | null> => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return null;
    const vb = (svg as SVGSVGElement).viewBox.baseVal;
    const w = vb?.width || 720, h = vb?.height || 720;
    const xml = new XMLSerializer().serializeToString(svg);
    const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
      const canvas = document.createElement("canvas");
      canvas.width = w * scale; canvas.height = h * scale;
      const ctx = canvas.getContext("2d"); if (!ctx) return null;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), aspect: w / h };
    } catch { return null; }
  };

  const downloadPdf = async () => {
    if (!result?.markdown) return;
    const name = inp.person_name.trim().replace(/[^\w\sÅÄÖåäö-]/g, "").replace(/\s+/g, "-") || "ikigai";
    const headerImage = result.diagram ? (await svgToPng()) ?? undefined : undefined;
    downloadMarkdownPdf(result.markdown, `${name}-ikigai.pdf`, { headerImage });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center gap-2">
          <Compass className="w-5 h-5 text-amber-500" />
          <span className="font-semibold tracking-wide">GripCoaching</span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-5 pt-14 pb-8 text-center">
        <div className="inline-flex items-center gap-2 text-amber-500 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" /> Gratis verktyg
        </div>
        <h1 className="font-bold text-3xl sm:text-4xl leading-tight">Hitta din Ikigai</h1>
        <p className="text-slate-300 mt-4 text-lg leading-relaxed">
          Svara på fyra frågor om dig själv. Du får en tydlig nisch, ett första erbjudande du kan sälja redan nästa vecka, och en konkret plan för de närmaste två veckorna.
        </p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-sm text-slate-300">
          {["Din nisch — där passion möter betalning", "Ett färdigt första erbjudande", "En 14-dagars plan att börja med"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-500" /> {t}</span>
          ))}
        </div>
      </section>

      {/* Form */}
      {!result && (
        <section className="max-w-2xl mx-auto px-5 pb-20">
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            {QUADRANTS.map((q) => (
              <div key={q.key}>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <q.icon className={`w-4 h-4 ${q.color}`} /> {q.label}
                </label>
                <p className="text-xs text-slate-500 mt-0.5 mb-1.5 leading-relaxed">{q.intro}</p>
                <textarea
                  value={inp[q.key]} onChange={(e) => set(q.key, e.target.value)} rows={3}
                  placeholder={q.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none resize-none"
                />
                <p className="text-xs text-slate-400 italic mt-1 leading-relaxed">{q.example}</p>
              </div>
            ))}

            <div className="border-t border-slate-100 pt-5 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={inp.person_name} onChange={(e) => set("person_name", e.target.value)} placeholder="Ditt namn"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none" />
                <input type="email" value={inp.person_email} onChange={(e) => set("person_email", e.target.value)} placeholder="Din e-post"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none" />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-500 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-amber-600" />
                <span>Ja, skapa min Ikigai och skicka mig resultatet. Jag är okej med att GripCoaching sparar mina svar och hör av sig med tips.</span>
              </label>

              <button onClick={generate} disabled={!ready || generating}
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-5 py-3 rounded-lg text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {generating ? "Skapar din Ikigai..." : "Visa min Ikigai"}
              </button>
              {!ready && !generating && <p className="text-xs text-slate-400 text-center">Fyll i alla frågor, namn, e-post och bocka i rutan.</p>}
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
              {generating && <p className="text-xs text-slate-400 text-center">Det tar ungefär en halv minut — vi tänker igenom det ordentligt.</p>}
            </div>
          </div>
        </section>
      )}

      {/* Resultat */}
      {result && (
        <section id="ikigai-resultat" className="max-w-3xl mx-auto px-5 pb-20">
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            {result.diagram && (
              <div ref={svgRef} className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100 p-3 max-w-[680px] mx-auto">
                <IkigaiDiagram data={result.diagram} />
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button onClick={downloadPdf} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
                <Download className="w-4 h-4" /> Ladda ner som PDF
              </button>
            </div>
            <MarkdownView>{result.markdown}</MarkdownView>

            {/* Coaching-CTA */}
            <div className="rounded-xl bg-slate-950 text-slate-100 p-6 text-center">
              <h3 className="font-bold text-xl">Vill du ta det här vidare?</h3>
              <p className="text-slate-300 mt-2 text-sm leading-relaxed max-w-lg mx-auto">
                Din Ikigai är kartan. Att faktiskt bygga nischen, paketera erbjudandet och få de första kunderna går snabbare med någon vid din sida. Det är där jag kommer in.
              </p>
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-5 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold">
                Boka ett samtal med Håkan <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
