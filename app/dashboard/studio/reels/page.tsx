"use client";

import { useEffect, useState } from "react";
import { Film, Sparkles, AlertTriangle, Clock, Copy, CheckCircle2, Loader2, Image as ImageIcon, Type, ShieldAlert, Save, Play, Download } from "lucide-react";
import { renderReel, kanRendera, NEUTRAL_BRAND, type RenderBrand } from "@/lib/studio/reel-render";
import { DashHero, LivePill, HeroChip } from "@/components/ui/dash";
import ReelSceneMedia from "@/components/studio/ReelSceneMedia";
import { REEL_TEMPLATE_LIST, MAX_WORDS_PER_LINE, SAFE_ZONE, ordCount, type ReelStoryboard, type ReelTemplateKey, type ReelSceneKind, type ReelMediaSource } from "@/lib/studio/reels";

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
  const [reelId, setReelId] = useState<string | null>(null);
  const [sparar, setSparar] = useState(false);
  const [sparad, setSparad] = useState(false);
  const [aiBekraftad, setAiBekraftad] = useState(false);
  const [brand, setBrand] = useState<RenderBrand>(NEUTRAL_BRAND);
  const [stod, setStod] = useState<{ ok: boolean; skal?: string } | null>(null);
  const [renderar, setRenderar] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMb, setVideoMb] = useState(0);
  const [sparade, setSparade] = useState<
    { id: string; title: string | null; template_key: string; duration_ms: number | null; updated_at: string; storyboard: ReelStoryboard }[]
  >([]);

  async function laddaSparade() {
    try {
      const r = await fetch("/api/studio/reels");
      const d = await r.json();
      if (r.ok) setSparade(d.items || []);
    } catch {
      /* listan är en bekvämlighet, inte ett krav */
    }
  }

  useEffect(() => {
    void laddaSparade();
  }, []);

  function oppnaSparad(id: string) {
    const rad = sparade.find((s) => s.id === id);
    if (!rad?.storyboard?.scenes) return;
    setBoard(rad.storyboard);
    setTemplateKey(rad.storyboard.templateKey);
    setReelId(id);
    setSparad(true);
    setAiBekraftad(false);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Kundens färger och typsnitt in i videon, samma källa som resten av Studio.
  useEffect(() => {
    fetch("/api/studio/brand")
      .then((r) => r.json())
      .then((d) => {
        const b = d?.brand;
        if (!b) return;
        setBrand({
          headlineFont: b.fonts?.headline || "Inter",
          bodyFont: b.fonts?.body || "Inter",
          accent: b.colors?.accent || NEUTRAL_BRAND.accent,
          ink: b.colors?.ink || NEUTRAL_BRAND.ink,
          paper: b.colors?.paper || NEUTRAL_BRAND.paper,
        });
      })
      .catch(() => {});
    kanRendera().then(setStod).catch(() => setStod({ ok: false, skal: "Kunde inte kontrollera videostödet." }));
  }, []);

  const mall = REEL_TEMPLATE_LIST.find((m) => m.key === templateKey);

  // Äkthetsregeln: bekräftelse krävs bara när mallen påstår en verklig förändring OCH
  // någon scen faktiskt bär en AI-bild. Eget material passerar alltid fritt.
  const harAiBild = Boolean(board?.scenes.some((s) => s.source === "ai"));
  const kraverBekraftelse = Boolean(board?.aiBekraftelseKravs) && harAiBild;
  const antalMedMaterial = board?.scenes.filter((s) => s.mediaUrl).length ?? 0;
  const alltMaterialKlart = Boolean(board) && antalMedMaterial === board!.scenes.length;

  function sattMaterial(index: number, url: string, source: ReelMediaSource) {
    setBoard((prev) => {
      if (!prev) return prev;
      const scenes = prev.scenes.map((s, i) => (i === index ? { ...s, mediaUrl: url, source } : s));
      return { ...prev, scenes };
    });
    setSparad(false);
  }

  async function rendera() {
    if (!board) return;
    setRenderar(true);
    setError(null);
    setRenderProgress(0);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    try {
      const blob = await renderReel(board, brand, setRenderProgress);
      setVideoUrl(URL.createObjectURL(blob));
      setVideoMb(blob.size / 1024 / 1024);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Renderingen misslyckades");
    } finally {
      setRenderar(false);
    }
  }

  async function sparaReel() {
    if (!board) return;
    setSparar(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reelId, storyboard: board }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunde inte spara");
      setReelId(data.id);
      setSparad(true);
      void laddaSparade();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSparar(false);
    }
  }

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
    setReelId(null);
    setSparad(false);
    setAiBekraftad(false);
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => kopiera(JSON.stringify(board, null, 2), "json")}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  {copied === "json" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "json" ? "Kopierat" : "Kopiera JSON"}
                </button>
                <button
                  type="button"
                  onClick={sparaReel}
                  disabled={sparar}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {sparar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : sparad ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
                  {sparar ? "Sparar..." : sparad ? "Sparad" : reelId ? "Uppdatera" : "Spara reel"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 text-xs">
              <span className={alltMaterialKlart ? "font-semibold text-emerald-700" : "font-medium text-gray-700"}>
                {antalMedMaterial} av {board.scenes.length} scener har bild
              </span>
              <span className="text-gray-400">
                {alltMaterialKlart
                  ? kraverBekraftelse && !aiBekraftad
                    ? "Bekräfta AI-bilderna nedan innan rendering."
                    : "Klart för rendering. Renderaren byggs i nästa etapp."
                  : "Välj material för varje scen nedan."}
              </span>
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

            {kraverBekraftelse && (
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-xs text-blue-800">
                <input
                  type="checkbox"
                  checked={aiBekraftad}
                  onChange={(e) => setAiBekraftad(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Jag bekräftar att AI-bilderna i den här reelen visar koncept och visualiseringar, och inte utges för verkliga
                    kundinstallationer.
                  </span>
                </span>
              </label>
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

              <ReelSceneMedia
                mediaUrl={s.mediaUrl}
                source={s.source}
                imagePrompt={s.imagePrompt}
                onValj={(url, source) => sattMaterial(i, url, source)}
              />
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

          {/* Rendering */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Gör videon</h3>
            <p className="mt-1 text-sm text-gray-500">
              Videon skapas i din webbläsare, inget laddas upp till någon server. Det tar några sekunder.
            </p>

            {stod && !stod.ok && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{stod.skal} Öppna sidan i Chrome eller Edge så fungerar det.</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={rendera}
                disabled={renderar || !alltMaterialKlart || (kraverBekraftelse && !aiBekraftad) || (stod ? !stod.ok : false)}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {renderar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {renderar ? `Renderar ${Math.round(renderProgress * 100)} %` : "Rendera video"}
              </button>

              {videoUrl && (
                <a
                  href={videoUrl}
                  download={`reel-${board.templateKey}.mp4`}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                >
                  <Download className="h-4 w-4" />
                  Ladda ner ({videoMb.toFixed(1)} MB)
                </a>
              )}

              {!alltMaterialKlart && <span className="text-xs text-gray-400">Alla scener behöver en bild först.</span>}
              {alltMaterialKlart && kraverBekraftelse && !aiBekraftad && (
                <span className="text-xs text-gray-400">Bekräfta AI-bilderna ovan först.</span>
              )}
            </div>

            {renderar && (
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-pink-500 transition-all" style={{ width: `${Math.round(renderProgress * 100)}%` }} />
              </div>
            )}

            {videoUrl && (
              <div className="mt-5 flex flex-wrap items-start gap-5">
                <video src={videoUrl} controls playsInline className="w-[220px] rounded-xl border border-gray-200 bg-black" />
                <div className="min-w-0 flex-1 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">Klar att publicera</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Ladda ner filen och lägg upp den i Instagram-appen. Lägg på ett trendljud när du publicerar, det ger betydligt
                    bättre räckvidd än en reel utan ljud.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="px-1 text-xs text-gray-400">
            Texterna hamnar innanför Instagrams säkra zoner vid rendering: {SAFE_ZONE.top} px från toppen, {SAFE_ZONE.bottom} px från botten
            och {SAFE_ZONE.side} px in från sidorna. Där ligger appens egna knappar och caption.
          </p>
        </section>
      )}

      {/* Sparade reels */}
      {sparade.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Sparade reels</h2>
          <p className="mt-1 text-sm text-gray-500">Klicka för att öppna manuset igen, byta bilder eller rendera om.</p>
          <div className="mt-4 divide-y divide-gray-100">
            {sparade.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => oppnaSparad(s.id)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{s.title || "Utan titel"}</div>
                  <div className="mt-0.5 text-xs text-gray-400">
                    {REEL_TEMPLATE_LIST.find((m) => m.key === s.template_key)?.name || s.template_key}
                    {s.duration_ms ? ` · ${(s.duration_ms / 1000).toFixed(1)} sek` : ""}
                    {` · ${new Date(s.updated_at).toLocaleDateString("sv-SE")}`}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium text-pink-600">Öppna</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
