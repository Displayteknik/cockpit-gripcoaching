"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Download, FileText } from "lucide-react";

interface Rad { name: string; qty: number; unit_price: number | null; lead_time_days: number | null }
interface Offert {
  foretag: string;
  quote_number?: string | null;
  customer_name?: string | null;
  customer_company?: string | null;
  valuta?: string;
  sektioner: { rubrik: string; text: string }[];
  rader: Rad[];
  total?: number | null;
  villkor: Record<string, unknown>;
  signatur: string;
}

interface QuoteRef { id: string; quote_number?: string }

function kr(n?: number | null) { return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—"; }
const VILLKOR_ETIKETT: Record<string, string> = { betalning: "Betalning", garanti: "Garanti", giltighet: "Giltighet", leverans: "Leverans", ovrigt: "Övrigt" };

export default function OffertDokument({ quote, primaryColor = "#1A6B3C", onClose }: { quote: QuoteRef; primaryColor?: string; onClose: () => void }) {
  const [offert, setOffert] = useState<Offert | null>(null);
  const [fel, setFel] = useState<string | null>(null);
  const [laddar, setLaddar] = useState(false);
  const docRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/offert/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: quote.id }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setOffert(d.offert); else setFel(d.error || "Kunde inte generera"); })
      .catch(() => setFel("Kunde inte generera"));
  }, [quote.id]);

  const laddaNer = async () => {
    if (!docRef.current || laddar) return;
    setLaddar(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = (await import("html2pdf.js")).default as any;
      await html2pdf()
        .set({
          margin: [12, 12, 14, 12],
          filename: `Offert ${offert?.quote_number || ""}.pdf`.trim(),
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(docRef.current)
        .save();
    } catch {
      setFel("Kunde inte skapa PDF");
    } finally {
      setLaddar(false);
    }
  };

  const rader = offert?.rader || [];
  const prisIdx = offert?.sektioner.findIndex((s) => /pris|kostnad|invester|belopp/i.test(s.rubrik)) ?? -1;

  const PrisTabell = () => (
    <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0 4px", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${primaryColor}` }}>
          <th style={{ textAlign: "left", padding: "6px 4px", color: primaryColor }}>Post</th>
          <th style={{ textAlign: "right", padding: "6px 4px", color: primaryColor, width: 50 }}>Antal</th>
          <th style={{ textAlign: "right", padding: "6px 4px", color: primaryColor, width: 90 }}>À-pris</th>
          <th style={{ textAlign: "right", padding: "6px 4px", color: primaryColor, width: 100 }}>Summa</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "6px 4px" }}>{r.name}{r.lead_time_days != null ? <span style={{ color: "#999", fontSize: 11 }}> · ledtid {r.lead_time_days} dgr</span> : null}</td>
            <td style={{ textAlign: "right", padding: "6px 4px" }}>{r.qty}</td>
            <td style={{ textAlign: "right", padding: "6px 4px" }}>{kr(r.unit_price)}</td>
            <td style={{ textAlign: "right", padding: "6px 4px" }}>{kr((Number(r.unit_price) || 0) * (Number(r.qty) || 0))}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={3} style={{ textAlign: "right", padding: "8px 4px", fontWeight: 700 }}>Ordervärde</td>
          <td style={{ textAlign: "right", padding: "8px 4px", fontWeight: 700, color: primaryColor }}>{kr(offert?.total)}</td>
        </tr>
      </tbody>
    </table>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[95vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between gap-3 z-10">
          <div className="inline-flex items-center gap-1.5 font-display font-bold text-gray-900">
            <FileText className="w-5 h-5" style={{ color: primaryColor }} /> Offert {quote.quote_number || ""}
          </div>
          <div className="flex items-center gap-2">
            {offert && (
              <button onClick={laddaNer} disabled={laddar} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
                {laddar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Ladda ner PDF
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-6 py-5">
          {fel ? (
            <div className="text-sm text-red-600 py-6">{fel}</div>
          ) : !offert ? (
            <div className="flex items-center gap-2 text-gray-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Skriver din offert…</div>
          ) : (
            <div ref={docRef} style={{ background: "#fff", color: "#222", padding: "8px 4px", fontFamily: "Georgia, serif", lineHeight: 1.5 }}>
              {/* Sidhuvud */}
              <div style={{ borderBottom: `3px solid ${primaryColor}`, paddingBottom: 10, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: primaryColor }}>{offert.foretag}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginTop: 4 }}>
                  <span>Offert {offert.quote_number || ""}</span>
                  <span>Till: {offert.customer_company || offert.customer_name || ""}</span>
                </div>
              </div>
              {/* Sektioner + prislista inflätad */}
              {offert.sektioner.map((s, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: primaryColor, marginBottom: 4 }}>{s.rubrik}</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{s.text}</div>
                  {i === prisIdx && rader.length > 0 && <PrisTabell />}
                </div>
              ))}
              {prisIdx < 0 && rader.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: primaryColor, marginBottom: 4 }}>Pris</div>
                  <PrisTabell />
                </div>
              )}
              {/* Villkor */}
              {offert.villkor && Object.keys(offert.villkor).length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: primaryColor, marginBottom: 4 }}>Villkor</div>
                  <div style={{ fontSize: 12 }}>
                    {Object.entries(offert.villkor).map(([k, v]) => {
                      const val = Array.isArray(v) ? v.filter(Boolean).join("; ") : String(v || "");
                      if (!val) return null;
                      return <div key={k} style={{ marginBottom: 2 }}><b>{VILLKOR_ETIKETT[k] || k}:</b> {val}</div>;
                    })}
                  </div>
                </div>
              )}
              {/* Signatur */}
              <div style={{ marginTop: 20, fontSize: 13, whiteSpace: "pre-wrap", color: "#444" }}>{offert.signatur}</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
