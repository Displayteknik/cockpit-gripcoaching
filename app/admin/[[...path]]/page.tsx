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
  const [showPageList, setShowPageList] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");

  // Load page list
  const loadPages = useCallback(async () => {
    const { data } = await supabase
      .from("hm_pages")
      .select("*")
      .order("title", { ascending: true });
    setPages(data || []);
  }, []);

  // Load specific page
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

  // Save page
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

  // Create new page
  const handleCreatePage = async () => {
    if (!newPageSlug || !newPageTitle) return;

    const slug = newPageSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    const { error } = await supabase.from("hm_pages").insert({
      slug,
      title: newPageTitle,
      data: emptyData,
      is_published: false,
    });

    if (error) {
      alert("Kunde inte skapa sida: " + error.message);
      return;
    }

    setNewPageSlug("");
    setNewPageTitle("");
    setShowPageList(false);
    await loadPages();
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
      {/* Page selector toolbar */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-gray-900 text-white h-10 flex items-center px-4 text-sm gap-4">
        <span className="font-bold text-blue-400">HM Motor Editor</span>
        <span className="text-gray-500">|</span>

        <button
          onClick={() => setShowPageList(!showPageList)}
          className="flex items-center gap-2 hover:text-blue-300 transition-colors"
        >
          <span>
            Sida: <strong>{currentSlug}</strong>
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${showPageList ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Page dropdown */}
        {showPageList && (
          <div className="absolute top-10 left-0 w-80 bg-gray-800 border border-gray-700 rounded-b-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-3 border-b border-gray-700">
              <h3 className="font-semibold mb-2">Sidor</h3>
              {pages.map((page) => (
                <button
                  key={page.slug}
                  onClick={() => {
                    loadPage(page.slug);
                    setShowPageList(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors flex items-center justify-between ${
                    page.slug === currentSlug ? "bg-blue-600" : ""
                  }`}
                >
                  <span>{page.title}</span>
                  <span className="text-xs text-gray-400">/{page.slug}</span>
                </button>
              ))}
            </div>

            <div className="p-3">
              <h3 className="font-semibold mb-2 text-sm">Skapa ny sida</h3>
              <input
                type="text"
                placeholder="Titel"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm mb-2"
              />
              <input
                type="text"
                placeholder="URL-slug (t.ex. om-oss)"
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm mb-2"
              />
              <button
                onClick={handleCreatePage}
                disabled={!newPageSlug || !newPageTitle}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-1.5 rounded text-sm font-medium transition-colors"
              >
                Skapa sida
              </button>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
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
      <div className="pt-10 h-screen">
        <Puck
          config={puckConfig}
          data={pageData}
          onPublish={handlePublish}
        />
      </div>
    </div>
  );
}
