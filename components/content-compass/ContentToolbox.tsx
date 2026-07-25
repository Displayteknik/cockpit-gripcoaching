"use client";

// CC-3 verktygslåda (admin): klistra in en text → auto-klassa (funnel/4A/DISC + confidence)
// eller granska mot inläggsanatomin (hook, känsla, kund-nytta, exakt en CTA). Ren testyta,
// rör inte StudioMaker. Klassning kan senare kopplas till att spara på en post.
import { useState } from "react";
import { Wand2, ClipboardCheck, Loader2, Check, X } from "lucide-react";
import { CompassBadges } from "@/components/content-compass/badges";
import type { FunnelLevel } from "@/lib/content-compass/data";

const FUNNEL_OPTS: { v: "" | FunnelLevel; label: string }[] = [
  { v: "", label: "Funnel: auto" },
  { v: "tofu", label: "TOFU" },
  { v: "mofu", label: "MOFU" },
  { v: "bofu", label: "BOFU" },
];

interface ClassifyRes { funnel: string | null; four_a: string | null; disc: string[]; confidence: number | null; motivering: string }
interface ReviewRes {
  passed: boolean;
  checks: { har_hook: boolean; har_kansla: boolean; nytta_ar_kundens_resultat: boolean; antal_cta: number | null; cta_matchar_funnel: boolean | null };
  brister: string[];
  sammanfattning: string;
}

export default function ContentToolbox({ accent = "#7c3aed" }: { accent?: string }) {
  const [text, setText] = useState("");
  const [funnel, setFunnel] = useState<"" | FunnelLevel>("");
  const [busy, setBusy] = useState<"" | "classify" | "review">("");
  const [err, setErr] = useState("");
  const [classifyRes, setClassifyRes] = useState<ClassifyRes | null>(null);
  const [reviewRes, setReviewRes] = useState<ReviewRes | null>(null);

  const run = async (mode: "classify" | "review") => {
    if (text.trim().length < 20) { setErr("Klistra in en text (minst 20 tecken)."); return; }
    setBusy(mode); setErr(""); setClassifyRes(null); setReviewRes(null);
    try {
      const url = mode === "classify" ? "/api/content/classify" : "/api/content/review";
      const payload = mode === "classify" ? { text: text.trim() } : { text: text.trim(), funnel: funnel || undefined };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Något gick fel."); return; }
      if (mode === "classify") setClassifyRes(d); else setReviewRes(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const CheckRow = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-500" />}
      <span className={ok ? "text-gray-700" : "text-red-600"}>{label}</span>
    </div>
  );

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-display font-bold text-gray-900 text-lg">Innehålls-verktyg</h2>
        <p className="text-xs text-gray-400">Klistra in ett inlägg. Klassa det på tre axlar eller granska det mot inläggsanatomin.</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Klistra in ett socialt inlägg här."
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 outline-none resize-y"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => run("classify")} disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: accent }}>
          {busy === "classify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Klassa
        </button>
        <button onClick={() => run("review")} disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
          {busy === "review" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Granska mot anatomin
        </button>
        <select value={funnel} onChange={(e) => setFunnel(e.target.value as "" | FunnelLevel)} className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm">
          {FUNNEL_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}

      {classifyRes && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Klassning:</span>
            <CompassBadges funnel={classifyRes.funnel} four_a={classifyRes.four_a} disc={classifyRes.disc} />
            {classifyRes.confidence != null && <span className="text-xs text-gray-400">säkerhet {Math.round(classifyRes.confidence * 100)}%</span>}
          </div>
          {classifyRes.motivering && <p className="text-xs text-gray-500">{classifyRes.motivering}</p>}
        </div>
      )}

      {reviewRes && (
        <div className={`rounded-xl border p-4 space-y-2 ${reviewRes.passed ? "border-emerald-100 bg-emerald-50/40" : "border-amber-100 bg-amber-50/40"}`}>
          <div className="text-sm font-semibold text-gray-800">{reviewRes.passed ? "Följer anatomin" : "Kan bli bättre"}</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            <CheckRow ok={reviewRes.checks.har_hook} label="Har en hook" />
            <CheckRow ok={reviewRes.checks.har_kansla} label="Känsla och igenkänning" />
            <CheckRow ok={reviewRes.checks.nytta_ar_kundens_resultat} label="Nyttan är kundens resultat" />
            <CheckRow ok={reviewRes.checks.antal_cta === 1} label={`Exakt en CTA${reviewRes.checks.antal_cta != null ? ` (hittade ${reviewRes.checks.antal_cta})` : ""}`} />
            {reviewRes.checks.cta_matchar_funnel != null && <CheckRow ok={reviewRes.checks.cta_matchar_funnel} label="CTA matchar funnel-nivån" />}
          </div>
          {reviewRes.brister.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
              {reviewRes.brister.map((b, i) => <li key={i}>· {b}</li>)}
            </ul>
          )}
          {reviewRes.sammanfattning && <p className="text-xs text-gray-500">{reviewRes.sammanfattning}</p>}
        </div>
      )}
    </section>
  );
}
