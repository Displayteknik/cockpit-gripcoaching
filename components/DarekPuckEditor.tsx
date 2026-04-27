"use client";

import { useEffect, useState, useCallback } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfigDarek as puckConfig } from "@/lib/puck-config-darek";

const emptyData: Data = { content: [], root: { props: { title: "Ny sida" } } };

export default function DarekPuckEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentSlug, setCurrentSlug] = useState("index");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSlug, setNewSlug] = useState("");

  const loadPage = useCallback(async (slug: string) => {
    setLoading(true);
    const r = await fetch(`/api/darek/puck?slug=${slug}`);
    const j = await r.json();
    setData(j.data?.content?.length ? j.data : emptyData);
    setPages(j.pages || []);
    setCurrentSlug(slug);
    setLoading(false);
  }, []);

  useEffect(() => { loadPage("index"); }, [loadPage]);

  const handlePublish = async (puckData: Data) => {
    setSaving(true); setMsg("Sparar...");
    const r = await fetch(`/api/darek/puck?slug=${currentSlug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(puckData) });
    if (!r.ok) { setSaving(false); setMsg("Spar-fel: " + (await r.text())); return; }
    setMsg("Sparat ✓ Triggar publicering...");
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

  const switchPage = (slug: string) => {
    if (slug === "__new__") { setShowNewForm(true); return; }
    setShowNewForm(false);
    loadPage(slug);
  };

  const createPage = async () => {
    if (!newSlug.trim()) return;
    const slug = newSlug.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
    await fetch(`/api/darek/puck?slug=${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emptyData) });
    setNewSlug(""); setShowNewForm(false);
    loadPage(slug);
  };

  const deletePage = async (slug: string) => {
    if (slug === "index") return;
    if (!confirm(`Ta bort sidan /${slug}?`)) return;
    await fetch(`/api/darek/puck?slug=${slug}`, { method: "DELETE" });
    loadPage("index");
  };

  if (loading || !data) return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Laddar editor...</div></div>;

  return (
    <div className="h-screen relative">
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#1a1f2e] text-white h-11 flex items-center px-4 text-sm gap-3 shadow-lg">
        <span className="font-bold text-amber-400 flex-shrink-0">Darek Uhrberg</span>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Sida:</span>
          <select value={currentSlug} onChange={(e) => switchPage(e.target.value)} className="bg-[#2a3040] border border-gray-600 rounded-md px-3 py-1 text-sm text-white focus:border-amber-400 outline-none cursor-pointer min-w-[180px]">
            {pages.includes("index") || <option value="index">Startsida — /</option>}
            {pages.map((s) => <option key={s} value={s}>{s === "index" ? "Startsida — /" : `${s} — /${s}`}</option>)}
            <option value="__new__">+ Skapa ny sida...</option>
          </select>
          {currentSlug !== "index" && <button onClick={() => deletePage(currentSlug)} className="text-xs text-red-300 hover:text-red-100 px-2">Radera</button>}
          {showNewForm && (
            <div className="flex items-center gap-2 ml-2 bg-[#2a3040] rounded-lg px-3 py-1 border border-gray-600">
              <span className="text-gray-500 text-xs">/</span>
              <input type="text" placeholder="slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} autoFocus className="bg-transparent border-none outline-none text-sm w-24 placeholder:text-gray-500" onKeyDown={(e) => e.key === "Enter" && createPage()} />
              <button onClick={createPage} disabled={!newSlug.trim()} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black px-2.5 py-0.5 rounded text-xs font-medium">Skapa</button>
            </div>
          )}
        </div>
        {msg && <span className="text-xs text-emerald-300 ml-3">{msg}</span>}
        <div className="ml-auto flex items-center gap-2">
          <a href="/dashboard" className="text-xs text-gray-300 hover:text-white">← Cockpit</a>
          <a href={`https://darekuhrberg.se${currentSlug === "index" ? "" : "/" + currentSlug}`} target="_blank" rel="noreferrer" className="px-3 py-1 text-xs border border-white/20 rounded hover:bg-white/10">Visa live →</a>
          <button onClick={publishToSite} disabled={publishing} className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded disabled:opacity-50">
            {publishing ? "Publicerar..." : "Publicera till sajt"}
          </button>
        </div>
      </div>
      <div className="pt-11 h-screen">
        <Puck key={currentSlug} config={puckConfig} data={data} onPublish={handlePublish} />
      </div>
    </div>
  );
}
