"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, Copy, Check } from "lucide-react";

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
  const { id } = use(params);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/specialist")
      .then((r) => r.json())
      .then((list: Specialist[]) => {
        const s = list.find((x) => x.id === id);
        if (s) setSpecialist(s);
        else setError("Specialist saknas");
      })
      .catch((e) => setError(e.message));
  }, [id]);

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
        </div>
      )}
    </div>
  );
}
