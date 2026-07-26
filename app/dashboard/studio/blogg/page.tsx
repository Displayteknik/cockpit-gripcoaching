"use client";

import SmartTextarea from "@/components/SmartTextarea";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Wand2, Send, Check, Eye, Code, Link2, Layers, Image as ImageIcon, PenLine } from "lucide-react";
import { DashHero, LivePill } from "@/components/ui/dash";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
interface BlogSite { id: string; name: string }
interface BlogAuthor { id: string; name: string }
interface BlogCategory { id: string; label: string }

const DEFAULT_COLOR = "#1A6B3C";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Fri text → enkel HTML: en tom rad = nytt stycke, enkel radbrytning = <br>.
// Låter en kund skriva helt själv utan att kunna HTML.
function plainToHtml(t: string): string {
  return t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export default function StudioBloggPage({ customer = false }: { customer?: boolean }) {
  // I kundvyn (/k/blogg) leder "öppna i Studio" till /k/studio (admin-Studion är spärrad).
  const studioHref = customer ? "/k/studio" : "/dashboard/studio";
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
  // Skriv-själv-läge: kunden skriver hela artikeln manuellt (plain text → HTML).
  const [manualMode, setManualMode] = useState(false);
  const [plainBody, setPlainBody] = useState("");
  const [repurposing, setRepurposing] = useState(false);
  const [repurposed, setRepurposed] = useState(0);
  // Gör om ett BEFINTLIGT sparat blogginlägg till sociala inlägg (genväg).
  const [savedBlogs, setSavedBlogs] = useState<{ id: string; title: string; text: string; published: boolean }[]>([]);
  const [selBlog, setSelBlog] = useState("");

  // Publicerings-mål (GHL-bloggen eller din egen sajt)
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
  const [blogSchedule, setBlogSchedule] = useState("");

  const inputCls = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
    fetch("/api/studio/blog/list").then((r) => r.json()).then((d) => setSavedBlogs(Array.isArray(d.posts) ? d.posts : [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/studio/blog/meta").then((r) => r.json()).then((d) => {
      const conn = !!d.connected && (d.meta?.sites?.length || 0) > 0;
      setConnected(!!d.connected);
      setDestination(conn ? "ghl" : "native");
      if (d.meta) {
        setSites(d.meta.sites || []); setAuthors(d.meta.authors || []); setCategories(d.meta.categories || []);
        setBlogId(d.meta.sites?.[0]?.id || "");
        setAuthorId(d.meta.authors?.[0]?.id || "");
      }
    }).catch(() => { setConnected(false); setDestination("native"); });
  }, [client]);

  const generate = useCallback(async () => {
    if (!topic.trim()) { setError("Skriv ett ämne först"); return; }
    setError(""); setGenerating(true); setPublishedUrl("");
    try {
      const r = await fetch("/api/studio/blog/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, wordCount }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa artikeln");
      const a = d.article;
      setManualMode(false);
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

  // Skriv helt själv: öppnar tomma fält i editorn, samma publicerings-flöde.
  const startManual = useCallback(() => {
    setError(""); setPublishedUrl(""); setManualMode(true); setHasArticle(true);
    setTitle(""); setPlainBody(""); setHtml(""); setMetaTitle(""); setMetaDescription(""); setUrlSlug("");
    setCoverImageUrl(""); setCoverImageAlt(""); setInternalLinks(0); setRepurposed(0); setShowHtml(false);
  }, []);

  const publish = useCallback(async () => {
    if (!title.trim()) { setError("Ge artikeln en rubrik först"); return; }
    setError(""); setPublishing(true); setPublishedUrl("");
    try {
      if (destination === "native") {
        const r = await fetch("/api/studio/blog/publish-native", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, html, urlSlug, description: metaDescription, scheduledAt: blogSchedule || undefined }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
        setPublishedUrl(d.scheduled ? "scheduled" : "native");
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
  }, [destination, blogId, title, html, metaDescription, urlSlug, authorId, categoryId, coverImageUrl, coverImageAlt, blogSchedule]);

  const doRepurpose = useCallback(async (t: string, text: string, topicHint: string) => {
    setError(""); setRepurposing(true); setRepurposed(0);
    try {
      const r = await fetch("/api/studio/blog/repurpose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, articleText: text.slice(0, 4000), topic: topicHint }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa sociala inlägg");
      setRepurposed(d.count || 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRepurposing(false);
    }
  }, []);
  const repurpose = useCallback(() => {
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return doRepurpose(title, plain, topic);
  }, [html, title, topic, doRepurpose]);
  const repurposeSaved = useCallback(() => {
    const b = savedBlogs.find((x) => x.id === selBlog);
    if (!b) return;
    return doRepurpose(b.title, b.text, "");
  }, [savedBlogs, selBlog, doRepurpose]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <DashHero
          title="Blogg"
          subtitle={`Skriv en artikel själv eller låt Skrivhjälpen skapa ett förslag — publicera sedan på din sajt.${client ? ` · ${client.name}` : ""}`}
          accent={primary}
          icon={FileText}
          eyebrow={<LivePill label="Bloggverktyget" />}
        />

        {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* STEG 1 — skapa artikeln (skriv själv eller låt Skrivhjälpen föreslå) */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">1. Skapa artikeln</h2>
            <p className="text-sm text-gray-500 mt-1">Två sätt: skriv hela artikeln själv, eller ge ett ämne så skriver Skrivhjälpen ett förslag du kan finslipa.</p>
          </div>
          <SmartTextarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2}
            placeholder="Ämne eller vinkel — t.ex. en guide, en jämförelse eller vanliga frågor" className={inputCls} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-gray-500">Längd</label>
            <select value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value={500}>~500 ord</option>
              <option value={800}>~800 ord</option>
              <option value={1200}>~1200 ord</option>
              <option value={1600}>~1600 ord</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={startManual}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50">
                <PenLine className="w-4 h-4" /> Skriv själv
              </button>
              <button onClick={generate} disabled={generating}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {hasArticle && !manualMode ? "Skriv nytt förslag" : "Låt Skrivhjälpen skriva"}
              </button>
            </div>
          </div>
        </section>

        {hasArticle && (
          <>
            {/* STEG 2 — skriv/granska */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg">{manualMode ? "2. Skriv din artikel" : "2. Granska och finslipa"}</h2>
                {!manualMode && (
                  <button onClick={() => setShowHtml((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                    {showHtml ? <><Eye className="w-3.5 h-3.5" /> Förhandsvisning</> : <><Code className="w-3.5 h-3.5" /> Avancerad redigering</>}
                  </button>
                )}
              </div>

              {!manualMode && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600"><Link2 className="w-3.5 h-3.5" /> {internalLinks} länkar till dina andra sidor</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600"><ImageIcon className="w-3.5 h-3.5" /> {coverImageUrl ? "Omslagsbild klar" : "Ingen bild"}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600">Vanliga frågor med svar</span>
                </div>
              )}

              {coverImageUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt={coverImageAlt} className="w-full max-h-64 object-cover" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rubrik</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={manualMode ? "Ge artikeln en rubrik" : ""} className={inputCls} />
              </div>

              {manualMode ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Brödtext</label>
                  <SmartTextarea
                    value={plainBody}
                    onChange={(e) => { setPlainBody(e.target.value); setHtml(plainToHtml(e.target.value)); }}
                    rows={16}
                    placeholder="Skriv din artikel här. Lämna en tom rad mellan styckena så delas de upp snyggt."
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1">Tips: en tom rad = nytt stycke. Du kan lägga till en rubrik och beskrivning för Google längre ner (valfritt).</p>
                </div>
              ) : showHtml ? (
                <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={16} className={`${inputCls} font-mono text-xs`} />
              ) : (
                <div className="blog-content rounded-xl border border-gray-100 bg-white p-8 max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: `<h1>${escapeHtml(title)}</h1>${html}` }} />
              )}

              {/* Google-fält — valfritt, förklarat i klarspråk */}
              <details className="rounded-xl border border-gray-100 bg-gray-50/60 p-4" open={!manualMode}>
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">Hur artikeln ser ut i Google (valfritt)</summary>
                <div className="mt-3 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Rubrik i Google ({metaTitle.length}/60)</label>
                      <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Webbadress</label>
                      <input value={urlSlug} onChange={(e) => setUrlSlug(e.target.value)} placeholder="t-ex-brollopsblommor-2026" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Beskrivning i Google ({metaDescription.length}/160)</label>
                    <SmartTextarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className={inputCls} />
                  </div>
                </div>
              </details>
            </section>

            {/* STEG 3 — publicera */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-display font-bold text-gray-900 text-lg">3. Publicera</h2>

              <div className="flex gap-2">
                <button onClick={() => setDestination("ghl")} disabled={!connected || sites.length === 0}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40"
                  style={destination === "ghl" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                  Din hemsida {(!connected || sites.length === 0) && "(inte kopplad än)"}
                </button>
                <button onClick={() => setDestination("native")}
                  className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
                  style={destination === "native" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                  Bloggen här i verktyget
                </button>
              </div>

              {destination === "ghl" ? (
                connected === null ? (
                  <div className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Kollar kopplingen.</div>
                ) : !connected || sites.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-700">
                    Din hemsida är inte kopplad än för {client?.name || "den här kunden"}. Vi kopplar den åt dig — hör av dig. Eller välj Bloggen här i verktyget så länge.
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
                <p className="text-sm text-gray-500">Sparas som blogginlägg här i verktyget. Utan tid = ligger kvar som utkast. Med tid = publiceras automatiskt då.</p>
              )}

              {destination === "native" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Schemalägg publicering (valfritt)</label>
                  <input type="datetime-local" value={blogSchedule} onChange={(e) => setBlogSchedule(e.target.value)} className={inputCls} />
                  {blogSchedule && <button onClick={() => setBlogSchedule("")} className="text-xs text-gray-400 hover:text-gray-600 mt-1">Rensa (spara som utkast)</button>}
                </div>
              )}

              <button onClick={publish} disabled={publishing || (destination === "ghl" && (!connected || sites.length === 0))}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : publishedUrl ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {publishedUrl ? (publishedUrl === "scheduled" ? "Schemalagt" : "Utkast sparat") : destination === "ghl" ? "Spara som utkast på hemsidan" : blogSchedule ? "Schemalägg publicering" : "Spara som utkast i verktyget"}
              </button>
              {publishedUrl && (
                <p className="text-xs text-gray-500 text-center">
                  {publishedUrl === "scheduled" ? "Schemalagt — publiceras automatiskt vid vald tid." : publishedUrl === "native" ? "Utkastet ligger sparat här i verktyget (opublicerat). Granska och publicera när du är nöjd." : "Utkastet ligger sparat på din hemsida (ännu opublicerat). Granska och publicera det där."}
                </p>
              )}
              <p className="text-xs text-gray-400">{blogSchedule && destination === "native" ? "Publiceras automatiskt vid vald tid." : "Skapar ett utkast — publicerar aldrig skarpt direkt."}</p>
            </section>

            {/* STEG 4 — gör om till sociala inlägg */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <h2 className="font-display font-bold text-gray-900 text-lg">4. Gör om till sociala inlägg (valfritt)</h2>
              <p className="text-sm text-gray-500">Skapa tre färdiga inlägg ur artikeln, med olika krokar — sparas i Studio, redo att lägga bild på och publicera eller schemalägga.</p>
              <div className="flex items-center gap-3">
                <button onClick={repurpose} disabled={repurposing}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  style={{ background: primary }}>
                  {repurposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Skapa sociala inlägg
                </button>
                {repurposed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                    <Check className="w-4 h-4" /> {repurposed} inlägg sparade — <a href={studioHref} className="underline">öppna i Studio</a>
                  </span>
                )}
              </div>
            </section>
          </>
        )}

        {/* GENVÄG — gör sociala inlägg av en artikel du redan har (separat, valfritt) */}
        {savedBlogs.length > 0 && (
          <section className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}14`, color: primary }}>Genväg</span>
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><Layers className="w-5 h-5" style={{ color: primary }} /> Har du redan en artikel?</h2>
            </div>
            <p className="text-sm text-gray-500">Välj ett blogginlägg du redan skapat, så gör Skrivhjälpen om det till tre färdiga sociala inlägg i din röst. Sparas i Studio.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={selBlog} onChange={(e) => setSelBlog(e.target.value)} className={`${inputCls} max-w-md`}>
                <option value="">Välj blogginlägg</option>
                {savedBlogs.map((b) => <option key={b.id} value={b.id}>{b.title}{b.published ? "" : " (utkast)"}</option>)}
              </select>
              <button onClick={repurposeSaved} disabled={!selBlog || repurposing}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40" style={{ background: primary }}>
                {repurposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Skapa sociala inlägg
              </button>
            </div>
            {repurposed > 0 && <div className="text-sm text-emerald-600 flex items-center gap-1.5"><Check className="w-4 h-4" /> {repurposed} inlägg sparade. <a href={studioHref} className="underline">Öppna i Studio</a></div>}
          </section>
        )}
      </div>
    </div>
  );
}
