"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Image as ImageIcon, Download, Upload, Loader2, Wand2, Star,
  Maximize2, Save, Check, Search, RefreshCw,
} from "lucide-react";
import { TEMPLATE_META } from "@/lib/studio/templates-meta";
import type { StudioFormat } from "@/lib/studio/payload";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface Suggestion { hookType: string; headline1: string; headline2: string; body: string }

const HOOK_LABEL: Record<string, string> = {
  "fråga": "Fråga", "statistik": "Statistik", "konträr": "Konträr",
  "berättelse": "Berättelse", "påstående": "Påstående",
};

const DEFAULT_COLOR = "#1A6B3C";

// Standardfärg + snabbval för penseldrags-rutan. Gul = Opticurs standard.
const DEFAULT_BRUSH = "#F2B01E";
const BRUSH_SWATCHES: { name: string; hex: string }[] = [
  { name: "Gul", hex: "#F2B01E" },
  { name: "Grön", hex: "#1A6B3C" },
  { name: "Ljusgrön", hex: "#5AAF32" },
  { name: "Mint", hex: "#7ECECA" },
  { name: "Mörkgrön", hex: "#0F4F2A" },
  { name: "Vit", hex: "#FFFFFF" },
];

// UTF-8-säker base64 (åäö) i webbläsaren — matchar serverns Buffer-base64.
function encodePayload(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export default function StudioPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATE_META[0].id);
  const [format, setFormat] = useState<StudioFormat>("1080x1350");
  const [headline1, setHeadline1] = useState("");
  const [headline2, setHeadline2] = useState("");
  const [body, setBody] = useState("");
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [badgeLine1, setBadgeLine1] = useState("FRÅN");
  const [badgeLine2, setBadgeLine2] = useState("0 KR");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFocusY, setImageFocusY] = useState(40);
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH);
  const [topic, setTopic] = useState("");

  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imgResults, setImgResults] = useState<{ url: string; thumb: string; credit: string }[]>([]);
  const [searchingImg, setSearchingImg] = useState<"stock" | "ai" | "">("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const meta = useMemo(() => TEMPLATE_META.find((t) => t.id === templateId)!, [templateId]);
  const primary = client?.primary_color || DEFAULT_COLOR;
  const slug = client?.slug || "opticur";

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  const payload = useMemo(
    () => ({
      clientId: slug, templateId, format, headline1, headline2, body,
      badge: { enabled: meta.fields.badge && badgeEnabled, line1: badgeLine1, line2: badgeLine2 },
      imageUrl, imageFocusY, brushColor,
    }),
    [slug, templateId, format, headline1, headline2, body, meta, badgeEnabled, badgeLine1, badgeLine2, imageUrl, imageFocusY, brushColor],
  );

  // Debouncad preview-URL så iframen inte laddar om vid varje tangenttryck.
  // _v = cache-brytare; "Uppdatera"-knappen sätter nytt värde → tvingar färsk render.
  const [nonce, setNonce] = useState(() => Date.now());
  const [previewSrc, setPreviewSrc] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setPreviewSrc(`/studio/render/${templateId}?p=${encodeURIComponent(encodePayload(payload))}&_v=${nonce}`);
    }, 400);
    return () => clearTimeout(t);
  }, [payload, templateId, nonce]);

  const [w, h] = format === "1080x1080" ? [1080, 1080] : [1080, 1350];
  const previewScale = 300 / w; // preview-bredd ~300px

  // ── Foto-uppladdning (signerad URL → Supabase Storage) ──
  const onFile = useCallback(async (file: File) => {
    setError(""); setUploading(true);
    try {
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      setImageUrl(d.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Bildförslag (Pexels-stock eller AI-genererad) ──
  const suggestImage = useCallback(async (mode: "stock" | "ai") => {
    setError(""); setSearchingImg(mode);
    try {
      const r = await fetch("/api/studio/suggest-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topic: topic || headline1, aspect: format === "1080x1350" ? "portrait" : "square" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Bildförslag misslyckades");
      setImgResults(d.photos || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchingImg("");
    }
  }, [topic, headline1, format]);

  // ── AI-textförslag (3 hook-drivna varianter) ──
  const suggest = useCallback(async () => {
    setError(""); setSuggesting(true); setSuggestions([]);
    try {
      const r = await fetch("/api/studio/suggest-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, format, topic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "AI-förslag misslyckades");
      setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [templateId, format, topic]);

  const applySuggestion = useCallback((s: Suggestion) => {
    setHeadline1(s.headline1 || "");
    setHeadline2(s.headline2 || "");
    setBody(s.body || "");
  }, []);

  // ── Export PNG (en klick lokalt; annars payload-nedladdning) ──
  const exportPng = useCallback(async () => {
    setError(""); setExporting(true);
    try {
      const r = await fetch("/api/studio/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Export misslyckades");
      const a = document.createElement("a");
      a.href = d.dataUrl;
      a.download = `${slug}-${templateId}-${format}.png`;
      a.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [payload, slug, templateId, format]);

  const downloadPayload = useCallback(() => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${templateId}.json`;
    a.click();
  }, [payload, slug, templateId]);

  // ── Utkast (localStorage) ──
  const draftKey = `studio-draft:${slug}`;
  const saveDraft = useCallback(() => {
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }, [draftKey, payload]);
  const loadDraft = useCallback(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      setTemplateId(d.templateId ?? TEMPLATE_META[0].id);
      setFormat(d.format ?? "1080x1350");
      setHeadline1(d.headline1 ?? ""); setHeadline2(d.headline2 ?? ""); setBody(d.body ?? "");
      setBadgeEnabled(!!d.badge?.enabled); setBadgeLine1(d.badge?.line1 ?? "FRÅN"); setBadgeLine2(d.badge?.line2 ?? "0 KR");
      setImageUrl(d.imageUrl ?? ""); setImageFocusY(d.imageFocusY ?? 40);
      setBrushColor(d.brushColor || DEFAULT_BRUSH);
    } catch { /* ignore */ }
  }, [draftKey]);

  const fileRef = useRef<HTMLInputElement>(null);
  const inputCls = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
              <ImageIcon className="w-6 h-6" style={{ color: primary }} />
            </span>
            <div>
              <h1 className="font-display font-bold text-2xl text-gray-900">Studio</h1>
              <p className="text-sm text-gray-500">Skapa färdiga inlägg — utan Canva. {client ? `Klient: ${client.name}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadDraft} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              Återuppta utkast
            </button>
            <button onClick={saveDraft} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              {saved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />} Spara utkast
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* ── Vänster: formulär ── */}
          <div className="space-y-6">
            {/* Mall + format */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display font-bold text-gray-900 text-lg">Mall</h2>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATE_META.map((t) => {
                  const active = t.id === templateId;
                  return (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className="text-left rounded-xl border px-4 py-3 transition-colors"
                      style={active ? { borderColor: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb" }}>
                      <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.formats.join(" · ")}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {(["1080x1350", "1080x1080"] as StudioFormat[]).map((f) => {
                  const active = f === format;
                  return (
                    <button key={f} onClick={() => setFormat(f)}
                      className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      style={active ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                      {f === "1080x1350" ? "Porträtt 4:5" : "Kvadrat 1:1"}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Foto */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display font-bold text-gray-900 text-lg">Foto</h2>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 cursor-pointer p-6 text-center transition-colors"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Laddar upp…</div>
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="max-h-40 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
                      <Upload className="w-[18px] h-[18px]" style={{ color: primary }} />
                    </span>
                    Dra hit en bild eller klicka för att ladda upp
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </div>
              {imageUrl && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Vertikal fokuspunkt ({imageFocusY}%)</label>
                  <input type="range" min={0} max={100} value={imageFocusY} onChange={(e) => setImageFocusY(Number(e.target.value))} className="w-full" style={{ accentColor: primary }} />
                </div>
              )}

              {/* Bildförslag: riktiga foton (Pexels) eller AI-genererat */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="text-xs font-medium text-gray-500">Ingen egen bild? Låt verktyget föreslå — utifrån ämnet {topic ? `"${topic}"` : "(fyll i under Text)"}.</div>
                <div className="flex gap-2">
                  <button onClick={() => suggestImage("stock")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {searchingImg === "stock" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sök riktiga foton
                  </button>
                  <button onClick={() => suggestImage("ai")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {searchingImg === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generera (AI)
                  </button>
                </div>
                {imgResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imgResults.map((p, i) => (
                      <button key={i} onClick={() => setImageUrl(p.url)} title={p.credit}
                        className="rounded-lg overflow-hidden border-2 transition-colors aspect-square"
                        style={{ borderColor: imageUrl === p.url ? primary : "transparent" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Text */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">Text</h2>
                <button onClick={suggest} disabled={suggesting}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  style={{ background: primary }}>
                  {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Föreslå text
                </button>
              </div>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ämne för AI-förslag (valfritt) — t.ex. skolstart, barnglasögon…" className={inputCls} />

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500">Välj ett förslag — klicka för att fylla i:</div>
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => applySuggestion(s)}
                      className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 p-3 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
                          {HOOK_LABEL[s.hookType] || "Hook"}
                        </span>
                        <span className="text-sm font-bold text-gray-900 truncate">{s.headline1}</span>
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2">{s.headline2} — {s.body}</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{meta.fields.headline1}</label>
                  <input value={headline1} onChange={(e) => setHeadline1(e.target.value)} className={inputCls} />
                  {headline1.length > meta.headlineSoftMax && (
                    <div className="text-xs text-amber-600 mt-1">Rubriken är {headline1.length} tecken — bryter troligen till 2 rader i denna mall (ryms ~{meta.headlineSoftMax}).</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{meta.fields.headline2}</label>
                  <input value={headline2} onChange={(e) => setHeadline2(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{meta.fields.body}</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputCls} />
                </div>
              </div>

              {meta.fields.badge && (
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={badgeEnabled} onChange={(e) => setBadgeEnabled(e.target.checked)} style={{ accentColor: primary }} />
                    <Star className="w-4 h-4" style={{ color: primary }} /> Visa pris-stjärna
                  </label>
                  {badgeEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <input value={badgeLine1} onChange={(e) => setBadgeLine1(e.target.value)} placeholder="Rad 1" className={inputCls} />
                      <input value={badgeLine2} onChange={(e) => setBadgeLine2(e.target.value)} placeholder="Rad 2" className={inputCls} />
                    </div>
                  )}
                </div>
              )}

              {meta.fields.brush && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="block text-xs font-medium text-gray-500">Färg på rutan</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {BRUSH_SWATCHES.map((s) => {
                      const active = brushColor.toUpperCase() === s.hex.toUpperCase();
                      return (
                        <button key={s.hex} onClick={() => setBrushColor(s.hex)} title={s.name}
                          className="w-8 h-8 rounded-full border transition-transform hover:scale-110"
                          style={{
                            background: s.hex,
                            borderColor: active ? "#111827" : "#e5e7eb",
                            boxShadow: active ? "0 0 0 2px #fff, 0 0 0 4px #111827" : "none",
                          }} />
                      );
                    })}
                    <label className="w-8 h-8 rounded-full border border-dashed border-gray-300 flex items-center justify-center cursor-pointer relative overflow-hidden" title="Egen färg">
                      <span className="text-[10px] text-gray-500">+</span>
                      <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                    <button onClick={() => setBrushColor(DEFAULT_BRUSH)} className="text-xs text-gray-500 hover:text-gray-700 ml-1">Återställ</button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Höger: live-preview (sticky) ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Förhandsvisning</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setNonce(Date.now())} title="Ladda om förhandsvisningen (färsk render)" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
                  </button>
                  <a href={previewSrc} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <Maximize2 className="w-3.5 h-3.5" /> Full storlek
                  </a>
                </div>
              </div>
              <div className="mx-auto rounded-xl overflow-hidden border border-gray-100 bg-gray-100" style={{ width: w * previewScale, height: h * previewScale }}>
                {previewSrc && (
                  <iframe title="preview" src={previewSrc} scrolling="no"
                    style={{ width: w, height: h, border: 0, transform: `scale(${previewScale})`, transformOrigin: "top left" }} />
                )}
              </div>
            </section>

            <button onClick={exportPng} disabled={exporting}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primary }}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportera PNG
            </button>
            <button onClick={downloadPayload} className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
              Ladda ner payload (för CLI-export)
            </button>
            <p className="text-xs text-gray-400 text-center px-2">
              Export kör lokalt via Playwright. Funkar inte knappen (t.ex. i molnet) — ladda ner payload och kör <code className="bg-gray-100 px-1 rounded">npm run studio:export</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
