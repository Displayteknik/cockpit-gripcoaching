"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Loader2, Upload, Wand2, ThumbsUp, ThumbsDown, ExternalLink, Image as ImageIcon } from "lucide-react";

const STYLES = [
  { id: "cinematic", label: "Cinematic mörk" },
  { id: "editorial", label: "Editorial" },
  { id: "product", label: "Produkt" },
  { id: "nordic", label: "Nordiskt natur" },
  { id: "urban", label: "Urban" },
  { id: "minimal", label: "Minimal" },
  { id: "tech", label: "Tech" },
  { id: "lifestyle", label: "Livsstil" },
];

interface StockPhoto { id: number; url: string; src: string; srcMedium: string; photographer: string; alt: string }

interface ImagePickerProps {
  postId: string;
  slideIndex?: number; // om satt → bild för slide, annars huvudbild
  contextText: string; // text för stock-sökning + AI-prompt
  currentImageUrl?: string | null;
  onClose: () => void;
  onSelected: (url: string) => void;
}

export default function ImagePicker({ postId, slideIndex, contextText, currentImageUrl, onClose, onSelected }: ImagePickerProps) {
  const [tab, setTab] = useState<"ai" | "stock" | "upload">("ai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI-state
  const [style, setStyle] = useState("cinematic");
  const [mode, setMode] = useState<"standalone" | "overlay">("standalone");
  const [generated, setGenerated] = useState<{ url: string; prompt: string; engine: string } | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<1 | -1 | null>(null);
  const [aspect, setAspect] = useState<"square" | "portrait" | "landscape">("square");

  // Stock-state
  const [stockQuery, setStockQuery] = useState(contextText.slice(0, 80));
  const [stockResults, setStockResults] = useState<StockPhoto[]>([]);

  // Upload-state
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === "stock" && stockResults.length === 0 && stockQuery) doStockSearch();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doStockSearch() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/social/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: stockQuery, count: 12 }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) setError(d.error);
    setStockResults(d.photos || []);
  }

  async function doGenerate() {
    setBusy(true);
    setError(null);
    setGenerated(null);
    setFeedbackGiven(null);
    const r = await fetch("/api/social/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId, slide_index: slideIndex, style, mode, aspect }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setError(d.error || "Bildgenerering misslyckades"); return; }
    setGenerated({ url: d.image_url, prompt: d.prompt, engine: d.engine });
  }

  async function giveFeedback(rating: 1 | -1) {
    if (!generated) return;
    setFeedbackGiven(rating);
    await fetch("/api/images/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: generated.prompt, image_style: style, content_text: contextText, rating }),
    });
  }

  function applyAi() {
    if (generated) onSelected(generated.url);
  }

  async function applyStock(p: StockPhoto) {
    setBusy(true);
    // Ladda upp till Supabase via generate-image helper-route? Nej — vi har en separat upload?
    // Skicka URL till en upload-helper. Vi kan göra det enkelt: skapa en /api/images/upload som tar URL/base64.
    const r = await fetch("/api/images/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: p.src, post_id: postId, slide_index: slideIndex, attribution: p.photographer }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.url) onSelected(d.url);
    else setError(d.error || "Upload misslyckades");
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const r = await fetch("/api/images/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: dataUrl, post_id: postId, slide_index: slideIndex }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.url) onSelected(d.url);
    else setError(d.error || "Upload misslyckades");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-600" />
            Välj bild {slideIndex != null ? `för slide ${slideIndex + 1}` : ""}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
        </div>

        <div className="flex border-b border-gray-100 bg-gray-50">
          {[
            { id: "ai" as const, label: "AI-generera", icon: Wand2 },
            { id: "stock" as const, label: "Stockfoto (Pexels)", icon: Search },
            { id: "upload" as const, label: "Ladda upp", icon: Upload },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? "border-purple-600 text-purple-700 bg-white" : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded">{error}</div>}

          {tab === "ai" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Stil</label>
                  <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Läge</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value as "standalone" | "overlay")} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="standalone">Standalone (bild = innehåll)</option>
                    <option value="overlay">Overlay (text läggs på)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Format</label>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="square">Kvadrat (1:1) — Feed-post</option>
                    <option value="portrait">Porträtt (9:16) — Reel/Story</option>
                    <option value="landscape">Landskap (16:9)</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                <strong>Bygger på:</strong> {contextText.slice(0, 200)}{contextText.length > 200 ? "…" : ""}
              </div>

              <button
                onClick={doGenerate}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                {busy ? "Skapar bild (15–30 sek)..." : generated ? "Generera ny version" : "Generera bild"}
              </button>

              {generated && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="relative">
                    <img src={generated.url} alt="" className="w-full" />
                    <span className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-0.5 rounded">{generated.engine}</span>
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <button onClick={() => giveFeedback(1)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${feedbackGiven === 1 ? "bg-emerald-600 text-white" : "bg-white/90 hover:bg-white text-emerald-600"}`} title="Bra bild — AI lär sig">
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => giveFeedback(-1)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${feedbackGiven === -1 ? "bg-red-600 text-white" : "bg-white/90 hover:bg-white text-red-600"}`} title="Dålig bild — AI undviker">
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer">Se prompt som AI använde</summary>
                      <div className="mt-2 bg-white p-2 rounded border border-gray-200 font-mono leading-relaxed">{generated.prompt}</div>
                    </details>
                    <button onClick={applyAi} className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold">
                      Använd denna bild
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "stock" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doStockSearch(); }}
                  placeholder="Sökord (svenska eller engelska)"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <button onClick={doStockSearch} disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sök"}
                </button>
              </div>
              <div className="text-xs text-gray-400">Gemini tolkar kontexten och kraftar engelsk Pexels-sökning.</div>

              {stockResults.length === 0 && !busy && (
                <div className="text-center text-sm text-gray-400 py-8">
                  {error ? "" : "Inga resultat ännu. Sökt på det relevanta för posten."}
                </div>
              )}
              {stockResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {stockResults.map((p) => (
                    <button key={p.id} onClick={() => applyStock(p)} disabled={busy} className="group relative rounded-lg overflow-hidden bg-gray-100 aspect-square hover:ring-2 hover:ring-blue-400 disabled:opacity-50">
                      <img src={p.srcMedium} alt={p.alt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                        <div className="text-white text-[10px] p-1.5 truncate w-full bg-black/50 opacity-0 group-hover:opacity-100">📸 {p.photographer}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-400 flex items-center gap-1">
                Foton från <a href="https://pexels.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline flex items-center gap-0.5">Pexels <ExternalLink className="w-3 h-3" /></a> — gratis under Pexels-licens. Fotograf-attribution sparas automatiskt.
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) uploadFile(f);
                }}
                className="border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl p-12 text-center cursor-pointer transition-colors"
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                {busy ? (
                  <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto" />
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <div className="text-sm font-medium text-gray-700">Dra & släpp eller klicka för att välja</div>
                    <div className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — max 5 MB</div>
                  </>
                )}
              </div>
              {currentImageUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Aktuell bild:</div>
                  <img src={currentImageUrl} alt="" className="rounded-lg border border-gray-200 max-h-32" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
