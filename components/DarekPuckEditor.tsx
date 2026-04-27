"use client";

import { useEffect, useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfig } from "@/lib/puck-config";

const emptyData: Data = { content: [], root: { props: { title: "Darek Uhrberg — Konstnär" } } };

export default function DarekPuckEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/darek/puck")
      .then((r) => r.json())
      .then((d: Data) => {
        setData(d.content?.length ? d : emptyData);
        setLoading(false);
      })
      .catch(() => { setData(emptyData); setLoading(false); });
  }, []);

  const handlePublish = async (puckData: Data) => {
    setSaving(true); setMsg("Sparar...");
    const r = await fetch("/api/darek/puck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(puckData) });
    if (!r.ok) { setSaving(false); setMsg("Spar-fel: " + (await r.text())); return; }
    setMsg("Sparat ✓ Triggar publicering...");
    // Auto-trigga Netlify deploy efter sparning
    const pub = await fetch("/api/darek/publish", { method: "POST" });
    const pj = await pub.json();
    setSaving(false);
    if (!pub.ok) { setMsg("Sparat men publicering misslyckades: " + pj.error); return; }
    setMsg("✓ Sparat + bygget startat — darekuhrberg.se uppdateras om ~1 min");
    setTimeout(() => setMsg(null), 12000);
  };

  const publishToSite = async () => {
    setPublishing(true);
    const r = await fetch("/api/darek/publish", { method: "POST" });
    const j = await r.json();
    setPublishing(false);
    setMsg(j.message || j.error);
    setTimeout(() => setMsg(null), 8000);
  };

  if (loading || !data) return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Laddar editor...</div></div>;

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold text-sm">Darek Uhrberg — Sajt-editor</span>
          {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="text-xs text-gray-300 hover:text-white">← Tillbaka till cockpit</a>
          <a href="https://darekuhrberg.se" target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs border border-white/20 rounded hover:bg-white/10">Visa publik sajt</a>
          <button onClick={publishToSite} disabled={publishing} className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded disabled:opacity-50">
            {publishing ? "Publicerar..." : "Publicera till sajt"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <Puck config={puckConfig} data={data} onPublish={handlePublish} />
        {saving && <div className="fixed top-16 right-6 bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg z-50">Sparar...</div>}
      </div>
    </div>
  );
}
