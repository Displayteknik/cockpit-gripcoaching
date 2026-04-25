"use client";

import { useEffect, useState } from "react";
import { supabase, type Vehicle } from "@/lib/supabase";
import { Sparkles, Copy, Trash2, Loader2, Check, Send, Image } from "lucide-react";

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

interface Slide { number: number; headline: string; body: string; image_hint: string }
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
                  {p.hook && (
                    <div className="mb-2 p-2 bg-purple-50 border-l-2 border-purple-400 rounded text-sm text-gray-800 font-medium">
                      🎣 {p.hook}
                    </div>
                  )}
                  {p.slides && p.slides.length > 0 && (
                    <details className="mb-2 bg-gray-50 rounded-lg overflow-hidden">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1">
                        <Image className="w-3.5 h-3.5" />
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
