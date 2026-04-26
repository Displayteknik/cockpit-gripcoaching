"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, type Exhibition } from "@/lib/supabase";
import { Plus, Pencil, Trash2, X, Upload, Image as ImageIcon, Calendar, MapPin } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Kommande", color: "bg-blue-100 text-blue-700" },
  { value: "ongoing", label: "Pågår nu", color: "bg-emerald-100 text-emerald-700" },
  { value: "past", label: "Genomförd", color: "bg-gray-100 text-gray-600" },
];

const empty: Partial<Exhibition> = {
  year: new Date().getFullYear(), title: "", venue: "", city: "",
  start_date: "", end_date: "", status: "past", description: "", image_url: "", url: "", sort_order: 0,
};

export default function UtstallningarPage() {
  const [items, setItems] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Exhibition> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("art_exhibitions").select("*").eq("client_id", clientId)
      .order("year", { ascending: false }).order("sort_order", { ascending: true });
    setItems((data as Exhibition[]) || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const grouped = items.reduce<Record<number, Exhibition[]>>((acc, it) => {
    (acc[it.year] = acc[it.year] || []).push(it);
    return acc;
  }, {});
  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

  const openNew = () => { setEditing({ ...empty }); setIsNew(true); };
  const openEdit = (it: Exhibition) => { setEditing(it); setIsNew(false); };

  const uploadImage = async (file: File) => {
    const ext = file.name.split(".").pop();
    const name = `exhibitions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("art-images").upload(name, file, { upsert: false, cacheControl: "31536000" });
    if (error) { alert("Uppladdningsfel: " + error.message); return null; }
    return supabase.storage.from("art-images").getPublicUrl(name).data.publicUrl;
  };

  const handleFile = async (file: File | null) => {
    if (!file || !editing) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) setEditing({ ...editing, image_url: url });
    setUploading(false);
  };

  const handleSave = async () => {
    if (!editing || !clientId) return;
    setSaving(true);
    const payload: Partial<Exhibition> = {
      ...editing, client_id: clientId,
      start_date: editing.start_date || null,
      end_date: editing.end_date || null,
    };
    if (isNew) {
      const { error } = await supabase.from("art_exhibitions").insert(payload);
      if (error) { alert("Fel: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("art_exhibitions").update(payload).eq("id", editing.id!);
      if (error) { alert("Fel: " + error.message); setSaving(false); return; }
    }
    setSaving(false); setEditing(null); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ta bort utställningen?")) return;
    await supabase.from("art_exhibitions").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Utställningar</h1>
          <p className="text-sm text-gray-500 mt-1">{items.length} utställningar · {years.length} år</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Ny utställning
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : years.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Inga utställningar än. Klicka "Ny utställning" för att börja.
        </div>
      ) : (
        <div className="space-y-8">
          {years.map((year) => (
            <div key={year}>
              <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{year}</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {grouped[year].map((it) => {
                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === it.status);
                  return (
                    <div key={it.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 group">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusOpt?.color || ""}`}>{statusOpt?.label}</span>
                          {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-700">Extern länk →</a>}
                        </div>
                        <div className="font-semibold text-gray-900 truncate">{it.title}</div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {it.venue && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{it.venue}{it.city && `, ${it.city}`}</span>}
                          {(it.start_date || it.end_date) && (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{it.start_date}{it.end_date && ` – ${it.end_date}`}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(it.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">{isNew ? "Ny utställning" : editing.title || "Redigera"}</h2>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="År *">
                  <input type="number" value={editing.year || ""} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                </Field>
                <Field label="Status">
                  <select value={editing.status || "past"} onChange={(e) => setEditing({ ...editing, status: e.target.value as Exhibition["status"] })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm">
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Titel *">
                <input type="text" value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Plats / galleri">
                  <input type="text" value={editing.venue || ""} onChange={(e) => setEditing({ ...editing, venue: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                </Field>
                <Field label="Stad">
                  <input type="text" value={editing.city || ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Startdatum">
                  <input type="date" value={editing.start_date || ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                </Field>
                <Field label="Slutdatum">
                  <input type="date" value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
                </Field>
              </div>
              <Field label="Beskrivning">
                <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none" />
              </Field>
              <Field label="Extern länk (valfri)">
                <input type="url" value={editing.url || ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                  placeholder="https://..." className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm" />
              </Field>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bild</label>
                <div className="flex items-start gap-4">
                  {editing.image_url ? (
                    <div className="relative">
                      <img src={editing.image_url} alt="" className="w-32 h-32 rounded-lg object-cover" />
                      <button onClick={() => setEditing({ ...editing, image_url: "" })} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-900 hover:bg-gray-50">
                      {uploading ? (
                        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-xs text-gray-500 mt-1">Ladda upp</span>
                        </>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Avbryt</button>
              <button onClick={handleSave} disabled={saving || !editing.title || !editing.year}
                className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? "Sparar..." : isNew ? "Lägg till" : "Spara"}
              </button>
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
