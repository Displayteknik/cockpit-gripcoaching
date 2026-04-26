"use client";

import { useEffect, useState } from "react";
import { supabase, type Vehicle } from "@/lib/supabase";
import { Sparkles, Copy, Trash2, Loader2, Check, Send, Image as ImageIcon, Pencil, X, Wand2, Save, Eye, Calendar, Upload } from "lucide-react";
import ImagePicker from "@/components/ImagePicker";
import InstagramPreview from "@/components/InstagramPreview";

function Instagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function Facebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

type Platform = "instagram" | "facebook";

interface Slide { number: number; headline: string; body: string; image_hint: string; image_url?: string }
interface SocialPost {
  id: string;
  platform: Platform;
  format: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  vehicle_id: string | null;
  status: string;
  slides: Slide[] | null;
  image_url: string | null;
  image_prompt: string | null;
  image_engine: string | null;
  created_at: string;
}

const FORMATS: Record<Platform, { value: string; label: string }[]> = {
  instagram: [
    { value: "reel", label: "Reel (15–30 sek)" },
    { value: "carousel", label: "Carousel (5–8 slides)" },
    { value: "single", label: "Enstaka bild" },
    { value: "story", label: "Story" },
  ],
  facebook: [
    { value: "post", label: "Inlägg (kort)" },
    { value: "long", label: "Inlägg (lång berättelse)" },
    { value: "offer", label: "Erbjudande-inlägg" },
  ],
};

export default function SocialPage() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [format, setFormat] = useState("reel");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [angle, setAngle] = useState("");
  const [extra, setExtra] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<SocialPost>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [imagePickerFor, setImagePickerFor] = useState<{ post: SocialPost; slideIndex?: number } | null>(null);
  const [previewFor, setPreviewFor] = useState<SocialPost | null>(null);

  useEffect(() => {
    supabase
      .from("hm_vehicles")
      .select("id, title, brand, category, slug")
      .eq("is_sold", false)
      .order("is_featured", { ascending: false })
      .then(({ data }) => setVehicles((data || []) as Vehicle[]));
    loadPosts();
  }, []);

  async function loadPosts() {
    const r = await fetch("/api/social");
    if (r.ok) setPosts(await r.json());
  }

  async function generate() {
    setLoading(true);
    try {
      const r = await fetch("/api/social/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          format,
          vehicle_id: vehicleId || null,
          angle,
          extra,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        alert("Fel: " + (err.error || "okänt"));
        return;
      }
      await loadPosts();
      setAngle("");
      setExtra("");
    } finally {
      setLoading(false);
    }
  }

  function copy(p: SocialPost) {
    const text = `${p.caption}\n\n${p.hashtags || ""}`.trim();
    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function startEdit(p: SocialPost) {
    setEditingId(p.id);
    setEdits({ hook: p.hook, caption: p.caption, hashtags: p.hashtags, cta: p.cta, slides: p.slides ? [...p.slides] : null });
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      const r = await fetch("/api/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...edits }),
      });
      if (r.ok) {
        setEditingId(null);
        setEdits({});
        loadPosts();
      } else {
        alert("Kunde inte spara: " + (await r.text()));
      }
    } finally {
      setSavingEdit(false);
    }
  }

  function updateSlide(idx: number, field: keyof Slide, value: string) {
    if (!edits.slides) return;
    const next = [...edits.slides];
    next[idx] = { ...next[idx], [field]: value };
    setEdits({ ...edits, slides: next });
  }

  function openImagePicker(post: SocialPost, slideIndex?: number) {
    setImagePickerFor({ post, slideIndex });
  }

  async function publishNow(p: SocialPost) {
    if (p.platform !== "instagram") { alert("Direct publish stöds bara för Instagram. För Facebook: kopiera och posta manuellt."); return; }
    if (!confirm(`Publicera direkt på Instagram nu?\n\n${p.hook?.slice(0, 80) || ""}`)) return;
    const r = await fetch("/api/instagram/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: p.id }),
    });
    const d = await r.json();
    if (r.ok) {
      alert(`✓ Publicerat! Media-ID: ${d.ig_media_id}`);
      loadPosts();
    } else {
      alert("Fel: " + (d.error || "okänt"));
    }
  }

  async function scheduleQuick(p: SocialPost) {
    const when = prompt("Datum & tid (YYYY-MM-DD HH:MM):", new Date(Date.now() + 86400000).toISOString().slice(0, 16).replace("T", " "));
    if (!when) return;
    const isoDate = new Date(when.replace(" ", "T")).toISOString();
    const r = await fetch("/api/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: p.id, scheduled_at: isoDate, platform: p.platform }),
    });
    if (r.ok) alert(`Schemalagt till ${new Date(isoDate).toLocaleString("sv-SE")}`);
    else alert("Fel: " + (await r.text()));
  }

  async function share(p: SocialPost) {
    const recipientName = prompt("Mottagarens namn (visas i delningssidan):", "");
    if (recipientName === null) return;
    const recipientEmail = prompt("Mottagarens e-post (för din egen referens):", "") || "";
    const r = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource_type: "social", resource_id: p.id, recipient_name: recipientName, recipient_email: recipientEmail }),
    });
    if (!r.ok) { alert("Fel: " + (await r.text())); return; }
    const { token } = await r.json();
    const url = `${window.location.origin}/granska/${token}`;
    navigator.clipboard.writeText(url);
    alert("Granskningslänk skapad och kopierad:\n\n" + url + "\n\nSkicka via mejl/SMS. Kunden kan godkänna, avvisa eller kommentera.");
  }

  async function remove(id: string) {
    if (!confirm("Ta bort inlägget?")) return;
    await fetch(`/api/social?id=${id}`, { method: "DELETE" });
    loadPosts();
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/social", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadPosts();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* Generator panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-20">
        <h2 className="font-display font-bold text-lg text-gray-900 mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Social-generator
        </h2>
        <p className="text-xs text-gray-500 mb-4">Konverterande inlägg — Instagram + Facebook.</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Plattform</label>
            <div className="grid grid-cols-2 gap-2">
              {(["instagram", "facebook"] as Platform[]).map((p) => {
                const Icon = p === "instagram" ? Instagram : Facebook;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setPlatform(p);
                      setFormat(FORMATS[p][0].value);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      platform === p
                        ? "bg-brand-blue text-white border-brand-blue"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {p === "instagram" ? "Instagram" : "Facebook"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              {FORMATS[platform].map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Koppla fordon (valfritt)</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            >
              <option value="">— Allmänt inlägg —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.category.toUpperCase()} · {v.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Vinkel (valfritt)</label>
            <input
              type="text"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="t.ex. 'vinter-ATV till jakten'"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Extra info (valfritt)</label>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              placeholder="Kampanj, specialpris, säsong..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
            />
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Skriver...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generera inlägg
              </>
            )}
          </button>
        </div>
      </div>

      {imagePickerFor && (
        <ImagePicker
          postId={imagePickerFor.post.id}
          slideIndex={imagePickerFor.slideIndex}
          contextText={
            imagePickerFor.slideIndex != null && imagePickerFor.post.slides
              ? `${imagePickerFor.post.slides[imagePickerFor.slideIndex].headline}: ${imagePickerFor.post.slides[imagePickerFor.slideIndex].body}`
              : `${imagePickerFor.post.hook}\n${imagePickerFor.post.caption}`
          }
          currentImageUrl={
            imagePickerFor.slideIndex != null && imagePickerFor.post.slides
              ? imagePickerFor.post.slides[imagePickerFor.slideIndex]?.image_url
              : imagePickerFor.post.image_url
          }
          onClose={() => setImagePickerFor(null)}
          onSelected={() => {
            setImagePickerFor(null);
            loadPosts();
          }}
        />
      )}

      {previewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setPreviewFor(null)} />
          <div className="relative">
            <button onClick={() => setPreviewFor(null)} className="absolute -top-10 right-0 text-white text-2xl">×</button>
            <InstagramPreview
              platform={previewFor.platform}
              format={previewFor.format}
              username="@klient"
              hook={previewFor.hook || ""}
              caption={previewFor.caption || ""}
              hashtags={previewFor.hashtags || ""}
              imageUrl={previewFor.image_url}
              slides={previewFor.slides}
            />
          </div>
        </div>
      )}

      {/* Posts list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-gray-900">Sparade inlägg ({posts.length})</h2>
        </div>
        {posts.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
            Inga inlägg än. Skapa ditt första i panelen till vänster.
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const Icon = p.platform === "instagram" ? Instagram : Facebook;
              return (
                <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${p.platform === "instagram" ? "text-pink-500" : "text-blue-600"}`} />
                      <span className="text-xs font-medium text-gray-700">{p.platform === "instagram" ? "Instagram" : "Facebook"}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{p.format}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.status === "draft" ? "bg-amber-100 text-amber-700" :
                        p.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {p.status === "draft" ? "Utkast" : p.status === "approved" ? "Godkänd" : "Publicerad"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewFor(p)}
                        className="p-1.5 hover:bg-pink-50 rounded-lg text-gray-500 hover:text-pink-600 transition-colors"
                        title="Förhandsgranska som Instagram"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openImagePicker(p)}
                        className="p-1.5 hover:bg-purple-50 rounded-lg text-gray-500 hover:text-purple-600 transition-colors"
                        title="Välj bild (AI / Stock / Upload)"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => scheduleQuick(p)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                        title="Schemalägg"
                      >
                        <Calendar className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => publishNow(p)}
                        disabled={!p.image_url}
                        className="p-1.5 hover:bg-pink-50 rounded-lg text-gray-500 hover:text-pink-600 transition-colors disabled:opacity-30"
                        title={p.image_url ? "Publicera direkt på Instagram" : "Behöver bild först"}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => editingId === p.id ? setEditingId(null) : startEdit(p)}
                        className={`p-1.5 rounded-lg transition-colors ${editingId === p.id ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:bg-gray-100 hover:text-amber-600"}`}
                        title="Redigera"
                      >
                        {editingId === p.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => share(p)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"
                        title="Dela för godkännande"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copy(p)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-blue transition-colors"
                        title="Kopiera text + hashtags"
                      >
                        {copiedId === p.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => updateStatus(p.id, p.status === "approved" ? "draft" : "approved")}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-emerald-600 transition-colors"
                        title="Växla godkänd-status"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {p.image_url && editingId !== p.id && (
                    <div className="mb-3 relative inline-block group/img">
                      <img src={p.image_url} alt="" className="rounded-lg max-w-xs max-h-64 border border-gray-200" />
                      <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">{p.image_engine || "Bild"}</span>
                      <button onClick={() => openImagePicker(p)} className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 px-2 py-1 rounded text-xs font-medium opacity-0 group-hover/img:opacity-100 transition-opacity">
                        Byt bild
                      </button>
                    </div>
                  )}
                  {editingId === p.id ? (
                    <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div>
                        <label className="text-xs font-bold text-amber-900 uppercase">Hook</label>
                        <input
                          value={edits.hook || ""}
                          onChange={(e) => setEdits({ ...edits, hook: e.target.value })}
                          className="w-full mt-1 px-2 py-1.5 rounded border border-amber-300 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-amber-900 uppercase">Bildtext</label>
                        <textarea
                          value={edits.caption || ""}
                          onChange={(e) => setEdits({ ...edits, caption: e.target.value })}
                          rows={6}
                          className="w-full mt-1 px-2 py-1.5 rounded border border-amber-300 text-sm bg-white font-body leading-relaxed"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-amber-900 uppercase">Hashtags</label>
                          <input value={edits.hashtags || ""} onChange={(e) => setEdits({ ...edits, hashtags: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded border border-amber-300 text-sm bg-white" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-amber-900 uppercase">CTA</label>
                          <input value={edits.cta || ""} onChange={(e) => setEdits({ ...edits, cta: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded border border-amber-300 text-sm bg-white" />
                        </div>
                      </div>
                      {edits.slides && edits.slides.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-amber-900 uppercase">Slides</div>
                          {edits.slides.map((s, i) => (
                            <div key={i} className="bg-white rounded p-2 border border-amber-200">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] text-gray-500">Slide {s.number}</div>
                                <button onClick={() => openImagePicker(p, i)} className="text-xs text-purple-600 hover:bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  {s.image_url ? "Byt slide-bild" : "Lägg till bild"}
                                </button>
                              </div>
                              {s.image_url && <img src={s.image_url} alt="" className="rounded mb-1 max-h-24" />}
                              <input value={s.headline} onChange={(e) => updateSlide(i, "headline", e.target.value)} placeholder="Rubrik" className="w-full px-2 py-1 rounded border border-gray-200 text-sm font-bold mb-1" />
                              <textarea value={s.body} onChange={(e) => updateSlide(i, "body", e.target.value)} rows={2} placeholder="Brödtext" className="w-full px-2 py-1 rounded border border-gray-200 text-xs" />
                              <input value={s.image_hint} onChange={(e) => updateSlide(i, "image_hint", e.target.value)} placeholder="Bildidé" className="w-full mt-1 px-2 py-1 rounded border border-gray-200 text-[11px] italic text-gray-600" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openImagePicker(p)} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-medium">
                          <ImageIcon className="w-3 h-3" />
                          {p.image_url ? "Byt huvudbild" : "Välj huvudbild"}
                        </button>
                        <button onClick={() => saveEdit(p.id)} disabled={savingEdit} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50">
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Spara
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div>
                  {p.hook && (
                    <div className="mb-2 p-2 bg-purple-50 border-l-2 border-purple-400 rounded text-sm text-gray-800 font-medium">
                      🎣 {p.hook}
                    </div>
                  )}
                  {p.slides && p.slides.length > 0 && (
                    <details className="mb-2 bg-gray-50 rounded-lg overflow-hidden">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {p.slides.length} slides
                      </summary>
                      <div className="p-3 space-y-2 border-t border-gray-200">
                        {p.slides.map((s) => (
                          <div key={s.number} className="bg-white rounded p-2 border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="text-xs font-bold text-purple-600">Slide {s.number}</div>
                            </div>
                            <div className="text-sm font-bold text-gray-900 mt-0.5">{s.headline}</div>
                            <div className="text-xs text-gray-700 mt-1">{s.body}</div>
                            <div className="text-[11px] text-gray-500 italic mt-1">📷 {s.image_hint}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-body leading-relaxed">{p.caption}</pre>
                  {p.hashtags && <div className="mt-2 text-xs text-blue-600">{p.hashtags}</div>}
                  {p.cta && <div className="mt-2 text-xs text-gray-500"><strong>CTA:</strong> {p.cta}</div>}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
