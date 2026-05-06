"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Image as ImageIcon,
  Type,
  Quote,
  Sparkles,
  Check,
  X,
  Banana,
  Upload,
  Library,
  Camera,
  LayoutTemplate,
} from "lucide-react";

interface Asset {
  id: string;
  asset_type: string;
  title: string | null;
  signed_url?: string;
  category: string | null;
}

interface SavedPost {
  id: string;
  hook: string;
  image_url: string | null;
  image_engine: string | null;
}

interface Props {
  postId: string;
  hook: string;
  cta?: string;
  clientSlug?: string;
  format?: string;
  onClose: () => void;
  onImageSet: (url: string) => void;
}

type Tab = "bigtext" | "quote" | "overlay" | "imagen" | "nanobanana" | "pexels" | "upload" | "library" | "opticurmall" | "carousel";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: "nanobanana", label: "Nano Banana", icon: Banana, desc: "Gemini 2.5 Flash Image — bra på text-i-bild" },
  { key: "imagen", label: "Imagen / FLUX", icon: Sparkles, desc: "Google Imagen 4 + FLUX 1.1 fallback" },
  { key: "pexels", label: "Pexels stock", icon: Camera, desc: "Riktiga foton från Pexels-biblioteket" },
  { key: "overlay", label: "Foto + text", icon: ImageIcon, desc: "Eget foto med text-overlay" },
  { key: "bigtext", label: "Stor text", icon: Type, desc: "Brand-färg + hook som rubrik" },
  { key: "quote", label: "Citat", icon: Quote, desc: "Italic-citat på solid bakgrund" },
  { key: "upload", label: "Ladda upp egen", icon: Upload, desc: "Egen bildfil från datorn" },
  { key: "library", label: "Bibliotek", icon: Library, desc: "Tidigare genererade bilder" },
];

export default function ImageStudio({ postId, hook, cta, clientSlug, format, onClose, onImageSet }: Props) {
  const isOpticur = clientSlug === "opticur";
  const isCarousel = format === "carousel";
  const [tab, setTab] = useState<Tab>(isCarousel ? "carousel" : isOpticur ? "opticurmall" : "nanobanana");
  const [carouselSlides, setCarouselSlides] = useState<{ image_url: string; headline: string; body: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState(hook);
  const [library, setLibrary] = useState<SavedPost[]>([]);
  const [pexelsResults, setPexelsResults] = useState<{ id: number; src: string; srcMedium: string; photographer: string; alt: string }[]>([]);
  const [pexelsQuery, setPexelsQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/assets?type=photo")
      .then((r) => r.json())
      .then((d) => setPhotos(d.assets || []));
    fetch("/api/posts?limit=30")
      .then((r) => r.json())
      .then((d) => setLibrary((d.posts || []).filter((p: SavedPost) => p.image_url)));
  }, []);

  // Lyssna på opticur-mall-iframen som skickar PNG via postMessage
  useEffect(() => {
    async function onMsg(ev: MessageEvent) {
      if (!ev.data || ev.data.type !== "opticur-mall-image") return;
      const dataUrl = ev.data.dataUrl as string;
      if (!dataUrl?.startsWith("data:image/")) return;
      setBusy(true);
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const fd = new FormData();
        fd.append("file", new File([blob], `opticur-${ev.data.template || "mall"}.png`, { type: "image/png" }));
        const up = await fetch(`/api/posts/${postId}/set-image`, { method: "PUT", body: fd });
        const d = await up.json();
        if (d.image_url) {
          setPreviewUrl(d.image_url);
          // Bekräfta tillbaka till iframen
          const iframe = document.querySelector('iframe[title="Opticur Content Creator"]') as HTMLIFrameElement | null;
          iframe?.contentWindow?.postMessage({ type: "opticur-mall-image-saved" }, "*");
        }
      } finally {
        setBusy(false);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [postId]);

  async function generateText(style: "bigtext" | "quote") {
    setBusy(true);
    try {
      const r = await fetch(`/api/posts/${postId}/render-svg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      const d = await r.json();
      if (d.image_url) setPreviewUrl(d.image_url);
      else alert("Misslyckades: " + (d.error || "okänt"));
    } finally {
      setBusy(false);
    }
  }

  async function generateOverlay() {
    if (!selectedPhoto) {
      alert("Välj ett foto först");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/posts/${postId}/render-photo-overlay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: selectedPhoto }),
      });
      const d = await r.json();
      if (d.image_url) setPreviewUrl(d.image_url);
      else alert("Misslyckades: " + (d.error || "okänt"));
    } finally {
      setBusy(false);
    }
  }

  async function generateNanoBanana() {
    setBusy(true);
    try {
      const r = await fetch(`/api/posts/${postId}/nano-banana`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const d = await r.json();
      if (d.image_url) setPreviewUrl(d.image_url);
      else alert("Nano Banana: " + (d.error || "okänt"));
    } finally {
      setBusy(false);
    }
  }

  async function generateImagen() {
    setBusy(true);
    try {
      const r = await fetch("/api/social/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          text: aiPrompt,
          mode: "standalone",
          aspect: "square",
        }),
      });
      const d = await r.json();
      if (d.image_url) setPreviewUrl(d.image_url);
      else alert("Imagen: " + (d.error || "okänt"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/posts/${postId}/set-image`, { method: "PUT", body: fd });
      const d = await r.json();
      if (d.image_url) setPreviewUrl(d.image_url);
      else alert("Upload: " + (d.error || "okänt"));
    } finally {
      setBusy(false);
    }
  }

  function pickFromLibrary(url: string) {
    setPreviewUrl(url);
  }

  async function generateCarousel() {
    setBusy(true);
    setCarouselSlides([]);
    try {
      const r = await fetch(`/api/posts/${postId}/render-carousel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 6 }),
      });
      const d = await r.json();
      if (d.slides) {
        setCarouselSlides(d.slides);
        if (d.slides[0]?.image_url) setPreviewUrl(d.slides[0].image_url);
      } else {
        alert("Carousel: " + (d.error || "okänt"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function searchPexels() {
    setBusy(true);
    try {
      const q = pexelsQuery.trim() || hook.slice(0, 60);
      const r = await fetch(`/api/images/pexels?topic=${encodeURIComponent(q)}&count=12`);
      const d = await r.json();
      setPexelsResults(d.photos || []);
      if (d.error) alert("Pexels: " + d.error);
    } finally {
      setBusy(false);
    }
  }

  function useThisImage() {
    if (!previewUrl) return;
    fetch(`/api/posts/${postId}/set-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: previewUrl, engine: tab }),
    }).then(() => {
      onImageSet(previewUrl);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-display font-bold text-gray-900">Bildstudio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="md:w-72 border-r border-gray-200 p-3 space-y-1 overflow-y-auto flex-shrink-0">
            {isCarousel && (
              <button
                onClick={() => {
                  setTab("carousel");
                  setPreviewUrl(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors mb-2 ${
                  tab === "carousel"
                    ? "bg-blue-50 text-blue-900 border-2 border-blue-300"
                    : "bg-blue-50/40 hover:bg-blue-50 text-blue-800 border-2 border-blue-200"
                }`}
              >
                <Library className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">Carousel-slides 📚</div>
                  <div className="text-xs text-blue-700 truncate">5–8 slides på en gång</div>
                </div>
              </button>
            )}
            {isOpticur && (
              <button
                onClick={() => {
                  setTab("opticurmall");
                  setPreviewUrl(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors mb-2 ${
                  tab === "opticurmall"
                    ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-300"
                    : "bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800 border-2 border-emerald-200"
                }`}
              >
                <LayoutTemplate className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">Opticur-mall ⭐</div>
                  <div className="text-xs text-emerald-700 truncate">Egen mall med fot, QR & ZEISS</div>
                </div>
              </button>
            )}
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPreviewUrl(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors ${
                    tab === t.key ? "bg-purple-50 text-purple-900" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">{t.label}</div>
                    <div className="text-xs text-gray-500 truncate">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-5 overflow-y-auto bg-gray-50">
            {tab === "carousel" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Genererar 5–8 slides på en gång — Slide 1 är hooken, mitten har poäng/insikter,
                  sista är CTA. Alla slides får samma visuella språk med kundens brand-färg.
                </div>
                <button
                  onClick={generateCarousel}
                  disabled={busy}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Library className="w-4 h-4" />}
                  Generera 6 slides
                </button>
                {carouselSlides.length > 0 && (
                  <div>
                    <div className="text-xs uppercase font-semibold text-gray-500 mb-2">
                      {carouselSlides.length} slides klara
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {carouselSlides.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => s.image_url && setPreviewUrl(s.image_url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                            previewUrl === s.image_url
                              ? "border-blue-600 ring-2 ring-blue-300"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {s.image_url && <img src={s.image_url} alt={s.headline} className="w-full h-full object-cover" />}
                          <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] rounded px-1.5 py-0.5">
                            {i + 1}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 italic">
                      Slides sparas på inlägget. Klick på "Använd den här bilden" sätter slide 1 som
                      cover.
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "opticurmall" && (
              <div className="space-y-3 -m-5 h-full flex flex-col">
                <div className="px-5 pt-3 pb-2 bg-emerald-50 border-b border-emerald-200 flex items-start gap-3">
                  <LayoutTemplate className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 flex-1">
                    Opticurs egna mall-byggare — fot, QR-kod till bokadirekt, ZEISS-logga inbyggt.
                    Skapa bilden här, ladda ner som PNG, sen <strong>"Ladda upp egen"</strong>-fliken
                    här i Bildstudio för att koppla på inlägget.
                  </div>
                </div>
                <iframe
                  src="/opticur-mall/index.html"
                  className="flex-1 w-full border-0 bg-white min-h-[500px]"
                  title="Opticur Content Creator"
                />
              </div>
            )}

            {(tab === "bigtext" || tab === "quote") && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Genererar bild med <strong>{hook.slice(0, 80)}</strong> som huvudtext på kundens
                  brand-färg.
                </div>
                <button
                  onClick={() => generateText(tab as "bigtext" | "quote")}
                  disabled={busy}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {previewUrl ? "Generera om" : "Generera bild"}
                </button>
              </div>
            )}

            {tab === "overlay" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Välj ett foto från kunskapsbanken. Hooken läggs som text-overlay.
                </div>
                {photos.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    Inga foton i kunskapsbanken ännu. Ladda upp foton i Brand-profil först.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {photos.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPhoto(p.id)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                            selectedPhoto === p.id
                              ? "border-purple-600 ring-2 ring-purple-300"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {p.signed_url && (
                            <img
                              src={p.signed_url}
                              alt={p.title || ""}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {selectedPhoto === p.id && (
                            <div className="absolute top-1 right-1 bg-purple-600 text-white rounded-full p-1">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={generateOverlay}
                      disabled={busy || !selectedPhoto}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      Lägg text på foto
                    </button>
                  </>
                )}
              </div>
            )}

            {tab === "nanobanana" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Google Gemini 2.5 Flash Image — bra på svensk text-i-bild, snabb. Beskriv
                  vad bilden ska visa.
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"
                />
                <button
                  onClick={generateNanoBanana}
                  disabled={busy || !aiPrompt.trim()}
                  className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50 hover:bg-yellow-600"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banana className="w-4 h-4" />}
                  Generera med Nano Banana
                </button>
              </div>
            )}

            {tab === "imagen" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Google Imagen 4.0 — mer fotorealistiska scener. Längre genereringstid (~15 sek).
                </div>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"
                />
                <button
                  onClick={generateImagen}
                  disabled={busy}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generera med Imagen 4
                </button>
              </div>
            )}

            {tab === "pexels" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Sök riktiga stockfoton från Pexels — gratis, hög kvalitet. AI-curaterad query
                  baserat på inläggets innehåll.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pexelsQuery}
                    onChange={(e) => setPexelsQuery(e.target.value)}
                    placeholder={hook.slice(0, 60)}
                    onKeyDown={(e) => e.key === "Enter" && searchPexels()}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={searchPexels}
                    disabled={busy}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Sök
                  </button>
                </div>
                {pexelsResults.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {pexelsResults.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPreviewUrl(p.src)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                          previewUrl === p.src
                            ? "border-purple-600 ring-2 ring-purple-300"
                            : "border-gray-200 hover:border-gray-400"
                        }`}
                        title={p.photographer}
                      >
                        <img src={p.srcMedium} alt={p.alt} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                          {p.photographer}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "upload" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Ladda upp en egen bild — JPG, PNG, WebP eller GIF. Max 20 MB.
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-white rounded-lg p-8 flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : <Upload className="w-6 h-6 text-gray-400" />}
                  <span className="text-sm text-gray-600 font-medium">
                    {busy ? "Laddar upp..." : "Klicka för att välja fil"}
                  </span>
                </button>
              </div>
            )}

            {tab === "library" && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  Tidigare genererade bilder — klicka för att återanvända på det här inlägget.
                </div>
                {library.length === 0 ? (
                  <div className="text-sm text-gray-400 italic text-center py-8">
                    Inga sparade bilder än
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {library.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => p.image_url && pickFromLibrary(p.image_url)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                          previewUrl === p.image_url
                            ? "border-purple-600 ring-2 ring-purple-300"
                            : "border-gray-200 hover:border-gray-400"
                        }`}
                        title={p.hook}
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.hook}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {p.image_engine && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                            {p.image_engine}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {previewUrl && (
              <div className="mt-6 space-y-3">
                <div className="text-xs uppercase font-semibold text-gray-500">Förhandsvisning</div>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-md mx-auto">
                  <img src={previewUrl} alt="Förhandsvisning" className="w-full h-auto" />
                </div>
                <button
                  onClick={useThisImage}
                  className="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Använd den här bilden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
