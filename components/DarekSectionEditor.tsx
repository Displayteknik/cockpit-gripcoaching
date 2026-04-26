"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Pencil, X, Plus, Trash2, Upload, Globe, Eye, Image as ImageIcon, GripVertical } from "lucide-react";

type ContentMap = Record<string, unknown>;

interface SectionDef {
  key: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

type FieldDef =
  | { name: string; label: string; type: "text" | "textarea" | "url" | "html"; placeholder?: string }
  | { name: string; label: string; type: "image"; bucket?: string }
  | { name: string; label: string; type: "image-list" }
  | { name: string; label: string; type: "kv-list"; keyLabel: string; valLabel: string }
  | { name: string; label: string; type: "stat-list" }
  | { name: string; label: string; type: "subject-list" }
  | { name: string; label: string; type: "social-list" }
  | { name: string; label: string; type: "nav-list" }
  | { name: string; label: string; type: "boolean" };

const SECTIONS: SectionDef[] = [
  {
    key: "hero",
    label: "Hero",
    description: "Förstaintrycket — titel, undertext, hero-bild och slideshow",
    fields: [
      { name: "year", label: "Övre etikett", type: "text", placeholder: "Konstnär · Sandarne" },
      { name: "titleLine1", label: "Titel rad 1", type: "text" },
      { name: "titleLine2", label: "Titel rad 2 (italic)", type: "text" },
      { name: "tagline", label: "Tagline", type: "text" },
      { name: "ctaLabel", label: "Knapp-text", type: "text" },
      { name: "ctaHref", label: "Knapp-länk", type: "text", placeholder: "#portfolio" },
      { name: "heroImage", label: "Hero-bild (huvud)", type: "image" },
      { name: "heroAlt", label: "Hero-bild alt-text", type: "text" },
      { name: "slideshow", label: "Slideshow-bilder", type: "image-list" },
      { name: "scrollHint", label: "Scroll-hint text", type: "text" },
    ],
  },
  {
    key: "nuPagar",
    label: "Nu pågår-banner",
    description: "Aktiv utställning som visas högst upp",
    fields: [
      { name: "enabled", label: "Visa banner", type: "boolean" },
      { name: "label", label: "Etikett", type: "text", placeholder: "Nu pågår" },
      { name: "title", label: "Titel", type: "text" },
      { name: "href", label: "Länk till sida", type: "text" },
      { name: "meta", label: "Detaljer (kvarter)", type: "kv-list", keyLabel: "Etikett", valLabel: "Värde" },
      { name: "ctaLabel", label: "CTA-text", type: "text" },
      { name: "ctaHref", label: "CTA-länk", type: "text" },
    ],
  },
  {
    key: "about",
    label: "Om konstnären",
    description: "Porträtt, presentation, statistik",
    fields: [
      { name: "sectionLabel", label: "Sektionsetikett", type: "text" },
      { name: "titleHtml", label: "Rubrik (HTML — em + br tillåtna)", type: "text" },
      { name: "portrait", label: "Porträttbild", type: "image" },
      { name: "portraitAlt", label: "Porträtt alt-text", type: "text" },
      { name: "portraitLabel", label: "Bildtext", type: "text" },
      { name: "paragraphs", label: "Stycken", type: "image-list" },
      { name: "stats", label: "Statistik", type: "stat-list" },
    ],
  },
  {
    key: "shop",
    label: "Galleri-rubrik",
    description: "Rubrik och intro för shop-sektionen (verken kommer från Verk-fliken)",
    fields: [
      { name: "sectionLabel", label: "Etikett", type: "text" },
      { name: "heading", label: "Rubrik", type: "text" },
    ],
  },
  {
    key: "exhibitions",
    label: "Utställningar-rubrik",
    description: "Rubrik för CV-sektionen (utställningar kommer från Utställningar-fliken)",
    fields: [
      { name: "sectionLabel", label: "Etikett", type: "text" },
      { name: "heading", label: "Rubrik", type: "text" },
    ],
  },
  {
    key: "contact",
    label: "Kontakt",
    description: "Kontaktinfo, formulär och sociala länkar",
    fields: [
      { name: "heading", label: "Rubrik (HTML)", type: "text" },
      { name: "subheading", label: "Underrubrik", type: "text" },
      { name: "email", label: "E-post", type: "text" },
      { name: "phone", label: "Telefon", type: "text" },
      { name: "address", label: "Adress", type: "text" },
      { name: "formSubjects", label: "Formulär-ämnen", type: "subject-list" },
      { name: "social", label: "Sociala länkar", type: "social-list" },
    ],
  },
  {
    key: "footer",
    label: "Footer",
    description: "Längst ner på sidan",
    fields: [
      { name: "copyright", label: "Copyright", type: "text" },
      { name: "logo", label: "Logo (text)", type: "text" },
      { name: "location", label: "Plats", type: "text" },
    ],
  },
  {
    key: "site",
    label: "Sidans titel & nav",
    description: "Browser-titel och navigation",
    fields: [
      { name: "title", label: "Browser-titel", type: "text" },
      { name: "navLogo", label: "Logo i nav", type: "text" },
      { name: "navLinks", label: "Nav-länkar", type: "nav-list" },
    ],
  },
];

export default function DarekSectionEditor() {
  const [content, setContent] = useState<ContentMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/darek/content");
    const j = await r.json();
    setContent(j);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (key: string) => {
    setEditing(key);
    const v = content?.[key];
    setEditValue(JSON.parse(JSON.stringify(v ?? {})));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const r = await fetch("/api/darek/content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: editing, value: editValue }),
    });
    setSaving(false);
    if (!r.ok) { alert("Fel: " + (await r.text())); return; }
    setEditing(null);
    load();
  };

  const publish = async () => {
    setPublishing(true); setPublishMsg(null);
    const r = await fetch("/api/darek/publish", { method: "POST" });
    const j = await r.json();
    setPublishing(false);
    setPublishMsg(j.message || j.error);
    setTimeout(() => setPublishMsg(null), 8000);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Laddar...</div>;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Sektioner</h1>
          <p className="text-sm text-gray-500 mt-1">Redigera Dareks sajt — varje sektion publiceras till darekuhrberg.se</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://darekuhrberg.se" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg">
            <Eye className="w-4 h-4" />
            Visa publik sajt
          </a>
          <button onClick={publish} disabled={publishing} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
            <Globe className="w-4 h-4" />
            {publishing ? "Publicerar..." : "Publicera till sajt"}
          </button>
        </div>
      </div>

      {publishMsg && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{publishMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((s) => {
          const data = content?.[s.key] as Record<string, unknown> | undefined;
          const summary = sectionSummary(s.key, data);
          return (
            <div key={s.key} className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-400 transition-colors cursor-pointer" onClick={() => openEdit(s.key)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display font-bold text-gray-900">{s.label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-900 transition-opacity">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-700 mt-3">{summary}</div>
            </div>
          );
        })}
      </div>

      {editing && (
        <SectionEditModal
          section={SECTIONS.find((s) => s.key === editing)!}
          value={editValue as Record<string, unknown>}
          onChange={setEditValue}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function sectionSummary(key: string, data: Record<string, unknown> | undefined): string {
  if (!data) return "(tom)";
  if (key === "hero") return `${data.titleLine1 || ""} ${data.titleLine2 || ""} — ${data.tagline || ""}`.trim();
  if (key === "nuPagar") return data.enabled ? `${data.title || "(ingen titel)"}` : "(avstängd)";
  if (key === "about") return `${(data.paragraphs as unknown[])?.length || 0} stycken · ${(data.stats as unknown[])?.length || 0} stats`;
  if (key === "shop" || key === "exhibitions") return `${data.heading || ""}`;
  if (key === "contact") return `${data.email || ""} · ${(data.social as unknown[])?.length || 0} sociala länkar`;
  if (key === "footer") return `${data.copyright || ""}`;
  if (key === "site") return `${(data.navLinks as unknown[])?.length || 0} nav-länkar`;
  return "";
}

function SectionEditModal({ section, value, onChange, onClose, onSave, saving }: {
  section: SectionDef;
  value: Record<string, unknown>;
  onChange: (v: unknown) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const setField = (name: string, v: unknown) => onChange({ ...value, [name]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg">{section.label}</h2>
            <p className="text-xs text-gray-500">{section.description}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {section.fields.map((f) => (
            <Field key={f.name} field={f} value={value[f.name]} onChange={(v) => setField(f.name, v)} />
          ))}
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">Avbryt</button>
          <button onClick={onSave} disabled={saving} className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {saving ? "Sparar..." : "Spara"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
      {renderInput(field, value, onChange)}
    </div>
  );
}

function renderInput(field: FieldDef, value: unknown, onChange: (v: unknown) => void) {
  const cls = "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 outline-none";
  switch (field.type) {
    case "text":
    case "url":
      return <input type="text" value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
    case "textarea":
      return <textarea value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} rows={4} className={cls + " resize-none"} />;
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300" />
          {value ? "På" : "Av"}
        </label>
      );
    case "image":
      return <ImageInput value={value as string} onChange={onChange} />;
    case "image-list":
      // för slideshow OCH för paragraphs (textstycken) — om field.name === 'paragraphs' → renderar text-list istället
      return field.name === "paragraphs"
        ? <TextListInput value={value as string[]} onChange={onChange} placeholder="Skriv ett stycke..." />
        : <ImageListInput value={value as string[]} onChange={onChange} />;
    case "kv-list":
      return <KVListInput value={value as { key: string; val: string }[]} onChange={onChange} keyLabel={field.keyLabel} valLabel={field.valLabel} />;
    case "stat-list":
      return <StatListInput value={value as { number: string; label: string }[]} onChange={onChange} />;
    case "subject-list":
      return <KVListInput value={(value as { value: string; label: string }[])?.map((o) => ({ key: o.value, val: o.label }))} onChange={(v) => onChange((v as { key: string; val: string }[]).map((kv) => ({ value: kv.key, label: kv.val })))} keyLabel="Värde" valLabel="Etikett" />;
    case "social-list":
      return <KVListInput value={(value as { href: string; label: string }[])?.map((o) => ({ key: o.label, val: o.href }))} onChange={(v) => onChange((v as { key: string; val: string }[]).map((kv) => ({ label: kv.key, href: kv.val })))} keyLabel="Etikett" valLabel="URL" />;
    case "nav-list":
      return <KVListInput value={(value as { label: string; href: string }[])?.map((o) => ({ key: o.label, val: o.href }))} onChange={(v) => onChange((v as { key: string; val: string }[]).map((kv) => ({ label: kv.key, href: kv.val })))} keyLabel="Etikett" valLabel="Länk" />;
    default:
      return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
  }
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const upload = async (f: File) => {
    setUp(true);
    const ext = f.name.split(".").pop();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("darek-images").upload(name, f, { cacheControl: "31536000" });
    if (error) { alert("Uppladdningsfel: " + error.message); setUp(false); return; }
    const url = supabase.storage.from("darek-images").getPublicUrl(name).data.publicUrl;
    onChange(url); setUp(false);
  };
  return (
    <div className="flex items-start gap-3">
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="w-24 h-24 rounded-lg object-cover bg-gray-100" />
          <button onClick={() => onChange("")} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()} className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-900 hover:bg-gray-50">
          {up ? <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /> : <><Upload className="w-4 h-4 text-gray-400" /><span className="text-[10px] text-gray-500 mt-1">Ladda upp</span></>}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="eller klistra in URL" className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200" />
    </div>
  );
}

function ImageListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const list = value || [];
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList) => {
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const ext = f.name.split(".").pop();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("darek-images").upload(name, f, { cacheControl: "31536000" });
      if (error) { alert(error.message); continue; }
      urls.push(supabase.storage.from("darek-images").getPublicUrl(name).data.publicUrl);
    }
    onChange([...list, ...urls]);
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {list.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url} alt="" className="w-full aspect-square rounded-lg object-cover bg-gray-100" />
            <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={() => inputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-900 hover:text-gray-900">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
    </div>
  );
}

function TextListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const list = value || [];
  return (
    <div className="space-y-2">
      {list.map((t, i) => (
        <div key={i} className="flex gap-2">
          <GripVertical className="w-4 h-4 text-gray-300 mt-3 flex-shrink-0" />
          <textarea value={t} onChange={(e) => { const n = [...list]; n[i] = e.target.value; onChange(n); }}
            rows={3} placeholder={placeholder} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, ""])} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium">
        <Plus className="w-4 h-4" /> Lägg till stycke
      </button>
    </div>
  );
}

function KVListInput({ value, onChange, keyLabel, valLabel }: { value: { key: string; val: string }[]; onChange: (v: { key: string; val: string }[]) => void; keyLabel: string; valLabel: string }) {
  const list = value || [];
  return (
    <div className="space-y-2">
      {list.map((kv, i) => (
        <div key={i} className="flex gap-2">
          <input type="text" value={kv.key} onChange={(e) => { const n = [...list]; n[i] = { ...kv, key: e.target.value }; onChange(n); }}
            placeholder={keyLabel} className="w-1/3 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <input type="text" value={kv.val} onChange={(e) => { const n = [...list]; n[i] = { ...kv, val: e.target.value }; onChange(n); }}
            placeholder={valLabel} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { key: "", val: "" }])} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium">
        <Plus className="w-4 h-4" /> Lägg till
      </button>
    </div>
  );
}

function StatListInput({ value, onChange }: { value: { number: string; label: string }[]; onChange: (v: { number: string; label: string }[]) => void }) {
  const list = value || [];
  return (
    <div className="space-y-2">
      {list.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input type="text" value={s.number} onChange={(e) => { const n = [...list]; n[i] = { ...s, number: e.target.value }; onChange(n); }}
            placeholder="Siffra (5+)" className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <input type="text" value={s.label} onChange={(e) => { const n = [...list]; n[i] = { ...s, label: e.target.value }; onChange(n); }}
            placeholder="Etikett (År aktiv)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...list, { number: "", label: "" }])} className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium">
        <Plus className="w-4 h-4" /> Lägg till
      </button>
    </div>
  );
}
