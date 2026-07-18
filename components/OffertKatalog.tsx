"use client";

import { useEffect, useRef, useState } from "react";
import { Package, Loader2, Plus, Upload, Pencil, Trash2, X, Truck, Clock, AlertTriangle } from "lucide-react";
import { calcRate } from "@/lib/offert/fx";

interface Product {
  id: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  supplier_name?: string | null;
  sku?: string | null;
  purchase_price?: number | null;
  freight?: number | null;
  currency?: string | null;
  lead_time_days?: number | null;
  markup_pct?: number | null;
  notes?: string | null;
}

const VALUTOR = ["SEK", "USD", "EUR", "CNY"];
const TOM: Partial<Product> = { name: "", category: "", unit: "st", supplier_name: "", currency: "SEK", purchase_price: null, freight: null, lead_time_days: null, markup_pct: null };

function nOrNull(v: string): number | null {
  const s = v.replace(",", ".").replace(/[^\d.]/g, "");
  return s === "" ? null : Number(s);
}
function kr(n?: number | null) {
  return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—";
}
// Landat pris i SEK = (inpris + frakt) × kalkylkurs (spot × buffert). Utländsk valuta räknas om.
function landatSEK(p: Partial<Product>, rates: Record<string, number>): number | null {
  if (typeof p.purchase_price !== "number") return null;
  const rate = calcRate(rates, p.currency);
  return Math.round((p.purchase_price + (Number(p.freight) || 0)) * rate);
}
function prisForslag(p: Partial<Product>, rates: Record<string, number>): number | null {
  const landat = landatSEK(p, rates);
  if (landat == null) return null;
  return Math.round(landat * (1 + (Number(p.markup_pct) || 0) / 100));
}

export default function OffertKatalog({ primaryColor = "#1A6B3C" }: { primaryColor?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Product> | null>(null);
  const [sparar, setSparar] = useState(false);
  const [importing, setImporting] = useState(false);
  const [supplierForImport, setSupplierForImport] = useState("");
  const [fel, setFel] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({ SEK: 1 });
  const [fxDate, setFxDate] = useState<string>("");
  const [importFlags, setImportFlags] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ladda = () => {
    setLoading(true);
    fetch("/api/offert/products").then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    ladda();
    fetch("/api/offert/fx").then((r) => r.json()).then((d) => { if (d.rates) setRates(d.rates); if (d.date) setFxDate(d.date); }).catch(() => {});
  }, []);

  const spara = async () => {
    if (!form?.name?.trim() || sparar) return;
    setSparar(true);
    setFel(null);
    try {
      const method = form.id ? "PUT" : "POST";
      const r = await fetch("/api/offert/products", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { setForm(null); ladda(); }
      else setFel(d.error || "Kunde inte spara");
    } catch { setFel("Kunde inte spara"); } finally { setSparar(false); }
  };

  const radera = async (id: string) => {
    if (!confirm("Ta bort produkten?")) return;
    await fetch(`/api/offert/products?id=${id}`, { method: "DELETE" });
    ladda();
  };

  const importera = async (file: File) => {
    setImporting(true); setFel(null); setImportFlags([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (supplierForImport.trim()) fd.append("supplierName", supplierForImport.trim());
      const r = await fetch("/api/offert/products/extract", { method: "POST", body: fd });
      const d = await r.json();
      if (d.ok) { setSupplierForImport(""); setImportFlags(d.flags || []); ladda(); }
      else setFel(d.error || "Kunde inte importera");
    } catch { setFel("Kunde inte importera"); } finally { setImporting(false); }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5" style={{ color: primaryColor }} />
          <h2 className="font-display font-bold text-gray-900 text-lg">Din produktkatalog</h2>
          <span className="text-xs text-gray-400">({products.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Importera prislista
          </button>
          <button
            onClick={() => setForm({ ...TOM })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" /> Ny produkt
          </button>
        </div>
      </div>

      {fel && <div className="text-xs text-red-600">{fel}</div>}

      {importFlags.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle className="w-3.5 h-3.5" /> Att kontrollera i prislistan</div>
          {importFlags.map((f, i) => <div key={i} className="text-xs text-amber-700 pl-5">• {f}</div>)}
        </div>
      )}

      {form && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900 text-sm">{form.id ? "Redigera produkt" : "Ny produkt"}</div>
            <button onClick={() => setForm(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Falt label="Namn" span2><In value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} placeholder="t.ex. Furuplank 45×95" /></Falt>
            <Falt label="Kategori"><In value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} /></Falt>
            <Falt label="Leverantör"><In value={form.supplier_name || ""} onChange={(v) => setForm({ ...form, supplier_name: v })} /></Falt>
            <Falt label="Enhet"><In value={form.unit || ""} onChange={(v) => setForm({ ...form, unit: v })} placeholder="st" /></Falt>
            <Falt label="Art.nr"><In value={form.sku || ""} onChange={(v) => setForm({ ...form, sku: v })} /></Falt>
            <Falt label="Valuta">
              <div className="flex gap-1">
                {VALUTOR.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, currency: c })}
                    className={`flex-1 text-xs font-semibold px-1 py-2 rounded-lg border ${(form.currency || "SEK") === c ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
                    style={(form.currency || "SEK") === c ? { background: primaryColor } : undefined}>{c}</button>
                ))}
              </div>
            </Falt>
            <Falt label={`Inpris (${form.currency || "SEK"})`}><In value={form.purchase_price ?? ""} onChange={(v) => setForm({ ...form, purchase_price: nOrNull(v) })} numeric /></Falt>
            <Falt label={`Frakt/enhet (${form.currency || "SEK"})`}><In value={form.freight ?? ""} onChange={(v) => setForm({ ...form, freight: nOrNull(v) })} numeric /></Falt>
            <Falt label="Ledtid (dgr)"><In value={form.lead_time_days ?? ""} onChange={(v) => setForm({ ...form, lead_time_days: nOrNull(v) })} numeric /></Falt>
            <Falt label="Pålägg (%)"><In value={form.markup_pct ?? ""} onChange={(v) => setForm({ ...form, markup_pct: nOrNull(v) })} numeric /></Falt>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {(form.currency && form.currency !== "SEK") && landatSEK(form, rates) != null && (
                <span className="mr-2">Landat: <span className="font-semibold text-gray-700">{kr(landatSEK(form, rates))}</span>
                  <span className="text-xs text-gray-400"> ({form.currency}→SEK, +3% buffert)</span></span>
              )}
              Prisförslag: <span className="font-bold text-gray-900">{prisForslag(form, rates) != null ? kr(prisForslag(form, rates)) : "—"}</span>
            </div>
            <button
              onClick={spara}
              disabled={!form.name?.trim() || sparar}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Spara
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${primaryColor}14` }}>
            <Package className="w-6 h-6" style={{ color: primaryColor }} />
          </span>
          <div className="font-semibold text-gray-900">Ingen produkt än</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Lägg in produkter manuellt eller importera en leverantörs prislista (Word/PDF) — så räknar vi pris och marginal åt dig när du bygger offerter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const pris = prisForslag(p, rates);
            const cur = p.currency || "SEK";
            const landat = landatSEK(p, rates);
            return (
              <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm truncate">{p.name}</span>
                    {p.category && <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{p.category}</span>}
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-xs text-gray-500 mt-1">
                    {p.supplier_name && <span>{p.supplier_name}</span>}
                    <span>Inpris {typeof p.purchase_price === "number" ? p.purchase_price.toLocaleString("sv-SE") : "—"} {cur}{p.unit ? `/${p.unit}` : ""}</span>
                    {p.freight != null && <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3" /> {p.freight.toLocaleString("sv-SE")} {cur}</span>}
                    {cur !== "SEK" && landat != null && <span className="text-gray-700 font-medium">= landat {kr(landat)}</span>}
                    {p.lead_time_days != null && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {p.lead_time_days} dgr</span>}
                    {p.markup_pct != null && <span>+{p.markup_pct}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-gray-900 tabular-nums">{pris != null ? kr(pris) : "—"}</div>
                    <div className="text-[11px] text-gray-400">prisförslag</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setForm(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => radera(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importera(f); e.target.value = ""; }}
      />
    </section>
  );
}

function Falt({ label, span2, children }: { label: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}
function In({ value, onChange, placeholder, numeric }: { value: string | number; onChange: (v: string) => void; placeholder?: string; numeric?: boolean }) {
  return (
    <input
      value={String(value)}
      inputMode={numeric ? "decimal" : undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
    />
  );
}
