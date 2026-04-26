"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, type ArtWork } from "@/lib/supabase";
import {
  Plus, Pencil, Trash2, Star, Search, X, Upload, Image as ImageIcon, Eye, Globe,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "for_sale", label: "Till salu", color: "bg-emerald-100 text-emerald-700" },
  { value: "sold", label: "Såld", color: "bg-red-100 text-red-700" },
  { value: "reserved", label: "Reserverad", color: "bg-amber-100 text-amber-700" },
  { value: "exhibition_only", label: "Endast utställning", color: "bg-blue-100 text-blue-700" },
  { value: "archived", label: "Arkiverad", color: "bg-gray-100 text-gray-500" },
];

const TECHNIQUES = ["Akvarell", "Olja", "Akryl", "Kol", "Blandteknik", "Tusch", "Pastell", "Skulptur", "Foto", "Tryck"];

const emptyWork: Partial<ArtWork> = {
  title: "", slug: "", artist: "Darek Uhrberg", year: new Date().getFullYear(),
  technique: "", medium: "", width_cm: null, height_cm: null, depth_cm: null,
  price: 0, price_label: "", description: "", image_url: "",
  gallery: [], tags: [], status: "for_sale", is_featured: false, sort_order: 0,
};

export default function VerkPage() {
  const [works, setWorks] = useState<ArtWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editing, setEditing] = useState<Partial<ArtWork> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "images" | "details">("info");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const publishToSite = async () => {
    setPublishing(true); setPublishMsg(null);
    const r = await fetch("/api/darek/publish", { method: "POST" });
    const j = await r.json();
    setPublishing(false);
    setPublishMsg(j.message || j.error);
    setTimeout(() => setPublishMsg(null), 6000);
  };

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const loadWorks = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("art_works").select("*").eq("client_id", clientId)
      .order("sort_order", { ascending: true });
    setWorks((data as ArtWork[]) || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadWorks(); }, [loadWorks]);

  const filtered = works.filter((w) => {
    if (filterStatus !== "all" && w.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return w.title.toLowerCase().includes(s) || (w.technique || "").toLowerCase().includes(s);
    }
    return true;
  });

  const openEdit = (w: ArtWork) => {
    setEditing({ ...w, gallery: w.gallery || [], tags: w.tags || [] });
    setActiveTab("info");
    setIsNew(false);
  };

  const openNew = () => {
    setEditing({ ...emptyWork });
    setActiveTab("info");
    setIsNew(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("art-images").upload(name, file, { cacheControl: "31536000", upsert: false });
    if (error) { alert("Uppladdningsfel: " + error.message); return null; }
    const { data } = supabase.storage.from("art-images").getPublicUrl(name);
    return data.publicUrl;
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      if (!editing.image_url) {
        setEditing({ ...editing, image_url: urls[0], gallery: [...(editing.gallery || []), ...urls.slice(1)] });
      } else {
        setEditing({ ...editing, gallery: [...(editing.gallery || []), ...urls] });
      }
    }
    setUploading(false);
  };

  const setMainImage = (url: string) => {
    if (!editing) return;
    const gallery = [...(editing.gallery || [])].filter((u) => u !== url);
    if (editing.image_url) gallery.unshift(editing.image_url);
    setEditing({ ...editing, image_url: url, gallery });
  };

  const removeImage = (url: string) => {
    if (!editing) return;
    if (editing.image_url === url) {
      const gallery = [...(editing.gallery || [])];
      setEditing({ ...editing, image_url: gallery.shift() || "", gallery });
    } else {
      setEditing({ ...editing, gallery: (editing.gallery || []).filter((u) => u !== url) });
    }
  };

  const handleSave = async () => {
    if (!editing || !clientId) return;
    setSaving(true);
    const payload: Partial<ArtWork> = { ...editing, client_id: clientId };
    if (!payload.slug && payload.title) {
      payload.slug = payload.title.toLowerCase()
        .replace(/[åä]/g, "a").replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    if (isNew) {
      const { error } = await supabase.from("art_works").insert(payload);
      if (error) { alert("Fel: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("art_works").update(payload).eq("id", editing.id!);
      if (error) { alert("Fel: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    setEditing(null);
    loadWorks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ta bort detta verk?")) return;
    await supabase.from("art_works").delete().eq("id", id);
    loadWorks();
  };

  const toggleFeatured = async (w: ArtWork) => {
    await supabase.from("art_works").update({ is_featured: !w.is_featured }).eq("id", w.id);
    loadWorks();
  };

  const updateStatus = async (w: ArtWork, status: string) => {
    await supabase.from("art_works").update({ status }).eq("id", w.id);
    loadWorks();
  };

  const allImages = editing ? [editing.image_url, ...(editing.gallery || [])].filter(Boolean) as string[] : [];

  const formatPrice = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kr";
  const dim = (w: Partial<ArtWork>) => [w.width_cm, w.height_cm, w.depth_cm].filter(Boolean).join(" × ") + (w.width_cm ? " cm" : "");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Verk</h1>
          <p className="text-sm text-gray-500 mt-1">{works.length} verk totalt · {filtered.length} visas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={publishToSite} disabled={publishing} className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
            <Globe className="w-4 h-4" />
            {publishing ? "Publicerar..." : "Publicera till sajt"}
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />
            Nytt verk
          </button>
        </div>
      </div>
      {publishMsg && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{publishMsg}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Sök titel eller teknik..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "Alla" }, ...STATUS_OPTIONS].map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s.value ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Verk</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Teknik</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Mått</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Pris</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((w) => {
                const statusOpt = STATUS_OPTIONS.find((s) => s.value === w.status);
                return (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {w.image_url ? (
                          <img src={w.image_url} alt={w.title} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm text-gray-900">{w.title}</div>
                          <div className="text-xs text-gray-400">{w.year || "—"}{w.is_featured && <span className="ml-2 text-amber-500">★</span>}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{w.technique || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{dim(w) || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {w.price > 0 ? formatPrice(w.price) : w.price_label || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select value={w.status} onChange={(e) => updateStatus(w, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 focus:ring-2 focus:ring-gray-900/20 outline-none cursor-pointer ${statusOpt?.color || ""}`}>
                        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => toggleFeatured(w)}
                          className={`p-1.5 rounded-lg transition-colors ${w.is_featured ? "text-amber-500 bg-amber-50" : "text-gray-400 hover:bg-gray-100"}`}>
                          <Star className="w-4 h-4" fill={w.is_featured ? "currentColor" : "none"} />
                        </button>
                        <a href={`/verk/${w.slug}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors" title="Öppna publik sida">
                          <Eye className="w-4 h-4" />
                        </a>
                        <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(w.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Inga verk hittades</div>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                {editing.image_url ? (
                  <img src={editing.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="font-display font-bold text-lg">{isNew ? "Nytt verk" : editing.title || "Redigera"}</h2>
                  <p className="text-xs text-gray-500">{editing.technique || "—"} · {dim(editing) || "ingen storlek"} · {editing.price ? formatPrice(editing.price) : "Inget pris"}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
              {([["info", "Information"], ["images", "Bilder"], ["details", "Detaljer"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {label}
                  {key === "images" && allImages.length > 0 && (
                    <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{allImages.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {activeTab === "info" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Titel *">
                      <input type="text" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none" />
                    </Field>
                    <Field label="URL-slug">
                      <input type="text" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                        placeholder="auto-genereras" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Konstnär">
                      <input type="text" value={editing.artist || ""} onChange={(e) => setEditing({ ...editing, artist: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </Field>
                    <Field label="År">
                      <input type="number" value={editing.year || ""} onChange={(e) => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </Field>
                    <Field label="Teknik">
                      <input type="text" list="techniques" value={editing.technique || ""} onChange={(e) => setEditing({ ...editing, technique: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                      <datalist id="techniques">{TECHNIQUES.map((t) => <option key={t} value={t} />)}</datalist>
                    </Field>
                  </div>
                  <Field label="Beskrivning">
                    <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      rows={4} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Pris (kr)">
                      <input type="number" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </Field>
                    <Field label="Prisetikett">
                      <input type="text" value={editing.price_label || ""} onChange={(e) => setEditing({ ...editing, price_label: e.target.value })}
                        placeholder="t.ex. 'Förfrågan'" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Status">
                      <select value={editing.status || "for_sale"} onChange={(e) => setEditing({ ...editing, status: e.target.value as ArtWork["status"] })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
                        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-end gap-4 pb-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={editing.is_featured || false} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                          className="rounded border-gray-300" />
                        Utvald (visas först)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "images" && (
                <div className="space-y-5">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-gray-900 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">Laddar upp...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Dra & släpp bilder eller klicka</span>
                        <span className="text-xs text-gray-400">JPG, PNG, WebP — max 10 MB</span>
                      </div>
                    )}
                  </div>

                  {allImages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Bilder ({allImages.length})</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {allImages.map((url, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-square">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            {i === 0 && (
                              <span className="absolute top-2 left-2 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HUVUDBILD</span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                              {i !== 0 && (
                                <button onClick={() => setMainImage(url)} className="bg-white text-gray-800 p-2 rounded-lg shadow-lg" title="Gör till huvudbild">
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => removeImage(url)} className="bg-red-500 text-white p-2 rounded-lg shadow-lg" title="Ta bort">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "details" && (
                <div className="space-y-5">
                  <Field label="Underlag/medium">
                    <input type="text" value={editing.medium || ""} onChange={(e) => setEditing({ ...editing, medium: e.target.value })}
                      placeholder="t.ex. papper, duk, masonit" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </Field>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mått (cm)</label>
                    <div className="grid grid-cols-3 gap-3">
                      <input type="number" placeholder="Bredd" value={editing.width_cm || ""} onChange={(e) => setEditing({ ...editing, width_cm: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                      <input type="number" placeholder="Höjd" value={editing.height_cm || ""} onChange={(e) => setEditing({ ...editing, height_cm: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                      <input type="number" placeholder="Djup (skulptur)" value={editing.depth_cm || ""} onChange={(e) => setEditing({ ...editing, depth_cm: e.target.value ? Number(e.target.value) : null })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                  <Field label="Taggar (kommaseparerat)">
                    <input type="text" value={(editing.tags || []).join(", ")}
                      onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="natur, abstrakt, porträtt..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </Field>
                  <Field label="Sortering">
                    <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </Field>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div className="text-xs text-gray-400">{editing.slug && <span>/verk/{editing.slug}</span>}</div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                  Avbryt
                </button>
                <button onClick={handleSave} disabled={saving || !editing.title}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {saving ? "Sparar..." : isNew ? "Lägg till verk" : "Spara ändringar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
