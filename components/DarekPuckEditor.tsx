"use client";

import { useEffect, useState } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfigDarek as puckConfig } from "@/lib/puck-config-darek";

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
    <div className="h-screen relative">
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#1a1f2e] text-white h-11 flex items-center px-4 text-sm gap-3 shadow-lg">
        <span className="font-bold text-amber-400 flex-shrink-0">Darek Uhrberg</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400 text-xs">Sajt-editor</span>
        {msg && <span className="text-xs text-emerald-300 ml-3">{msg}</span>}
        <div className="ml-auto flex items-center gap-2">
          <a href="/dashboard" className="text-xs text-gray-300 hover:text-white">← Cockpit</a>
          <a href="https://darekuhrberg.se" target="_blank" rel="noreferrer" className="px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10">Visa live →</a>
          <button onClick={publishToSite} disabled={publishing} className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded disabled:opacity-50">
            {publishing ? "Publicerar..." : "Publicera till sajt"}
          </button>
        </div>
      </div>
      <div className="pt-11 h-screen">
        <Puck config={puckConfig} data={data} onPublish={handlePublish} />
      </div>
    </div>
  );
}
