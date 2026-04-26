"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type PageData } from "@/lib/supabase";
import Link from "next/link";
import { Plus, Pencil, Trash2, ExternalLink, Globe, GlobeLock } from "lucide-react";
import DarekSectionEditor from "@/components/DarekSectionEditor";

export default function SidorRouter() {
  const [resourceModule, setResourceModule] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setResourceModule(c?.resource_module || "automotive"));
  }, []);
  if (resourceModule === null) return <div className="text-center py-12 text-gray-400">Laddar...</div>;
  if (resourceModule === "art") return <DarekSectionEditor />;
  return <SidorDashboardPage />;
}

function SidorDashboardPage() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const loadPages = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("hm_pages")
      .select("*")
      .eq("client_id", clientId)
      .order("title", { ascending: true });
    setPages(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const createPage = async () => {
    if (!newTitle || !newSlug || !clientId) return;
    const slug = newSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    const { error } = await supabase.from("hm_pages").insert({
      client_id: clientId,
      slug,
      title: newTitle,
      data: { content: [], root: { props: { title: newTitle } } },
      is_published: false,
    });

    if (error) {
      alert("Fel: " + error.message);
      return;
    }

    setNewTitle("");
    setNewSlug("");
    setShowNew(false);
    loadPages();
  };

  const deletePage = async (id: string, slug: string) => {
    if (!confirm(`Ta bort sidan "/${slug}"? Detta kan inte ångras.`)) return;
    await supabase.from("hm_pages").delete().eq("id", id).eq("client_id", clientId!);
    loadPages();
  };

  const togglePublished = async (page: PageData) => {
    await supabase
      .from("hm_pages")
      .update({ is_published: !page.is_published })
      .eq("id", page.id)
      .eq("client_id", clientId!);
    loadPages();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Sidor</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hantera sidor som redigeras i den visuella editorn
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ny sida
        </button>
      </div>

      {/* New page form */}
      {showNew && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-display font-semibold text-sm mb-3">Skapa ny sida</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Titel (t.ex. Om oss)"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (!newSlug || newSlug === newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) {
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[åä]/g, "a")
                      .replace(/ö/g, "o")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "")
                  );
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
            <input
              type="text"
              placeholder="URL-slug (t.ex. om-oss)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-48 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
            <button
              onClick={createPage}
              disabled={!newTitle || !newSlug}
              className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Skapa
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Page list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Sida</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">URL</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Uppdaterad</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm text-gray-900">{page.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      /{page.slug === "index" ? "" : page.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublished(page)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${
                        page.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {page.is_published ? "Publicerad" : "Utkast"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(page.updated_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin?page=${page.slug}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-brand-blue transition-colors"
                        title="Redigera i editor"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <Link
                        href={page.slug === "index" ? "/" : `/${page.slug}`}
                        target="_blank"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title="Visa live"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      {page.slug !== "index" && (
                        <button
                          onClick={() => deletePage(page.id, page.slug)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Inga sidor skapade ännu. Skapa din första sida ovan.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
