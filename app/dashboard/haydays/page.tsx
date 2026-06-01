"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Save, Rocket, ArrowUp, ArrowDown, ExternalLink, Wand2 } from "lucide-react";

type Partner = { name: string; url: string; logo: string; initials: string; wide: boolean };
type Klass = { namn: string; spec: string };
type Oppet = { dag: string; tid: string };
type Content = {
  hero?: { tagline?: string };
  eventet?: { lead1?: string; lead2?: string };
  historien?: { p1?: string; p2?: string; p3?: string; avslut?: string };
  oppettider?: Oppet[];
  klasser?: Klass[];
  partners?: Partner[];
};

const SECTION = "rounded-2xl border border-gray-200 bg-white p-5 sm:p-6";
const H = "font-display font-bold text-gray-900";
const LBL = "block text-xs font-semibold text-gray-500 mb-1";
const INPUT = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
const BTN_SM = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium";

export default function HaydaysPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/haydays/content")
      .then((r) => r.status === 403 ? Promise.reject("forbidden") : r.json())
      .then((c) => { setContent(c || {}); setLoading(false); })
      .catch(() => { setForbidden(true); setLoading(false); });
  }, []);

  const update = useCallback((fn: (c: Content) => Content) => {
    setContent((prev) => fn(structuredClone(prev || {})));
    setDirty(true);
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 5000); };

  const save = async () => {
    if (!content) return;
    setSaving(true);
    const r = await fetch("/api/haydays/content", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const j = await r.json();
    setSaving(false);
    if (j.ok) { setDirty(false); flash("Sparat ✓"); } else flash(j.error || "Kunde inte spara");
  };

  const publish = async () => {
    setPublishing(true);
    const r = await fetch("/api/haydays/publish", { method: "POST" });
    const j = await r.json();
    setPublishing(false);
    flash(j.message || j.error || "Publicering startad");
  };

  if (loading) return <div className="text-gray-500 py-12 text-center">Laddar…</div>;
  if (forbidden) return (
    <div className="max-w-xl mx-auto py-16 text-center">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Välj Hay Days-klienten</h1>
      <p className="text-gray-600">Den här sidan redigerar Scandinavian Hay Days-sajten. Byt aktiv klient till <strong>Scandinavian Hay Days</strong> i sidomenyn.</p>
    </div>
  );

  const c = content!;
  const partners = c.partners || [];
  const klasser = c.klasser || [];
  const oppet = c.oppettider || [];

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Hay Days-sajten</h1>
          <p className="text-sm text-gray-500">Redigera innehåll och publicera till scandinavian-haydays.netlify.app</p>
        </div>
        <a href="https://scandinavian-haydays.netlify.app" target="_blank" rel="noopener"
           className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ExternalLink className="w-4 h-4" /> Visa sajt
        </a>
      </div>

      <div className="space-y-6">
        {/* TEXTER */}
        <section className={SECTION}>
          <h2 className={`${H} text-lg mb-4`}>Texter</h2>
          <div className="space-y-4">
            <div>
              <label className={LBL}>Hero — slogan</label>
              <input className={INPUT} value={c.hero?.tagline || ""}
                onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, tagline: e.target.value } }))} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Intro — stycke 1</label>
                <textarea className={`${INPUT} h-28`} value={c.eventet?.lead1 || ""}
                  onChange={(e) => update((d) => ({ ...d, eventet: { ...d.eventet, lead1: e.target.value } }))} />
              </div>
              <div>
                <label className={LBL}>Intro — stycke 2</label>
                <textarea className={`${INPUT} h-28`} value={c.eventet?.lead2 || ""}
                  onChange={(e) => update((d) => ({ ...d, eventet: { ...d.eventet, lead2: e.target.value } }))} />
              </div>
            </div>
          </div>
        </section>

        {/* HISTORIEN */}
        <section className={SECTION}>
          <h2 className={`${H} text-lg mb-1`}>Historien</h2>
          <p className="text-xs text-gray-400 mb-4">Du kan använda &lt;strong&gt;fet text&lt;/strong&gt; i styckena.</p>
          <div className="space-y-4">
            {(["p1", "p2", "p3"] as const).map((k, i) => (
              <div key={k}>
                <label className={LBL}>Stycke {i + 1}</label>
                <textarea className={`${INPUT} h-24`} value={c.historien?.[k] || ""}
                  onChange={(e) => update((d) => ({ ...d, historien: { ...d.historien, [k]: e.target.value } }))} />
              </div>
            ))}
            <div>
              <label className={LBL}>Avslutning (kort)</label>
              <input className={INPUT} value={c.historien?.avslut || ""}
                onChange={(e) => update((d) => ({ ...d, historien: { ...d.historien, avslut: e.target.value } }))} />
            </div>
          </div>
        </section>

        {/* ÖPPETTIDER */}
        <section className={SECTION}>
          <h2 className={`${H} text-lg mb-4`}>Öppettider</h2>
          <div className="space-y-2">
            {oppet.map((o, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={INPUT} placeholder="Dag (t.ex. Fre 31 juli)" value={o.dag}
                  onChange={(e) => update((d) => { d.oppettider![i].dag = e.target.value; return d; })} />
                <input className={INPUT} placeholder="Tid (t.ex. kl. 10–20)" value={o.tid}
                  onChange={(e) => update((d) => { d.oppettider![i].tid = e.target.value; return d; })} />
                <button className={`${BTN_SM} text-red-600 hover:bg-red-50`}
                  onClick={() => update((d) => { d.oppettider!.splice(i, 1); return d; })}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button className={`${BTN_SM} text-blue-700 hover:bg-blue-50 mt-1`}
              onClick={() => update((d) => ({ ...d, oppettider: [...(d.oppettider || []), { dag: "", tid: "" }] }))}>
              <Plus className="w-4 h-4" /> Lägg till dag
            </button>
          </div>
        </section>

        {/* KLASSER */}
        <section className={SECTION}>
          <h2 className={`${H} text-lg mb-4`}>Tävlingsklasser</h2>
          <div className="space-y-2">
            {klasser.map((k, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className={INPUT} placeholder="Klass (t.ex. Sport)" value={k.namn}
                  onChange={(e) => update((d) => { d.klasser![i].namn = e.target.value; return d; })} />
                <input className={INPUT} placeholder="Spec (t.ex. 700cc — kan lämnas tom)" value={k.spec}
                  onChange={(e) => update((d) => { d.klasser![i].spec = e.target.value; return d; })} />
                <div className="flex">
                  <button disabled={i === 0} className={`${BTN_SM} text-gray-400 hover:text-gray-700 disabled:opacity-30`}
                    onClick={() => update((d) => { const a = d.klasser!; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return d; })}><ArrowUp className="w-4 h-4" /></button>
                  <button disabled={i === klasser.length - 1} className={`${BTN_SM} text-gray-400 hover:text-gray-700 disabled:opacity-30`}
                    onClick={() => update((d) => { const a = d.klasser!; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return d; })}><ArrowDown className="w-4 h-4" /></button>
                  <button className={`${BTN_SM} text-red-600 hover:bg-red-50`}
                    onClick={() => update((d) => { d.klasser!.splice(i, 1); return d; })}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button className={`${BTN_SM} text-blue-700 hover:bg-blue-50 mt-1`}
              onClick={() => update((d) => ({ ...d, klasser: [...(d.klasser || []), { namn: "", spec: "" }] }))}>
              <Plus className="w-4 h-4" /> Lägg till klass
            </button>
          </div>
        </section>

        {/* PARTNERS */}
        <section className={SECTION}>
          <h2 className={`${H} text-lg mb-1`}>Samarbetspartners</h2>
          <p className="text-xs text-gray-400 mb-4">Initialer visas om loggan saknas. Tips: klicka trollstaven för att hämta logga automatiskt från webbadressen.</p>
          <div className="space-y-3">
            {partners.map((p, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 overflow-hidden text-xs font-bold text-gray-500">
                    {p.logo ? <img src={p.logo} alt="" className="h-full w-full object-contain" /> : (p.initials || "?")}
                  </span>
                  <input className={`${INPUT} font-medium`} placeholder="Företagsnamn" value={p.name}
                    onChange={(e) => update((d) => { d.partners![i].name = e.target.value; return d; })} />
                  <div className="flex flex-shrink-0">
                    <button disabled={i === 0} className={`${BTN_SM} text-gray-400 hover:text-gray-700 disabled:opacity-30`}
                      onClick={() => update((d) => { const a = d.partners!; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return d; })}><ArrowUp className="w-4 h-4" /></button>
                    <button disabled={i === partners.length - 1} className={`${BTN_SM} text-gray-400 hover:text-gray-700 disabled:opacity-30`}
                      onClick={() => update((d) => { const a = d.partners!; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return d; })}><ArrowDown className="w-4 h-4" /></button>
                    <button className={`${BTN_SM} text-red-600 hover:bg-red-50`}
                      onClick={() => update((d) => { d.partners!.splice(i, 1); return d; })}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <input className={INPUT} placeholder="Länk (https://…)" value={p.url}
                    onChange={(e) => update((d) => { d.partners![i].url = e.target.value; return d; })} />
                  <div className="flex gap-1">
                    <input className={INPUT} placeholder="Logga-URL (lämna tom för initialer)" value={p.logo}
                      onChange={(e) => update((d) => { d.partners![i].logo = e.target.value; return d; })} />
                    <button title="Hämta logga från länken" className={`${BTN_SM} text-blue-700 hover:bg-blue-50 flex-shrink-0`}
                      onClick={() => update((d) => {
                        try {
                          const host = new URL(d.partners![i].url).hostname.replace(/^www\./, "");
                          d.partners![i].logo = `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
                        } catch { /* ogiltig url */ }
                        return d;
                      })}><Wand2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input className={`${INPUT} w-20`} placeholder="Init." value={p.initials}
                      onChange={(e) => update((d) => { d.partners![i].initials = e.target.value; return d; })} />
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={!!p.wide}
                        onChange={(e) => update((d) => { d.partners![i].wide = e.target.checked; return d; })} /> Bred
                    </label>
                  </div>
                </div>
              </div>
            ))}
            <button className={`${BTN_SM} text-blue-700 hover:bg-blue-50 mt-1`}
              onClick={() => update((d) => ({ ...d, partners: [...(d.partners || []), { name: "", url: "", logo: "", initials: "", wide: false }] }))}>
              <Plus className="w-4 h-4" /> Lägg till partner
            </button>
          </div>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500 truncate">{msg || (dirty ? "Osparade ändringar" : "Allt sparat")}</span>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? "Sparar…" : "Spara"}
            </button>
            <button onClick={publish} disabled={publishing || dirty}
              title={dirty ? "Spara först" : "Publicera live"}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              <Rocket className="w-4 h-4" /> {publishing ? "Publicerar…" : "Publicera"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
