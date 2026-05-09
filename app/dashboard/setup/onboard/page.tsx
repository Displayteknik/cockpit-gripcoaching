"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Rocket,
} from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  public_url: string | null;
  progress: number;
  total: number;
}

interface Step {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  cta_label: string;
  cta_href: string;
}

interface ClientStatus {
  client: { id: string; name: string; slug: string; public_url: string | null };
  steps: Step[];
  stats: Record<string, number>;
}

function OnboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const clientId = params.get("client");
  const [list, setList] = useState<ClientRow[]>([]);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [pixelSnippet, setPixelSnippet] = useState<string | null>(null);
  const [pixelCopied, setPixelCopied] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (clientId) {
      fetch(`/api/setup/onboard-status?client_id=${clientId}`)
        .then((r) => r.json())
        .then((d) => {
          setStatus(d);
          // hoppa till första icke-klara steget
          const firstUndone = d.steps?.findIndex((s: Step) => !s.done) ?? 0;
          setActiveStep(firstUndone < 0 ? 0 : firstUndone);
        })
        .finally(() => setLoading(false));
    } else {
      fetch("/api/setup/onboard-status")
        .then((r) => r.json())
        .then((d) => setList(d.clients ?? []))
        .finally(() => setLoading(false));
    }
  }, [clientId]);

  async function fetchPixel() {
    if (!clientId) return;
    setBusyAction("pixel");
    try {
      const r = await fetch(`/api/setup/pixel-snippet?client_id=${clientId}`);
      const d = await r.json();
      setPixelSnippet(d.snippet ?? null);
    } finally {
      setBusyAction(null);
    }
  }

  async function rebuildVoice() {
    if (!clientId) return;
    setBusyAction("voice");
    setActionMsg(null);
    try {
      const r = await fetch(`/api/setup/voice-rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const d = await r.json();
      setActionMsg(
        d.ok ? `Voice byggd: ${d.summary ?? "klar"}` : `Fel: ${d.summary ?? d.error ?? "okänt"}`
      );
      // refresh
      const s = await fetch(`/api/setup/onboard-status?client_id=${clientId}`).then((r) => r.json());
      setStatus(s);
    } finally {
      setBusyAction(null);
    }
  }

  async function runNightForClient() {
    if (!clientId) return;
    setBusyAction("ideas");
    setActionMsg(null);
    try {
      const r = await fetch(`/api/setup/night-iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const d = await r.json();
      setActionMsg(
        d.ok ? `${d.summary ?? "Idéer genererade"}` : `Fel: ${d.summary ?? d.error ?? "okänt"}`
      );
      const s = await fetch(`/api/setup/onboard-status?client_id=${clientId}`).then((r) => r.json());
      setStatus(s);
    } finally {
      setBusyAction(null);
    }
  }

  // === LIST-VY ===
  if (!clientId) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
        <div className="mb-6">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            Onboarding
          </span>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
            <Rocket className="w-6 h-6 text-purple-600" />
            Onboarding-flöde
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            5 steg per klient. Brand-profil → Voice → Winning examples → Pixel → Idé-motor.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Laddar klienter…
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((c) => {
              const pct = Math.round((c.progress / c.total) * 100);
              const complete = c.progress === c.total;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/dashboard/setup/onboard?client=${c.id}`)}
                  className="w-full text-left bg-white border border-gray-200 hover:border-purple-400 hover:shadow-sm transition rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {c.name}
                      {complete && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.public_url ?? "ingen URL satt"}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-32">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${complete ? "bg-emerald-500" : "bg-purple-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 w-12 text-right">
                      {c.progress}/{c.total}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === DETALJ-VY ===
  if (loading || !status) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Laddar status…
      </div>
    );
  }

  const step = status.steps[activeStep];
  const doneCount = status.steps.filter((s) => s.done).length;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-4">
        <Link
          href="/dashboard/setup/onboard"
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3 h-3" /> Tillbaka till lista
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            Onboarding
          </span>
          <h1 className="font-display text-2xl font-bold text-gray-900 mt-1">{status.client.name}</h1>
          <p className="text-gray-600 text-sm mt-1">{status.client.public_url ?? "ingen URL satt"}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gray-900">
            {doneCount}/{status.steps.length}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">steg klara</div>
        </div>
      </div>

      {/* Steg-rad */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {status.steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveStep(i)}
            className={`text-left p-3 rounded-xl border transition ${
              activeStep === i
                ? "border-purple-500 bg-purple-50"
                : s.done
                ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"
                : "border-gray-200 bg-white hover:border-gray-400"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {s.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <span className="text-xs uppercase tracking-wider text-gray-500">{i + 1}</span>
            </div>
            <div className="text-sm font-semibold text-gray-900">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Aktivt steg-kort */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Steg {activeStep + 1} av {status.steps.length}
            </div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {step.label}
              {step.done && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </h2>
          </div>
        </div>

        <p className="text-gray-700 mb-5">{step.detail}</p>

        {/* Steg-specifika in-page actions */}
        {step.id === "voice" && (status.stats.assets ?? 0) >= 5 && (
          <div className="mb-4">
            <button
              onClick={rebuildVoice}
              disabled={busyAction === "voice"}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busyAction === "voice" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              Bygg/uppdatera voice-fingerprint nu
            </button>
          </div>
        )}

        {step.id === "pixel" && !step.done && (
          <div className="mb-4">
            {!pixelSnippet ? (
              <button
                onClick={fetchPixel}
                disabled={busyAction === "pixel"}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busyAction === "pixel" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Hämta pixel-snippet
              </button>
            ) : (
              <div>
                <div className="text-xs text-gray-500 mb-1">Klistra in i &lt;head&gt; på sajten:</div>
                <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {pixelSnippet}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixelSnippet);
                    setPixelCopied(true);
                    setTimeout(() => setPixelCopied(false), 1500);
                  }}
                  className="mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded inline-flex items-center gap-1"
                >
                  {pixelCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {pixelCopied ? "Kopierat!" : "Kopiera"}
                </button>
              </div>
            )}
          </div>
        )}

        {step.id === "ideas" && (status.stats.gsc_keywords ?? 0) > 0 && (status.stats.ideas ?? 0) === 0 && (
          <div className="mb-4">
            <button
              onClick={runNightForClient}
              disabled={busyAction === "ideas"}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busyAction === "ideas" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              Generera 5 LinkedIn + 5 mejl-idéer nu
            </button>
          </div>
        )}

        {actionMsg && (
          <div className="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2">
            {actionMsg}
          </div>
        )}

        {/* Default-CTA: länk ut till rätt sida */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <Link
            href={step.cta_href}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {step.cta_label}
          </Link>
          {activeStep < status.steps.length - 1 && (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
            >
              Nästa steg <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 py-12 text-center">Laddar…</div>}>
      <OnboardInner />
    </Suspense>
  );
}
