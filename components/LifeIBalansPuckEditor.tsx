"use client";

// Life i Balans Puck-editor — samma lagringsmodell som AdminEditor (hm_pages,
// klient-medveten via aktiv client_id) men med Örtagård-configen.

import { useState, useEffect, useCallback } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfigLifeibalans } from "@/lib/puck-config-lifeibalans";
import { LIB_HOME_DATA } from "@/lib/puck-lifeibalans-default";
import { supabase, type PageData } from "@/lib/supabase";

const emptyData: Data = { content: [], root: { props: { title: "Ny sida" } } };

export default function LifeIBalansPuckEditor() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string>("index");
  const [pageData, setPageData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const loadPages = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase.from("hm_pages").select("*").eq("client_id", clientId).order("title", { ascending: true });
    setPages(data || []);
  }, [clientId]);

  const loadPage = useCallback(async (slug: string) => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase.from("hm_pages").select("*").eq("client_id", clientId).eq("slug", slug).single();
    setPageData(data ? (data.data as Data) : slug === "index" ? LIB_HOME_DATA : emptyData);
    setCurrentSlug(slug);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId) loadPages().then(() => loadPage("index"));
  }, [loadPages, loadPage, clientId]);

  const handlePublish = async (data: Data) => {
    if (!clientId) return;
    const title = (data.root?.props as Record<string, string>)?.title || currentSlug;
    const { error } = await supabase.from("hm_pages").upsert(
      { client_id: clientId, slug: currentSlug, title, data, is_published: true, updated_at: new Date().toISOString() },
      { onConflict: "client_id,slug" }
    );
    if (error) alert("Kunde inte spara: " + error.message);
    else { alert("Sidan sparades!"); loadPages(); }
  };

  const handleCreatePage = async () => {
    if (!newPageSlug || !newPageTitle || !clientId) return;
    const slug = newPageSlug.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { error } = await supabase.from("hm_pages").insert({ client_id: clientId, slug, title: newPageTitle, data: emptyData, is_published: false });
    if (error) { alert("Kunde inte skapa sida: " + error.message); return; }
    setNewPageSlug(""); setNewPageTitle(""); setShowNewForm(false);
    await loadPages(); loadPage(slug);
  };

  const switchPage = (slug: string) => {
    if (slug === "__new__") { setShowNewForm(true); return; }
    setShowNewForm(false); loadPage(slug);
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Laddar editor...</div></div>;
  }

  return (
    <div className="h-screen relative">
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#26332a] text-white h-11 flex items-center px-4 text-sm gap-3 shadow-lg">
        <span className="font-bold text-amber-300 flex-shrink-0">Life i Balans</span>
        <span className="text-white/30">|</span>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">Sida:</span>
          <select value={currentSlug} onChange={(e) => switchPage(e.target.value)} className="bg-[#31402f] border border-white/20 rounded-md px-3 py-1 text-sm text-white outline-none cursor-pointer min-w-[180px]">
            {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title} — /{p.slug === "index" ? "" : p.slug}</option>)}
            <option value="__new__">+ Skapa ny sida...</option>
          </select>
        </div>
        {showNewForm && (
          <div className="flex items-center gap-2 ml-2 bg-[#31402f] rounded-lg px-3 py-1 border border-white/20">
            <input type="text" placeholder="Titel" value={newPageTitle} onChange={(e) => { setNewPageTitle(e.target.value); setNewPageSlug(e.target.value.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} className="bg-transparent border-none outline-none text-sm w-28 placeholder:text-white/40" autoFocus />
            <span className="text-white/40 text-xs">/</span>
            <input type="text" placeholder="slug" value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} className="bg-transparent border-none outline-none text-sm w-24 placeholder:text-white/40" />
            <button onClick={handleCreatePage} disabled={!newPageSlug || !newPageTitle} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black px-2.5 py-0.5 rounded text-xs font-medium">Skapa</button>
            <button onClick={() => { setShowNewForm(false); setCurrentSlug(pages[0]?.slug || "index"); }} className="text-white/50 hover:text-white p-0.5">✕</button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-4">
          <a href="/dashboard" className="text-xs text-white/60 hover:text-white transition-colors">Dashboard</a>
          <a href={`https://lifeibalans.se${currentSlug === "index" ? "" : "/" + currentSlug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white transition-colors">Visa live →</a>
        </div>
      </div>
      <div className="pt-11 h-screen">
        <Puck key={currentSlug} config={puckConfigLifeibalans} data={pageData} onPublish={handlePublish} />
      </div>
    </div>
  );
}
