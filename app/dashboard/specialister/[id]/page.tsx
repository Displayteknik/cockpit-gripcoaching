"use client";

import { Suspense, useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, Copy, Check } from "lucide-react";
import { VoiceCheckBadge } from "@/components/dashboard/VoiceCheckBadge";
import MarkdownView from "@/components/MarkdownView";

// Gör om markdown till ren text för inklistring i visuella byggare (GHL m.fl.) —
// så inga #, ** eller länk-syntax följer med och stör typsnitt/färg.
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")            // kodblock bort (hör ej till sidtexten)
    .replace(/^#{1,6}\s+/gm, "")               // rubriker → ren rad
    .replace(/\*\*([^*]+)\*\*/g, "$1")         // fet
    .replace(/\*([^*]+)\*/g, "$1")             // kursiv
    .replace(/`([^`]+)`/g, "$1")               // inline-kod
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // länkar → bara text
    .replace(/^\s*[-*]\s+/gm, "• ")            // punktlistor
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ") // numrerade listor behåller siffran
    .replace(/^\s*\|.*\|\s*$/gm, "")           // ev. tabellrader bort
    .replace(/^-{3,}\s*$/gm, "")               // avdelare bort
    .replace(/\n{3,}/g, "\n\n")                // städa blankrader
    .trim();
}

// Delar upp svaret i guide / texten-att-klistra-in / resten, så texten kan visas i en egen kopiera-ruta.
function splitOutput(md: string): { before: string; paste: string; after: string } | null {
  const lines = md.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+.*färdig text/i.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let j = start + 1; j < lines.length; j++) {
    if (/^#{1,3}\s+/.test(lines[j])) { end = j; break; }
  }
  const paste = lines.slice(start + 1, end).join("\n").trim();
  if (!paste) return null;
  return {
    before: lines.slice(0, start).join("\n").trim(),
    paste,
    after: lines.slice(end).join("\n").trim(),
  };
}

type Input = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

type Specialist = {
  id: string;
  name: string;
  category: string;
  inputs: Input[];
};

type RunResult = {
  output: string;
  model: string;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number;
};

export default function SpecialistRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500 p-4">Laddar...</div>}>
      <SpecialistRunnerInner params={params} />
    </Suspense>
  );
}

function SpecialistRunnerInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteCopied, setPasteCopied] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list: Specialist[] = await fetch("/api/specialist").then((r) => r.json());
        const s = list.find((x) => x.id === id);
        if (!s) { if (!cancelled) setError("Specialist saknas"); return; }
        if (cancelled) return;
        setSpecialist(s);

        // 1. Prefill fran query-params (t.ex. amne fran "Att gora idag" / Quick wins)
        const prefill: Record<string, string> = {};
        for (const inp of s.inputs) {
          const v = searchParams?.get(inp.key);
          if (v) prefill[inp.key] = v;
        }

        // 2. Brand-profilen fyller aterkommande falt (lasare/bransch/USP) som inte redan satts.
        //    En sanningskalla — anvandaren ska inte skriva samma info varje gang.
        try {
          const brandRes = await fetch("/api/brand/prefill").then((r) => r.json());
          const brand: Record<string, string> = brandRes?.prefill ?? {};
          for (const inp of s.inputs) {
            if (!prefill[inp.key] && brand[inp.key]) prefill[inp.key] = brand[inp.key];
          }
        } catch {}

        if (!cancelled && Object.keys(prefill).length > 0) {
          setValues((prev) => ({ ...prev, ...prefill }));
        }

        // 3. Sidtext lases in AUTOMATISKT om sid_url finns + specialisten har nuvarande_text.
        //    Ingen knapp — verktyget gor det sjalvt.
        const sidUrl = searchParams?.get("sid_url");
        const amneParam = searchParams?.get("amne") || "";
        const hasNuvarande = s.inputs.some((i) => i.key === "nuvarande_text");
        if (sidUrl && hasNuvarande) {
          setPageLoading(true);
          try {
            const res = await fetch(`/api/seo/page-text?url=${encodeURIComponent(sidUrl)}${amneParam ? `&amne=${encodeURIComponent(amneParam)}` : ""}`);
            const d = await res.json();
            if (!cancelled && res.ok && d.text) {
              // Teknisk status så optimeraren anpassar sig (plattform + befintligt schema).
              const status = [
                d.platform ? `Plattform: ${d.platform}` : "",
                d.has_faq_schema
                  ? "Teknisk status: sidan har REDAN FAQ-schema — föreslå INGET nytt schema."
                  : "Teknisk status: sidan saknar FAQ-schema.",
              ].filter(Boolean).join("\n");
              // Kapa till ~4000 tecken — räcker som kontext, håller prompten snabb (undviker timeout).
              const pageText = String(d.text || "").slice(0, 4000);
              setValues((prev) => ({ ...prev, nuvarande_text: `Sida: ${d.url}\n${status}\n\n${pageText}` }));
            }
          } catch {} finally {
            if (!cancelled) setPageLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id, searchParams]);

  const onChange = (key: string, v: string) => setValues((p) => ({ ...p, [key]: v }));

  const run = async () => {
    if (!specialist) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/specialist/${specialist.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });
      const raw = await res.text();
      let data: RunResult & { error?: string };
      try {
        data = JSON.parse(raw);
      } catch {
        // Vercel returnerar text (ej JSON) vid timeout → visa begripligt fel.
        throw new Error("Genereringen tog för lång tid eller avbröts. Försök igen — eller korta ned 'Nuvarande text'.");
      }
      if (!res.ok) throw new Error(data?.error ?? "Fel vid körning");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyPaste = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setPasteCopied(true);
    setTimeout(() => setPasteCopied(false), 1500);
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link
          href="/dashboard/specialister"
          className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Tillbaka till specialister
        </Link>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {specialist?.name ?? "Laddar..."}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {pageLoading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-3 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Läser in sidans text automatiskt...
        </div>
      )}

      {specialist && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          {specialist.inputs.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {f.label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : f.type === "select" ? (
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                >
                  <option value="">Välj...</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Kör...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Kör specialisten
              </>
            )}
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500">
              {result.model} · {result.tokens_out} tokens out · {(result.duration_ms / 1000).toFixed(1)}s
            </div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" /> Kopierat
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Kopiera
                </>
              )}
            </button>
          </div>
          {(() => {
            const parts = splitOutput(result.output);
            if (!parts) return <MarkdownView>{result.output}</MarkdownView>;
            return (
              <>
                {parts.before && <MarkdownView>{parts.before}</MarkdownView>}
                <div className="mt-4 border-2 border-emerald-300 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between bg-emerald-50 px-4 py-2.5 border-b border-emerald-200">
                    <span className="text-sm font-semibold text-emerald-900">📋 Texten du klistrar in på sidan</span>
                    <button
                      onClick={() => copyPaste(stripMarkdown(parts.paste))}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {pasteCopied ? <><Check className="w-3 h-3" /> Kopierat</> : <><Copy className="w-3 h-3" /> Kopiera text</>}
                    </button>
                  </div>
                  <div className="p-4 max-h-[520px] overflow-y-auto bg-white">
                    <MarkdownView>{parts.paste}</MarkdownView>
                  </div>
                </div>
                {parts.after && <div className="mt-4"><MarkdownView>{parts.after}</MarkdownView></div>}
              </>
            );
          })()}
          <div className="mt-3">
            <VoiceCheckBadge text={result.output} surface="specialist" />
          </div>
        </div>
      )}
    </div>
  );
}
