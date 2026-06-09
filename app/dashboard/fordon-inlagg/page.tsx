"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type Vehicle, formatPrice } from "@/lib/supabase";
import { Sparkles, Loader2, Search, Copy, Check, RefreshCw, Image as ImageIcon, Save, Car } from "lucide-react";

type Row = Vehicle & { gallery?: string[] };

export default function FordonInlaggPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Row | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => setClientId(c?.id || null));
  }, []);

  const loadVehicles = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from("hm_vehicles")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_sold", false)
      .order("sort_order", { ascending: true });
    setVehicles(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const filtered = vehicles.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return v.title.toLowerCase().includes(s) || v.brand?.toLowerCase().includes(s);
  });

  const generate = useCallback(async (v: Row) => {
    setGenerating(true);
    setError("");
    setSavedMsg("");
    try {
      const r = await fetch("/api/fordon/post-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: v.id, platform: "instagram" }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kunde inte generera text"); return; }
      setHook(d.hook || "");
      setBody(d.body || "");
      setCta(d.cta || "");
      setHashtags((d.hashtags || []).join(" "));
      if (d.image_url) setImageUrl(d.image_url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }, []);

  const selectVehicle = (v: Row) => {
    setSelected(v);
    setImageUrl(v.image_url || v.gallery?.[0] || "");
    setHook(""); setBody(""); setCta(""); setHashtags("");
    setError(""); setSavedMsg("");
    generate(v);
  };

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setSavedMsg("");
    try {
      const tags = hashtags.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean);
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook, body, cta, hashtags: tags,
          image_url: imageUrl || null,
          format: "single", platform: "instagram", status: "draft",
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kunde inte spara"); return; }
      setSavedMsg("Sparat som utkast — finns nu under Inlägg / Veckoplan för schemaläggning.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const fullCaption = [hook, body, cta, hashtags.split(/[\s,]+/).filter(Boolean).map((h) => `#${h.replace(/^#/, "")}`).join(" ")]
    .filter(Boolean).join("\n\n");

  const copy = async () => {
    await navigator.clipboard.writeText(fullCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Car className="w-6 h-6 text-brand-blue" /> Fordonsinlägg
        </h1>
        <p className="text-sm text-gray-500 mt-1">Välj en bil → få ett färdigt textförslag i HM Motors röst → redigera och spara som utkast.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Bil-lista */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col max-h-[75vh]">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Sök bil..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {loading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Laddar...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Inga bilar</div>
            ) : (
              filtered.map((v) => (
                <button key={v.id} onClick={() => selectVehicle(v)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${selected?.id === v.id ? "bg-brand-blue/10 ring-1 ring-brand-blue/30" : "hover:bg-gray-50"}`}>
                  {v.image_url ? (
                    <img src={v.image_url} alt="" className="w-14 h-10 rounded object-cover bg-gray-100 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{v.title}</div>
                    <div className="text-xs text-gray-400">{v.price > 0 ? formatPrice(v.price) : v.price_label}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Förslag */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {!selected ? (
            <div className="text-center py-20 text-gray-400">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-300" />
              Välj en bil i listan så skapar jag ett inläggsförslag.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-32 h-24 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-32 h-24 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-6 h-6 text-gray-300" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900">{selected.title}</div>
                  <div className="text-sm text-gray-500">{selected.price > 0 ? formatPrice(selected.price) : selected.price_label}</div>
                  <button onClick={() => generate(selected)} disabled={generating}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-blue hover:text-brand-blue-dark font-medium disabled:opacity-50">
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {generating ? "Genererar..." : "Generera nytt förslag"}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Bildens riktiga foto används i inlägget.</p>
                </div>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

              {generating && !body ? (
                <div className="py-10 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Skriver förslag i HM Motors röst...
                </div>
              ) : (
                <>
                  <Field label="Hook" value={hook} onChange={setHook} rows={2} />
                  <Field label="Brödtext" value={body} onChange={setBody} rows={7} />
                  <Field label="CTA" value={cta} onChange={setCta} rows={2} />
                  <Field label="Hashtags (mellanslag)" value={hashtags} onChange={setHashtags} rows={2} />

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button onClick={save} disabled={saving || !body.trim()}
                      className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Spara som utkast
                    </button>
                    <button onClick={copy} disabled={!body.trim()}
                      className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Kopierat" : "Kopiera text"}
                    </button>
                    {savedMsg && <span className="text-sm text-emerald-700">{savedMsg}</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none" />
    </div>
  );
}
