"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, ArrowLeft, Loader2, AlertTriangle, Check, FileText } from "lucide-react";
import { DashHero } from "@/components/ui/dash";

interface Tier { qty: number; unit_price: number; freight_per_unit?: number; shipping_way?: string }
interface Article { model_no: string; description?: string; category?: string; tiers: Tier[] }
interface Extraction {
  supplier: { name: string; contact_name?: string; incoterm?: string; warranty?: string; production_days_note?: string };
  currency: string; currency_uncertain?: boolean; validity_days?: number; articles: Article[];
}
interface DiffRad { sku: string; qty_tier: number; shipping_way: string; falt?: string; fran?: number; till?: number; unit_price?: number; freight_per_unit?: number }
interface Diff { nya: DiffRad[]; andrade: DiffRad[]; oforandrade: number }

export default function UppladdningPage() {
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [ex, setEx] = useState<Extraction | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setError(null); setSaved(null); setEx(null); setDiff(null); setFileName(f.name); setExtracting(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const resp = await fetch("/api/prislistan/uppladdning/extrahera", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64: b64, mimeType: f.type || "application/pdf" }),
      });
      const d = await resp.json();
      if (d.error) { setError(d.error + (d.detail ? " — " + d.detail : "")); return; }
      setEx(d.extraction); setFlags(d.flags || []);
      hamtaDiff(d.extraction);
    } catch (e) { setError(String(e)); } finally { setExtracting(false); }
  }

  async function hamtaDiff(extraction: Extraction) {
    try {
      const resp = await fetch("/api/prislistan/uppladdning/diff", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ articles: extraction.articles }),
      });
      const d = await resp.json();
      if (!d.error) setDiff(d);
    } catch { /* diffvyn är extra info */ }
  }

  async function spara() {
    if (!ex) return;
    setSaving(true); setError(null);
    try {
      const resp = await fetch("/api/prislistan/uppladdning/spara", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ supplier: ex.supplier, currency: ex.currency, validity_days: ex.validity_days, articles: ex.articles, notes: `Källa: ${fileName}` }),
      });
      const d = await resp.json();
      if (!resp.ok || d.error) { setError(d.error + (d.detail ? " — " + d.detail : "")); return; }
      const flaggText = d.marginalflaggor?.length ? ` ${d.marginalflaggor.length} artikel(ar) fick en ny inpris-flagga, kolla marginalen.` : "";
      setSaved(`Sparat: ${d.sparade_rader} prisrader. Kurs ${ex.currency}/SEK ${d.fx_rate} (kalkylkurs ${d.calc_rate}) fryst.${flaggText}`);
      setDiff(null); setEx(null);
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-8">
      <DashHero
        title="Läs in prislista"
        subtitle="Ladda upp leverantörens prislista (ditt inköp, t.ex. TODISP i USD) — inte din kundoffert. Du ser exakt vad som ändras innan något sparas."
        icon={Upload}
        accent="#2563eb"
      />
      <Link href="/dashboard/prislistan" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Tillbaka till prislistan
      </Link>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-gray-500 shadow-sm hover:border-gray-300">
        <Upload className="h-6 w-6 text-gray-400" />
        <span className="text-sm">{fileName || "Dra hit eller klicka — PDF, Excel eller foto"}</span>
        <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>

      {extracting && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Läser prislistan…</div>}
      {error && <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {saved && <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check className="h-4 w-4" /> {saved}</div>}

      {ex && !saved && (
        <div className="space-y-4">
          {flags.length > 0 && (
            <div className="space-y-1.5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Kontrollera ({flags.length})</div>
              {flags.map((f, i) => <p key={i} className="text-sm text-amber-800">{f}</p>)}
            </div>
          )}

          {diff && (diff.nya.length > 0 || diff.andrade.length > 0) && (
            <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jämfört mot tidigare inläsningar · {diff.oforandrade} oförändrade</div>
              {diff.andrade.map((r, i) => (
                <div key={`a${i}`} className="flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
                  <span className="font-mono text-blue-600">{r.sku}</span>
                  <span className="text-gray-400">qty {r.qty_tier}{r.shipping_way ? ` · ${r.shipping_way}` : ""} · {r.falt}:</span>
                  <span className="text-gray-400 line-through">{r.fran}</span> → <span className="font-medium text-amber-600">{r.till}</span>
                </div>
              ))}
              {diff.nya.map((r, i) => (
                <div key={`n${i}`} className="text-sm text-emerald-700">
                  <span className="font-mono">{r.sku}</span> <span className="text-gray-400">qty {r.qty_tier}{r.shipping_way ? ` · ${r.shipping_way}` : ""} — ny rad, {r.unit_price} + frakt {r.freight_per_unit}</span>
                </div>
              ))}
            </div>
          )}
          {diff && diff.nya.length === 0 && diff.andrade.length === 0 && (
            <div className="text-sm text-gray-400">Inget nytt mot tidigare inläsningar — {diff.oforandrade} rader oförändrade.</div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-700">
              <b>{ex.supplier.name}</b> {ex.currency_uncertain && <span className="text-amber-600">(valuta osäker: {ex.currency})</span>}
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-500">
              {ex.articles.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className="h-3 w-3" /> {a.model_no} — {a.tiers.length} nivå{a.tiers.length === 1 ? "" : "er"}
                </div>
              ))}
            </div>
          </div>

          <button onClick={spara} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Spara prislista ({ex.currency}, kurs fryses)
          </button>
        </div>
      )}
    </div>
  );
}
