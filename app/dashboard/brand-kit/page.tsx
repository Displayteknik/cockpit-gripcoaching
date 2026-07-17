"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Palette, Save, Check, Loader2, Upload, Type, Sparkles, ImageIcon, Ban, Wand2, Layers } from "lucide-react";

const FONTS = ["Inter", "Archivo", "Poppins", "Anton", "Playfair Display"];
const COLOR_ROLES: { key: string; label: string; hint: string }[] = [
  { key: "primary", label: "Primär", hint: "Rubriker, bärande ytor" },
  { key: "primaryDeep", label: "Primär mörk", hint: "Kontrast, footrar" },
  { key: "primaryLight", label: "Primär ljus", hint: "Hover, ljusa ytor" },
  { key: "accent", label: "Accent", hint: "Penselruta, badge, CTA" },
  { key: "support", label: "Stödfärg", hint: "Lugna bakgrundszoner" },
  { key: "ink", label: "Text", hint: "Brödtext på ljust" },
  { key: "paper", label: "Bakgrund", hint: "Ljus bakgrund" },
];

type Kit = Record<string, any>;

function shade(hex: string, t: number): string {
  const h = hex.replace("#", ""); if (h.length < 6) return hex;
  const p = (i: number) => { const c = parseInt(h.slice(i, i + 2), 16); const v = t < 0 ? c * (1 + t) : c + (255 - c) * t; return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"); };
  return `#${p(0)}${p(2)}${p(4)}`;
}

export default function BrandKitPage() {
  const [kit, setKit] = useState<Kit>({});
  const [clientName, setClientName] = useState("");
  const [clientPrimary, setClientPrimary] = useState("#1A6B3C");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentNote, setAgentNote] = useState("");

  useEffect(() => {
    fetch("/api/brand-kit").then((r) => r.json()).then((d) => {
      setKit(d.kit || {}); setClientName(d.clientName || ""); setClientPrimary(d.clientPrimary || "#1A6B3C");
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Hjälpare: sätt nästlat värde
  const set = useCallback((path: string, value: unknown) => {
    setKit((prev) => {
      const next = structuredClone(prev);
      const keys = path.split("."); let o: Record<string, any> = next;
      for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] || {}; o = o[keys[i]]; }
      o[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const colors = kit.colors || {};
  const primaryForDerive = colors.primary || clientPrimary;

  const save = useCallback(async () => {
    setError(""); setSaving(true);
    try {
      const r = await fetch("/api/brand-kit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kit }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte spara");
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }, [kit]);

  const uploadLogo = useCallback(async (file: File, slot: "primaryUrl" | "onDarkUrl" | "iconUrl") => {
    setError(""); setUploading(slot);
    try {
      const r = await fetch("/api/studio/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size, bucket: "brand-assets" }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      set(`logo.${slot}`, d.publicUrl);
    } catch (e) { setError((e as Error).message); } finally { setUploading(""); }
  }, [set]);

  const runAgent = useCallback(async () => {
    setError(""); setAgentNote(""); setAgentLoading(true);
    try {
      const r = await fetch("/api/brand-kit/agent", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Analysen misslyckades");
      const p = d.proposed || {};
      // Slå ihop förslaget (fyller bara det agenten hittade — skriver över tomt).
      setKit((prev) => {
        const next = structuredClone(prev);
        if (p.colors) next.colors = { ...(next.colors || {}), ...p.colors };
        if (p.fonts) next.fonts = { ...(next.fonts || {}), ...p.fonts };
        if (p.logo) next.logo = { ...(next.logo || {}), ...p.logo };
        if (p.imageStyle) next.imageStyle = { ...(next.imageStyle || {}), ...p.imageStyle };
        if (p.contentProfile) next.contentProfile = { ...(next.contentProfile || {}), ...p.contentProfile };
        if (p.donts) next.donts = p.donts;
        return next;
      });
      const bits = [p.colors && "färger", p.fonts && "typsnitt", p.logo && "logga", p.imageStyle && "bildstil", p.contentProfile && "format", p.donts && "vill-inte-ha"].filter(Boolean);
      setAgentNote(bits.length ? `Förslag infogat: ${bits.join(", ")}. Granska och tryck Spara.` : "Hittade inget säkert att föreslå — fyll i manuellt.");
    } catch (e) { setError((e as Error).message); } finally { setAgentLoading(false); }
  }, []);

  const previewColors = useMemo(() => ({
    primary: colors.primary || clientPrimary,
    accent: colors.accent || "#F2B01E",
    support: colors.support || "#7ECECA",
    ink: colors.ink || "#1A1A1A",
    paper: colors.paper || "#FFFFFF",
  }), [colors, clientPrimary]);

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";
  const card = "bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4";
  const logoRef = useRef<HTMLInputElement>(null);

  if (loading) return <div className="p-8 text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Laddar grafisk profil…</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between sticky top-0 bg-gray-50 -mx-4 px-4 py-3 z-10 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${previewColors.primary}1a` }}><Palette className="w-6 h-6" style={{ color: previewColors.primary }} /></span>
            <div>
              <h1 className="font-display font-bold text-2xl text-gray-900">Grafisk profil</h1>
              <p className="text-sm text-gray-500">Logga, färger, typsnitt, element och bildstil — så allt innehåll blir rätt automatiskt. {clientName && `Klient: ${clientName}`}</p>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: previewColors.primary }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saving ? "Sparar…" : saved ? "Sparat" : "Spara"}
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Auto-setup från webbplatsen */}
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white shadow-sm p-4 flex items-center gap-3 flex-wrap">
          <button onClick={runAgent} disabled={agentLoading} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40" style={{ background: previewColors.primary }}>
            {agentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Hämta från webbplatsen
          </button>
          <span className="text-sm text-gray-500">Låt AI:n läsa av logga, färger och typsnitt från kundens sajt — du granskar och justerar innan du sparar.</span>
          {agentNote && <span className="text-sm w-full font-medium" style={{ color: previewColors.primary }}>{agentNote}</span>}
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="space-y-6">
            {/* Logotyp */}
            <section className={card}>
              <div className="flex items-center gap-2"><Upload className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Logotyp</h2></div>
              <div className="grid grid-cols-3 gap-3">
                {([["primaryUrl", "På ljus botten"], ["onDarkUrl", "På mörk botten"], ["iconUrl", "Symbol/ikon"]] as const).map(([slot, label]) => (
                  <div key={slot}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <label className="block rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 cursor-pointer p-3 text-center" style={{ background: slot === "onDarkUrl" ? "#1f2937" : "#fff" }}>
                      {uploading === slot ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /> : kit.logo?.[slot] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={kit.logo[slot]} alt="" className="max-h-14 mx-auto object-contain" />
                      ) : <span className="text-xs text-gray-400">Ladda upp</span>}
                      <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f, slot); }} />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            {/* Färger */}
            <section className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Palette className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Färger</h2></div>
                <button onClick={() => { set("colors.primaryDeep", shade(primaryForDerive, -0.28)); set("colors.primaryLight", shade(primaryForDerive, 0.35)); }} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"><Wand2 className="w-3.5 h-3.5" /> Härled mörk/ljus</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COLOR_ROLES.map((role) => (
                  <div key={role.key} className="flex items-center gap-2">
                    <input type="color" value={colors[role.key] || (role.key === "primary" ? clientPrimary : "#ffffff")} onChange={(e) => set(`colors.${role.key}`, e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800">{role.label}</div>
                      <div className="text-[11px] text-gray-400 truncate">{role.hint}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Förbjudna färger (kommaseparerade hex)</label>
                <input value={(colors.forbidden || []).join(", ")} onChange={(e) => set("colors.forbidden", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="#FF0000, #000080" className={inputCls} />
              </div>
            </section>

            {/* Typsnitt */}
            <section className={card}>
              <div className="flex items-center gap-2"><Type className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Typsnitt</h2></div>
              <div className="grid sm:grid-cols-2 gap-3">
                {([["headline", "Rubrik"], ["body", "Brödtext"]] as const).map(([slot, label]) => (
                  <div key={slot}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <select value={kit.fonts?.[slot] || "Inter"} onChange={(e) => set(`fonts.${slot}`, e.target.value)} className={inputCls}>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <div className="mt-1 text-xl text-gray-800" style={{ fontFamily: `${kit.fonts?.[slot] || "Inter"}, sans-serif` }}>Aa Bb Cc åäö</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Grafiska element */}
            <section className={card}>
              <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Grafiska element</h2></div>
              <div className="space-y-2">
                {([["brush", "Penseldrags-ruta"], ["badge", "Stjärn-/pris-badge"], ["lines", "Avdelar-linjer"], ["shapes", "Geometriska former"], ["underline", "Handritad understrykning"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={kit.elements?.[key]?.enabled ?? (key === "brush" || key === "badge")} onChange={(e) => set(`elements.${key}.enabled`, e.target.checked)} style={{ accentColor: previewColors.primary }} />
                    {label}
                  </label>
                ))}
              </div>
            </section>

            {/* Bildstil */}
            <section className={card}>
              <div className="flex items-center gap-2"><ImageIcon className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Bildstil</h2></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
                  <select value={kit.imageStyle?.mode || "photo"} onChange={(e) => set("imageStyle.mode", e.target.value)} className={inputCls}>
                    <option value="photo">Foto</option><option value="illustration">Illustration</option><option value="mixed">Blandat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Färgton</label>
                  <select value={kit.imageStyle?.colorGrade || "neutral"} onChange={(e) => set("imageStyle.colorGrade", e.target.value)} className={inputCls}>
                    <option value="warm">Varm</option><option value="cool">Kall</option><option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stil-beskrivning (bilder ska kännas som…)</label>
                <input value={kit.imageStyle?.prompt || ""} onChange={(e) => set("imageStyle.prompt", e.target.value)} placeholder="Verkliga människor i nordisk miljö, naturligt ljus" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Undvik i bilder</label>
                <input value={kit.imageStyle?.negative || ""} onChange={(e) => set("imageStyle.negative", e.target.value)} placeholder="stockfoto-känsla, plastigt leende, text i bild" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={kit.imageStyle?.people ?? true} onChange={(e) => set("imageStyle.people", e.target.checked)} style={{ accentColor: previewColors.primary }} /> Får innehålla människor
              </label>
            </section>

            {/* Format & innehåll */}
            <section className={card}>
              <div className="flex items-center gap-2"><Layers className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Format & innehåll</h2></div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Typ av verksamhet</label>
                  <select value={kit.contentProfile?.clientType || ""} onChange={(e) => set("contentProfile.clientType", e.target.value)} className={inputCls}>
                    <option value="">—</option><option value="retail">Butik / retail</option><option value="coach">Coach / personlig utv.</option>
                    <option value="consultant">Konsult / tjänst</option><option value="b2b-tech">B2B / teknik</option><option value="automotive">Fordon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Textvikt</label>
                  <select value={kit.contentProfile?.textWeight || "balanced"} onChange={(e) => set("contentProfile.textWeight", e.target.value)} className={inputCls}>
                    <option value="poster">Affisch (lite text)</option><option value="balanced">Balanserad</option><option value="text-first">Text-först (mycket text)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Overlay-stil (foto+text)</label>
                  <select value={kit.contentProfile?.overlayStyle || "scrim-bottom"} onChange={(e) => set("contentProfile.overlayStyle", e.target.value)} className={inputCls}>
                    <option value="scrim-bottom">Mörkning nedtill</option><option value="scrim-full">Mörkning hela</option><option value="band">Färgband</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Föreslagna format <span className="text-gray-400 font-normal">— alla format finns alltid tillgängliga; dessa markeras "Föreslås"</span></label>
                <div className="flex flex-wrap gap-2">
                  {([["overlay", "Foto+overlay"], ["text-only", "Textkort"], ["quote", "Citat"], ["carousel", "Karusell"], ["poster", "Affisch"], ["statement", "Statement"], ["list", "Lista"], ["offer", "Erbjudande"]] as const).map(([key, label]) => {
                    const on = (kit.contentProfile?.formats || []).includes(key);
                    return (
                      <button key={key} onClick={() => { const cur: string[] = kit.contentProfile?.formats || []; set("contentProfile.formats", on ? cur.filter((x) => x !== key) : [...cur, key]); }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={on ? { background: previewColors.primary, color: "#fff", borderColor: previewColors.primary } : { background: "#fff", color: "#374151", borderColor: "#e5e7eb" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Fot + Vill inte ha */}
            <section className={card}>
              <div className="flex items-center gap-2"><Ban className="w-5 h-5" style={{ color: previewColors.primary }} /><h2 className="font-display font-bold text-gray-900 text-lg">Fot & vill-inte-ha</h2></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={kit.footer?.tagline || ""} onChange={(e) => set("footer.tagline", e.target.value)} placeholder="Tagline (kort slogan under loggan)" className={inputCls} />
                <input value={kit.footer?.address || ""} onChange={(e) => set("footer.address", e.target.value)} placeholder="Adress · ort · telefon" className={inputCls} />
                <input value={kit.footer?.ctaLabel || ""} onChange={(e) => set("footer.ctaLabel", e.target.value)} placeholder="CTA-text (Boka online…)" className={inputCls} />
                <input value={kit.footer?.ctaUrl || ""} onChange={(e) => set("footer.ctaUrl", e.target.value)} placeholder="CTA-länk" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Vill inte ha (en per rad)</label>
                <textarea value={(kit.donts || []).join("\n")} onChange={(e) => set("donts", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} rows={3} placeholder={"Aldrig emojis i grafik\nIngen röd färg"} className={inputCls} />
              </div>
            </section>
          </div>

          {/* Live-palett (sticky) */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <section className={card}>
              <h3 className="font-display font-bold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Live-palett</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(previewColors).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className="w-full aspect-square rounded-lg border border-gray-100" style={{ background: v as string }} />
                    <div className="text-[10px] text-gray-400 mt-1">{k}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-4 space-y-1" style={{ background: previewColors.paper, border: "1px solid #eee" }}>
                <div className="font-bold text-xl" style={{ color: previewColors.primary, fontFamily: `${kit.fonts?.headline || "Inter"}, sans-serif` }}>{clientName || "Rubrik"}</div>
                <div style={{ color: previewColors.ink, fontFamily: `${kit.fonts?.body || "Inter"}, sans-serif` }}>Så här ser brödtexten ut.</div>
                <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: previewColors.accent, color: "#1a1a1a" }}>Accent / CTA</span>
              </div>
              <p className="text-xs text-gray-400">Full mall-förhandsvisning i Studio när mallarna använder profilen.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
