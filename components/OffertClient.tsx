"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, CheckCircle2, Sparkles, RefreshCw, ListChecks, Plus } from "lucide-react";
import OffertKatalog from "@/components/OffertKatalog";
import OffertInkop from "@/components/OffertInkop";
import OffertSkapa from "@/components/OffertSkapa";
import OffertDokument from "@/components/OffertDokument";

interface Quote {
  id: string; quote_number?: string; customer_name?: string; customer_company?: string;
  status?: string; total?: number; created_at?: string; updated_at?: string; sent_at?: string; won_at?: string;
}
interface Sektion { rubrik: string; syfte: string; exempeltext: string }
interface Blueprint {
  sektioner: Sektion[];
  villkor: Record<string, string | string[]>;
  ton?: string; sprak?: string; valuta?: string;
  meta?: { rubrik_stil?: string; signatur?: string };
  source_name?: string; updated_at?: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Utkast", cls: "bg-gray-100 text-gray-600" },
  sent: { label: "Skickad", cls: "bg-blue-100 text-blue-700" },
  won: { label: "Vunnen", cls: "bg-emerald-100 text-emerald-700" },
  lost: { label: "Förlorad", cls: "bg-rose-100 text-rose-700" },
};

function kr(n?: number) { return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—"; }
function datum(s?: string) { return s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : ""; }

// En offertförfrågan från kundens webbformulär (tabellen offert_leads).
interface WebbLead {
  id: string; namn?: string; foretag?: string; epost?: string; telefon?: string;
  miljo?: string; mal?: string; yta?: string; ort?: string; beskrivning?: string;
  tidsplan?: string; budget?: string; bild_url?: string | null; created_at?: string;
}

export default function OffertClient({ primaryColor = "#1A6B3C", leadId, onKlientBytt }: { primaryColor?: string; leadId?: string; onKlientBytt?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [bpLoading, setBpLoading] = useState(true);
  const [laser, setLaser] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [visaSkapa, setVisaSkapa] = useState(false);
  const [lead, setLead] = useState<WebbLead | null>(null);
  const [leadFel, setLeadFel] = useState<string | null>(null);
  const [docQuote, setDocQuote] = useState<Quote | null>(null);
  // Kunden som följde med hit från Fokus-kortet ("Skapa offert" på en affär).
  const [franAffar, setFranAffar] = useState<{ namn?: string; foretag?: string; oppId?: string; contactId?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Via ref så att en inline-callback från föräldern inte gör om lead-hämtningen.
  const onKlientByttRef = useRef(onKlientBytt);
  onKlientByttRef.current = onKlientBytt;

  const laddaQuotes = useCallback(() => {
    setLoading(true);
    fetch("/api/offert/quote").then((r) => r.json()).then((d) => setQuotes(Array.isArray(d.quotes) ? d.quotes : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Kommer man hit via "Skapa offert" på ett Fokus-kort ligger kunden i query-strängen.
  // Då öppnas offertförslaget direkt, ifyllt med kontakt, företag och affärens id i MySales
  // — så att den sparade offerten hamnar på rätt affär och inte på en lös dublett.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const namn = q.get("kund") || undefined;
    const foretag = q.get("foretag") || undefined;
    const oppId = q.get("opp") || undefined;
    if (!namn && !foretag && !oppId) return;
    setFranAffar({ namn, foretag, oppId, contactId: q.get("kontakt") || undefined });
    setVisaSkapa(true);
  }, []);

  useEffect(() => {
    let avbruten = false;
    (async () => {
      // Kommer man hit via "Skapa offertförslag" i aviseringsmejlet hämtas förfrågan FÖRST.
      // Det anropet växlar också aktiv klient till leadets tenant — görs det efter att
      // offerter och offertmall redan laddats visar vyn föregående kunds data.
      if (leadId) {
        try {
          const r = await fetch(`/api/offert/lead?id=${encodeURIComponent(leadId)}`);
          const d = await r.json();
          if (avbruten) return;
          if (r.ok && d.lead) {
            // Bytte tenant → ladda om HELA sidan en gång. Sidomenyn, klientväljaren och
            // färgerna renderas i layouten och hade annars stått kvar på föregående kund
            // ovanför rätt kunds förfrågan. Engångsspärren gör att ett byte som inte
            // fastnar aldrig kan bli en omladdningsloop.
            const spärr = `offert-lead-omladdad:${leadId}`;
            if (d.bytteKlient && !sessionStorage.getItem(spärr)) {
              sessionStorage.setItem(spärr, "1");
              window.location.reload();
              return;
            }
            setLead(d.lead as WebbLead);
            setVisaSkapa(true);
            onKlientByttRef.current?.();
          } else setLeadFel(d.error || "Kunde inte hämta förfrågan");
        } catch {
          if (!avbruten) setLeadFel("Kunde inte hämta förfrågan");
        }
      }
      if (avbruten) return;
      laddaQuotes();
      fetch("/api/offert/blueprint").then((r) => r.json()).then((d) => {
        if (d.hasBlueprint) setBp(d.blueprint);
      }).catch(() => {}).finally(() => setBpLoading(false));
    })();
    return () => { avbruten = true; };
  }, [laddaQuotes, leadId]);

  const laddaUpp = async (file: File) => {
    setFel(null); setLaser(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/offert/blueprint", { method: "POST", body: fd });
      const d = await r.json();
      if (d.ok) setBp(d.blueprint);
      else setFel(d.error || "Kunde inte tolka offerten");
    } catch {
      setFel("Kunde inte ladda upp");
    } finally {
      setLaser(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}>
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
            <FileText className="w-3.5 h-3.5" /> Offertmotor
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Offerter</h1>
          <p className="text-white/80 mt-1.5 text-sm max-w-lg">
            Lär motorn din offertmall en gång — sen bygger du snygga offerter från produktlista, prissättning och marknadskoll.
          </p>
        </div>
      </div>

      {/* Förfrågan från webben — visas bara när man kommit hit via länken i aviseringsmejlet */}
      {leadFel && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Kunde inte öppna förfrågan: {leadFel}
        </div>
      )}
      {lead && (
        <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">Förfrågan från webben</span>
            {lead.created_at && <span className="text-xs text-gray-400">{datum(lead.created_at)}</span>}
          </div>
          <div className="font-display font-bold text-gray-900">
            {lead.namn || "—"}{lead.foretag ? <span className="font-normal text-gray-500"> · {lead.foretag}</span> : null}
          </div>
          <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            {lead.epost && <a href={`mailto:${lead.epost}`} className="text-blue-600 hover:underline">{lead.epost}</a>}
            {lead.telefon && <a href={`tel:${lead.telefon}`} className="text-blue-600 hover:underline">{lead.telefon}</a>}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {([["Miljö", lead.miljo], ["Mål", lead.mal], ["Yta/storlek", lead.yta], ["Ort", lead.ort],
               ["Tidsplan", lead.tidsplan], ["Budget", lead.budget]] as [string, string | undefined][])
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-gray-500 shrink-0">{k}</dt>
                  <dd className="text-gray-900 font-medium">{v}</dd>
                </div>
              ))}
          </dl>
          {lead.beskrivning && (
            <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{lead.beskrivning}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {lead.bild_url && (
              <a href={lead.bild_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Öppna bilden på platsen</a>
            )}
            {!visaSkapa && (
              <button onClick={() => setVisaSkapa(true)} className="font-semibold text-blue-600 hover:underline">
                Skapa offertförslag
              </button>
            )}
          </div>
        </section>
      )}

      {/* Din offertmall (Fas 1) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5" style={{ color: primaryColor }} />
          <h2 className="font-display font-bold text-gray-900 text-lg">Din offertmall</h2>
        </div>

        {bpLoading ? (
          <div className="flex items-center gap-2 text-gray-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
        ) : !bp ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${primaryColor}14` }}>
              <Upload className="w-6 h-6" style={{ color: primaryColor }} />
            </span>
            <div className="font-semibold text-gray-900">Ladda upp en av dina tidigare offerter</div>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Motorn läser din offert och lär sig din struktur, dina villkor och din ton — så att nya offerter blir exakt som du brukar göra dem. Word (.docx) eller PDF.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={laser}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              style={{ background: primaryColor }}
            >
              {laser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {laser ? "Läser din offert…" : "Ladda upp offert"}
            </button>
            {fel && <div className="text-xs text-red-600 mt-3">{fel}</div>}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="font-semibold text-gray-900">Mall inlärd{bp.source_name ? ` från ${bp.source_name}` : ""}</div>
                  {bp.ton && <div className="text-xs text-gray-500 mt-0.5">Ton: {bp.ton}</div>}
                </div>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={laser}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {laser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Lär om
              </button>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">Sektioner ({bp.sektioner.length})</div>
              <ol className="space-y-1.5">
                {bp.sektioner.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${primaryColor}14`, color: primaryColor }}>{i + 1}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{s.rubrik}</span>
                      {s.syfte && <span className="text-xs text-gray-500"> — {s.syfte}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {bp.villkor && Object.keys(bp.villkor).length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">Villkor</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(bp.villkor).flatMap(([k, v]) => {
                    const vals = Array.isArray(v) ? v : [v];
                    return vals.filter(Boolean).map((val, j) => (
                      <span key={`${k}${j}`} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1 text-gray-600">
                        {String(val)}
                      </span>
                    ));
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
              <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
              Nästa steg: lägg in din produktkatalog, så kan vi bygga offerter med prissättning och marknadskoll. (Kommer snart.)
            </div>
            {fel && <div className="text-xs text-red-600">{fel}</div>}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) laddaUpp(f); e.target.value = ""; }}
        />
      </section>

      {/* Produktkatalog (Fas 2) */}
      <OffertKatalog primaryColor={primaryColor} />

      {/* Inköpsdatabas (OFFERT-2) — leverantörsprislistor med kvantitetstrappor och fraktsätt */}
      <OffertInkop primaryColor={primaryColor} />

      {/* Offertlista + Skapa offert */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-bold text-gray-900 text-lg">Dina offerter</h2>
          {bp ? (
            <button
              onClick={() => setVisaSkapa(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90"
              style={{ background: primaryColor }}
            >
              <Plus className="w-4 h-4" /> Skapa offert
            </button>
          ) : (
            <span className="text-xs text-gray-400">Lär in din offertmall först för att skapa offerter</span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Laddar offerter…</div>
        ) : quotes.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm text-sm text-gray-500">
            Inga offerter än. Klicka <span className="font-semibold">Skapa offert</span> för din första.
          </div>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => {
              const st = q.status ? STATUS[q.status] : undefined;
              return (
                <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{q.quote_number || "Offert"}</span>
                      {st && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {q.customer_company || q.customer_name || "—"}{q.updated_at ? ` · ${datum(q.updated_at)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="font-bold text-gray-900 tabular-nums">{kr(q.total)}</div>
                    <button
                      onClick={() => setDocQuote(q)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-3.5 h-3.5" /> Öppna
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {visaSkapa && (
        <OffertSkapa
          primaryColor={primaryColor}
          // Stängs dialogen släpps kunden från Fokus-kortet, annars skulle nästa
          // "Skapa offert" öppna förifylld med föregående affär.
          onClose={() => { setVisaSkapa(false); setFranAffar(null); }}
          onSaved={laddaQuotes}
          forifyllNamn={lead?.namn ?? franAffar?.namn}
          forifyllForetag={lead?.foretag ?? franAffar?.foretag}
          forifyllContactId={franAffar?.contactId}
          forifyllOppId={franAffar?.oppId}
        />
      )}
      {docQuote && <OffertDokument quote={docQuote} primaryColor={primaryColor} onClose={() => setDocQuote(null)} />}
    </div>
  );
}
