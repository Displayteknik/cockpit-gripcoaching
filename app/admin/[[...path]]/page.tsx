"use client";

import { useState, useEffect, useCallback } from "react";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { puckConfig } from "@/lib/puck-config";
import { supabase, type PageData } from "@/lib/supabase";

const emptyData: Data = {
  content: [],
  root: { props: { title: "Ny sida" } },
};

export default function AdminEditor() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string>("index");
  const [pageData, setPageData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");

  const loadPages = useCallback(async () => {
    const { data } = await supabase
      .from("hm_pages")
      .select("*")
      .order("title", { ascending: true });
    setPages(data || []);
  }, []);

  const loadPage = useCallback(async (slug: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("hm_pages")
      .select("*")
      .eq("slug", slug)
      .single();

    if (data) {
      setPageData(data.data as Data);
    } else {
      setPageData(emptyData);
    }
    setCurrentSlug(slug);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPages().then(() => loadPage("index"));
  }, [loadPages, loadPage]);

  const handlePublish = async (data: Data) => {
    const title =
      (data.root?.props as Record<string, string>)?.title || currentSlug;

    const { error } = await supabase.from("hm_pages").upsert(
      {
        slug: currentSlug,
        title,
        data,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );

    if (error) {
      alert("Kunde inte spara: " + error.message);
    } else {
      alert("Sidan sparades!");
      loadPages();
    }
  };

  const handleCreatePage = async () => {
    if (!newPageSlug || !newPageTitle) return;
    const slug = newPageSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { error } = await supabase.from("hm_pages").insert({
      slug, title: newPageTitle, data: emptyData, is_published: false,
    });
    if (error) { alert("Kunde inte skapa sida: " + error.message); return; }
    setNewPageSlug(""); setNewPageTitle(""); setShowNewForm(false);
    await loadPages();
    loadPage(slug);
  };

  const switchPage = (slug: string) => {
    if (slug === "__new__") {
      setShowNewForm(true);
      return;
    }
    setShowNewForm(false);
    loadPage(slug);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Laddar editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen relative">
      {/* Top toolbar with prominent page selector */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-[#1a1f2e] text-white h-11 flex items-center px-4 text-sm gap-3 shadow-lg">
        <span className="font-bold text-blue-400 flex-shrink-0">HM Motor</span>
        <span className="text-gray-600">|</span>

        {/* Page selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs">Sida:</span>
          <select
            value={currentSlug}
            onChange={(e) => switchPage(e.target.value)}
            className="bg-[#2a3040] border border-gray-600 rounded-md px-3 py-1 text-sm text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none cursor-pointer min-w-[180px]"
          >
            {pages.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} — /{p.slug === "index" ? "" : p.slug}
              </option>
            ))}
            <option value="__new__">+ Skapa ny sida...</option>
          </select>
        </div>

        {/* New page inline form */}
        {showNewForm && (
          <div className="flex items-center gap-2 ml-2 bg-[#2a3040] rounded-lg px-3 py-1 border border-gray-600">
            <input
              type="text"
              placeholder="Titel"
              value={newPageTitle}
              onChange={(e) => {
                setNewPageTitle(e.target.value);
                setNewPageSlug(e.target.value.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
              }}
              className="bg-transparent border-none outline-none text-sm w-28 placeholder:text-gray-500"
              autoFocus
            />
            <span className="text-gray-500 text-xs">/</span>
            <input
              type="text"
              placeholder="slug"
              value={newPageSlug}
              onChange={(e) => setNewPageSlug(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-24 placeholder:text-gray-500"
            />
            <button
              onClick={handleCreatePage}
              disabled={!newPageSlug || !newPageTitle}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-2.5 py-0.5 rounded text-xs font-medium transition-colors"
            >
              Skapa
            </button>
            <button
              onClick={() => { setShowNewForm(false); setCurrentSlug(pages[0]?.slug || "index"); }}
              className="text-gray-500 hover:text-white p-0.5"
            >
              ✕
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-4">
          <a href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">
            Dashboard
          </a>
          <a
            href={currentSlug === "index" ? "/" : `/${currentSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Visa live &rarr;
          </a>
        </div>
      </div>

      {/* Puck editor */}
      <div className="pt-11 h-screen">
        <Puck config={puckConfig} data={pageData} onPublish={handlePublish} />
      </div>
    </div>
  );
}
