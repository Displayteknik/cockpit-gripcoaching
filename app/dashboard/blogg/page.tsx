"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type BlogPost } from "@/lib/supabase";
import { Plus, Pencil, Trash2, Eye, EyeOff, X } from "lucide-react";

const emptyPost: Partial<BlogPost> = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  image_url: "",
  author: "Håkan Mikaelsson",
  published: false,
};

export default function BlogDashboardPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hm_blog")
      .select("*")
      .order("published_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const openEdit = (post: BlogPost) => {
    setEditing({ ...post });
    setIsNew(false);
  };

  const openNew = () => {
    setEditing({ ...emptyPost });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);

    const payload = { ...editing };
    if (!payload.slug && payload.title) {
      payload.slug = payload.title
        .toLowerCase()
        .replace(/[åä]/g, "a")
        .replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    if (isNew) {
      payload.published_at = new Date().toISOString();
      const { error } = await supabase.from("hm_blog").insert(payload);
      if (error) alert("Fel: " + error.message);
    } else {
      const { error } = await supabase
        .from("hm_blog")
        .update(payload)
        .eq("id", editing.id);
      if (error) alert("Fel: " + error.message);
    }

    setSaving(false);
    setEditing(null);
    loadPosts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort detta inlägg?")) return;
    await supabase.from("hm_blog").delete().eq("id", id);
    loadPosts();
  };

  const togglePublished = async (post: BlogPost) => {
    await supabase
      .from("hm_blog")
      .update({ published: !post.published })
      .eq("id", post.id);
    loadPosts();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Blogg</h1>
          <p className="text-sm text-gray-500 mt-1">{posts.length} inlägg</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nytt inlägg
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Laddar...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Inlägg</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Datum</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {post.image_url ? (
                        <img src={post.image_url} alt="" className="w-12 h-9 rounded object-cover bg-gray-100" />
                      ) : (
                        <div className="w-12 h-9 rounded bg-gray-100" />
                      )}
                      <div>
                        <div className="font-medium text-sm text-gray-900">{post.title}</div>
                        <div className="text-xs text-gray-400 line-clamp-1">{post.excerpt}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(post.published_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      post.published
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {post.published ? "Publicerad" : "Utkast"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublished(post)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title={post.published ? "Avpublicera" : "Publicera"}
                      >
                        {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(post)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-blue transition-colors"
                        title="Redigera"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Ta bort"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div className="text-center py-12 text-gray-400">Inga blogginlägg ännu</div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 px-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="font-display font-bold text-lg">
                {isNew ? "Nytt inlägg" : "Redigera inlägg"}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={editing.slug || ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="auto-genereras"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bild-URL</label>
                <input
                  type="text"
                  value={editing.image_url || ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utdrag</label>
                <textarea
                  value={editing.excerpt || ""}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Innehåll</label>
                <textarea
                  value={editing.content || ""}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={12}
                  placeholder="Använd ## för rubriker, ** för fetstil"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Författare</label>
                  <input
                    type="text"
                    value={editing.author || ""}
                    onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.published || false}
                      onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                      className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                    />
                    Publicerad
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.title}
                className="px-6 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Sparar..." : isNew ? "Skapa" : "Spara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
