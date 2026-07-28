"use client";

import { useState } from "react";
import { Film, Sparkles, AlertTriangle, Clock, Copy, CheckCircle2, Loader2, Image as ImageIcon, Type, ShieldAlert } from "lucide-react";
import { DashHero, LivePill, HeroChip } from "@/components/ui/dash";
import { REEL_TEMPLATE_LIST, MAX_WORDS_PER_LINE, SAFE_ZONE, ordCount, type ReelStoryboard, type ReelTemplateKey, type ReelSceneKind } from "@/lib/studio/reels";

const KIND_LABEL: Record<ReelSceneKind, string> = {
  hook: "Krok",
  problem: "Problem",
  losning: "Lösning",
  fakta: "Fakta",
  cta: "Uppmaning",
};

const TRANSITION_LABEL: Record<string, string> = {
  overton: "Överton",
  svep: "Svep",
  ingen: "Ingen",
};

const DISC_OPTIONS: { letter: "D" | "I" | "S" | "C"; label: string }[] = [
  { letter: "D", label: "Rak och resultatdriven" },
  { letter: "I", label: "Energisk och visionär" },
  { letter: "S", label: "Trygg och relationsnära" },
  { letter: "C", label: "Faktabaserad och noggrann" },
];

export default function ReelsPage() {
  const [templateKey, setTemplateKey] = useState<ReelTemplateKey>("erbjudande");
  const [ide, setIde] = useState("");
  const [disc, setDisc] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<ReelStoryboard | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mall = REEL_TEMPLATE_LIST.find((m) => m.key === templateKey);

  function toggleDisc(letter: string) {
    setDisc((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  async function kopiera(text: string, vad: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(vad);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Kunde inte kopiera. Markera texten och kopiera manuellt.");
    }
  }

  async function skapa() {
    if (!ide.trim()) {
      setError("Skriv din idé först.");
      return;
    }
    setBusy(true);
    setError(null);
    setBoard(null);
    try {
      const res = await fetch("/api/studio/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ide, templateKey, disc: Array.from(disc) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunde inte skapa manuset");
      setBoard(data as ReelStoryboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <DashHero
        title="Reels"
        subtitle="Skriv en idé, få ett färdigt reel-manus scen för scen. Bilder och rendering kommer i nästa steg."
        icon={Film}
        accent="#ec4899"
        eyebrow={<LivePill label="steg 1 av 4: manus" />}
        chips={
          <>
            <HeroChip icon={Type} label="1080 x 1920" />
            <HeroChip icon={Clock} label="8 till 15 sek" />
            <HeroChip icon={Sparkles} label="4 mallar" />
          </>
        }
      />

      {/* Steg 1 — mall */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">1. Vad ska reelen göra?</h2>
        <p className="mt-1 text-sm text-gray-500">Mallen bestämmer antal scener och hur långa de är. Du skriver bara idén.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REEL_TEMPLATE_LIST.map((m) => {
            const vald = m.key === templateKey;
            const sek = m.scenes.reduce((s, x) => s + x.durationMs, 0) / 1000;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setTemplateKey(m.key)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  vald
                    ? "border-pink-300 bg-pink-50 shadow-[0_10px_30px_-12px_rgba(236,72,153,0.5)]"
                    : "border-gray-100 bg-white hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                  {vald && <CheckCircle2 className="h-4 w-4 text-pink-500" />}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{m.hint}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                  <span>{m.scenes.length} scener</span>
                  <span>{sek.toFixed(1)} sek</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Steg 2 — idé */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">2. Din idé</h2>
        <p className="mt-1 text-sm text-gray-500">En eller två meningar räcker. Skriv som du skulle sagt det till en kund.</p>
        <textarea
          value={ide}
          onChange={(e) => setIde(e.target.value)}
          rows={3}
          placeholder="Skicka en bild på din butik så visar vi hur den ser ut med skärm, gratis montage och pris inom 24 timmar"
          className="mt-4 w-full rounded-xl border border-gray-200 p-3.5 text-sm text-gray-900 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
        />

        <div className="mt-5">
          <h3 className="text-sm font-medium text-gray-700">Tilltal (valfritt)</h3>
          <p className="mt-1 text-xs text-gray-500">Styr tonen i texten. Hoppa över om du är osäker.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DISC_OPTIONS.map((d) => {
              const på = disc.has(d.letter);
              return (
                <button
                  key={d.letter}
                  type="button"
                  onClick={() => toggleDisc(d.letter)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    på ? "border-pink-300 bg-pink-50 text-pink-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={skapa}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Skriver manuset..." : "Skapa manus"}
          </button>
          {mall && <span className="text-xs text-gray-400">{mall.scenes.length} scener enligt mallen {mall.name}</span>}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Resultat */}
      {board && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{board.title}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Mall {board.templateName}, {board.scenes.length} scener, {(board.durationMs / 1000).toFixed(1)} sekunder totalt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => kopiera(JSON.stringify(board, null, 2), "json")}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                {copied === "json" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "json" ? "Kopierat" : "Kopiera JSON"}
              </button>
            </div>

            {board.varningar.length > 0 && (
              <div className="mt-4 space-y-2">
                {board.varningar.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {board.aiBekraftelseKravs && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-xs text-blue-800">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Den här mallen kräver bekräftelse innan rendering om någon scen använder en AI-bild. AI-bilder får visa koncept och
                  visualiseringar, inte utges för verkliga kundinstallationer.
                </span>
              </div>
            )}
          </div>

          {board.scenes.map((s, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white">{i + 1}</span>
                <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-700">{KIND_LABEL[s.kind]}</span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {(s.durationMs / 1000).toFixed(1)} sek
                </span>
                <span className="text-xs text-gray-400">Övergång: {TRANSITION_LABEL[s.transition]}</span>
                <span className="text-xs text-gray-400">
                  Ken Burns {s.kenBurns.from.toFixed(2)} till {s.kenBurns.to.toFixed(2)}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {[s.overlay.line1, s.overlay.line2].filter(Boolean).map((rad, r) => {
                  const n = ordCount(rad);
                  const over = n > MAX_WORDS_PER_LINE;
                  return (
                    <div key={r} className="flex items-baseline justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                      <span className={`text-sm font-medium ${r === 0 ? "text-gray-900" : "text-gray-600"}`}>{rad}</span>
                      <span className={`shrink-0 text-xs tabular-nums ${over ? "font-semibold text-red-600" : "text-gray-400"}`}>{n} ord</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
                <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="italic">{s.imagePrompt}</span>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">Caption</h3>
              <button
                type="button"
                onClick={() => kopiera(board.caption, "caption")}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                {copied === "caption" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "caption" ? "Kopierat" : "Kopiera"}
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-sans text-sm leading-relaxed text-gray-800">{board.caption}</pre>
          </div>

          <p className="px-1 text-xs text-gray-400">
            Texterna hamnar innanför Instagrams säkra zoner vid rendering: {SAFE_ZONE.top} px från toppen, {SAFE_ZONE.bottom} px från botten
            och {SAFE_ZONE.side} px in från sidorna. Där ligger appens egna knappar och caption.
          </p>
        </section>
      )}
    </div>
  );
}
