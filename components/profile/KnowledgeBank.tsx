"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  Quote,
  Link as LinkIcon,
  Upload,
  Trash2,
  Loader2,
  Sparkles,
  Plus,
  X,
  Check,
} from "lucide-react";

type AssetType = "post" | "photo" | "audio" | "video" | "testimonial" | "link" | "document";

interface Asset {
  id: string;
  asset_type: AssetType;
  category: string | null;
  title: string | null;
  body: string | null;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_bytes: number | null;
  duration_s: number | null;
  person_name: string | null;
  person_label: string | null;
  ai_summary: string | null;
  status: string;
  signed_url?: string;
  created_at: string;
}

const TABS: { key: AssetType; label: string; icon: React.ComponentType<{ className?: string }>; hint: string; minRecommended: number }[] = [
  { key: "post", label: "Egna inlägg", icon: FileText, hint: "Klistra in 5–10 av kundens egna inlägg. AI:n imiterar deras röst.", minRecommended: 5 },
  { key: "photo", label: "Foton", icon: ImageIcon, hint: "Person, lokal, process, kunder. Slår alla stockfoton.", minRecommended: 5 },
  { key: "audio", label: "Ljud", icon: Mic, hint: "Inspelningar där kunden pratar. Transkriberas automatiskt.", minRecommended: 1 },
  { key: "video", label: "Video", icon: Video, hint: "Korta klipp där personen är i bild. Transkriberas automatiskt.", minRecommended: 1 },
  { key: "testimonial", label: "Vittnesmål", icon: Quote, hint: "Riktiga citat från kunder med namn eller initialer.", minRecommended: 3 },
  { key: "link", label: "Länkar", icon: LinkIcon, hint: "Podcast, artikel, YouTube — där kunden uttalar sig.", minRecommended: 0 },
];

export default function KnowledgeBank({ onChange }: { onChange?: () => void }) {
  const [activeTab, setActiveTab] = useState<AssetType>("post");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [counts, setCounts] = useState<Record<AssetType, number>>({} as Record<AssetType, number>);
  const [loading, setLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const r = await fetch("/api/assets");
      const d = await r.json();
      if (d.assets) {
        setAssets(d.assets as Asset[]);
        const c = TABS.reduce((acc, t) => ({ ...acc, [t.key]: 0 }), {} as Record<AssetType, number>);
        for (const a of d.assets as Asset[]) c[a.asset_type] = (c[a.asset_type] || 0) + 1;
        setCounts(c);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function refresh() {
    loadAll();
    onChange?.();
  }

  const filtered = assets.filter((a) => a.asset_type === activeTab);
  const tab = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">
              Kunskapsbank — kundens råmaterial
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Allt som matas in här används av generatorn och Coach för att skriva i exakt
              kundens röst — sparas på klienten och stannar där.
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = counts[t.key] || 0;
          const isActive = activeTab === t.key;
          const meets = count >= t.minRecommended;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:bg-white/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  meets && t.minRecommended > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : count > 0
                    ? "bg-gray-200 text-gray-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
                {t.minRecommended > 0 && `/${t.minRecommended}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-5">
        <div className="text-sm text-gray-600 mb-4">{tab.hint}</div>

        {activeTab === "post" && <PostEditor onCreated={refresh} />}
        {activeTab === "testimonial" && <TestimonialEditor onCreated={refresh} />}
        {activeTab === "link" && <LinkEditor onCreated={refresh} />}
        {(activeTab === "photo" || activeTab === "audio" || activeTab === "video") && (
          <FileUploader assetType={activeTab} onUploaded={refresh} />
        )}

        <div className="mt-6 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-sm text-gray-400 italic py-6 text-center">
              Inget tillagt ännu. Lägg till ovan.
            </div>
          ) : (
            filtered.map((a) => <AssetCard key={a.id} asset={a} onChanged={refresh} />)
          )}
        </div>
      </div>
    </div>
  );
}

function PostEditor({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    // Splittar på rader med dubbla nyrader → flera inlägg
    const blocks = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 30);
    const items = blocks.length > 0 ? blocks : [text.trim()];
    for (const body of items) {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_type: "post", body, title: body.slice(0, 80) }),
      });
    }
    setText("");
    setBusy(false);
    onCreated();
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Klistra in ett eller flera inlägg. Separera flera inlägg med en blank rad."
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body leading-relaxed focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy || !text.trim()}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Lägg till
        </button>
      </div>
    </div>
  );
}

function TestimonialEditor({ onCreated }: { onCreated: () => void }) {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!body.trim()) return;
    setBusy(true);
    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_type: "testimonial",
        body,
        person_name: name || null,
        person_label: label || null,
      }),
    });
    setBody("");
    setName("");
    setLabel("");
    setBusy(false);
    onCreated();
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder='"Citat från kund — vad de sa, ordagrant."'
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Namn (eller initialer)"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-amber-500"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Beskrivning, t.ex. 'kund Krokom, 45'"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-amber-500"
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy || !body.trim()}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Lägg till vittnesmål
        </button>
      </div>
    </div>
  );
}

function LinkEditor({ onCreated }: { onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!url.trim()) return;
    setBusy(true);
    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_type: "link", source_url: url, title: title || url }),
    });
    setUrl("");
    setTitle("");
    setBusy(false);
    onCreated();
  }

  return (
    <div className="space-y-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Beskrivning (valfritt)"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-blue-500"
      />
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={busy || !url.trim()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Lägg till länk
        </button>
      </div>
    </div>
  );
}

function FileUploader({ assetType, onUploaded }: { assetType: AssetType; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const accept =
    assetType === "photo" ? "image/*" : assetType === "audio" ? "audio/*" : assetType === "video" ? "video/*" : "*/*";

  async function handleFiles(files: FileList) {
    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Laddar upp ${i + 1}/${files.length}: ${file.name}`);
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/assets/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.error) {
        alert(`Fel: ${d.error}`);
        continue;
      }
      // Auto-transkribera audio/video
      if ((assetType === "audio" || assetType === "video") && d.asset?.id) {
        setProgress(`Transkriberar ${i + 1}/${files.length}...`);
        await fetch("/api/assets/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.asset.id }),
        });
      }
    }
    setProgress("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    onUploaded();
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-lg p-6 flex flex-col items-center gap-2 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-6 h-6 animate-spin text-gray-400" /> : <Upload className="w-6 h-6 text-gray-400" />}
        <span className="text-sm text-gray-600 font-medium">
          {busy ? progress || "Laddar upp..." : `Ladda upp ${assetType === "photo" ? "foton" : assetType === "audio" ? "ljud" : "video"}`}
        </span>
        <span className="text-xs text-gray-400">Klicka eller dra hit filer</span>
      </button>
    </div>
  );
}

function AssetCard({ asset, onChanged }: { asset: Asset; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  const isImage = asset.asset_type === "photo" && asset.signed_url;
  const isAudio = asset.asset_type === "audio" && asset.signed_url;
  const isVideo = asset.asset_type === "video" && asset.signed_url;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white hover:border-gray-300 transition-colors">
      <div className="flex gap-3">
        {isImage && (
          <img
            src={asset.signed_url}
            alt={asset.title || ""}
            className="w-20 h-20 object-cover rounded-md flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {asset.asset_type === "testimonial" && asset.person_name && (
            <div className="text-xs text-gray-500 mb-1">
              {asset.person_name}
              {asset.person_label && <span className="text-gray-400"> · {asset.person_label}</span>}
            </div>
          )}
          {asset.title && asset.asset_type !== "post" && (
            <div className="font-semibold text-sm text-gray-900 truncate">{asset.title}</div>
          )}
          {asset.body && (
            <div className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{asset.body}</div>
          )}
          {asset.source_url && (
            <a
              href={asset.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline truncate block"
            >
              {asset.source_url}
            </a>
          )}
          {asset.ai_summary && asset.body && (
            <div className="mt-1 text-xs text-purple-600 flex items-start gap-1">
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="italic">{asset.ai_summary}</span>
            </div>
          )}
          {asset.status === "processing" && (
            <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Bearbetar...
            </div>
          )}
          {isAudio && <audio controls src={asset.signed_url} className="mt-2 h-8 w-full max-w-xs" />}
          {isVideo && <video controls src={asset.signed_url} className="mt-2 max-w-xs rounded-md" />}
        </div>
        <div className="flex flex-col gap-1">
          {confirming ? (
            <>
              <button
                onClick={remove}
                disabled={busy}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                title="Bekräfta"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                title="Avbryt"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
              title="Ta bort"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
