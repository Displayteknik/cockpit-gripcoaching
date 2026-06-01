"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, Save, Rocket, ArrowUp, ArrowDown, ExternalLink, Wand2, X, MousePointerClick } from "lucide-react";

type Partner = { name: string; url: string; logo: string; initials: string; wide: boolean };
type Klass = { namn: string; spec: string };
type Oppet = { dag: string; tid: string };
type Content = {
  hero?: { tagline?: string };
  eventet?: { lead1?: string; lead2?: string };
  historien?: { p1?: string; p2?: string; p3?: string; avslut?: string };
  oppettider?: Oppet[];
  klasser?: Klass[];
  partners?: Partner[];
};

const LABELS: Record<string, string> = {
  "hero.tagline": "Slogan (hero)",
  "eventet.lead1": "Intro – stycke 1",
  "eventet.lead2": "Intro – stycke 2",
  "historien.p1": "Historien – stycke 1",
  "historien.p2": "Historien – stycke 2",
  "historien.p3": "Historien – stycke 3",
  "historien.avslut": "Historien – avslutning",
  oppettider: "Öppettider",
  klasser: "Tävlingsklasser",
  partners: "Partners & sponsorer",
};

const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
const LBL = "block text-xs font-semibold text-gray-500 mb-1";
const BTN_SM = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium";

function getText(c: Content, key: string): string {
  const [a, b] = key.split(".");
  // @ts-expect-error nested
  return (c?.[a]?.[b] ?? "") as string;
}
function setText(c: Content, key: string, val: string): Content {
  const [a, b] = key.split(".");
  const next = structuredClone(c);
  // @ts-expect-error nested
  next[a] = { ...(next[a] || {}), [b]: val };
  return next;
}

export default function HaydaysPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [rev, setRev] = useState(0); // tvingar omladdning av preview
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/api/haydays/content")
      .then((r) => (r.status === 403 ? Promise.reject("forbidden") : r.json()))
      .then((c) => { setContent(c || {}); setLoading(false); })
      .catch(() => { setForbidden(true); setLoading(false); });
  }, []);

  // Lyssna på klick i preview-iframen
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "hd-edit" && typeof e.data.key === "string") setEditKey(e.data.key);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const save = useCallback(async (next: Content) => {
    setSaving(true);
    const r = await fetch("/api/haydays/content", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: next }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.ok) { setContent(next); setRev((v) => v + 1); flash("Sparat ✓ – förhandsvisningen uppdateras"); }
    else flash(j.error || "Kunde inte spara");
  }, []);

  const publish = async () => {
    setPublishing(true);
    const r = await fetch("/api/haydays/publish", { method: "POST" });
    const j = await r.json();
    setPublishing(false);
    flash(j.message || j.error || "Publicering startad");
  };

  if (loading) return <div className="text-gray-500 py-12 text-center">Laddar…</div>;
  if (forbidden) return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Välj Hay Days-klienten</h1>
      <p className="text-gray-600">Byt aktiv klient till <strong>Scandinavian Hay Days</strong> i sidomenyn för att redigera sajten.</p>
    </div>
  );

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col -mt-2">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-gray-200">
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">Hay Days-sajten</h1>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <MousePointerClick className="w-3.5 h-3.5" /> Klicka på en text eller sektion i sajten för att redigera den
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-gray-600 mr-1">{msg}</span>}
          <a href="https://scandinavian-haydays.netlify.app" target="_blank" rel="noopener"
             className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 px-2">
            <ExternalLink className="w-4 h-4" /> Visa live
          </a>
          <button onClick={publish} disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            <Rocket className="w-4 h-4" /> {publishing ? "Publicerar…" : "Publicera"}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 relative bg-gray-100 rounded-b-xl overflow-hidden">
        <iframe
          ref={iframeRef}
          key={rev}
          src={`/api/haydays/preview?rev=${rev}`}
          className="w-full h-full border-0 bg-white"
          title="Förhandsvisning"
        />
      </div>

      {/* Drawer */}
      {editKey && content && (
        <EditDrawer
          editKey={editKey}
          content={content}
          saving={saving}
          onClose={() => setEditKey(null)}
          onSave={(next) => { save(next); setEditKey(null); }}
        />
      )}
    </div>
  );
}

function EditDrawer({ editKey, content, saving, onClose, onSave }: {
  editKey: string; content: Content; saving: boolean;
  onClose: () => void; onSave: (c: Content) => void;
}) {
  const [draft, setDraft] = useState<Content>(() => structuredClone(content));
  const isText = editKey.includes(".");

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-display font-bold text-gray-900">{LABELS[editKey] || editKey}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isText && <TextEditor editKey={editKey} draft={draft} setDraft={setDraft} />}
          {editKey === "oppettider" && <OppetEditor draft={draft} setDraft={setDraft} />}
          {editKey === "klasser" && <KlassEditor draft={draft} setDraft={setDraft} />}
          {editKey === "partners" && <PartnerEditor draft={draft} setDraft={setDraft} />}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-2">
          <button onClick={() => onSave(draft)} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "Sparar…" : "Spara"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Avbryt</button>
        </div>
      </div>
    </>
  );
}

function TextEditor({ editKey, draft, setDraft }: { editKey: string; draft: Content; setDraft: (c: Content) => void }) {
  const allowsBold = editKey === "historien.p3" || editKey === "historien.avslut";
  const val = getText(draft, editKey);
  const rows = editKey === "hero.tagline" || editKey === "historien.avslut" ? 2 : 5;
  return (
    <div>
      <label className={LBL}>Text</label>
      <textarea
        className={INPUT}
        style={{ minHeight: rows * 28 }}
        value={val}
        onChange={(e) => setDraft(setText(draft, editKey, e.target.value))}
      />
      {allowsBold && <p className="text-xs text-gray-400 mt-1">Tips: omge ord med &lt;strong&gt;…&lt;/strong&gt; för fetstil.</p>}
    </div>
  );
}

function OppetEditor({ draft, setDraft }: { draft: Content; setDraft: (c: Content) => void }) {
  const list = draft.oppettider || [];
  const upd = (next: Oppet[]) => setDraft({ ...draft, oppettider: next });
  return (
    <div className="space-y-3">
      {list.map((o, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input className={INPUT} placeholder="Dag" value={o.dag}
            onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, dag: e.target.value } : x))} />
          <input className={INPUT} placeholder="Tid" value={o.tid}
            onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, tid: e.target.value } : x))} />
          <button className={`${BTN_SM} text-red-500 hover:bg-red-50`} onClick={() => upd(list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button className={`${BTN_SM} text-blue-600 hover:bg-blue-50`} onClick={() => upd([...list, { dag: "", tid: "" }])}><Plus className="w-4 h-4" /> Lägg till dag</button>
    </div>
  );
}

function KlassEditor({ draft, setDraft }: { draft: Content; setDraft: (c: Content) => void }) {
  const list = draft.klasser || [];
  const upd = (next: Klass[]) => setDraft({ ...draft, klasser: next });
  const move = (i: number, d: number) => { const n = [...list]; const t = n[i + d]; if (!t) return; n[i + d] = n[i]; n[i] = t; upd(n); };
  return (
    <div className="space-y-3">
      {list.map((k, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input className={INPUT} placeholder="Klass" value={k.namn}
            onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, namn: e.target.value } : x))} />
          <input className={INPUT} placeholder="Spec (valfri)" value={k.spec}
            onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, spec: e.target.value } : x))} />
          <div className="flex flex-col">
            <button className={`${BTN_SM} text-gray-400 hover:bg-gray-100 py-0.5`} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button className={`${BTN_SM} text-gray-400 hover:bg-gray-100 py-0.5`} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>
          <button className={`${BTN_SM} text-red-500 hover:bg-red-50`} onClick={() => upd(list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button className={`${BTN_SM} text-blue-600 hover:bg-blue-50`} onClick={() => upd([...list, { namn: "", spec: "" }])}><Plus className="w-4 h-4" /> Lägg till klass</button>
    </div>
  );
}

function PartnerEditor({ draft, setDraft }: { draft: Content; setDraft: (c: Content) => void }) {
  const list = draft.partners || [];
  const upd = (next: Partner[]) => setDraft({ ...draft, partners: next });
  const move = (i: number, d: number) => { const n = [...list]; const t = n[i + d]; if (!t) return; n[i + d] = n[i]; n[i] = t; upd(n); };
  const autoLogo = (i: number) => {
    const p = list[i];
    try {
      const host = new URL(p.url).hostname.replace(/^www\./, "");
      upd(list.map((x, j) => j === i ? { ...x, logo: `https://www.google.com/s2/favicons?domain=${host}&sz=128` } : x));
    } catch { /* ogiltig url */ }
  };
  return (
    <div className="space-y-4">
      {list.map((p, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button className={`${BTN_SM} text-gray-400 hover:bg-gray-100`} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></button>
              <button className={`${BTN_SM} text-gray-400 hover:bg-gray-100`} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></button>
              <button className={`${BTN_SM} text-red-500 hover:bg-red-50`} onClick={() => upd(list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <input className={INPUT} placeholder="Namn" value={p.name}
            onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
          <div className="flex gap-2">
            <input className={INPUT} placeholder="https://… (valfri)" value={p.url}
              onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
            <button className={`${BTN_SM} text-blue-600 hover:bg-blue-50 whitespace-nowrap`} onClick={() => autoLogo(i)} title="Hämta logga från webbadressen"><Wand2 className="w-4 h-4" /> Logga</button>
          </div>
          <div className="flex gap-2">
            <input className={INPUT} placeholder="Logga-URL (valfri)" value={p.logo}
              onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, logo: e.target.value } : x))} />
            <input className={`${INPUT} w-20`} placeholder="Init." value={p.initials}
              onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, initials: e.target.value } : x))} />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={!!p.wide}
              onChange={(e) => upd(list.map((x, j) => j === i ? { ...x, wide: e.target.checked } : x))} />
            Bred logga
          </label>
        </div>
      ))}
      <button className={`${BTN_SM} text-blue-600 hover:bg-blue-50`} onClick={() => upd([...list, { name: "", url: "", logo: "", initials: "", wide: false }])}><Plus className="w-4 h-4" /> Lägg till partner</button>
    </div>
  );
}
