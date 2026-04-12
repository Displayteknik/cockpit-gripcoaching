"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, type BlogPost } from "@/lib/supabase";
import { RichEditor } from "@/components/dashboard/RichEditor";
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Upload, Image as ImageIcon } from "lucide-react";

const emptyPost: Partial<BlogPost> = {
  title: "", slug: "", excerpt: "", content: "",
  image_url: "", author: "Håkan Mikaelsson", published: false,
};

export default function BlogDashboardPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hm_blog")
      .select("*")
      .order("published_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const openEdit = (post: BlogPost) => { setEditing({ ...post }); setIsNew(false); };
  const openNew = () => { setEditing({ ...emptyPost }); setIsNew(true); };

  const uploadCover = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const name = `blog-cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("vehicle-images")
      .upload(name, file, { cacheControl: "31536000" });
    if (error) { alert("Uppladdningsfel: " + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("vehicle-images").getPublicUrl(name);
    setEditing((prev) => prev ? { ...prev, image_url: data.publicUrl } : prev);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = { ...editing };
    if (!payload.slug && payload.title) {
      payload.slug = payload.title.toLowerCase()
        .replace(/[åä]/g, "a").replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    if (isNew) {
      payload.published_at = new Date().toISOString();
      const { error } = await supabase.from("hm_blog").insert(payload);
      if (error) alert("Fel: " + error.message);
    } else {
      const { error } = await supabase.from("hm_blog").update(payload).eq("id", editing.id);
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
    await supabase.from("hm_blog").update({ published: !post.published }).eq("id", post.id);
    loadPosts();
  };

  // Full-page editor when editing
  if (editing) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" /> Tillbaka
          </button>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing.published || false}
                onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
              Publicerad
            </label>
            <button onClick={handleSave} disabled={saving || !editing.title}
              className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? "Sparar..." : isNew ? "Publicera" : "Spara"}
            </button>
          </div>
        </div>

        {/* Cover image */}
        <div className="mb-6">
          {editing.image_url ? (
            <div className="relative rounded-xl overflow-hidden aspect-[21/9] bg-gray-100">
              <img src={editing.image_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                <div className="flex gap-2">
                  <button onClick={() => coverInputRef.current?.click()}
                    className="bg-white text-gray-800 px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                    Byt bild
                  </button>
                  <button onClick={() => setEditing({ ...editing, image_url: "" })}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                    Ta bort
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl aspect-[21/9] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brand-blue hover:bg-brand-blue/5 transition-colors"
              onClick={() => coverInputRef.current?.click()}
            >
              {uploading ? (
                <div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500">Klicka för att lägga till omslagsbild</span>
                </>
              )}
            </div>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) uploadCover(e.target.files[0]); e.target.value = ""; }} />
        </div>

        {/* Title */}
        <input
          type="text"
          value={editing.title || ""}
          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          placeholder="Rubrik"
          className="w-full text-3xl font-display font-bold text-gray-900 border-none outline-none placeholder:text-gray-300 mb-2"
        />

        {/* Slug */}
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
          <span>/blogg/</span>
          <input
            type="text"
            value={editing.slug || ""}
            onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
            placeholder="auto-genereras"
            className="border-none outline-none text-gray-500 bg-transparent"
          />
        </div>

        {/* Excerpt */}
        <textarea
          value={editing.excerpt || ""}
          onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
          placeholder="Kort utdrag som visas i listningar..."
          rows={2}
          className="w-full px-0 py-2 border-none outline-none text-gray-600 resize-none placeholder:text-gray-300 mb-4 text-base"
        />

        {/* Rich text editor */}
        <RichEditor
          content={editing.content || ""}
          onChange={(html) => setEditing((prev) => prev ? { ...prev, content: html } : prev)}
        />

        {/* Meta */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Författare</label>
            <input type="text" value={editing.author || ""} onChange={(e) => setEditing({ ...editing, author: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
            <input type="text" value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              placeholder="auto-genereras" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Blogg</h1>
          <p className="text-sm text-gray-500 mt-1">{posts.length} inlägg</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
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
                <tr key={post.id} className="hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openEdit(post)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {post.image_url ? (
                        <img src={post.image_url} alt="" className="w-14 h-10 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm text-gray-900 group-hover:text-brand-blue transition-colors">{post.title}</div>
                        <div className="text-xs text-gray-400 line-clamp-1">{post.excerpt}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(post.published_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      post.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {post.published ? "Publicerad" : "Utkast"}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => togglePublished(post)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                        title={post.published ? "Avpublicera" : "Publicera"}>
                        {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(post)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-blue transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(post.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && <div className="text-center py-12 text-gray-400">Inga blogginlägg ännu</div>}
        </div>
      )}
    </div>
  );
}
