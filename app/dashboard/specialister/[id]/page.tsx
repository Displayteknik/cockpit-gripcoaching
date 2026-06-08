"use client";

import { Suspense, useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, Copy, Check } from "lucide-react";
import { VoiceCheckBadge } from "@/components/dashboard/VoiceCheckBadge";

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
              // Teknisk status så optimeraren inte föreslår kod du redan har.
              const status = d.has_faq_schema
                ? "Teknisk status: sidan har REDAN FAQ-schema — föreslå INGET nytt schema."
                : "Teknisk status: sidan saknar FAQ-schema.";
              setValues((prev) => ({ ...prev, nuvarande_text: `Sida: ${d.url}\n${status}\n\n${d.text}` }));
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
      const data = await res.json();
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
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {result.output}
          </pre>
          <div className="mt-3">
            <VoiceCheckBadge text={result.output} surface="specialist" />
          </div>
        </div>
      )}
    </div>
  );
}
