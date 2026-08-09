"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, Trash2, Users, Package, TrendingUp, Search, Sparkles, ExternalLink, Database, AlertTriangle, Ban } from "lucide-react";
import { landat, prisFranPalagg, summera, overGolv } from "@/lib/offert/kalkyl";
import { calcRate } from "@/lib/offert/fx";

interface Product {
  id: string; name: string; supplier_name?: string | null; currency?: string | null;
  purchase_price?: number | null; freight?: number | null; markup_pct?: number | null; lead_time_days?: number | null; unit?: string | null;
}
interface Customer { name: string; company: string; ghlContactId: string; ghlOpportunityId: string }
interface Row {
  product_id: string | null; name: string; qty: number; unit_price: number | null; cost: number | null; lead_time_days: number | null;
  inkop_trappa_id?: string | null; fraktsatt?: string | null; harkomst?: string | null;
}

// OFFERT-2: uppslag mot inköpsdatabasen.
interface InkopProdukt {
  produktnyckel: string; produktnamn: string; storlek: string | null; ljusstyrka: string | null; miljo: string | null;
  modellnr: string | null; harNagonFrakt: boolean; trappor: { antal: number }[];
}
interface Fraktalternativ { fraktsatt: string; etikett: string; frakt_styck: number; landat_styck: number; landat_order: number; kalla: string }
interface Flagga { kod: string; niva: "blockerande" | "varning" | "info"; text: string }
interface Uppslag {
  typ: "uppslag"; produktnyckel: string; antal: number; trappa_id: string; exw_styck: number; valuta: string;
  ledtid: string | null; alternativ: Fraktalternativ[]; saknade: { fraktsatt: string; etikett: string }[];
  billigast: Fraktalternativ | null; trappor: number[]; kalla: string; flaggor: Flagga[];
  produkt: { produktnamn: string } | null;
}
interface TrappaSaknas { typ: "trappa_saknas"; text: string; trappor: number[] }
interface ProduktSaknas { typ: "produkt_saknas"; text: string }
type UppslagSvar = Uppslag | TrappaSaknas | ProduktSaknas;

function kr(n?: number | null) { return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—"; }
function nOrNull(v: string): number | null { const s = v.replace(",", ".").replace(/[^\d.]/g, ""); return s === "" ? null : Number(s); }

export default function OffertSkapa({ primaryColor = "#1A6B3C", onClose, onSaved, forifyllNamn, forifyllForetag, forifyllContactId, forifyllOppId }: { primaryColor?: string; onClose: () => void; onSaved: () => void; forifyllNamn?: string; forifyllForetag?: string; forifyllContactId?: string; forifyllOppId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Kommer offerten ur en webbförfrågan eller ett Fokus-kort är kunden redan känd. Fälten är
  // fortsatt redigerbara — och att välja en kund ur pipelinen skriver över dem som vanligt.
  // Kommer den från ett Fokus-kort följer även affärens id med, så att offerten binds till
  // rätt affär i MySales i stället för att bli en lös rad.
  const [namn, setNamn] = useState(forifyllNamn || "");
  const [foretag, setForetag] = useState(forifyllForetag || "");
  const [ghlContactId, setGhlContactId] = useState(forifyllContactId || "");
  const [ghlOppId, setGhlOppId] = useState(forifyllOppId || "");
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
  const [rates, setRates] = useState<Record<string, number>>({ SEK: 1 });
  const [fxDatum, setFxDatum] = useState("");

  // OFFERT-2
  const [visaInkop, setVisaInkop] = useState(false);
  const [inkopProdukter, setInkopProdukter] = useState<InkopProdukt[]>([]);
  const [inkopFinns, setInkopFinns] = useState(false);
  const [inkopSok, setInkopSok] = useState("");
  const [uppslag, setUppslag] = useState<UppslagSvar | null>(null);
  const [inkopLaddar, setInkopLaddar] = useState(false);
  const [valtFraktsatt, setValtFraktsatt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/offert/products").then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => {});
    fetch("/api/offert/customers").then((r) => r.json()).then((d) => setCustomers(d.customers || [])).catch(() => {});
    fetch("/api/offert/fx").then((r) => r.json()).then((d) => { if (d.rates) setRates(d.rates); if (d.date) setFxDatum(d.date); }).catch(() => {});
    fetch("/api/offert/inkop/produkter").then((r) => r.json()).then((d) => {
      setInkopProdukter(d.produkter || []);
      setInkopFinns(!!d.prisbok);
    }).catch(() => {});
    const d = new Date();
    setOffertnr(`OFF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
  }, []);

  const totals = useMemo(() => summera(rows.map((r) => ({ qty: r.qty, unit_price: r.unit_price, cost: r.cost }))), [rows]);
  const golvOk = overGolv(totals.marginPct);
  // En rad med känd kostnad men utan satt à-pris är inte en marginalmiss — den är osatt.
  // Utan den skillnaden larmar golvvarningen rött så fort man lagt in en rad ur inköpsdatabasen.
  const oprissatta = rows.filter((r) => r.cost != null && r.unit_price == null).length;

  const laggProdukt = (p: Product) => {
    const cost = landat(p.purchase_price, p.freight, calcRate(rates, p.currency)); // landat i SEK (valuta omräknad)
    const pris = prisFranPalagg(cost, p.markup_pct);
    setRows((rs) => [...rs, { product_id: p.id, name: p.name, qty: 1, unit_price: pris || null, cost: cost || null, lead_time_days: p.lead_time_days ?? null }]);
    setVisaProdukter(false); setProdSok("");
  };
  const laggFri = () => setRows((rs) => [...rs, { product_id: null, name: "", qty: 1, unit_price: null, cost: null, lead_time_days: null }]);

  // ── Inköpsdatabasen ────────────────────────────────────────────────────────
  // Uppslaget görs alltid på servern, alltid på produktnyckel + ett offererat antal. Klienten
  // räknar aldrig fram ett fraktpris själv och fyller aldrig i ett saknat.
  const slaUpp = async (nyckel: string, antal: number) => {
    setInkopLaddar(true);
    setValtFraktsatt(null);
    try {
      const r = await fetch(`/api/offert/inkop/uppslag?nyckel=${encodeURIComponent(nyckel)}&antal=${antal}`);
      const d = (await r.json()) as UppslagSvar;
      setUppslag(d);
      if (d.typ === "uppslag") setValtFraktsatt(d.billigast?.fraktsatt ?? null);
    } catch {
      setFel("Kunde inte slå upp produkten");
    } finally {
      setInkopLaddar(false);
    }
  };

  // Landad kostnad räknas om till SEK med Riksbankens kurs + buffert — samma väg som katalogen.
  // Utpriset lämnas tomt: påslagsregeln finns inte än, och ett påhittat pris vore värre än inget.
  const laggInkopRad = () => {
    if (!uppslag || uppslag.typ !== "uppslag" || !valtFraktsatt) return;
    const alt = uppslag.alternativ.find((a) => a.fraktsatt === valtFraktsatt);
    if (!alt) return;
    const kurs = calcRate(rates, uppslag.valuta);
    setRows((rs) => [
      ...rs,
      {
        product_id: null,
        name: uppslag.produkt?.produktnamn || uppslag.produktnyckel,
        qty: uppslag.antal,
        unit_price: null,
        cost: Math.round(alt.landat_styck * kurs),
        lead_time_days: null,
        inkop_trappa_id: uppslag.trappa_id,
        fraktsatt: alt.fraktsatt,
        harkomst: `${alt.landat_styck.toLocaleString("sv-SE")} ${uppslag.valuta}/st (${alt.etikett}) × ${kurs.toFixed(4)} · ${alt.kalla}`,
      },
    ]);
    setUppslag(null);
    setVisaInkop(false);
    setInkopSok("");
  };
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
        body: JSON.stringify({
          quote_number: offertnr,
          customer_name: namn,
          customer_company: foretag,
          ghl_contact_id: ghlContactId,
          ghl_opportunity_id: ghlOppId,
          items: rows.map(({ harkomst: _harkomst, ...rad }) => rad),
        }),
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
                {inkopFinns && (
                  <button onClick={() => { setVisaInkop((v) => !v); setUppslag(null); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Database className="w-3.5 h-3.5" /> Ur inköpsdatabasen
                  </button>
                )}
                <button onClick={laggFri} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Plus className="w-3.5 h-3.5" /> Fri rad
                </button>
              </div>
            </div>

            {visaInkop && (
              <div className="rounded-xl border border-gray-200 p-2 space-y-2">
                {!uppslag ? (
                  <>
                    <div className="flex items-center gap-1.5 px-2 py-1"><Search className="w-3.5 h-3.5 text-gray-400" />
                      <input value={inkopSok} onChange={(e) => setInkopSok(e.target.value)} placeholder="Sök storlek, ljusstyrka, inne/ute…" className="flex-1 text-sm outline-none" />
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {inkopProdukter
                        .filter((p) => {
                          if (!inkopSok.trim()) return true;
                          const hö = [p.produktnamn, p.produktnyckel, p.modellnr, p.storlek, p.ljusstyrka, p.miljo].filter(Boolean).join(" ").toLowerCase();
                          return inkopSok.toLowerCase().split(/\s+/).every((o) => hö.includes(o));
                        })
                        .map((p) => (
                          <button
                            key={p.produktnyckel}
                            onClick={() => slaUpp(p.produktnyckel, p.trappor[0]?.antal ?? 1)}
                            disabled={!p.harNagonFrakt || inkopLaddar}
                            title={p.harNagonFrakt ? undefined : "Inget fraktsätt är offererat — kostnaden går inte att räkna fram. Begär offert från leverantören."}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm flex justify-between items-center gap-2 disabled:opacity-45 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          >
                            <span className="font-medium text-gray-800 truncate">{p.produktnamn}</span>
                            <span className="text-gray-500 text-xs flex-shrink-0 inline-flex items-center gap-1">
                              {p.harNagonFrakt ? `${p.trappor.map((t) => t.antal).join("/")} st` : <><Ban className="w-3 h-3" /> fraktpris saknas</>}
                            </span>
                          </button>
                        ))}
                    </div>
                  </>
                ) : uppslag.typ !== "uppslag" ? (
                  <div className="p-2 space-y-2">
                    <div className="text-xs text-amber-700">{uppslag.text}</div>
                    <button onClick={() => setUppslag(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-900">← Tillbaka</button>
                  </div>
                ) : (
                  <div className="p-2 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">{uppslag.produkt?.produktnamn || uppslag.produktnyckel}</div>
                        <div className="text-xs text-gray-400">{uppslag.kalla}</div>
                      </div>
                      <button onClick={() => setUppslag(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">Antal (offererade trappor)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {uppslag.trappor.map((a) => (
                          <button key={a} onClick={() => slaUpp(uppslag.produktnyckel, a)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${a === uppslag.antal ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-600"}`}
                            style={a === uppslag.antal ? { background: primaryColor } : undefined}>{a} st</button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Andra antal räknas inte om — både pris och frakt ändras med volymen. Begär ny offert i så fall.</div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1">Fraktsätt · EXW {uppslag.exw_styck.toLocaleString("sv-SE")} {uppslag.valuta}/st</div>
                      <div className="flex flex-wrap gap-1.5">
                        {uppslag.alternativ.map((a) => (
                          <button key={a.fraktsatt} onClick={() => setValtFraktsatt(a.fraktsatt)}
                            className={`text-xs px-2.5 py-1 rounded-lg border tabular-nums ${valtFraktsatt === a.fraktsatt ? "text-white border-transparent font-semibold" : "bg-white border-gray-200 text-gray-600"}`}
                            style={valtFraktsatt === a.fraktsatt ? { background: primaryColor } : undefined}
                            title={`Frakt ${a.frakt_styck} ${uppslag.valuta}/st · ${a.kalla}`}>
                            {a.etikett} {a.landat_styck.toLocaleString("sv-SE")}/st
                          </button>
                        ))}
                        {uppslag.saknade.map((s) => (
                          <span key={s.fraktsatt} className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-gray-200 text-gray-400" title="Leverantören har inte offererat det här fraktsättet — begär offert.">
                            {s.etikett}: saknas
                          </span>
                        ))}
                      </div>
                    </div>

                    {uppslag.flaggor.map((f) => (
                      <div key={f.kod} className={`text-xs rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 ${f.niva === "blockerande" ? "bg-red-50 text-red-700" : f.niva === "varning" ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600"}`}>
                        {f.niva !== "info" && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                        <span>{f.text}</span>
                      </div>
                    ))}

                    {valtFraktsatt && (() => {
                      const alt = uppslag.alternativ.find((a) => a.fraktsatt === valtFraktsatt)!;
                      const kurs = calcRate(rates, uppslag.valuta);
                      return (
                        <div className="rounded-xl bg-gray-50 p-2.5 text-xs text-gray-600 space-y-0.5">
                          <div>Landat <span className="font-semibold text-gray-900">{alt.landat_styck.toLocaleString("sv-SE")} {uppslag.valuta}/st</span> · {alt.landat_order.toLocaleString("sv-SE")} {uppslag.valuta} för {uppslag.antal} st</div>
                          <div>= <span className="font-semibold text-gray-900">{kr(Math.round(alt.landat_styck * kurs))}</span>/st (Riksbanken{fxDatum ? ` ${fxDatum}` : ""}, +3 % buffert)</div>
                          <div className="text-gray-400">Utpriset sätter du själv — påslagsregel och fasta kostnader är inte inlagda än.</div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setUppslag(null)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">Tillbaka</button>
                      <button onClick={laggInkopRad} disabled={!valtFraktsatt}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: primaryColor }}>
                        <Plus className="w-3.5 h-3.5" /> Lägg till rad
                      </button>
                    </div>
                  </div>
                )}
                {inkopLaddar && <div className="flex items-center gap-2 text-xs text-gray-400 px-2 pb-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Slår upp…</div>}
              </div>
            )}
            {visaProdukter && (
              <div className="rounded-xl border border-gray-200 p-2 space-y-1 max-h-52 overflow-y-auto">
                <div className="flex items-center gap-1.5 px-2 py-1"><Search className="w-3.5 h-3.5 text-gray-400" />
                  <input value={prodSok} onChange={(e) => setProdSok(e.target.value)} placeholder="Sök produkt…" className="flex-1 text-sm outline-none" />
                </div>
                {products.length === 0 && <div className="text-xs text-gray-400 px-2 py-1">Katalogen är tom — lägg in produkter först, eller använd Fri rad.</div>}
                {prodFiltrerade.map((p) => (
                  <button key={p.id} onClick={() => laggProdukt(p)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm flex justify-between">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className="text-gray-500 text-xs">{kr(prisFranPalagg(landat(p.purchase_price, p.freight, calcRate(rates, p.currency)), p.markup_pct))}</span>
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
                    <div key={i} className="bg-gray-50 rounded-xl px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <input value={r.name} onChange={(e) => uppdatera(i, { name: e.target.value })} placeholder="Benämning" className="flex-1 min-w-0 text-sm bg-transparent outline-none" />
                        <input
                          value={String(r.qty)}
                          onChange={(e) => uppdatera(i, { qty: Number(nOrNull(e.target.value)) || 0 })}
                          disabled={!!r.inkop_trappa_id}
                          title={r.inkop_trappa_id ? "Antalet är låst till leverantörens offererade trappa. Byt trappa genom att lägga till raden på nytt." : "Antal"}
                          className="w-12 text-sm text-center bg-white rounded border border-gray-200 px-1 py-1 disabled:bg-gray-100 disabled:text-gray-500"
                        />
                        <input value={r.unit_price ?? ""} onChange={(e) => uppdatera(i, { unit_price: nOrNull(e.target.value) })} placeholder="à-pris" className="w-20 text-sm text-right bg-white rounded border border-gray-200 px-1.5 py-1" title="Pris/st" />
                        <span
                          className={`text-xs w-16 text-right ${r.unit_price == null ? "text-gray-300" : tbKr < 0 ? "text-red-500" : "text-gray-400"}`}
                          title={r.unit_price == null ? "Sätt à-pris för att se TB" : "TB/st"}
                        >
                          {r.cost == null ? "" : r.unit_price == null ? "TB —" : `TB ${Math.round(tbKr)}`}
                        </span>
                        <button onClick={() => taBort(i)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {r.harkomst && <div className="text-xs text-gray-400 pl-0.5 pt-0.5 truncate" title={r.harkomst}>{r.harkomst}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summering */}
          {rows.length > 0 && (
            <div className="rounded-2xl border border-gray-100 p-4 grid grid-cols-3 gap-3" style={{ background: `${primaryColor}0a` }}>
              <div><div className="text-xs text-gray-500 uppercase">Ordervärde</div><div className="text-lg font-bold text-gray-900 tabular-nums">{kr(totals.total)}</div></div>
              <div><div className="text-xs text-gray-500 uppercase">TB</div><div className="text-lg font-bold tabular-nums" style={{ color: oprissatta ? "#6b7280" : golvOk ? "#059669" : "#dc2626" }}>{oprissatta ? "—" : kr(totals.tbKr)}</div></div>
              <div><div className="text-xs text-gray-500 uppercase">Marginal</div><div className="text-lg font-bold tabular-nums" style={{ color: oprissatta ? "#6b7280" : golvOk ? "#059669" : "#dc2626" }}>{oprissatta ? "—" : `${totals.marginPct}%`}</div></div>
              {oprissatta > 0 ? (
                <div className="col-span-3 text-xs text-gray-500">
                  Sätt à-pris på {oprissatta === 1 ? "raden" : `${oprissatta} rader`} för att se TB och marginal. Kostnaden är känd — utpriset är inte satt än.
                </div>
              ) : !golvOk && totals.costTotal > 0 ? (
                <div className="col-span-3 text-xs text-red-600">⚠ Under 30 % golv — se över priser eller pålägg.</div>
              ) : null}
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
                      <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-100 rounded-lg px-2 py-0.5">
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
