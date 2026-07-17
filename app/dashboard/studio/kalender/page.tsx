"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileEdit, FolderOpen, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { FORMAT_DIMENSIONS, type StudioFormat } from "@/lib/studio/payload";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface StudioPost {
  id: string; template_id: string; format: StudioFormat; title: string;
  image_url: string | null; payload: Record<string, unknown>; updated_at: string;
  ghl_status: string | null; scheduled_at: string | null;
}

const DEFAULT_COLOR = "#1A6B3C";

function encodePayload(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fmt(d: string | null): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return d; }
}

export default function StudioKalenderPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const primary = client?.primary_color || DEFAULT_COLOR;

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/studio/posts");
      const d = await r.json();
      setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh, client]);

  const groups = useMemo(() => {
    const scheduled = posts.filter((p) => p.ghl_status === "scheduled").sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""));
    const drafts = posts.filter((p) => p.ghl_status === "draft");
    const saved = posts.filter((p) => !p.ghl_status);
    return { scheduled, drafts, saved };
  }, [posts]);

  const Card = ({ p }: { p: StudioPost }) => {
    const { w: pw, h: ph } = FORMAT_DIMENSIONS[p.format] ?? FORMAT_DIMENSIONS["1080x1350"];
    const cardW = 130; const s = cardW / pw;
    return (
      <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
        <div className="bg-gray-100 overflow-hidden mx-auto" style={{ width: cardW, height: ph * s }}>
          <iframe title={p.title} scrolling="no" src={`/studio/render/${p.template_id}?p=${encodeURIComponent(encodePayload(p.payload))}`}
            style={{ width: pw, height: ph, border: 0, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }} />
        </div>
        <div className="p-2 space-y-1">
          <div className="text-xs font-semibold text-gray-800 truncate" title={p.title}>{p.title}</div>
          {p.scheduled_at && <div className="text-xs" style={{ color: primary }}>{fmt(p.scheduled_at)}</div>}
          <a href="/dashboard/studio" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><FolderOpen className="w-3 h-3" /> Öppna</a>
        </div>
      </div>
    );
  };

  const Section = ({ title, icon, items, hint }: { title: string; icon: React.ReactNode; items: StudioPost[]; hint: string }) => (
    <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="font-display font-bold text-gray-900 text-lg">{title}</h2>
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">{hint}</p>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400">Inget här ännu.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((p) => <Card key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
              <CalendarClock className="w-6 h-6" style={{ color: primary }} />
            </span>
            <div>
              <h1 className="font-display font-bold text-2xl text-gray-900">Publiceringsöversikt</h1>
              <p className="text-sm text-gray-500">Schemalagda, utkast och sparade inlägg. {client ? `Klient: ${client.name}` : ""}</p>
            </div>
          </div>
          <button onClick={refresh} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Uppdatera
          </button>
        </div>

        <Section title="Schemalagda" icon={<CalendarClock className="w-5 h-5" style={{ color: primary }} />} items={groups.scheduled}
          hint="Ligger i GHL Social Planner med publiceringstid. Redigera/ställ in i GHL." />
        <Section title="Utkast i GHL" icon={<FileEdit className="w-5 h-5" style={{ color: primary }} />} items={groups.drafts}
          hint="Skapade som utkast i GHL — granska och publicera/schemalägg där." />
        <Section title="Sparade (ej publicerade)" icon={<FolderOpen className="w-5 h-5" style={{ color: primary }} />} items={groups.saved}
          hint="I biblioteket, ännu inte skickade till GHL. Öppna i Studio för att publicera eller schemalägga." />

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <ExternalLink className="w-3.5 h-3.5" /> Publiceringstider och slutlig publicering hanteras i GHL Social Planner.
        </p>
      </div>
    </div>
  );
}
