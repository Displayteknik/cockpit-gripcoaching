"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, Trash2, Users, Package, TrendingUp, Search, Sparkles, ExternalLink } from "lucide-react";
import { landat, prisFranPalagg, summera, overGolv } from "@/lib/offert/kalkyl";

interface Product {
  id: string; name: string; supplier_name?: string | null;
  purchase_price?: number | null; freight?: number | null; markup_pct?: number | null; lead_time_days?: number | null; unit?: string | null;
}
interface Customer { name: string; company: string; ghlContactId: string; ghlOpportunityId: string }
interface Row { product_id: string | null; name: string; qty: number; unit_price: number | null; cost: number | null; lead_time_days: number | null }

function kr(n?: number | null) { return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—"; }
function nOrNull(v: string): number | null { const s = v.replace(",", ".").replace(/[^\d.]/g, ""); return s === "" ? null : Number(s); }

export default function OffertSkapa({ primaryColor = "#1A6B3C", onClose, onSaved }: { primaryColor?: string; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [namn, setNamn] = useState("");
  const [foretag, setForetag] = useState("");
  const [ghlContactId, setGhlContactId] = useState("");
  const [ghlOppId, setGhlOppId] = useState("");
  const [offertnr, setOffertnr] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [visaKunder, setVisaKunder] = useState(false);
  const [visaProdukter, setVisaProdukter] = useState(false);
  const [prodSok, setProdSok] = useState("");
  const [kundSok, setKundSok] = useState("");
  const [marknadQ, setMarknadQ] = useState("");
  const [marknad, setMarknad] = useState<{ text: string; sources: { title: string; uri: string }[] } | null>(null);
  const [marknadLoading, setMarknadLoading] = useState(false);
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offert/products").then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => {});
    fetch("/api/offert/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || [])).catch(() => {});
    const d = new Date();
    setOffertnr(`OFF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
  }, []);

  const totals = useMemo(() => summera(rows.map((r) => ({ qty: r.qty, unit_price: r.unit_price, cost: r.cost }))), [rows]);
  const golvOk = overGolv(totals.marginPct);

  const laggProdukt = (p: Product) => {
    const cost = landat(p.purchase_price, p.freight);
    const pris = prisFranPalagg(cost, p.markup_pct);
    setRows((rs) => [...rs, { product_id: p.id, name: p.name, qty: 1, unit_price: pris || null, cost: cost || null, lead_time_days: p.lead_time_days ?? null }]);
    setVisaProdukter(false); setProdSok("");
  };
  const laggFri = () => setRows((rs) => [...rs, { product_id: null, name: "", qty: 1, unit_price: null, cost: null, lead_time_days: null }]);
  const uppdatera = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const taBort = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const valjKund = (c: Customer) => {
    setNamn(c.name); setForetag(c.company); setGhlContactId(c.ghlContactId); setGhlOppId(c.ghlOpportunityId);
    setVisaKunder(false); setKundSok("");
  };

  const marknadskoll = async () => {
    if (!marknadQ.trim() || marknadLoading) return;
    setMarknadLoading(true);
    try {
      const r = await fetch("/api/offert/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: marknadQ.trim() }) });
      const d = await r.json();
      if (d.text) setMarknad({ text: d.text, sources: d.sources || [] });
      else setFel(d.error || "Marknadskoll misslyckades");
    } catch { setFel("Marknadskoll misslyckades"); } finally { setMarknadLoading(false); }
  };

  const spara = async () => {
    if (sparar) return;
    if (!rows.some((r) => r.name.trim())) { setFel("Lägg till minst en rad"); return; }
    setSparar(true); setFel(null);
    try {
      const r = await fetch("/api/offert/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_number: offertnr, customer_name: namn, customer_company: foretag, ghl_contact_id: ghlContactId, ghl_opportunity_id: ghlOppId, items: rows }),
      });
      const d = await r.json();
      if (d.ok) { onSaved(); onClose(); }
      else setFel(d.error || "Kunde inte spara");
    } catch { setFel("Kunde inte spara"); } finally { setSparar(false); }
  };

  const prodFiltrerade = products.filter((p) => !prodSok || p.name.toLowerCase().includes(prodSok.toLowerCase()));
  const kundFiltrerade = customers.filter((c) => !kundSok || `${c.name} ${c.company}`.toLowerCase().includes(kundSok.toLowerCase()));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[95vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between gap-3 z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: primaryColor }}>
              <Sparkles className="w-3.5 h-3.5" /> Ny offert
            </div>
            <div className="font-display font-bold text-gray-900 text-lg">Bygg din offert</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Kund */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide font-semibold text-gray-500">Kund</label>
              {customers.length > 0 && (
                <button onClick={() => setVisaKunder((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900">
                  <Users className="w-3.5 h-3.5" /> Välj ur pipeline ({customers.length})
                </button>
              )}
            </div>
            {visaKunder && (
              <div className="rounded-xl border border-gray-200 p-2 space-y-1 max-h-52 overflow-y-auto">
                <div className="flex items-center gap-1.5 px-2 py-1"><Search className="w-3.5 h-3.5 text-gray-400" />
                  <input value={kundSok} onChange={(e) => setKundSok(e.target.value)} placeholder="Sök kund…" className="flex-1 text-sm outline-none" />
                </div>
                {kundFiltrerade.map((c, i) => (
                  <button key={i} onClick={() => valjKund(c)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm">
                    <span className="font-medium text-gray-800">{c.name || "—"}</span>{c.company && c.company !== c.name ? <span className="text-gray-500"> · {c.company}</span> : null}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Kontaktperson" className="text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
              <input value={foretag} onChange={(e) => setForetag(e.target.value)} placeholder="Företag" className="text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
            </div>
            <input value={offertnr} onChange={(e) => setOffertnr(e.target.value)} placeholder="Offertnummer" className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
          </div>

          {/* Rader */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide font-semibold text-gray-500">Rader</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setVisaProdukter((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Package className="w-3.5 h-3.5" /> Ur katalog
                </button>
                <button onClick={laggFri} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Plus className="w-3.5 h-3.5" /> Fri rad
                </button>
              </div>
            </div>
            {visaProdukter && (
              <div className="rounded-xl border border-gray-200 p-2 space-y-1 max-h-52 overflow-y-auto">
                <div className="flex items-center gap-1.5 px-2 py-1"><Search className="w-3.5 h-3.5 text-gray-400" />
                  <input value={prodSok} onChange={(e) => setProdSok(e.target.value)} placeholder="Sök produkt…" className="flex-1 text-sm outline-none" />
                </div>
                {products.length === 0 && <div className="text-xs text-gray-400 px-2 py-1">Katalogen är tom — lägg in produkter först, eller använd Fri rad.</div>}
                {prodFiltrerade.map((p) => (
                  <button key={p.id} onClick={() => laggProdukt(p)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm flex justify-between">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-500 text-xs">{kr(prisFranPalagg(landat(p.purchase_price, p.freight), p.markup_pct))}</span>
                  </button>
                ))}
              </div>
            )}
            {rows.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-4 rounded-xl border border-dashed border-gray-200">Lägg till rader ur katalogen eller fri rad.</div>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r, i) => {
                  const tbKr = (Number(r.unit_price) || 0) - (Number(r.cost) || 0);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-2">
                      <input value={r.name} onChange={(e) => uppdatera(i, { name: e.target.value })} placeholder="Benämning" className="flex-1 min-w-0 text-sm bg-transparent outline-none" />
                      <input value={String(r.qty)} onChange={(e) => uppdatera(i, { qty: Number(nOrNull(e.target.value)) || 0 })} className="w-12 text-sm text-center bg-white rounded border border-gray-200 px-1 py-1" title="Antal" />
                      <input value={r.unit_price ?? ""} onChange={(e) => uppdatera(i, { unit_price: nOrNull(e.target.value) })} placeholder="à-pris" className="w-20 text-sm text-right bg-white rounded border border-gray-200 px-1.5 py-1" title="Pris/st" />
                      <span className={`text-[11px] w-16 text-right ${tbKr < 0 ? "text-red-500" : "text-gray-400"}`} title="TB/st">{r.cost != null ? `TB ${Math.round(tbKr)}` : ""}</span>
                      <button onClick={() => taBort(i)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summering */}
          {rows.length > 0 && (
            <div className="rounded-2xl border border-gray-100 p-4 grid grid-cols-3 gap-3" style={{ background: `${primaryColor}0a` }}>
              <div><div className="text-[11px] text-gray-500 uppercase">Ordervärde</div><div className="text-lg font-bold text-gray-900 tabular-nums">{kr(totals.total)}</div></div>
              <div><div className="text-[11px] text-gray-500 uppercase">TB</div><div className="text-lg font-bold tabular-nums" style={{ color: golvOk ? "#059669" : "#dc2626" }}>{kr(totals.tbKr)}</div></div>
              <div><div className="text-[11px] text-gray-500 uppercase">Marginal</div><div className="text-lg font-bold tabular-nums" style={{ color: golvOk ? "#059669" : "#dc2626" }}>{totals.marginPct}%</div></div>
              {!golvOk && totals.costTotal > 0 && <div className="col-span-3 text-xs text-red-600">⚠ Under 30 % golv — se över priser eller pålägg.</div>}
            </div>
          )}

          {/* Marknadskoll */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide font-semibold text-gray-500">Marknads- & prishjälp (valfritt)</label>
            <div className="flex items-center gap-2">
              <input value={marknadQ} onChange={(e) => setMarknadQ(e.target.value)} placeholder='t.ex. "marknadspris 65 tum digital skylt" eller "timpris snickare"'
                className="flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                onKeyDown={(e) => { if (e.key === "Enter") marknadskoll(); }} />
              <button onClick={marknadskoll} disabled={!marknadQ.trim() || marknadLoading} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-40" style={{ background: primaryColor }}>
                {marknadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Kolla
              </button>
            </div>
            {marknad && (
              <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {marknad.text}
                {marknad.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {marknad.sources.slice(0, 4).map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg px-2 py-0.5">
                        {s.title.slice(0, 30)} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {fel && <div className="text-xs text-red-600">{fel}</div>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">Avbryt</button>
            <button onClick={spara} disabled={sparar || rows.length === 0} className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40" style={{ background: primaryColor }}>
              {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Spara offert
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
