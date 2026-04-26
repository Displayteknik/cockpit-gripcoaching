"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, type Vehicle } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, Star, Search, X, Upload, Image as ImageIcon,
  GripVertical, ChevronDown, Eye,
} from "lucide-react";

const CATEGORIES = [
  { value: "car", label: "Bil" },
  { value: "atv", label: "ATV" },
  { value: "utv", label: "UTV" },
  { value: "moped", label: "Moped" },
  { value: "slapvagn", label: "Släpvagn" },
  { value: "tradgard", label: "Trädgård" },
];

const emptyVehicle: Partial<Vehicle> & { gallery?: string[] } = {
  title: "", slug: "", brand: "", model: "", category: "car",
  image_url: "", description: "", specs: {}, price: 0,
  price_label: "", badge: "", is_featured: false, is_sold: false,
  sort_order: 0, gallery: [],
};

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<(Vehicle & { gallery?: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [editing, setEditing] = useState<(Partial<Vehicle> & { gallery?: string[] }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "images" | "specs">("info");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const loadVehicles = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("hm_vehicles")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true });
    setVehicles(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const filtered = vehicles.filter((v) => {
    if (filterCat !== "all" && v.category !== filterCat) return false;
    if (search) {
      const s = search.toLowerCase();
      return v.title.toLowerCase().includes(s) || v.brand?.toLowerCase().includes(s);
    }
    return true;
  });

  const openEdit = (vehicle: Vehicle & { gallery?: string[] }) => {
    setEditing({ ...vehicle, gallery: vehicle.gallery || [] });
    setActiveTab("info");
    setIsNew(false);
  };

  const openNew = () => {
    setEditing({ ...emptyVehicle });
    setActiveTab("info");
    setIsNew(true);
  };

  // Image upload to Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("vehicle-images")
      .upload(name, file, { cacheControl: "31536000", upsert: false });
    if (error) { alert("Uppladdningsfel: " + error.message); return null; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(name);
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
      // First image becomes main image if none set
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
    const gallery = [...(editing.gallery || [])].filter(u => u !== url);
    if (editing.image_url) gallery.unshift(editing.image_url);
    setEditing({ ...editing, image_url: url, gallery });
  };

  const removeImage = (url: string) => {
    if (!editing) return;
    if (editing.image_url === url) {
      const gallery = [...(editing.gallery || [])];
      setEditing({ ...editing, image_url: gallery.shift() || "", gallery });
    } else {
      setEditing({ ...editing, gallery: (editing.gallery || []).filter(u => u !== url) });
    }
  };

  // Specs helpers
  const addSpec = () => {
    if (!editing) return;
    setEditing({ ...editing, specs: { ...(editing.specs || {}), "": "" } });
  };

  const updateSpecKey = (oldKey: string, newKey: string) => {
    if (!editing) return;
    const specs = { ...(editing.specs || {}) };
    const val = specs[oldKey];
    delete specs[oldKey];
    specs[newKey] = val;
    setEditing({ ...editing, specs });
  };

  const updateSpecValue = (key: string, value: string) => {
    if (!editing) return;
    setEditing({ ...editing, specs: { ...(editing.specs || {}), [key]: value } });
  };

  const removeSpec = (key: string) => {
    if (!editing) return;
    const specs = { ...(editing.specs || {}) };
    delete specs[key];
    setEditing({ ...editing, specs });
  };

  const handleSave = async () => {
    if (!editing || !clientId) return;
    setSaving(true);
    const payload: Record<string, unknown> = { ...editing, client_id: clientId };
    if (!payload.slug && payload.title) {
      payload.slug = String(payload.title).toLowerCase()
        .replace(/[åä]/g, "a").replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    if (isNew) {
      const { error } = await supabase.from("hm_vehicles").insert(payload);
      if (error) alert("Fel: " + error.message);
    } else {
      const { error } = await supabase.from("hm_vehicles").update(payload).eq("id", editing.id!).eq("client_id", clientId);
      if (error) alert("Fel: " + error.message);
    }
    setSaving(false);
    setEditing(null);
    loadVehicles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort detta fordon?")) return;
    await supabase.from("hm_vehicles").delete().eq("id", id).eq("client_id", clientId!);
    loadVehicles();
  };

  const toggleFeatured = async (v: Vehicle) => {
    await supabase.from("hm_vehicles").update({ is_featured: !v.is_featured }).eq("id", v.id).eq("client_id", clientId!);
    loadVehicles();
  };

  const toggleSold = async (v: Vehicle) => {
    await supabase.from("hm_vehicles").update({ is_sold: !v.is_sold }).eq("id", v.id).eq("client_id", clientId!);
    loadVehicles();
  };

  const allImages = editing ? [editing.image_url, ...(editing.gallery || [])].filter(Boolean) as string[] : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Fordon</h1>
          <p className="text-sm text-gray-500 mt-1">{vehicles.length} fordon totalt &middot; {filtered.length} visas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          Nytt fordon
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Sök fordon..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "Alla" }, ...CATEGORIES].map((cat) => (
            <button key={cat.value} onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCat === cat.value ? "bg-brand-blue text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Fordon</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Kategori</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Pris</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {v.image_url ? (
                        <img src={v.image_url} alt={v.title} className="w-14 h-10 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm text-gray-900">{v.title}</div>
                        <div className="text-xs text-gray-400">{v.brand} {v.model}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {CATEGORIES.find((c) => c.value === v.category)?.label || v.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {v.price > 0 ? formatPrice(v.price) : v.price_label || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {v.is_featured && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Utvald</span>}
                      {v.is_sold && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Såld</span>}
                      {v.badge && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{v.badge}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggleSold(v)} className={`p-1.5 rounded-lg transition-colors text-xs font-medium ${v.is_sold ? "bg-red-50 text-red-600" : "text-gray-400 hover:bg-gray-100"}`}
                        title={v.is_sold ? "Markera som tillgänglig" : "Markera som såld"}>
                        {v.is_sold ? "Såld" : "Sälj"}
                      </button>
                      <button onClick={() => toggleFeatured(v)}
                        className={`p-1.5 rounded-lg transition-colors ${v.is_featured ? "text-amber-500 bg-amber-50" : "text-gray-400 hover:bg-gray-100"}`}>
                        <Star className="w-4 h-4" fill={v.is_featured ? "currentColor" : "none"} />
                      </button>
                      <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-blue transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400">Inga fordon hittades</div>}
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* Header with preview */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                {editing.image_url ? (
                  <img src={editing.image_url} alt="" className="w-16 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="font-display font-bold text-lg">{isNew ? "Nytt fordon" : editing.title || "Redigera"}</h2>
                  <p className="text-xs text-gray-500">{editing.brand} &middot; {CATEGORIES.find(c => c.value === editing.category)?.label} &middot; {editing.price ? formatPrice(editing.price) : "Inget pris"}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
              {([["info", "Information"], ["images", "Bilder"], ["specs", "Specifikationer"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {label}
                  {key === "images" && allImages.length > 0 && (
                    <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{allImages.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto flex-1 p-6">

              {/* ── INFO TAB ── */}
              {activeTab === "info" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                      <input type="text" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL-slug</label>
                      <input type="text" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                        placeholder="auto-genereras" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Märke</label>
                      <input type="text" value={editing.brand || ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modell</label>
                      <input type="text" value={editing.model || ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                      <select value={editing.category || "car"} onChange={(e) => setEditing({ ...editing, category: e.target.value as Vehicle["category"] })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none">
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
                    <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      rows={4} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pris (kr)</label>
                      <input type="number" value={editing.price || 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prisetikett</label>
                      <input type="text" value={editing.price_label || ""} onChange={(e) => setEditing({ ...editing, price_label: e.target.value })}
                        placeholder="t.ex. 'Kontakta oss'" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Badge</label>
                      <input type="text" value={editing.badge || ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
                        placeholder="t.ex. 'Nyhet'" className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sortering</label>
                      <input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                    </div>
                    <div className="flex items-end gap-4 pb-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={editing.is_featured || false} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })}
                          className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                        Utvald
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={editing.is_sold || false} onChange={(e) => setEditing({ ...editing, is_sold: e.target.checked })}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-500" />
                        Såld
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── IMAGES TAB ── */}
              {activeTab === "images" && (
                <div className="space-y-5">
                  {/* Upload area */}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-blue hover:bg-brand-blue/5 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-brand-blue", "bg-brand-blue/5"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-brand-blue", "bg-brand-blue/5"); }}
                    onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-brand-blue", "bg-brand-blue/5"); handleFileUpload(e.dataTransfer.files); }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-brand-blue border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-gray-500">Laddar upp...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Dra & släpp bilder eller klicka för att välja</span>
                        <span className="text-xs text-gray-400">JPG, PNG, WebP — max 5 MB per bild</span>
                      </div>
                    )}
                  </div>

                  {/* URL input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eller klistra in bild-URL</label>
                    <div className="flex gap-2">
                      <input type="text" id="url-input" placeholder="https://example.com/bild.jpg"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                      <button onClick={() => {
                        const input = document.getElementById("url-input") as HTMLInputElement;
                        if (input.value) {
                          if (!editing.image_url) setEditing({ ...editing, image_url: input.value });
                          else setEditing({ ...editing, gallery: [...(editing.gallery || []), input.value] });
                          input.value = "";
                        }
                      }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg transition-colors">
                        Lägg till
                      </button>
                    </div>
                  </div>

                  {/* Image gallery */}
                  {allImages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Bilder ({allImages.length})</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {allImages.map((url, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-[4/3]">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            {i === 0 && (
                              <span className="absolute top-2 left-2 bg-brand-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                HUVUDBILD
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                              {i !== 0 && (
                                <button onClick={() => setMainImage(url)} className="bg-white text-gray-800 p-2 rounded-lg text-xs font-medium hover:bg-gray-100 shadow-lg" title="Gör till huvudbild">
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => removeImage(url)} className="bg-red-500 text-white p-2 rounded-lg text-xs font-medium hover:bg-red-600 shadow-lg" title="Ta bort">
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

              {/* ── SPECS TAB ── */}
              {activeTab === "specs" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Lägg till specifikationer som visas på fordonskortet och detaljsidan.</p>

                  {Object.entries(editing.specs || {}).map(([key, value], i) => (
                    <div key={i} className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <input type="text" value={key} onChange={(e) => updateSpecKey(key, e.target.value)}
                        placeholder="Nyckel (t.ex. Årsmodell)" className="w-1/3 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                      <input type="text" value={value} onChange={(e) => updateSpecValue(key, e.target.value)}
                        placeholder="Värde (t.ex. 2024)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
                      <button onClick={() => removeSpec(key)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <button onClick={addSpec} className="flex items-center gap-2 text-sm text-brand-blue hover:text-brand-blue-dark font-medium py-2 transition-colors">
                    <Plus className="w-4 h-4" />
                    Lägg till specifikation
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div className="text-xs text-gray-400">
                {editing.slug && <span>/{editing.slug}</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                  Avbryt
                </button>
                <button onClick={handleSave} disabled={saving || !editing.title}
                  className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {saving ? "Sparar..." : isNew ? "Lägg till fordon" : "Spara ändringar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
