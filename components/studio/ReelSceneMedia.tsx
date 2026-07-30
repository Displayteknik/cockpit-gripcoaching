"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Upload, FolderOpen, Sparkles, Search, Loader2, X, Check } from "lucide-react";
import type { ReelMediaSource } from "@/lib/studio/reels";

interface Kandidat { url: string; thumb: string; credit: string }
interface Bibliotek { id: string; url: string; source: string; source_detail: string | null }

type Spar = "upp" | "mina" | "ai" | "stock" | null;

// Prioritetsordning i UI:t: eget material FÖRE ai och stock. Äkta kundbilder är alltid
// bättre än en genererad visualisering, och Före och efter kräver bekräftelse med AI-bild.
const SPAR: { key: Exclude<Spar, null>; label: string; icon: typeof Upload }[] = [
  { key: "upp", label: "Ladda upp", icon: Upload },
  { key: "mina", label: "Mina bilder", icon: FolderOpen },
  { key: "ai", label: "Skapa bild", icon: Sparkles },
  { key: "stock", label: "Sök foto", icon: Search },
];

export default function ReelSceneMedia({
  mediaUrl,
  source,
  imagePrompt,
  onValj,
}: {
  mediaUrl: string;
  source: ReelMediaSource;
  imagePrompt: string;
  onValj: (url: string, source: ReelMediaSource) => void;
}) {
  const [spar, setSpar] = useState<Spar>(null);
  const [busy, setBusy] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [kandidater, setKandidater] = useState<Kandidat[]>([]);
  const [bibliotek, setBibliotek] = useState<Bibliotek[]>([]);
  // B3: exakt text som ska synas i scenbilden + verifieringsslingans utfall.
  const [aiText, setAiText] = useState("");
  const [textInfo, setTextInfo] = useState<{ metod: string; forsok: number; verifierad: boolean; avlastText: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const zonRef = useRef<HTMLDivElement>(null);

  // Klistra in (Ctrl+V) direkt i scenen, utan omväg via mediabiblioteket.
  useEffect(() => {
    const zon = zonRef.current;
    if (!zon) return;
    function onPaste(e: ClipboardEvent) {
      const fil = Array.from(e.clipboardData?.files || []).find((f) => f.type.startsWith("image/"));
      if (fil) {
        e.preventDefault();
        void laddaUpp(fil);
      }
    }
    zon.addEventListener("paste", onPaste);
    return () => zon.removeEventListener("paste", onPaste);
  });

  async function anta(url: string, src: Exclude<ReelMediaSource, "">, detail?: string) {
    setBusy(true);
    setFel(null);
    try {
      const r = await fetch("/api/studio/reels/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adopt", url, source: src, detail }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte spara bilden");
      onValj(d.media.url, src);
      setSpar(null);
      setKandidater([]);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  async function laddaUpp(file: File) {
    setBusy(true);
    setFel(null);
    try {
      const r = await fetch("/api/studio/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      // Beskärs till 1080x1920 och registreras med källa uploaded på serversidan.
      await anta(d.publicUrl, "uploaded", file.name);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Uppladdning misslyckades");
      setBusy(false);
    }
  }

  async function oppna(k: Exclude<Spar, null>) {
    if (spar === k) {
      setSpar(null);
      return;
    }
    setSpar(k);
    setFel(null);
    setKandidater([]);

    if (k === "upp") {
      fileRef.current?.click();
      return;
    }

    // AI-spåret öppnar en liten panel (valfri "Text i bilden") — genererar först på knappen.
    if (k === "ai") return;

    setBusy(true);
    try {
      if (k === "mina") {
        const r = await fetch("/api/studio/reels/media");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Kunde inte hämta bilderna");
        setBibliotek(d.items || []);
      } else {
        const r = await fetch("/api/studio/reels/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: k, prompt: imagePrompt }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Kunde inte hämta bilder");
        setKandidater(d.candidates || []);
      }
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  // B3: generera scenbilden — med exakt text går den genom verifieringsslingan
  // (vision-koll, max 3 försök, programmatisk fallback) på serversidan.
  async function genereraAi() {
    setBusy(true);
    setFel(null);
    setTextInfo(null);
    try {
      const r = await fetch("/api/studio/reels/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai", prompt: imagePrompt, exactText: aiText.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa bilden");
      onValj(d.media.url, "ai");
      if (d.textInfo) setTextInfo(d.textInfo);
      else setSpar(null);
    } catch (e) {
      setFel(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={zonRef} tabIndex={-1} className="mt-4 outline-none">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void laddaUpp(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-start gap-4">
        {/* 9:16-ruta så du ser exakt vad scenen blir */}
        <div className="relative h-40 w-[90px] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs leading-tight text-gray-400">
              Ingen bild än
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {SPAR.map((s) => {
              const Icon = s.icon;
              const aktiv = spar === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={busy}
                  onClick={() => void oppna(s.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    aktiv ? "border-pink-300 bg-pink-50 text-pink-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {mediaUrl ? (
              <>
                Källa: <span className="font-medium text-gray-600">{etikett(source)}</span>. Beskuren till 1080 x 1920.
              </>
            ) : (
              "Dra in en bild, klistra in med Ctrl+V, eller välj ett spår ovan."
            )}
          </p>

          {fel && <p className="mt-2 text-xs text-red-600">{fel}</p>}

          {spar === "mina" && !busy && (
            <div className="mt-3">
              {bibliotek.length === 0 ? (
                <p className="text-xs text-gray-400">Inga bilder än. Ladda upp en, eller använd Skapa bild.</p>
              ) : (
                <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8">
                  {bibliotek.map((b, i) => (
                    <button key={b.id || i} type="button" onClick={() => void anta(b.url, "uploaded", b.source_detail || undefined)} className="group relative aspect-[9/16] overflow-hidden rounded-md border border-gray-200 hover:border-pink-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 hidden items-center justify-center bg-pink-600/70 group-hover:flex">
                        <Check className="h-4 w-4 text-white" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {spar === "ai" && (
            <div className="mt-3 space-y-2">
              <input
                value={aiText} onChange={(e) => setAiText(e.target.value)} maxLength={120} disabled={busy}
                placeholder="Text i bilden (valfri) — t.ex. Öppet i sommar"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-pink-200"
              />
              <div className="flex items-center gap-2">
                <button type="button" disabled={busy} onClick={() => void genereraAi()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-700 disabled:opacity-50">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Skapa bilden
                </button>
                <button type="button" onClick={() => setSpar(null)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" /> Stäng
                </button>
              </div>
              {textInfo && (
                textInfo.verifierad ? (
                  <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
                    {textInfo.metod === "programmatisk"
                      ? "Texten lades på stavningssäkert (bild utan text + exakt text ovanpå)."
                      : `Texten kontrollerad och stämmer (försök ${textInfo.forsok}).`}
                  </p>
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    Texten i bilden avviker: ”{textInfo.avlastText || "ingen text hittades"}”. Prova igen.
                  </p>
                )
              )}
            </div>
          )}

          {spar === "stock" && !busy && kandidater.length > 0 && (
            <div className="mt-3">
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
                {kandidater.map((k, i) => (
                  <button key={i} type="button" onClick={() => void anta(k.url, "stock", k.credit)} className="group relative aspect-[9/16] overflow-hidden rounded-md border border-gray-200 hover:border-pink-300">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={k.thumb} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 hidden items-center justify-center bg-pink-600/70 group-hover:flex">
                      <Check className="h-4 w-4 text-white" />
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setSpar(null)} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="h-3 w-3" /> Stäng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function etikett(s: ReelMediaSource): string {
  return s === "uploaded" ? "eget material" : s === "email" ? "inmejlat" : s === "ai" ? "AI-bild" : s === "stock" ? "stockfoto" : "okänd";
}
