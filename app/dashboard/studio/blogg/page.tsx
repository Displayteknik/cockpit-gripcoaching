"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Wand2, Send, Check, Eye, Code, Link2, Layers, Image as ImageIcon } from "lucide-react";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface BlogSite { id: string; name: string }
interface BlogAuthor { id: string; name: string }
interface BlogCategory { id: string; label: string }

const DEFAULT_COLOR = "#1A6B3C";

export default function StudioBloggPage() {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const primary = client?.primary_color || DEFAULT_COLOR;

  const [topic, setTopic] = useState("");
  const [wordCount, setWordCount] = useState(800);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Redigerbar artikel
  const [title, setTitle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [urlSlug, setUrlSlug] = useState("");
  const [html, setHtml] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [internalLinks, setInternalLinks] = useState(0);
  const [hasArticle, setHasArticle] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [repurposing, setRepurposing] = useState(false);
  const [repurposed, setRepurposed] = useState(0);

  // GHL blogg-meta
  const [connected, setConnected] = useState<boolean | null>(null);
  const [sites, setSites] = useState<BlogSite[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [blogId, setBlogId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [destination, setDestination] = useState<"ghl" | "native">("ghl");

  const inputCls = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/studio/blog/meta").then((r) => r.json()).then((d) => {
      const conn = !!d.connected && (d.meta?.sites?.length || 0) > 0;
      setConnected(!!d.connected);
      // Förval: GHL om kopplat med sajt, annars Cockpit-native.
      setDestination(conn ? "ghl" : "native");
      if (d.meta) {
        setSites(d.meta.sites || []); setAuthors(d.meta.authors || []); setCategories(d.meta.categories || []);
        setBlogId(d.meta.sites?.[0]?.id || "");
        setAuthorId(d.meta.authors?.[0]?.id || "");
      }
    }).catch(() => { setConnected(false); setDestination("native"); });
  }, [client]);

  const generate = useCallback(async () => {
    if (!topic.trim()) { setError("Ange ett ämne"); return; }
    setError(""); setGenerating(true); setPublishedUrl("");
    try {
      const r = await fetch("/api/studio/blog/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, wordCount }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte generera artikeln");
      const a = d.article;
      setTitle(a.title || ""); setMetaTitle(a.metaTitle || ""); setMetaDescription(a.metaDescription || "");
      setUrlSlug(a.urlSlug || ""); setHtml(a.html || ""); setHasArticle(true);
      setCoverImageUrl(a.coverImageUrl || ""); setCoverImageAlt(a.coverImageAlt || "");
      setInternalLinks(d.internalLinksCount || 0); setRepurposed(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [topic, wordCount]);

  const publish = useCallback(async () => {
    setError(""); setPublishing(true); setPublishedUrl("");
    try {
      if (destination === "native") {
        const r = await fetch("/api/studio/blog/publish-native", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, html, urlSlug, description: metaDescription }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
        setPublishedUrl("native");
      } else {
        if (!blogId) { setError("Välj en bloggsajt"); setPublishing(false); return; }
        const r = await fetch("/api/studio/blog/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blogId, title, html, description: metaDescription, urlSlug,
            author: authorId || undefined, categories: categoryId ? [categoryId] : [],
            imageUrl: coverImageUrl || undefined, imageAltText: coverImageAlt || undefined,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
        setPublishedUrl(d.postId || "ok");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }, [destination, blogId, title, html, metaDescription, urlSlug, authorId, categoryId, coverImageUrl, coverImageAlt]);

  const repurpose = useCallback(async () => {
    setError(""); setRepurposing(true);
    try {
      const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
      const r = await fetch("/api/studio/blog/repurpose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, articleText: plain, topic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa sociala inlägg");
      setRepurposed(d.count || 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRepurposing(false);
    }
  }, [html, title, topic]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
            <FileText className="w-6 h-6" style={{ color: primary }} />
          </span>
          <div>
            <h1 className="font-display font-bold text-2xl text-gray-900">Blogg</h1>
            <p className="text-sm text-gray-500">Ämne → färdig SEO-artikel → utkast i GHL Blogs eller på Cockpit-sajten. {client ? `Klient: ${client.name}` : ""}</p>
          </div>
        </div>

        {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Generera */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-display font-bold text-gray-900 text-lg">1. Skapa artikel</h2>
          <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2}
            placeholder="Ämne/vinkel — t.ex. en guide, en jämförelse eller vanliga frågor" className={inputCls} />
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500">Längd</label>
            <select value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value={500}>~500 ord</option>
              <option value={800}>~800 ord</option>
              <option value={1200}>~1200 ord</option>
              <option value={1600}>~1600 ord</option>
            </select>
            <button onClick={generate} disabled={generating}
              className="ml-auto inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primary }}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {hasArticle ? "Generera om" : "Generera artikel"}
            </button>
          </div>
        </section>

        {hasArticle && (
          <>
            {/* Redigera */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">2. Granska & redigera</h2>
                <button onClick={() => setShowHtml((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                  {showHtml ? <><Eye className="w-3.5 h-3.5" /> Förhandsvisning</> : <><Code className="w-3.5 h-3.5" /> Redigera HTML</>}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600"><Link2 className="w-3.5 h-3.5" /> {internalLinks} interna länkar</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600"><ImageIcon className="w-3.5 h-3.5" /> {coverImageUrl ? "Omslagsbild klar" : "Ingen bild"}</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">FAQ-schema</span>
              </div>

              {coverImageUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt={coverImageAlt} className="w-full max-h-64 object-cover" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Titel (H1)</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Meta-titel ({metaTitle.length}/60)</label>
                  <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">URL-slug</label>
                  <input value={urlSlug} onChange={(e) => setUrlSlug(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Meta-beskrivning ({metaDescription.length}/160)</label>
                <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className={inputCls} />
              </div>
              {showHtml ? (
                <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={16} className={`${inputCls} font-mono text-xs`} />
              ) : (
                <div className="rounded-xl border border-gray-100 bg-white p-6 prose prose-sm max-w-none overflow-x-auto">
                  <h1>{title}</h1>
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              )}
            </section>

            {/* Publicera */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display font-bold text-gray-900 text-lg">3. Publicera som utkast</h2>

              {/* Destinationsväljare — förvald per klient */}
              <div className="flex gap-2">
                <button onClick={() => setDestination("ghl")} disabled={!connected || sites.length === 0}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
                  style={destination === "ghl" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                  GHL Blogs {(!connected || sites.length === 0) && "(ej kopplat)"}
                </button>
                <button onClick={() => setDestination("native")}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
                  style={destination === "native" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                  Cockpit-sajt
                </button>
              </div>

              {destination === "ghl" ? (
                connected === null ? (
                  <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Kollar GHL-koppling…</div>
                ) : !connected || sites.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
                    GHL-blogg är inte kopplad för {client?.name || "klienten"}. Koppla i Studio (bild-vyn) → "Publicera till GHL", eller välj Cockpit-sajt.
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Bloggsajt</label>
                      <select value={blogId} onChange={(e) => setBlogId(e.target.value)} className={inputCls}>
                        {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Författare</label>
                      <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kategori</label>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500">Sparas som utkast på Cockpit-sajten (Blogg-arkiv) — opublicerat tills du släpper det.</p>
              )}

              <button onClick={publish} disabled={publishing || (destination === "ghl" && (!connected || sites.length === 0))}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : publishedUrl ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {publishedUrl ? "Utkast skapat" : destination === "ghl" ? "Skapa utkast i GHL Blogs" : "Spara utkast på Cockpit-sajten"}
              </button>
              {publishedUrl && (
                <p className="text-xs text-gray-500 text-center">
                  {publishedUrl === "native" ? "Utkastet ligger i Blogg-arkiv (opublicerat) — granska och publicera där." : "Utkastet ligger i GHL → Sites → Blogs (status Draft). Granska och publicera där."}
                </p>
              )}
              <p className="text-xs text-gray-400">Skapar ett utkast — publicerar aldrig skarpt.</p>
            </section>

            {/* Repurposing: blogg → sociala inlägg */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <h2 className="font-display font-bold text-gray-900 text-lg">4. Gör om till sociala inlägg</h2>
              <p className="text-sm text-gray-500">Skapa 3 färdiga social-inlägg ur artikeln (olika hooks) — sparas i Studio-biblioteket, redo att lägga bild på och publicera/schemalägga.</p>
              <div className="flex items-center gap-3">
                <button onClick={repurpose} disabled={repurposing}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  style={{ background: primary }}>
                  {repurposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Skapa sociala inlägg
                </button>
                {repurposed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                    <Check className="w-4 h-4" /> {repurposed} inlägg sparade — <a href="/dashboard/studio" className="underline">öppna i Studio</a>
                  </span>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
