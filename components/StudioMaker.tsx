"use client";

import SmartTextarea from "@/components/SmartTextarea";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Image as ImageIcon, Download, Upload, Loader2, Wand2, Star,
  Maximize2, Save, Check, Search, RefreshCw, Trash2, Copy, FolderOpen, Send,
  ExternalLink,
} from "lucide-react";
import { TEMPLATE_META, templatesForClient, isRecommendedFormat, templateNeedsImage } from "@/lib/studio/templates-meta";
import type { StudioFormat, StudioOverrides, StudioSlide } from "@/lib/studio/payload";
import { DEFAULT_OVERRIDES, FORMAT_LABELS, FORMAT_DIMENSIONS, isStoryFormat, emptySlide, MAX_SLIDES, derivePostType } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import StudioEditor, { type ImagePatch } from "@/components/studio/StudioEditor";
import ChannelPreview, { type ChannelKey, CHANNEL_BRAND } from "@/components/studio/ChannelPreview";
import { toBlob } from "html-to-image";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface Suggestion { hookType: string; headline1: string; headline2: string; body: string }
interface StudioPost { id: string; template_id: string; format: StudioFormat; title: string; image_url: string | null; payload: Record<string, unknown>; updated_at: string }
interface GhlAccount { id: string; name: string; platform: string; type: string; avatar?: string; isExpired?: boolean }

const HOOK_LABEL: Record<string, string> = {
  "fråga": "Fråga", "statistik": "Statistik", "konträr": "Konträr",
  "berättelse": "Berättelse", "påstående": "Påstående",
};

const SLIDE_KIND_LABEL: Record<string, string> = { hook: "Krok", point: "Punkt", cta: "Avslut" };

// Fas B — de tre kanalerna. platform = matchning mot GHL:s platform-sträng.
// Grafisk identitet (label/färg/gradient/ikon) hämtas ur CHANNEL_BRAND (EN källa).
const CHANNELS: { key: ChannelKey; platform: string }[] = [
  { key: "ig", platform: "instagram" },
  { key: "fb", platform: "facebook" },
  { key: "li", platform: "linkedin" },
];

const DEFAULT_COLOR = "#1A6B3C";

// Pedagogiska stegfärger (1-5) — harmoniska men distinkta. Varje steg får sin färg på
// nummer, ram och skugga så det syns direkt vad som hör ihop.
const STEG_FARGER = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"];
// Ram + mjuk färgad skugga för ett stegområde.
function stegRam(c: string): React.CSSProperties {
  return { borderColor: `${c}66`, boxShadow: `0 10px 30px -14px ${c}99` };
}

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

// customerMode = kundvyn (/k/studio): döljer byrå-only (GHL-config, CLI-payload),
// publicering endast Instagram-direkt. Admin-vyn (/dashboard/studio) = full.
export default function StudioMaker({ customerMode = false }: { customerMode?: boolean }) {
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
  const [overrides, setOverrides] = useState<StudioOverrides>(DEFAULT_OVERRIDES);
  const [slides, setSlides] = useState<StudioSlide[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [genCarousel, setGenCarousel] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [brand, setBrand] = useState<StudioBrand | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [applyingPaste, setApplyingPaste] = useState(false);
  const [topic, setTopic] = useState("");

  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imgResults, setImgResults] = useState<{ url: string; thumb: string; credit: string }[]>([]);
  const [searchingImg, setSearchingImg] = useState<"stock" | "ai" | "">("");
  // Personligt mediabibliotek (uppladdade + AI-bilder) — återanvänd eller släng.
  const [showMedia, setShowMedia] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ path: string; url: string; name: string; updated: string | null }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [deletingPath, setDeletingPath] = useState("");
  const [editOpen, setEditOpen] = useState(false); // Fas C: inline-redigering (modal)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [loadedPostId, setLoadedPostId] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [caption, setCaption] = useState("");
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  const [ghlConnected, setGhlConnected] = useState<boolean | null>(null);
  const [ghlAccounts, setGhlAccounts] = useState<GhlAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [ghlLocInput, setGhlLocInput] = useState("");
  const [ghlPitInput, setGhlPitInput] = useState("");
  const [connectingGhl, setConnectingGhl] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [igConn, setIgConn] = useState<{ connected: boolean; handle: string | null } | null>(null);
  // Fas B — multi-kanal: valda kanaler (förikryssade efter koppling), per-kanal-caption,
  // per-kanal publiceringsstatus. Grund-captionen (steg 4) är källa; kanal-caption faller
  // tillbaka på den tills man anpassar.
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(["ig"]);
  const [channelsSeeded, setChannelsSeeded] = useState(false);
  const [channelCaptions, setChannelCaptions] = useState<Record<ChannelKey, string>>({ ig: "", fb: "", li: "" });
  const [adapting, setAdapting] = useState(false);
  const [pubBusy, setPubBusy] = useState<ChannelKey | "">("");
  const [pubResult, setPubResult] = useState<Record<ChannelKey, "" | "ok" | "err">>({ ig: "", fb: "", li: "" });
  const [copied, setCopied] = useState<ChannelKey | "">("");

  const meta = useMemo(() => TEMPLATE_META.find((t) => t.id === templateId)!, [templateId]);
  const primary = client?.primary_color || DEFAULT_COLOR;
  const slug = client?.slug || "opticur";
  const availableTemplates = useMemo(() => templatesForClient(slug, contentFormats as never), [slug, contentFormats]);

  // Vald mall stödjer kanske inte aktuellt format (t.ex. byte till Opticur-mall utan 9:16) → hoppa till mallens första.
  useEffect(() => {
    if (!meta.formats.includes(format)) setFormat(meta.formats[0]);
  }, [meta, format]);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  // Resolved brand för live-editorn (samma som exporten använder).
  useEffect(() => {
    fetch("/api/studio/brand").then((r) => r.json()).then((d) => { if (d.brand) setBrand(d.brand); }).catch(() => {});
  }, [client]);

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
      imageUrl, imageFocusY, brushColor, overrides, slides, videoUrl,
    }),
    [slug, templateId, format, headline1, headline2, body, meta, badgeEnabled, badgeLine1, badgeLine2, imageUrl, imageFocusY, brushColor, overrides, slides, videoUrl],
  );

  const isCarousel = Boolean(meta.carousel);
  const slideCount = slides.length;
  const postType = derivePostType(format, videoUrl); // "post" | "story" | "reel"
  const needsImage = templateNeedsImage(templateId); // §00: mallar där bilden bär inlägget

  // Seed en tom karusell (hook → 3 punkter → cta) när man byter till karusell-mallen.
  useEffect(() => {
    if (isCarousel && slides.length === 0) {
      setSlides([emptySlide("hook"), emptySlide("point"), emptySlide("point"), emptySlide("point"), emptySlide("cta")]);
      setSlideIdx(0);
    }
  }, [isCarousel, slides.length]);

  const updateSlide = useCallback((i: number, patch: Partial<StudioSlide>) => {
    setSlides((prev) => prev.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  }, []);
  const addSlide = useCallback(() => {
    setSlides((prev) => {
      if (prev.length >= MAX_SLIDES) return prev;
      // Ny punkt före ev. cta-sliden så avslutet stannar sist.
      const ctaAt = prev.findIndex((s) => s.kind === "cta");
      const at = ctaAt >= 0 ? ctaAt : prev.length;
      const next = [...prev];
      next.splice(at, 0, emptySlide("point"));
      setSlideIdx(at);
      return next;
    });
  }, []);
  const removeSlide = useCallback((i: number) => {
    setSlides((prev) => (prev.length <= 1 ? prev : prev.filter((_, n) => n !== i)));
  }, []);
  const moveSlide = useCallback((i: number, dir: -1 | 1) => {
    setSlides((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSlideIdx((cur) => Math.min(Math.max(0, cur + dir), MAX_SLIDES - 1));
  }, []);

  // Debouncad preview-URL så iframen inte laddar om vid varje tangenttryck.
  // _v = cache-brytare; "Uppdatera"-knappen sätter nytt värde → tvingar färsk render.
  const [nonce, setNonce] = useState(() => Date.now());
  const [previewSrc, setPreviewSrc] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const slideQ = isCarousel ? `&slide=${slideIdx}` : "";
      setPreviewSrc(`/studio/render/${templateId}?p=${encodeURIComponent(encodePayload(payload))}${slideQ}&_v=${nonce}`);
    }, 400);
    return () => clearTimeout(t);
  }, [payload, templateId, nonce, isCarousel, slideIdx]);

  // Håll slide-index inom gränserna när slides ändras.
  useEffect(() => {
    if (slideIdx > Math.max(0, slideCount - 1)) setSlideIdx(Math.max(0, slideCount - 1));
  }, [slideCount, slideIdx]);

  const { w, h } = FORMAT_DIMENSIONS[format];
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

  // Video-uppladdning (för reels) → studio-videos-bucketen. Studio-rendern blir 9:16-cover.
  const onVideoFile = useCallback(async (file: File) => {
    setError(""); setUploadingVideo(true);
    try {
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Video-uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      setVideoUrl(d.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingVideo(false);
    }
  }, []);

  // ── Bildförslag (Pexels-stock eller AI-genererad) ──
  const suggestImage = useCallback(async (mode: "stock" | "ai") => {
    setError(""); setSearchingImg(mode);
    try {
      const r = await fetch("/api/studio/suggest-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topic: topic || headline1, aspect: isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square" }),
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

  // ── Mediabibliotek: klientens sparade bilder (studio-images/<clientId>/) ──
  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const r = await fetch("/api/studio/media");
      const d = await r.json();
      if (r.ok) setMediaItems(Array.isArray(d.items) ? d.items : []);
    } catch { /* ignore */ } finally { setLoadingMedia(false); }
  }, []);
  const toggleMedia = useCallback(() => {
    setShowMedia((v) => { if (!v) loadMedia(); return !v; });
  }, [loadMedia]);
  const deleteMedia = useCallback(async (path: string) => {
    setDeletingPath(path);
    try {
      const r = await fetch("/api/studio/media", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (r.ok) setMediaItems((prev) => prev.filter((m) => m.path !== path));
    } catch { /* ignore */ } finally { setDeletingPath(""); }
  }, []);

  // §00: aldrig tom yta — generera on-brand bild ur inläggets innehåll och applicera direkt.
  const generateOnBrandImage = useCallback(async () => {
    setError(""); setSearchingImg("ai");
    try {
      const t = [headline1, topic, body].filter(Boolean).join(". ").slice(0, 220) || topic;
      const r = await fetch("/api/studio/suggest-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ai", topic: t, aspect: isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Bildgenerering misslyckades");
      const url = d.photos?.[0]?.url;
      if (url) setImageUrl(url); else throw new Error("Ingen bild genererades");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchingImg("");
    }
  }, [headline1, topic, body, format]);

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

  // Direkt-manipulation av bilden i live-editorn (dra=flytta, scroll=zooma).
  const onImagePatch = useCallback((p: ImagePatch) => {
    if (p.imageFocusY !== undefined) setImageFocusY(p.imageFocusY);
    if (p.imageX !== undefined || p.imageScale !== undefined) {
      setOverrides((o) => ({ ...o, ...(p.imageX !== undefined ? { imageX: p.imageX } : {}), ...(p.imageScale !== undefined ? { imageScale: p.imageScale } : {}) }));
    }
  }, []);
  const setOv = useCallback((patch: Partial<StudioOverrides>) => setOverrides((o) => ({ ...o, ...patch })), []);

  // Fas C: inline-redigering — data-edit-fält (från mallen) → rätt state. Commit-on-blur.
  const onEditField = useCallback((field: string, text: string) => {
    if (field === "headline1") setHeadline1(text);
    else if (field === "headline2") setHeadline2(text);
    else if (field === "body") setBody(text);
    else if (field === "badge1") setBadgeLine1(text);
    else if (field === "badge2") setBadgeLine2(text);
    else if (field === "slide-headline") updateSlide(slideIdx, { headline: text });
    else if (field === "slide-body") updateSlide(slideIdx, { body: text });
  }, [slideIdx, updateSlide]);

  // Klistra in eget utkast → AI delar upp i rubrik/underrubrik/brödtext.
  const applyPaste = useCallback(async () => {
    if (!pasteText.trim()) return;
    setApplyingPaste(true); setError("");
    try {
      const r = await fetch("/api/studio/parse-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, templateId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte tolka texten");
      if (typeof d.headline1 === "string") setHeadline1(d.headline1);
      if (typeof d.headline2 === "string") setHeadline2(d.headline2);
      if (typeof d.body === "string") setBody(d.body);
      setPasteText("");
    } catch (e) { setError((e as Error).message); } finally { setApplyingPaste(false); }
  }, [pasteText, templateId]);

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

  // Generera hela karusellen (hook → punkter → cta) ur ämne + varumärkesröst.
  const generateCarouselNow = useCallback(async () => {
    setError(""); setGenCarousel(true);
    try {
      const r = await fetch("/api/studio/carousel/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || headline1, points: 3 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Karusell-generering misslyckades");
      if (Array.isArray(d.slides) && d.slides.length) { setSlides(d.slides); setSlideIdx(0); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenCarousel(false);
    }
  }, [topic, headline1]);

  // Fånga den dolda full-skala-designen (#hidden canvas) till en PNG-blob i webbläsaren.
  // Delas av export + spara-i-bibliotek + publicera. Fungerar i molnet (Playwright gör inte det).
  const captureRef = useRef<HTMLDivElement>(null);
  const captureDesignBlob = useCallback(async (): Promise<Blob | null> => {
    const node = captureRef.current;
    if (!node || !brand) return null;
    try {
      const { w: cw, h: ch } = FORMAT_DIMENSIONS[format];
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 150)); // låt bilden i den dolda editorn ladda klart
      return await toBlob(node, { width: cw, height: ch, pixelRatio: 1, cacheBust: true, backgroundColor: "#ffffff" });
    } catch {
      return null;
    }
  }, [brand, format]);

  // ── Export PNG — klient-render (fungerar i molnet, laddar ner den färdiga designen) ──
  const exportPng = useCallback(async () => {
    setError(""); setExporting(true);
    try {
      const blob = await captureDesignBlob();
      if (!blob) throw new Error("Kunde inte skapa bilden — prova igen om en stund.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-${templateId}-${format}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [captureDesignBlob, slug, templateId, format]);

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
    setOverrides({ ...DEFAULT_OVERRIDES, ...((d.overrides as object) || {}) });
    setSlides(Array.isArray(d.slides) ? (d.slides as StudioSlide[]) : []);
    setSlideIdx(0);
    setVideoUrl((d.videoUrl as string) ?? "");
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

  // Spara aktuell skapelse i biblioteket. asNew=true → alltid ny kopia. Returnerar post-id.
  const savePost = useCallback(async (asNew = false): Promise<string | null> => {
    setError(""); setSavingPost(true);
    try {
      const title = headline1 || body.slice(0, 40) || "Namnlöst inlägg";
      const r = await fetch("/api/studio/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asNew ? undefined : loadedPostId, title, payload: { ...payload, caption } }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte spara i biblioteket");
      const id = d.post?.id ?? null;
      setLoadedPostId(id);
      await refreshPosts();
      return id;
    } catch (e) {
      setError((e as Error).message);
      return null;
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
  // Hämta GHL-konton i BÅDE admin och kundläge — så kunden ser om FB/LI är kopplat via
  // MySales och kan publicera den vägen. Endast GHL-config-boxen (token) är admin-only.
  useEffect(() => { refreshGhlAccounts(); }, [refreshGhlAccounts, client]);

  // Instagram-kopplingsstatus (för direkt-IG-valet). Per aktiv klient.
  useEffect(() => {
    fetch("/api/instagram/connect")
      .then((r) => r.json())
      .then((d) => setIgConn({ connected: !!d.connected, handle: d.handle || null }))
      .catch(() => setIgConn({ connected: false, handle: null }));
  }, [client]);

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
        body: JSON.stringify({ headline: headline1, headline2, body, topic, slides, postType }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte föreslå bildtext");
      setCaption(d.caption || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggestingCaption(false);
    }
  }, [headline1, headline2, body, topic, slides, postType]);

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  // ── Fas B: kanaldetektering, anpassning, per-kanal-publicering ──
  // Icke-utgångna GHL-konton för en plattform (facebook/linkedin/instagram).
  const ghlFor = useCallback(
    (platform: string) => ghlAccounts.filter((a) => a.platform.toLowerCase().includes(platform) && !a.isExpired),
    [ghlAccounts],
  );
  // Är kanalen publicerbar? IG = direkt-koppling ELLER GHL-IG. FB/LI = via GHL.
  const channelConnected = useMemo<Record<ChannelKey, boolean>>(() => ({
    ig: !!igConn?.connected || ghlFor("instagram").length > 0,
    fb: ghlFor("facebook").length > 0,
    li: ghlFor("linkedin").length > 0,
  }), [igConn, ghlFor]);

  // Effektiv caption för en kanal: den anpassade om den finns, annars grund-captionen.
  const capFor = useCallback((k: ChannelKey) => (channelCaptions[k]?.trim() ? channelCaptions[k] : caption), [channelCaptions, caption]);

  // Render-URL för preview-bilden (samma bild i alla enhetsramar). Karusell = första sliden.
  const channelRenderSrc = useMemo(
    () => `/studio/render/${templateId}?p=${encodeURIComponent(encodePayload(payload))}${isCarousel ? "&slide=0" : ""}`,
    [templateId, payload, isCarousel],
  );

  // Förikryssa kanaler efter vad klienten kopplat — en gång, när kopplingsstatus lästs in.
  useEffect(() => {
    if (channelsSeeded) return;
    if (igConn === null) return; // vänta tills IG-status finns
    if (ghlConnected === null) return; // vänta även på GHL-status (hämtas i båda lägena)
    const connected = CHANNELS.filter((c) => channelConnected[c.key]).map((c) => c.key);
    setSelectedChannels(connected.length ? connected : ["ig"]);
    setChannelsSeeded(true);
  }, [channelsSeeded, igConn, ghlConnected, customerMode, channelConnected]);

  const toggleChannel = useCallback((k: ChannelKey) => {
    setSelectedChannels((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }, []);
  const setChannelCap = useCallback((k: ChannelKey, v: string) => {
    setChannelCaptions((prev) => ({ ...prev, [k]: v }));
  }, []);

  // Skriv en gång → AI anpassar grund-captionen per vald kanal (krok/längd/ton/hashtags).
  const adaptChannels = useCallback(async () => {
    const targets = selectedChannels.length ? selectedChannels : (["ig", "fb", "li"] as ChannelKey[]);
    setError(""); setAdapting(true);
    try {
      const r = await fetch("/api/studio/adapt-channel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, headline: headline1, headline2, body, topic, slides, postType, channels: targets }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte anpassa per kanal");
      if (d.captions) setChannelCaptions((prev) => ({ ...prev, ...d.captions }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdapting(false);
    }
  }, [selectedChannels, caption, headline1, headline2, body, topic, slides, postType]);

  const copyChannelText = useCallback((k: ChannelKey) => {
    navigator.clipboard?.writeText(capFor(k)).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); }).catch(() => {});
  }, [capFor]);

  // Rendera den FÄRDIGA designen (bild + ram + text + badge) klient-sida till en PNG och
  // ladda upp den — så det är DESIGNEN som publiceras, inte råfotot. Playwright-export körs
  // bara lokalt (501 i moln); detta fångar samma live-render i webbläsaren. null = misslyckades.
  // Rendera + ladda upp designen till studio-images → durabel publik URL. null = misslyckades.
  const renderDesignPng = useCallback(async (): Promise<string | null> => {
    const blob = await captureDesignBlob();
    if (!blob) return null;
    try {
      const file = new File([blob], `design-${templateId}-${Date.now()}.png`, { type: "image/png" });
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await r.json();
      if (!r.ok) return null;
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) return null;
      return d.publicUrl as string;
    } catch {
      return null;
    }
  }, [captureDesignBlob, templateId]);
  // Spara den färdiga designen som en bild i mediabiblioteket (syns direkt + kan återanvändas).
  const [savingDesign, setSavingDesign] = useState(false);
  const saveDesignToLibrary = useCallback(async () => {
    setError(""); setSavingDesign(true);
    try {
      const url = await renderDesignPng();
      if (!url) throw new Error("Kunde inte skapa den färdiga bilden — prova igen om en stund.");
      setShowMedia(true);
      await loadMedia();
    } catch (e) { setError((e as Error).message); } finally { setSavingDesign(false); }
  }, [renderDesignPng, loadMedia]);

  // Publicera EN kanal: IG direkt (ig-graph), FB/LI via GHL (ghl-social) med den plattformens konton.
  const publishTo = useCallback(async (k: ChannelKey) => {
    setError(""); setPubBusy(k); setPubResult((p) => ({ ...p, [k]: "" }));
    try {
      // Reel publicerar videon; övriga publicerar den FÄRDIGA designen (fallback: råfotot).
      const designUrl = postType === "reel" ? imageUrl : (await renderDesignPng()) || imageUrl;
      // Schemalagt → säkerställ en biblioteks-rad så scheduled_at skrivs och inlägget syns i Kalendern.
      let postId = loadedPostId;
      if (scheduleDate && !postId) postId = await savePost(false);
      let reqBody: Record<string, unknown>;
      if (k === "ig" && igConn?.connected) {
        // Direkt till klientens Instagram — publiceras nu (inget utkast/schema).
        reqBody = { postId, channel: "ig-graph", caption: capFor("ig"), imageUrl: designUrl, videoUrl, format };
      } else {
        const platform = k === "fb" ? "facebook" : k === "li" ? "linkedin" : "instagram";
        const accs = ghlFor(platform).map((a) => a.id).filter((id) => selectedAccounts.includes(id));
        if (!accs.length) throw new Error(`Inga valda ${CHANNEL_BRAND[k].label}-konton i GHL.`);
        reqBody = { postId, channel: "ghl-social", accountIds: accs, caption: capFor(k), imageUrl: designUrl, videoUrl, format, scheduleDate: scheduleDate || undefined };
      }
      const r = await fetch("/api/studio/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
      setPubResult((p) => ({ ...p, [k]: "ok" }));
      await refreshPosts();
      loadMedia(); // den renderade designen syns nu i mediabiblioteket
    } catch (e) {
      setError((e as Error).message);
      setPubResult((p) => ({ ...p, [k]: "err" }));
    } finally {
      setPubBusy("");
    }
  }, [igConn, loadedPostId, capFor, imageUrl, videoUrl, format, postType, renderDesignPng, ghlFor, selectedAccounts, scheduleDate, refreshPosts, loadMedia, savePost]);

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
              <h1 className="font-display font-bold text-2xl text-gray-900">Skapa inlägg</h1>
              <p className="text-sm text-gray-500">Färdiga inlägg till Instagram — utan Canva. {client ? `Klient: ${client.name}` : ""}</p>
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

        {/* Så funkar det — numrerad stegöversikt */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {[
            { n: 1, t: "Format & mall" },
            { n: 2, t: "Bild" },
            { n: 3, t: "Text på bilden" },
            { n: 4, t: "Bildtext" },
            { n: 5, t: "Kanaler & publicera" },
          ].map((s, i, arr) => (
            <span key={s.n} className="inline-flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: STEG_FARGER[s.n - 1] }}>
                <StegNr n={s.n} color={STEG_FARGER[s.n - 1]} /> {s.t}
              </span>
              {i < arr.length - 1 && <span className="text-gray-300">→</span>}
            </span>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* ── Vänster: formulär ── */}
          <div className="space-y-6">
            {/* Mall + format */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[0])}>
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={1} color={STEG_FARGER[0]} /> Format &amp; mall</h2>
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
                      <div className="text-xs text-gray-500 mt-0.5">{t.formats.map((f) => FORMAT_LABELS[f]).join(" · ")}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {meta.formats.map((f) => {
                  const active = f === format;
                  return (
                    <button key={f} onClick={() => setFormat(f)}
                      className="flex-1 min-w-[90px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                      style={active ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                      {FORMAT_LABELS[f]}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Foto */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[1])}>
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={2} color={STEG_FARGER[1]} /> Bild</h2>

              {/* Mallen visar en bild — mjuk hjälp, inte varning */}
              {needsImage && !imageUrl && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${primary}33`, background: `${primary}0a` }}>
                  <div className="text-xs text-gray-600">Den här mallen visar en bild. Ladda upp din egen nedan — eller låt oss skapa en on-brand bild ur innehållet.</div>
                  <button onClick={generateOnBrandImage} disabled={searchingImg === "ai"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {searchingImg === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Skapa on-brand bild
                  </button>
                </div>
              )}
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
                  <SmartTextarea value={imgComment} onChange={(e) => setImgComment(e.target.value)} rows={2}
                    placeholder='T.ex. "ljusare bakgrund", "visa produkten större" eller "ta bort personen i bakgrunden"'
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

              {/* Mediabibliotek — dina uppladdade + AI-skapade + färdiga design-bilder. */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                {/* Spara den FÄRDIGA designen (bild + ram + text) som en bild i biblioteket. */}
                <button onClick={saveDesignToLibrary} disabled={savingDesign || !brand}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  style={{ background: primary }}>
                  {savingDesign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara färdig bild i biblioteket
                </button>
                <p className="text-[11px] text-gray-400 -mt-1">Renderar hela inlägget (bild + ram + text) till en färdig bild — samma bild som publiceras. Dyker upp nedan.</p>

                <button onClick={toggleMedia}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  <FolderOpen className="w-4 h-4" /> {showMedia ? "Dölj mediabibliotek" : "Mina bilder (mediabibliotek)"}
                </button>
                {showMedia && (
                  loadingMedia ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina bilder…</div>
                  ) : mediaItems.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center py-4">Inga sparade bilder än. Bilder du laddar upp eller genererar dyker upp här.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaItems.map((m) => (
                        <div key={m.path} className="relative group rounded-lg overflow-hidden border-2 aspect-square" style={{ borderColor: imageUrl === m.url ? primary : "transparent" }}>
                          <button onClick={() => setImageUrl(m.url)} className="w-full h-full" title="Använd den här bilden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                          <button onClick={() => deleteMedia(m.path)} disabled={deletingPath === m.path} title="Ta bort bilden"
                            className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                            {deletingPath === m.path ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                          {imageUrl === m.url && <span className="absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: primary }}>Vald</span>}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </section>

            {/* Video (reel) — bara i 9:16 */}
            {isStoryFormat(format) && (
              <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-gray-900 text-lg">Video (reel)</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
                    {postType === "reel" ? "Blir reel" : "Blir story"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Ladda upp en video så publiceras inlägget som <strong>reel</strong> — Studio-bilden ovan blir omslag/cover. Utan video blir 9:16-inlägget en <strong>story</strong>.</p>
                {videoUrl ? (
                  <div className="flex items-center gap-3">
                    <video src={videoUrl} className="w-24 rounded-lg border border-gray-100" style={{ aspectRatio: "9/16", objectFit: "cover" }} muted />
                    <div className="flex-1 text-xs text-gray-500 truncate">Video uppladdad</div>
                    <button onClick={() => setVideoUrl("")} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Ta bort</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer">
                    {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Ladda upp video (MP4/MOV)
                    <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); }} />
                  </label>
                )}
              </section>
            )}

            {/* Text */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[2])}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={3} color={STEG_FARGER[2]} /> {isCarousel ? "Karusell" : "Text på bilden"}</h2>
                  {!isCarousel && <p className="text-xs text-gray-500 mt-0.5 ml-9">Rubrik och text som syns i <strong>själva bilden</strong>.</p>}
                </div>
                {isCarousel ? (
                  <button onClick={generateCarouselNow} disabled={genCarousel}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {genCarousel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generera karusell
                  </button>
                ) : (
                  <button onClick={suggest} disabled={suggesting}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Föreslå text
                  </button>
                )}
              </div>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={isCarousel ? "Ämne för karusellen — t.ex. 3 misstag att undvika, 5 tips" : "Ämne för AI-förslag (valfritt) — t.ex. ett erbjudande, en nyhet, en fråga"} className={inputCls} />

              {/* Klistra in eget utkast (ej karusell) */}
              {!isCarousel && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <label className="block text-xs font-medium text-gray-600">Har du ett eget utkast? Klistra in — AI delar upp i rubrik och text</label>
                <SmartTextarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={2} placeholder="Klistra in din egen text här…" className={inputCls} />
                <button onClick={applyPaste} disabled={applyingPaste || !pasteText.trim()}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  {applyingPaste ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Använd min text
                </button>
              </div>
              )}

              {!isCarousel && suggestions.length > 0 && (
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

              {isCarousel ? (
                <div className="space-y-3">
                  {/* Slide-flikar */}
                  <div className="flex flex-wrap gap-1.5">
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => setSlideIdx(i)}
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={i === slideIdx ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                        {i + 1}. {SLIDE_KIND_LABEL[s.kind]}
                      </button>
                    ))}
                    {slides.length < MAX_SLIDES && (
                      <button onClick={addSlide} className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">+ Slide</button>
                    )}
                  </div>

                  {/* Aktiv slide */}
                  {slides[slideIdx] && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          {(["hook", "point", "cta"] as StudioSlide["kind"][]).map((k) => (
                            <button key={k} onClick={() => updateSlide(slideIdx, { kind: k })}
                              className="rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                              style={slides[slideIdx].kind === k ? { borderColor: primary, color: primary, background: "#fff" } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                              {SLIDE_KIND_LABEL[k]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveSlide(slideIdx, -1)} disabled={slideIdx === 0} className="px-1.5 py-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Flytta upp">↑</button>
                          <button onClick={() => moveSlide(slideIdx, 1)} disabled={slideIdx === slides.length - 1} className="px-1.5 py-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Flytta ner">↓</button>
                          <button onClick={() => removeSlide(slideIdx)} disabled={slides.length <= 1} className="px-1.5 py-1 rounded text-red-400 hover:text-red-600 disabled:opacity-30" title="Ta bort"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rubrik</label>
                        <input value={slides[slideIdx].headline} onChange={(e) => updateSlide(slideIdx, { headline: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
                        <SmartTextarea value={slides[slideIdx].body} onChange={(e) => updateSlide(slideIdx, { body: e.target.value })} rows={3} className={inputCls} />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">{slides.length} slides · exporteras som {slides.length} bilder. Krok först, avslut sist.</div>
                </div>
              ) : (
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
                  <SmartTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputCls} />
                </div>
              </div>
              )}

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

            {/* Bildtext (caption) — förstaklassig, hälften av inlägget */}
            <section className="bg-white border rounded-2xl p-6 space-y-3" style={stegRam(STEG_FARGER[3])}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={4} color={STEG_FARGER[3]} /> Bildtext</h2>
                  <p className="text-xs text-gray-500 mt-0.5 ml-9">Texten <strong>under inlägget</strong> på Instagram (caption) — krok, värde, uppmaning, hashtags.</p>
                </div>
                <button onClick={suggestCaption} disabled={suggestingCaption}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40 shrink-0"
                  style={{ background: primary }}>
                  {suggestingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {caption ? "Skriv om" : "Föreslå bildtext"}
                </button>
              </div>
              <SmartTextarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7}
                placeholder="Skriv bildtexten här, eller låt AI föreslå en ur inläggets innehåll och din röst…"
                className={`${inputCls} leading-relaxed`} style={{ whiteSpace: "pre-wrap" }} />
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{caption.trim() ? `${caption.length} tecken` : "Ingen bildtext än"}</span>
                <span>{isCarousel ? "Grundas på karusellens slides" : postType === "reel" ? "Anpassad för reel" : "Grundas på inläggets innehåll"}</span>
              </div>
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
              <div className="relative mx-auto rounded-xl overflow-hidden border border-gray-100 bg-gray-100">
                <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={previewScale} onImagePatch={onImagePatch} slideIndex={isCarousel ? slideIdx : undefined} />
                {!imageUrl && !videoUrl && !headline1.trim() && !body.trim() && (!isCarousel || slides.every((s) => !s.headline?.trim() && !s.body?.trim())) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 p-6 bg-white/85 backdrop-blur-sm">
                    <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
                      <Wand2 className="w-5 h-5" style={{ color: primary }} />
                    </span>
                    <div className="text-sm font-semibold text-gray-800">Ditt inlägg visas här</div>
                    <p className="text-xs text-gray-500 max-w-[220px]">Skriv text i <strong>steg 3</strong> eller tryck <strong>Föreslå text</strong> — så ser du resultatet direkt.</p>
                  </div>
                )}
              </div>
              {payload.imageUrl && (
                <p className="text-[11px] text-gray-400 text-center mt-2">Dra i bilden för att flytta · scrolla för att zooma</p>
              )}
              <button onClick={() => setEditOpen(true)} disabled={!brand}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                <Wand2 className="w-4 h-4" /> Redigera direkt på bilden
              </button>
            </section>

            {/* Redigera — tweak-lager */}
            <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Redigera</h2>
                <button onClick={() => { setOverrides(DEFAULT_OVERRIDES); }} className="text-xs text-gray-400 hover:text-gray-700">Återställ</button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Textstorlek ({Math.round(overrides.fontScale * 100)}%)</label>
                <input type="range" min={0.6} max={1.6} step={0.05} value={overrides.fontScale} onChange={(e) => setOv({ fontScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rubrikfärg</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={overrides.headlineColor || "#1A1A1A"} onChange={(e) => setOv({ headlineColor: e.target.value })} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer" />
                    <button onClick={() => setOv({ headlineColor: "" })} className="text-xs text-gray-500 hover:text-gray-700">{overrides.headlineColor ? "Auto" : "Standard"}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Textfärg</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={overrides.bodyColor || "#1A1A1A"} onChange={(e) => setOv({ bodyColor: e.target.value })} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer" />
                    <button onClick={() => setOv({ bodyColor: "" })} className="text-xs text-gray-500 hover:text-gray-700">{overrides.bodyColor ? "Auto" : "Standard"}</button>
                  </div>
                </div>
              </div>
              {payload.imageUrl && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bildzoom ({Math.round(overrides.imageScale * 100)}%)</label>
                  <input type="range" min={1} max={3} step={0.05} value={overrides.imageScale} onChange={(e) => setOv({ imageScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
                </div>
              )}
              {(meta.fields.brush || meta.fields.badge) && (
                <div className="flex flex-wrap gap-4 pt-1">
                  {meta.fields.brush && (
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!overrides.hideBrush} onChange={(e) => setOv({ hideBrush: !e.target.checked })} style={{ accentColor: primary }} /> Penselruta
                    </label>
                  )}
                  {meta.fields.badge && (
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!overrides.hideBadge} onChange={(e) => setOv({ hideBadge: !e.target.checked })} style={{ accentColor: primary }} /> Badge
                    </label>
                  )}
                </div>
              )}
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
            {!customerMode && (
              <>
                <button onClick={downloadPayload} className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Ladda ner payload (för CLI-export)
                </button>
                <p className="text-xs text-gray-400 text-center px-2">
                  &quot;Exportera PNG&quot; renderas i webbläsaren och funkar även i molnet. Payload/CLI (<code className="bg-gray-100 px-1 rounded">npm run studio:export</code>) finns kvar som pixelperfekt reserv.
                </p>
              </>
            )}

            <p className="text-xs text-gray-400 text-center px-2">Kanaler, förhandsvisning och publicering — <strong>steg 5</strong> längre ner.</p>
          </div>
        </div>

        {/* ── Steg 5 · Kanaler & publicera — en yta, tre plattformar (Fas B) ── */}
        <section className="bg-white border rounded-2xl p-6 space-y-5" style={stegRam(STEG_FARGER[4])}>
          <div className="flex items-center gap-2 flex-wrap">
            <StegNr n={5} color={STEG_FARGER[4]} />
            <h2 className="font-display font-bold text-gray-900 text-lg">Kanaler &amp; publicera</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
              {postType === "reel" ? "Reel" : postType === "story" ? "Story" : isCarousel ? "Karusell" : "Inlägg"}
            </span>
            <span className="ml-auto text-xs text-gray-500">Skriv en gång — se och anpassa per plattform, som i GHL.</span>
          </div>

          {/* Kanalväljare — förikryssad efter vad klienten kopplat */}
          <div className="flex flex-wrap items-center gap-2">
            {CHANNELS.map(({ key }) => {
              const on = selectedChannels.includes(key);
              const conn = channelConnected[key];
              const brand = CHANNEL_BRAND[key];
              const { Icon } = brand;
              return (
                <button key={key} onClick={() => toggleChannel(key)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors"
                  style={on ? { borderColor: brand.color, color: brand.color, background: `${brand.color}12` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: on ? brand.gradient : "#9ca3af" }}>
                    <Icon className="w-3 h-3" />
                  </span>
                  {brand.label}
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={conn ? { background: "#dcfce7", color: "#15803d" } : { background: "#f3f4f6", color: "#9ca3af" }}>
                    {conn ? "kopplad" : "ej kopplad"}
                  </span>
                </button>
              );
            })}
            <button onClick={adaptChannels} disabled={adapting || (!caption.trim() && !headline1.trim() && slides.every((s) => !s.headline?.trim()))}
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primary }}>
              {adapting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Anpassa texten per kanal
            </button>
          </div>
          {!caption.trim() && (
            <div className="text-xs text-gray-500">Tips: skriv eller föreslå en bildtext i <strong>steg 4</strong> först — den blir grunden AI anpassar per kanal.</div>
          )}

          {selectedChannels.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Välj minst en kanal ovan för att förhandsgranska.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {CHANNELS.filter((c) => selectedChannels.includes(c.key)).map(({ key }) => {
                const brand = CHANNEL_BRAND[key];
                const label = brand.label;
                const { Icon } = brand;
                const eff = capFor(key);
                const busy = pubBusy === key;
                const res = pubResult[key];
                const igDirect = key === "ig" && !!igConn?.connected;
                const ghlAccs = ghlFor(key === "fb" ? "facebook" : key === "li" ? "linkedin" : "instagram");
                const canPublish = igDirect || (!igDirect && ghlAccs.some((a) => selectedAccounts.includes(a.id)));
                const openUrl = key === "li" ? "https://www.linkedin.com/feed/" : key === "fb" ? "https://www.facebook.com/" : "https://www.instagram.com/";
                return (
                  <div key={key} className="space-y-3">
                    <ChannelPreview channel={key} renderSrc={channelRenderSrc} format={format} caption={eff}
                      clientName={client?.name || slug} handle={key === "ig" ? igConn?.handle : null} primary={primary} />

                    {/* Per-kanal-caption (redigerbar) — faller tillbaka på grund-captionen */}
                    <div className="rounded-xl border bg-gray-50 p-2.5 space-y-1.5" style={{ borderColor: `${brand.color}26` }}>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: brand.color }}>
                          <span className="w-4 h-4 rounded flex items-center justify-center text-white" style={{ background: brand.gradient }}>
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                          {label}-text
                        </span>
                        <button onClick={() => copyChannelText(key)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800">
                          {copied === key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} Kopiera
                        </button>
                      </div>
                      <textarea value={channelCaptions[key]} onChange={(e) => setChannelCap(key, e.target.value)}
                        rows={4} placeholder={caption.trim() ? "Använder grund-captionen — anpassa via knappen eller skriv här." : "Ingen bildtext än (steg 4)."}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs leading-relaxed focus:border-gray-400 outline-none bg-white" style={{ whiteSpace: "pre-wrap" }} />
                    </div>

                    {/* Publiceringsrouting per kanal */}
                    {igDirect ? (
                      <button onClick={() => publishTo(key)} disabled={busy || !eff.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                        style={{ background: brand.gradient }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : res === "ok" ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {res === "ok" ? "Publicerat på Instagram ✓" : "Publicera nu på Instagram"}
                      </button>
                    ) : canPublish ? (
                      <button onClick={() => publishTo(key)} disabled={busy || !eff.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                        style={{ background: brand.gradient }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : res === "ok" ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {res === "ok" ? (scheduleDate ? "Schemalagt i GHL ✓" : "Utkast skapat i GHL ✓") : (scheduleDate ? `Schemalägg ${label} i GHL` : `Skapa ${label}-utkast i GHL`)}
                      </button>
                    ) : (
                      // Fallback: ingen direktväg (t.ex. LinkedIn utan GHL, eller kundläge) → kopiera + öppna.
                      <div className="space-y-1.5">
                        <a href={openUrl} target="_blank" rel="noopener" onClick={() => copyChannelText(key)}
                          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                          {copied === key ? <Check className="w-4 h-4 text-emerald-600" /> : <ExternalLink className="w-4 h-4" />} Kopiera text &amp; öppna {label}
                        </a>
                        <p className="text-[11px] text-gray-400">{label} saknar direktpublicering här — ladda ner PNG:en ovan, kopiera texten och lägg upp manuellt{customerMode ? "" : ", eller koppla GHL nedan"}.</p>
                      </div>
                    )}
                    {res === "err" && <p className="text-[11px] text-red-500">Publicering misslyckades — se felrutan högst upp.</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* GHL-koppling & kontoval (byrå-only) — driver FB/LI-publiceringen ovan */}
          {!customerMode && (selectedChannels.includes("fb") || selectedChannels.includes("li") || (selectedChannels.includes("ig") && !igConn?.connected)) && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">GHL Social Planner (Facebook / LinkedIn)</span>
                {ghlConnected && <button onClick={disconnectGhl} className="ml-auto text-xs text-gray-400 hover:text-red-600">Koppla från</button>}
              </div>
              {ghlConnected === null ? (
                <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kollar koppling…</div>
              ) : !ghlConnected ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Koppla {client?.name || "klienten"}s GHL för att publicera FB/LI. Skapa en <span className="font-medium">Private Integration-token</span> (scope: Social Media + View Users) i klientens GHL.</div>
                  <input value={ghlLocInput} onChange={(e) => setGhlLocInput(e.target.value)} placeholder="Location-id (t.ex. ZWqjUhS3f77BPpOiyMHK)" className={inputCls}
                    name="ghl-location-id" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <input value={ghlPitInput} onChange={(e) => setGhlPitInput(e.target.value)} type="text" placeholder="Private Integration-token (pit-…)" className={`${inputCls} font-mono`}
                    name="ghl-pit-token" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <button onClick={connectGhl} disabled={connectingGhl}
                    className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {connectingGhl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Koppla GHL
                  </button>
                </div>
              ) : ghlAccounts.length === 0 ? (
                <div className="text-xs text-gray-500">Inga kopplade sociala konton i GHL för den här klienten.</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-gray-500">Publicera till konton</div>
                    {ghlAccounts.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={() => toggleAccount(a.id)} disabled={a.isExpired} style={{ accentColor: primary }} />
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{a.platform}</span>
                        <span className="truncate">{a.name}</span>
                        {a.isExpired && <span className="text-xs text-red-500">(utgången)</span>}
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Schemalägg (valfritt)</label>
                    <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className={inputCls} />
                    {scheduleDate && <button onClick={() => setScheduleDate("")} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Rensa (skapa som utkast istället)</button>}
                    <p className="text-xs text-gray-400 mt-2">Utan datum: utkast i GHL. Med datum: schemaläggs i Social Planner.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {customerMode && (selectedChannels.includes("fb") || selectedChannels.includes("li")) && (
            <p className="text-xs text-gray-400">
              {ghlConnected
                ? "Är kanalen kopplad via MySales publicerar du direkt härifrån. Är den inte kopplad — kopiera texten och lägg upp manuellt, eller be din byrå koppla den."
                : "Facebook och LinkedIn förhandsvisas här. När de kopplats via MySales kan du publicera direkt — annars kopiera texten och lägg upp manuellt."}
            </p>
          )}
        </section>

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
                const { w: pw, h: ph } = FORMAT_DIMENSIONS[p.format] ?? FORMAT_DIMENSIONS["1080x1350"];
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

        {/* Fas C: inline-redigering — förstorad canvas i modal. Klicka text→skriv (contentEditable,
            commit-on-blur), klicka bild→byt. Ändringar syncar live till formulär + previews. */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-[94vw] max-h-[94vh] overflow-auto p-5">
              <div className="flex items-start justify-between gap-6 mb-3">
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-lg">Redigera direkt</h3>
                  <p className="text-xs text-gray-500 max-w-md">Klicka en <strong>text</strong> och skriv direkt · klicka <strong>bilden</strong> för att byta. Ändringar sparas när du klickar bort (Enter för rubriker).</p>
                </div>
                <button onClick={() => setEditOpen(false)}
                  className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90"
                  style={{ background: primary }}>
                  <Check className="w-4 h-4" /> Klar
                </button>
              </div>
              {(() => { const editScale = Math.min(440 / w, 620 / h); return (
                <div className="mx-auto rounded-xl overflow-hidden border border-gray-200 bg-gray-100" style={{ width: w * editScale }}>
                  <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={editScale}
                    onImagePatch={onImagePatch} slideIndex={isCarousel ? slideIdx : undefined}
                    editMode onEditField={onEditField} onEditImage={() => fileRef.current?.click()} editColor={primary} />
                </div>
              ); })()}
              {isCarousel && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                  {slides.map((s, i) => (
                    <button key={i} onClick={() => setSlideIdx(i)}
                      className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                      style={i === slideIdx ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                      {i + 1}. {SLIDE_KIND_LABEL[s.kind]}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-400 text-center mt-3">Byter du bild öppnas filväljaren. Fler bildval (Mina bilder, AI, stock) finns i <strong>steg 2 · Bild</strong>.</p>
            </div>
          </div>
        )}

        {/* Dold full-skala render (scale=1) — fångas klient-sida av html-to-image vid publicering
            så DESIGNEN publiceras, inte råfotot. Off-screen, påverkar inte layouten. */}
        <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: w, height: h, pointerEvents: "none", opacity: 0, zIndex: -1 }}>
          <div ref={captureRef}>
            <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={1} onImagePatch={() => {}} slideIndex={isCarousel ? slideIdx : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Numrerad steg-bricka — gör flödet begripligt (steg 1-5).
function StegNr({ n, color }: { n: number; color: string }) {
  return (
    <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: color }}>
      {n}
    </span>
  );
}
