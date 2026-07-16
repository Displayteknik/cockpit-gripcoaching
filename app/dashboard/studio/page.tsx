"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Image as ImageIcon, Download, Upload, Loader2, Wand2, Star,
  Maximize2, Save, Check, Search, RefreshCw, Trash2, Copy, FolderOpen, Send,
} from "lucide-react";
import { TEMPLATE_META, templatesForClient, isRecommendedFormat } from "@/lib/studio/templates-meta";
import type { StudioFormat } from "@/lib/studio/payload";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface Suggestion { hookType: string; headline1: string; headline2: string; body: string }
interface StudioPost { id: string; template_id: string; format: StudioFormat; title: string; image_url: string | null; payload: Record<string, unknown>; updated_at: string }
interface GhlAccount { id: string; name: string; platform: string; type: string; avatar?: string; isExpired?: boolean }

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
  const [imgComment, setImgComment] = useState("");
  const [editingImg, setEditingImg] = useState(false);
  const [prevImageUrl, setPrevImageUrl] = useState("");
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH);
  const [swatches, setSwatches] = useState(BRUSH_SWATCHES);
  const [contentFormats, setContentFormats] = useState<string[]>([]);
  const [topic, setTopic] = useState("");

  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imgResults, setImgResults] = useState<{ url: string; thumb: string; credit: string }[]>([]);
  const [searchingImg, setSearchingImg] = useState<"stock" | "ai" | "">("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [loadedPostId, setLoadedPostId] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [caption, setCaption] = useState("");
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  const [ghlConnected, setGhlConnected] = useState<boolean | null>(null);
  const [ghlAccounts, setGhlAccounts] = useState<GhlAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [ghlLocInput, setGhlLocInput] = useState("");
  const [ghlPitInput, setGhlPitInput] = useState("");
  const [connectingGhl, setConnectingGhl] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  const meta = useMemo(() => TEMPLATE_META.find((t) => t.id === templateId)!, [templateId]);
  const primary = client?.primary_color || DEFAULT_COLOR;
  const slug = client?.slug || "opticur";
  const availableTemplates = useMemo(() => templatesForClient(slug, contentFormats as never), [slug, contentFormats]);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  // Färg-swatches ur klientens grafiska profil (roll-färger) — annars Opticur-standard.
  useEffect(() => {
    fetch("/api/brand-kit").then((r) => r.json()).then((d) => {
      const fmts = d?.kit?.contentProfile?.formats;
      if (Array.isArray(fmts)) setContentFormats(fmts);
      const col = d?.kit?.colors || {};
      const roles: { name: string; hex: string }[] = [
        { name: "Accent", hex: col.accent }, { name: "Primär", hex: col.primary },
        { name: "Primär ljus", hex: col.primaryLight }, { name: "Stödfärg", hex: col.support },
        { name: "Primär mörk", hex: col.primaryDeep },
      ].filter((x) => typeof x.hex === "string" && /^#/.test(x.hex));
      if (roles.length >= 2) setSwatches([...roles, { name: "Vit", hex: "#FFFFFF" }]);
    }).catch(() => {});
  }, [client]);

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

  // ── Ändra bild via kommentar (bild-till-bild, Nano Banana) ──
  const editImage = useCallback(async () => {
    if (!imageUrl || !imgComment.trim()) return;
    setError(""); setEditingImg(true);
    try {
      const r = await fetch("/api/studio/edit-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, instruction: imgComment }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Bildändring misslyckades");
      setPrevImageUrl(imageUrl);
      setImageUrl(d.url);
      setImgComment("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEditingImg(false);
    }
  }, [imageUrl, imgComment]);

  const undoImageEdit = useCallback(() => {
    if (!prevImageUrl) return;
    setImageUrl(prevImageUrl);
    setPrevImageUrl("");
  }, [prevImageUrl]);

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
  // Fyller hela editorn från en payload (delas av utkast + bibliotek).
  const applyPayload = useCallback((d: Record<string, unknown>) => {
    const badge = (d.badge ?? {}) as { enabled?: boolean; line1?: string; line2?: string };
    setTemplateId((d.templateId as string) ?? TEMPLATE_META[0].id);
    setFormat((d.format as StudioFormat) ?? "1080x1350");
    setHeadline1((d.headline1 as string) ?? ""); setHeadline2((d.headline2 as string) ?? ""); setBody((d.body as string) ?? "");
    setBadgeEnabled(!!badge.enabled); setBadgeLine1(badge.line1 ?? "FRÅN"); setBadgeLine2(badge.line2 ?? "0 KR");
    setImageUrl((d.imageUrl as string) ?? ""); setImageFocusY((d.imageFocusY as number) ?? 40);
    setBrushColor((d.brushColor as string) || DEFAULT_BRUSH);
    setCaption((d.caption as string) ?? "");
    setPrevImageUrl("");
  }, []);

  const loadDraft = useCallback(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try { applyPayload(JSON.parse(raw)); setLoadedPostId(null); } catch { /* ignore */ }
  }, [draftKey, applyPayload]);

  // ── Bibliotek: tidigare skapelser (studio_posts) ──
  const refreshPosts = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/posts");
      const d = await r.json();
      if (r.ok) setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshPosts(); }, [refreshPosts, client]);

  // Spara aktuell skapelse i biblioteket. asNew=true → alltid ny kopia.
  const savePost = useCallback(async (asNew = false) => {
    setError(""); setSavingPost(true);
    try {
      const title = headline1 || body.slice(0, 40) || "Namnlöst inlägg";
      const r = await fetch("/api/studio/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asNew ? undefined : loadedPostId, title, payload: { ...payload, caption } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte spara i biblioteket");
      setLoadedPostId(d.post?.id ?? null);
      await refreshPosts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPost(false);
    }
  }, [headline1, body, caption, loadedPostId, payload, refreshPosts]);

  // Öppna en sparad skapelse i editorn för återanvändning/redigering.
  const openPost = useCallback((p: StudioPost) => {
    applyPayload(p.payload);
    setLoadedPostId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [applyPayload]);

  const deletePost = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/studio/posts/${id}`, { method: "DELETE" });
      if (r.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        if (loadedPostId === id) setLoadedPostId(null);
      }
    } catch { /* ignore */ }
  }, [loadedPostId]);

  // ── Publicering: GHL Social Planner (utkast) ──
  const refreshGhlAccounts = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/ghl-accounts");
      const d = await r.json();
      setGhlConnected(!!d.connected);
      const accs: GhlAccount[] = Array.isArray(d.accounts) ? d.accounts : [];
      setGhlAccounts(accs);
      setSelectedAccounts(accs.filter((a) => !a.isExpired).map((a) => a.id));
    } catch { setGhlConnected(false); }
  }, []);
  useEffect(() => { refreshGhlAccounts(); }, [refreshGhlAccounts, client]);

  const connectGhl = useCallback(async () => {
    if (!ghlLocInput.trim() || !ghlPitInput.trim()) { setError("Fyll i location-id och token"); return; }
    setError(""); setConnectingGhl(true);
    try {
      const r = await fetch("/api/studio/ghl-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: ghlLocInput.trim(), pit: ghlPitInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte koppla");
      setGhlPitInput("");
      await refreshGhlAccounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnectingGhl(false);
    }
  }, [ghlLocInput, ghlPitInput, refreshGhlAccounts]);

  const disconnectGhl = useCallback(async () => {
    await fetch("/api/studio/ghl-config", { method: "DELETE" });
    setGhlAccounts([]); setSelectedAccounts([]); setGhlConnected(false);
  }, []);

  const suggestCaption = useCallback(async () => {
    setError(""); setSuggestingCaption(true);
    try {
      const r = await fetch("/api/studio/suggest-caption", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: headline1, body, topic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte föreslå caption");
      setCaption(d.caption || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggestingCaption(false);
    }
  }, [headline1, body, topic]);

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const publishDraft = useCallback(async () => {
    if (!selectedAccounts.length) { setError("Välj minst ett konto"); return; }
    setError(""); setPublishing(true); setPublished(false);
    try {
      const r = await fetch("/api/studio/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: loadedPostId, accountIds: selectedAccounts, caption, imageUrl, scheduleDate: scheduleDate || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
      setPublished(true);
      await refreshPosts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }, [selectedAccounts, loadedPostId, caption, imageUrl, scheduleDate, refreshPosts]);

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
                {availableTemplates.map((t) => {
                  const active = t.id === templateId;
                  const rec = isRecommendedFormat(t, contentFormats as never);
                  return (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className="text-left rounded-xl border px-4 py-3 transition-colors relative"
                      style={active ? { borderColor: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                        {rec && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>Föreslås</span>}
                      </div>
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

              {/* Ändra bilden via kommentar (AI redigerar den befintliga bilden) */}
              {imageUrl && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                  <label className="block text-xs font-medium text-gray-600">Ändra bilden — skriv vad du vill</label>
                  <textarea value={imgComment} onChange={(e) => setImgComment(e.target.value)} rows={2}
                    placeholder='T.ex. "visa bara barnet, inte optikern, annars lika" eller "ljusare bakgrund"'
                    className={inputCls} />
                  <div className="flex items-center gap-2">
                    <button onClick={editImage} disabled={editingImg || !imgComment.trim()}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                      style={{ background: primary }}>
                      {editingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Ändra bild
                    </button>
                    {prevImageUrl && (
                      <button onClick={undoImageEdit} disabled={editingImg}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        <RefreshCw className="w-4 h-4" /> Ångra ändring
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Behåller komposition och stil — ändrar bara det du ber om.</p>
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
                    {swatches.map((s) => {
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

            {/* Spara i biblioteket (återanvändbar skapelse) */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-3 space-y-2">
              <button onClick={() => savePost(false)} disabled={savingPost}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {savingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {loadedPostId ? "Uppdatera i biblioteket" : "Spara i biblioteket"}
              </button>
              {loadedPostId && (
                <button onClick={() => savePost(true)} disabled={savingPost}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  <Copy className="w-4 h-4" /> Spara som ny
                </button>
              )}
              {loadedPostId && <p className="text-xs text-gray-400 text-center">Redigerar en sparad skapelse — uppdatera den eller spara som ny.</p>}
            </div>

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

            {/* Publicera till GHL (utkast) */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" style={{ color: primary }} />
                <h3 className="font-display font-bold text-gray-900 text-sm">Publicera till GHL (utkast)</h3>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-500">Bildtext (caption)</label>
                  <button onClick={suggestCaption} disabled={suggestingCaption} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40">
                    {suggestingCaption ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Föreslå
                  </button>
                </div>
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} placeholder="Skriv eller föreslå en caption…" className={inputCls} />
              </div>

              {ghlConnected === null ? (
                <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kollar koppling…</div>
              ) : !ghlConnected ? (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2">
                  <div className="text-xs text-gray-600">Koppla {client?.name || "klienten"}s GHL för att publicera. Skapa en <span className="font-medium">Private Integration-token</span> (scope: Social Media + View Users) i klientens GHL.</div>
                  <input value={ghlLocInput} onChange={(e) => setGhlLocInput(e.target.value)} placeholder="Location-id (t.ex. ZWqjUhS3f77BPpOiyMHK)" className={inputCls}
                    name="ghl-location-id" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <input value={ghlPitInput} onChange={(e) => setGhlPitInput(e.target.value)} type="text" placeholder="Private Integration-token (pit-…)" className={`${inputCls} font-mono`}
                    name="ghl-pit-token" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <button onClick={connectGhl} disabled={connectingGhl}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {connectingGhl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Koppla GHL
                  </button>
                </div>
              ) : ghlAccounts.length === 0 ? (
                <div className="text-xs text-gray-500">Inga kopplade sociala konton i GHL för den här klienten.</div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-500">Publicera till</div>
                    <button onClick={disconnectGhl} className="text-xs text-gray-400 hover:text-red-600">Koppla från</button>
                  </div>
                  <div className="space-y-1">
                    {ghlAccounts.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={() => toggleAccount(a.id)} disabled={a.isExpired} style={{ accentColor: primary }} />
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{a.platform}</span>
                        <span className="truncate">{a.name}</span>
                        {a.isExpired && <span className="text-xs text-red-500">(utgången)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {ghlConnected && ghlAccounts.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Schemalägg (valfritt)</label>
                    <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={inputCls} />
                    {scheduleDate && <button onClick={() => setScheduleDate("")} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Rensa (skapa som utkast istället)</button>}
                  </div>
                  <button onClick={publishDraft} disabled={publishing || !selectedAccounts.length}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : published ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {published ? (scheduleDate ? "Schemalagt i GHL" : "Utkast skapat i GHL") : (scheduleDate ? "Schemalägg i GHL" : "Skapa utkast i GHL")}
                  </button>
                </>
              )}
              <p className="text-xs text-gray-400">Utan datum: skapar utkast (publicerar inte). Med datum: schemaläggs i Social Planner och publiceras vid tidpunkten.</p>
            </div>
          </div>
        </div>

        {/* ── Tidigare skapelser (återanvänd & redigera) ── */}
        {posts.length > 0 && (
          <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" style={{ color: primary }} />
                <h2 className="font-display font-bold text-gray-900 text-lg">Tidigare skapelser</h2>
                <span className="text-xs text-gray-400">({posts.length})</span>
              </div>
              <button onClick={refreshPosts} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {posts.map((p) => {
                const [pw, ph] = p.format === "1080x1080" ? [1080, 1080] : [1080, 1350];
                const cardW = 150;
                const s = cardW / pw;
                const active = loadedPostId === p.id;
                return (
                  <div key={p.id} className="group rounded-xl border overflow-hidden transition-colors" style={{ borderColor: active ? primary : "#f3f4f6" }}>
                    <div className="bg-gray-100 overflow-hidden mx-auto" style={{ width: cardW, height: ph * s }}>
                      <iframe title={p.title} scrolling="no"
                        src={`/studio/render/${p.template_id}?p=${encodeURIComponent(encodePayload(p.payload))}`}
                        style={{ width: pw, height: ph, border: 0, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }} />
                    </div>
                    <div className="p-2 space-y-1.5">
                      <div className="text-xs font-semibold text-gray-800 truncate" title={p.title}>{p.title}</div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openPost(p)}
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg text-white hover:opacity-90"
                          style={{ background: primary }}>
                          <FolderOpen className="w-3.5 h-3.5" /> Öppna
                        </button>
                        <button onClick={() => deletePost(p.id)} title="Ta bort"
                          className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
