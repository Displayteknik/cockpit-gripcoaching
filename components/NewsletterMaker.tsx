"use client";

// Nyhetsbrev-modul v1: blogg → nyhetsbrev i klientens röst. Förhandsvisning som
// uppdateras live vid redigering, spara utkast, kopiera HTML, skicka testmejl.
// Tenant-låst via aktiv klient (API:erna resolvar rätt klient). customerMode = /k.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Loader2, Sparkles, Save, Copy, Check, Send, Trash2, FileText } from "lucide-react";
import { renderNewsletterHtml, type NewsletterContent } from "@/lib/newsletter-render";
import Select from "@/components/ui/Select";
import UtkastRad from "@/components/UtkastRad";
import { useUtkast } from "@/lib/studio/useUtkast";

interface ClientInfo { id: string; name: string; primary_color: string }
interface BlogItem { id: string; title: string; text: string }
interface DraftItem { id: string; subject: string; updated_at: string }

function AutoTextarea({ value, onChange, className = "", placeholder, rows = 1 }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(fit, [value]);
  return (
    <textarea ref={ref} value={value} placeholder={placeholder} rows={rows}
      onChange={(e) => onChange(e.target.value)} onInput={fit}
      className={`w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${className}`} />
  );
}

export default function NewsletterMaker({ customerMode = false }: { customerMode?: boolean }) {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [blogId, setBlogId] = useState("");
  // Default = skriv/klistra in text. Blogg-vägen erbjuds bara om det faktiskt finns
  // blogginlägg (annars leder fliken till en tom lista → förvirrande).
  const [pasteMode, setPasteMode] = useState(true);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");

  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");

  const [content, setContent] = useState<NewsletterContent | null>(null);
  const [subject, setSubject] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sourceBlogId, setSourceBlogId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  const primary = client?.primary_color || "#1A6B3C";

  const loadDrafts = useCallback(async () => {
    try { const r = await fetch("/api/newsletter"); const d = await r.json(); if (r.ok) setDrafts(d.newsletters || []); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
    fetch("/api/studio/blog/list").then((r) => r.json()).then((d) => { if (Array.isArray(d.posts)) setBlogs(d.posts); }).catch(() => {});
    loadDrafts();
  }, [loadDrafts]);

  // Live-HTML: re-renderas på klienten när content/ctaUrl ändras.
  const html = useMemo(() => {
    if (!content) return "";
    return renderNewsletterHtml(content, { brandName: client?.name || "", primaryColor: primary, ctaUrl: ctaUrl || undefined });
  }, [content, client?.name, primary, ctaUrl]);

  // ── UTKAST-1: autospar av pågående nyhetsbrev (per klient-id) ──
  // Ett genererat nyhetsbrev är en dyr AI-körning — en omladdning fick förr allt att försvinna.
  const utkast = useMemo(
    () => ({ pasteMode, pasteTitle, pasteText, blogId, content, subject, ctaUrl, sourceBlogId, loadedId }),
    [pasteMode, pasteTitle, pasteText, blogId, content, subject, ctaUrl, sourceBlogId, loadedId],
  );
  type NyhetsbrevUtkast = typeof utkast;

  // UTKAST-2: tömmer ytan vid klientbyte när den nya klienten saknar utkast. Utan den stod
  // förra klientens texter kvar under den nya klientens namn (Håkans fynd 10/8 i Studio —
  // nyhetsbrevet bar samma brist). Kvittona ("Sparat", "Kopierat", testutskicket) nollas
  // också: de gällde förra klientens brev och blir en falsk bekräftelse på det nya.
  const tomYtan = useCallback(() => {
    setPasteTitle(""); setPasteText(""); setBlogId("");
    setContent(null); setSubject(""); setCtaUrl(""); setSourceBlogId(null); setLoadedId(null); setErr("");
    setSaved(false); setCopied(false); setTestMsg("");
  }, []);

  const { aterupptaget, sparatVid, glomUtkast } = useUtkast<NyhetsbrevUtkast>({
    yta: "nyhetsbrev",
    klientId: client?.id,
    data: utkast,
    aterstall: useCallback((d: NyhetsbrevUtkast) => {
      setPasteMode(d.pasteMode ?? true);
      setPasteTitle(d.pasteTitle ?? ""); setPasteText(d.pasteText ?? "");
      setBlogId(d.blogId ?? "");
      setContent(d.content ?? null); setSubject(d.subject ?? ""); setCtaUrl(d.ctaUrl ?? "");
      setSourceBlogId(d.sourceBlogId ?? null); setLoadedId(d.loadedId ?? null);
    }, []),
    harInnehall: useCallback((d: NyhetsbrevUtkast) => Boolean(d.content || d.pasteText?.trim() || d.pasteTitle?.trim()), []),
    nollstall: tomYtan,
  });
  // "Börja om" = släng utkastet OCH töm ytan. Samma tömning som vid klientbyte, en källa.
  const borjaOm = useCallback(() => {
    glomUtkast();
    tomYtan();
  }, [glomUtkast, tomYtan]);

  const updateContent = (patch: Partial<NewsletterContent>) => { setContent((c) => (c ? { ...c, ...patch } : c)); setSaved(false); };
  const updateSection = (i: number, patch: Partial<{ heading: string; body: string }>) => {
    setContent((c) => { if (!c) return c; const sections = c.sections.slice(); sections[i] = { ...sections[i], ...patch }; return { ...c, sections }; });
    setSaved(false);
  };

  const generate = async () => {
    setErr(""); setGenerating(true); setContent(null);
    try {
      const body = pasteMode
        ? { articleText: pasteText, title: pasteTitle }
        : { blogId };
      if (!pasteMode && !blogId) { setErr("Välj ett blogginlägg (eller klistra in text)."); setGenerating(false); return; }
      const r = await fetch("/api/newsletter/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Kunde inte skapa nyhetsbrev"); return; }
      setContent(d.content);
      setSubject(d.subject || (d.content?.subjects?.[0] || ""));
      setCtaUrl(d.ctaUrl || "");
      setSourceBlogId(d.sourceBlogId || null);
      setLoadedId(null);
    } catch (e) { setErr((e as Error).message); } finally { setGenerating(false); }
  };

  const saveDraft = async () => {
    if (!content) return;
    setSaving(true); setSaved(false);
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: loadedId || undefined, subject, preheader: content.preheader, content, html, source_blog_id: sourceBlogId }),
      });
      const d = await r.json();
      if (r.ok) { setSaved(true); if (d.newsletter?.id) setLoadedId(d.newsletter.id); loadDrafts(); }
      else setErr(d.error || "Kunde inte spara");
    } finally { setSaving(false); }
  };

  const loadDraft = async (id: string) => {
    try {
      const r = await fetch(`/api/newsletter/${id}`); const d = await r.json();
      if (r.ok && d.newsletter?.content) {
        setContent(d.newsletter.content); setSubject(d.newsletter.subject || "");
        setSourceBlogId(d.newsletter.source_blog_id || null); setLoadedId(d.newsletter.id); setErr("");
      }
    } catch { /* ignore */ }
  };

  const deleteDraft = async (id: string) => {
    try { const r = await fetch(`/api/newsletter/${id}`, { method: "DELETE" }); if (r.ok) { setDrafts((p) => p.filter((x) => x.id !== id)); if (loadedId === id) setLoadedId(null); } } catch { /* ignore */ }
  };

  const copyHtml = async () => { await navigator.clipboard.writeText(html); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const sendTest = async () => {
    if (!content) return;
    setTesting(true); setTestMsg("");
    try {
      const text = [subject, "", content.intro].join("\n");
      const r = await fetch("/api/newsletter/test-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo, subject, html, text }),
      });
      const d = await r.json();
      setTestMsg(r.ok ? `Testmejl skickat till ${testTo} ✓` : d.error || "Kunde inte skicka");
    } catch (e) { setTestMsg((e as Error).message); } finally { setTesting(false); }
  };

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100";

  return (
    <div className="space-y-6">
      <UtkastRad aterupptaget={aterupptaget} sparatVid={sparatVid} onBorjaOm={borjaOm} />
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
            <Mail className="w-[22px] h-[22px]" style={{ color: primary }} />
          </span>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-xl">Nyhetsbrev</h1>
            <p className="text-sm text-gray-500">Skriv eller klistra in din text{blogs.length > 0 ? ", eller utgå från ett blogginlägg" : ""}, så gör Skrivhjälpen ett nyhetsbrev i din röst.</p>
          </div>
        </div>

        {/* Blogg-fliken visas bara om det finns blogginlägg — annars bara skriv/klistra in. */}
        {blogs.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setPasteMode(true)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${pasteMode ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`} style={pasteMode ? { background: primary } : {}}>Skriv / klistra in text</button>
            <button onClick={() => setPasteMode(false)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${!pasteMode ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`} style={!pasteMode ? { background: primary } : {}}>Från blogginlägg</button>
          </div>
        )}

        {pasteMode ? (
          <div className="space-y-2">
            <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Rubrik (valfritt)" className={inputCls} />
            <AutoTextarea value={pasteText} onChange={setPasteText} placeholder="Skriv eller klistra in det du vill skicka: ett erbjudande, en nyhet, veckans tips…" rows={4} />
          </div>
        ) : (
          <Select value={blogId} onChange={(e) => setBlogId(e.target.value)}>
            <option value="">Välj ett blogginlägg.</option>
            {blogs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </Select>
        )}

        <button onClick={generate} disabled={generating} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: primary }}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {generating ? "Skapar nyhetsbrev." : "Skapa nyhetsbrev"}
        </button>
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </div>

      {content && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Redigering */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold">Ämnesrad</label>
                <input value={subject} onChange={(e) => { setSubject(e.target.value); setSaved(false); }} className={`${inputCls} mt-1 font-medium`} />
                {content.subjects.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {content.subjects.map((s, i) => (
                      <button key={i} onClick={() => { setSubject(s); setSaved(false); }} className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-gray-50"
                        style={subject === s ? { borderColor: primary, background: `${primary}14`, color: primary } : { borderColor: "#e5e7eb", color: "#6b7280" }}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold">Förhandstext (preheader)</label>
                <input value={content.preheader} onChange={(e) => updateContent({ preheader: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold">Hälsning</label>
                <input value={content.greeting} onChange={(e) => updateContent({ greeting: e.target.value })} className={`${inputCls} mt-1`} />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold">Ingress</label>
                <AutoTextarea value={content.intro} onChange={(v) => updateContent({ intro: v })} className="mt-1" rows={3} />
              </div>
              {content.sections.map((s, i) => (
                <div key={i} className="border-t border-gray-100 pt-3 space-y-2">
                  <input value={s.heading} onChange={(e) => updateSection(i, { heading: e.target.value })} placeholder="Rubrik" className={`${inputCls} font-semibold`} />
                  <AutoTextarea value={s.body} onChange={(v) => updateSection(i, { body: v })} rows={2} />
                </div>
              ))}
              <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase text-gray-400 font-semibold">Knapptext</label>
                  <input value={content.cta_text} onChange={(e) => updateContent({ cta_text: e.target.value })} className={`${inputCls} mt-1`} />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-400 font-semibold">Knapp-länk</label>
                  <input value={ctaUrl} onChange={(e) => { setCtaUrl(e.target.value); setSaved(false); }} placeholder="https://" className={`${inputCls} mt-1`} />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold">Avslutning</label>
                <AutoTextarea value={content.signoff} onChange={(v) => updateContent({ signoff: v })} className="mt-1" rows={2} />
              </div>
            </div>

            {/* Åtgärder */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={saveDraft} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: primary }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? "Sparat" : loadedId ? "Uppdatera utkast" : "Spara utkast"}
                </button>
                <button onClick={copyHtml} title="Klistra in i ditt e-postverktyg (t.ex. Mailchimp) för att skicka till din lista." className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? "Kopierat" : "Kopiera för utskick"}
                </button>
              </div>
              <p className="text-xs text-gray-500">Så här skickar du: tryck <strong>Skicka test</strong> för att se brevet i din egen inkorg, eller <strong>Kopiera för utskick</strong> och klistra in i ditt e-postverktyg för att nå hela din lista.</p>
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="din@epost.se" className="flex-1 min-w-[160px] rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                <button onClick={sendTest} disabled={testing || !testTo} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Skicka test
                </button>
              </div>
              {testMsg && <p className="text-xs text-gray-600">{testMsg}</p>}
            </div>
          </div>

          {/* Förhandsvisning */}
          <div className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 shadow-sm">
              <div className="text-xs text-gray-400 px-1 pb-2">Förhandsvisning</div>
              <iframe title="Förhandsvisning" srcDoc={html} className="w-full h-[640px] rounded-lg border border-gray-200 bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Sparade utkast */}
      {drafts.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
              <FileText className="w-4 h-4" style={{ color: primary }} />
            </span>
            <h2 className="font-display font-bold text-gray-900 text-base">Sparade utkast</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2">
                <button onClick={() => loadDraft(d.id)} className="flex-1 text-left text-sm text-gray-800 hover:text-gray-900 font-medium truncate">{d.subject || "Utan ämnesrad"}</button>
                <button onClick={() => deleteDraft(d.id)} className="text-gray-300 hover:text-red-500" title="Ta bort"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {customerMode && <p className="text-xs text-gray-400">Testmejlet går bara till adressen du anger. Massutskick till en lista kommer i nästa version.</p>}
    </div>
  );
}
