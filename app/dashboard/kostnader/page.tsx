"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Info, Coins, TrendingUp, CalendarDays, Wallet, Server, ChevronDown, ChevronRight, RefreshCw, ShoppingCart, Percent, ExternalLink } from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";

// KOSTNAD-1 K3 — vad AI:n kostar, var pengarna går och vilken provider som är nere.
// Endast huvudadmin (API:t grindar). Klarspråk, inga tankstreck i UI-texterna.

interface Grupp { nyckel: string; kostnad: number; anrop: number; fel: number }
interface Kontodata { kvot: number; extra: number; anvant: number; periodStart: string }
interface TenantRad {
  tenantId: string | null; namn: string; kostnad: number; anrop: number; fel: number; tak: number; procent: number;
  credits: Kontodata | null; creditSaldo: number | null; felprissatt: boolean;
}
interface Prisrad { action: string; credits: number; label: string; active: boolean }
interface Orderrad {
  id: string; tenant_id: string; namn: string; credits: number; price_sek: number;
  status: string; created_at: string; decided_at: string | null; decided_by: string | null;
}
interface HealthRad {
  provider: string; senaste_ok: string | null; senaste_fel: string | null;
  senaste_felklass: string | null; senaste_httpstatus: number | null; senaste_svarskropp: string | null;
  fel_senaste_timmen: number; ok_senaste_timmen: number; rod: boolean; text: string | null;
}
interface FelRad {
  created_at: string; provider: string; flow: string; model: string;
  error_class: string | null; http_status: number | null; error_body: string | null;
}
interface FastRad { id: string; namn: string; kategori: string; belopp_sek: number; note: string | null; aktiv: boolean }

// ── K3-INKÖP ───────────────────────────────────────────────────────────────
interface Takt { snittPerDag: number; summa: number; fonster: number; namnare: number; tunt: boolean }
interface Larmrad { id: string; text: string; niva: "gul" | "rod"; etikett: string; lank: string }
interface Inkopsrad {
  id: string; provider: string; etikett: string; typ: "forbetalt" | "efterskott";
  saldo_belopp: number | null; saldo_valuta: string; saldo_kalla: "api" | "manuellt";
  saldo_uppdaterad: string | null; saldo_fel: string | null; saldoAlderDagar: number | null;
  betalkort_sista_fyra: string | null;
  forra_fakturan_sek: number | null; forra_fakturan_datum: string | null;
  pafyllningssteg: number | null; fakturalank: string | null; notering: string | null;
  saldoSek: number | null; kurs: number;
  takt7: Takt; takt30: Takt; dagarKvar: number | null; prognosSek: number; manadHittills: number;
  larmniva: "gron" | "gul" | "rod"; larmorsak: string; billingfelSenasteDygnet: boolean;
  rekommendation: { belopp: number; valuta: string; beloppSek: number; senast: string | null; klartext: string } | null;
  harApi: boolean;
}
interface MarginalRad {
  tenantId: string; namn: string; abonnemangSek: number | null; topupSek: number; aiKostnadSek: number;
  intaktSek: number | null; marginalSek: number | null; marginalProcent: number | null; prisSaknas: boolean;
}
interface MrrVal { id: string; kund: string; bolag: string; belopp_ex_moms: number; client_id: string | null }

interface Data {
  summa: { idag: number; vecka: number; manad: number; prognos: number; fast: number; totaltNu: number; totaltPrognos: number };
  fasta: FastRad[];
  health: HealthRad[];
  perProvider: Grupp[];
  perFlow: Grupp[];
  perTenant: TenantRad[];
  plattform: { tak: number | null; varningProcent: number; manad: number };
  fel: FelRad[];
  antalHandelser: number;
  creditPriser: Prisrad[];
  ordrar: Orderrad[];
  period: string;
  inkop: {
    idag: string;
    trosklar: { gulDagar: number; rodDagar: number; gulPrognosProcent: number };
    rader: Inkopsrad[];
    larm: Larmrad[];
  };
  marginal: {
    rader: MarginalRad[];
    summa: { intaktSek: number; aiKostnadSek: number; marginalSek: number; marginalProcent: number | null; utanPris: number };
    mrrVal: MrrVal[];
    manad: string;
  };
}

const kr = (n: number) => `${n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const krHel = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;
const tid = (s: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig");
const valutabelopp = (n: number, valuta: string) =>
  `${n.toLocaleString("sv-SE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${valuta}`;

/** Saldots ålder i klarspråk. Aldrig en färsk siffra som i själva verket är gammal. */
function alderText(dagar: number | null, kalla: string): string {
  if (dagar === null) return `${kalla === "api" ? "hämtas automatiskt" : "manuellt"}, aldrig ifyllt`;
  const nar = dagar === 0 ? "idag" : dagar === 1 ? "1 dag gammalt" : `${dagar} dagar gammalt`;
  return `${kalla === "api" ? "hämtat automatiskt" : "manuellt"}, ${nar}`;
}

const FELKLASS_TEXT: Record<string, string> = {
  billing: "Betalning",
  quota: "Kvot",
  auth: "Nyckel",
  model: "Modell",
  other: "Övrigt",
};

/** Vågrätt stapeldiagram i tabellform. Bredden är andel av den dyraste raden. */
function Stapel({ rader, max, etikett }: { rader: Grupp[]; max: number; etikett: string }) {
  if (!rader.length) return <p className="px-5 py-6 text-sm text-gray-500">Inga anrop den här månaden än.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
          <th className="px-5 py-2.5 font-medium">{etikett}</th>
          <th className="px-3 py-2.5 font-medium">Andel</th>
          <th className="px-3 py-2.5 text-right font-medium">Kostnad</th>
          <th className="px-3 py-2.5 text-right font-medium">Anrop</th>
          <th className="px-5 py-2.5 text-right font-medium">Fel</th>
        </tr>
      </thead>
      <tbody>
        {rader.map((g) => (
          <tr key={g.nyckel || "-"} className="border-b border-gray-50 last:border-0">
            <td className="px-5 py-2.5 font-medium text-gray-800">{g.nyckel || "okänt"}</td>
            <td className="px-3 py-2.5 w-1/3">
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full" style={{ width: `${max > 0 ? Math.max(2, (g.kostnad / max) * 100) : 0}%`, background: "linear-gradient(90deg,#38bdf8,#2563eb)" }} />
              </div>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{kr(g.kostnad)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{g.anrop}</td>
            <td className={`px-5 py-2.5 text-right tabular-nums ${g.fel ? "font-semibold text-red-600" : "text-gray-400"}`}>{g.fel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function KostnaderPage() {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [oppetFel, setOppetFel] = useState<number | null>(null);
  const [redigerar, setRedigerar] = useState<string | null>(null);
  const [nyttTak, setNyttTak] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fastUtkast, setFastUtkast] = useState<Record<string, string>>({});
  const [nyttNamn, setNyttNamn] = useState("");
  const [prisUtkast, setPrisUtkast] = useState<Record<string, string>>({});
  const [kvotUtkast, setKvotUtkast] = useState<Record<string, string>>({});
  const [insattning, setInsattning] = useState<{ tenantId: string; credits: string; note: string } | null>(null);
  // K3-INKÖP: utkast per fält, nyckeln är kontots id plus fältnamnet.
  const [kontoUtkast, setKontoUtkast] = useState<Record<string, string>>({});
  const [troskelUtkast, setTroskelUtkast] = useState<Record<string, string>>({});

  const hamta = useCallback(async () => {
    setLaddar(true);
    try {
      const r = await fetch("/api/kostnader");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta kostnaderna");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function sparaTak(tenantId: string) {
    setSparar(true);
    try {
      const r = await fetch("/api/kostnader", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, tak: Number(nyttTak) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara taket");
      setRedigerar(null);
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  async function patcha(kropp: Record<string, unknown>) {
    setSparar(true);
    try {
      const r = await fetch("/api/kostnader", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kropp),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara");
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  const roda = data?.health.filter((h) => h.rod) || [];
  const vantande = data?.ordrar.filter((o) => o.status === "pending") || [];
  const felprissatta = data?.perTenant.filter((t) => t.felprissatt) || [];
  const maxProvider = Math.max(0, ...(data?.perProvider.map((g) => g.kostnad) || [0]));
  const maxFlow = Math.max(0, ...(data?.perFlow.map((g) => g.kostnad) || [0]));
  const plattformProcent =
    data?.plattform.tak && data.plattform.tak > 0 ? (data.plattform.manad / data.plattform.tak) * 100 : 0;

  return (
    <div className="space-y-6">
      <DashHero
        title="Vad tjänsterna kostar"
        subtitle="Allt du betalar för på ett ställe: varje anrop till en betaltjänst loggas med pris, flöde och eventuellt fel, och de fasta abonnemangen räknas in i totalen."
        icon={Coins}
        eyebrow={<LivePill label="denna månad" />}
        chips={
          data ? (
            <>
              <HeroChip icon={Wallet} label={`${kr(data.summa.totaltNu)} totalt hittills`} />
              <HeroChip icon={TrendingUp} label={`${kr(data.summa.totaltPrognos)} vid månadsslut`} />
              <HeroChip icon={CalendarDays} label={`${data.antalHandelser} anrop`} />
            </>
          ) : undefined
        }
        right={
          <button onClick={hamta} disabled={laddar}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Uppdatera
          </button>
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {/* Larmbanner: en provider som svarar med betalnings- eller nyckelfel stoppar allt som
          går genom den. Klartext plus länk till rätt ställe att åtgärda det på. */}
      {roda.map((h) => (
        <div key={h.provider} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-red-800">{h.text}</p>
            <p className="mt-1 text-sm text-red-700">
              Senaste lyckade anrop: {tid(h.senaste_ok)}. Svarskod {h.senaste_httpstatus ?? "okänd"}.
            </p>
            {h.senaste_svarskropp && (
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-red-900">{h.senaste_svarskropp.slice(0, 1200)}</pre>
            )}
            <a
              href={h.provider === "gemini" ? "https://console.cloud.google.com/billing" : h.provider === "anthropic" ? "https://console.anthropic.com/settings/billing" : h.provider === "fal" ? "https://fal.ai/dashboard/billing" : "#"}
              target="_blank" rel="noreferrer"
              className="mt-3 inline-flex rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              Öppna fakturasidan hos {h.provider}
            </a>
          </div>
        </div>
      ))}

      {/* Två saker kräver en handling av dig och ska inte behöva letas upp. */}
      {vantande.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>{vantande.length} {vantande.length === 1 ? "kund väntar" : "kunder väntar"} på påfyllning.</strong>{" "}
          {vantande.map((o) => o.namn).join(", ")}. Godkänn längre ner, så sätts creditsen in direkt.
        </div>
      )}
      {felprissatta.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Creditsen är felprissatta för {felprissatta.map((t) => t.namn).join(", ")}.</strong>{" "}
          Kostnadstaket nås trots att credits finns kvar, alltså kostar en bild mer i verkligheten än den gör i credits.
        </div>
      )}

      {/* K3-INKÖP: samma larmrader som ligger överst i Founder HQ:s morgonlista, från
          samma källa (lib/inkop). Poängen är förvarning: betalningsspärren 1 augusti
          syntes först när allt redan stod stilla. */}
      {(data?.inkop.larm || []).map((larm) => (
        <div key={larm.id}
          className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${
            larm.niva === "rod" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}>
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${larm.niva === "rod" ? "text-red-600" : "text-amber-600"}`} />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{larm.text}</span>{" "}
            <a href="#inkop" className="font-medium underline">Se inköpsläget</a>
          </p>
        </div>
      ))}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Förbrukning idag" value={Math.round(data.summa.idag)} sub={kr(data.summa.idag)} icon={Coins} tone="blue" i={0} />
            <StatTile label="Förbrukning denna månad" value={Math.round(data.summa.manad)} sub={`${kr(data.summa.manad)} · sju dagar: ${kr(data.summa.vecka)}`} icon={CalendarDays} tone="violet" i={1} />
            <StatTile label="Fasta abonnemang" value={Math.round(data.summa.fast)} sub={`${kr(data.summa.fast)} per månad`} icon={Server} tone="slate" i={2} />
            <StatTile label="Totalt vid månadsslut" value={Math.round(data.summa.totaltPrognos)} sub={`${kr(data.summa.totaltPrognos)} · nu ${kr(data.summa.totaltNu)}`} icon={TrendingUp} tone="amber" i={3} />
          </div>

          {/* Håkans order 2/8: siffrorna är riktvärden tills prislistan stämts av mot
              verklig faktura. Flaggan står högst upp så ingen läser summan som fakturerad
              kostnad — 46elks rapporterar verkligt pris, övriga räknas ur prislistan. */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-semibold">Siffrorna är riktvärden.</span> Priserna kommer från prislistan nedan och är
              inte avstämda mot verklig faktura ännu. Stäm av mot nästa faktura och rätta värdena under
              &quot;Per tjänst&quot; — ändringen gäller direkt, ingen ny version behövs. Abonnemangsposterna står på noll
              tills du fyllt i dem.
            </p>
          </div>

          {/* Globalt tak: varning vid inställd procent (default 90). */}
          {data.plattform.tak && (
            <div className={`rounded-2xl border px-5 py-4 ${plattformProcent >= 100 ? "border-red-200 bg-red-50" : plattformProcent >= data.plattform.varningProcent ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">Plattformens månadstak</span>
                <span className="tabular-nums text-gray-600">{kr(data.plattform.manad)} av {kr(data.plattform.tak)}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, plattformProcent)}%`, background: plattformProcent >= 100 ? "#dc2626" : plattformProcent >= data.plattform.varningProcent ? "#d97706" : "linear-gradient(90deg,#34d399,#059669)" }} />
              </div>
            </div>
          )}

          {/* ── K3-INKÖP: saldon, takt, prognos och köprekommendation ──────────
              Förbrukningen kommer ur samma händelselogg som resten av sidan. Ingen
              siffra hittas på: saknas underlag står det, saknas saldo står det. */}
          <section id="inkop" className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-gray-900">
                <ShoppingCart className="h-5 w-5 text-indigo-500" /> Inköp och saldon
              </h2>
              <span className="text-sm text-gray-500">
                Gult under {data.inkop.trosklar.gulDagar} dagar kvar, rött under {data.inkop.trosklar.rodDagar}.
                Inga automatiska köp görs någonsin.
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {data.inkop.rader.map((r) => {
                const rod = r.larmniva === "rod";
                const gul = r.larmniva === "gul";
                const nyckel = (falt: string) => `${r.id}:${falt}`;
                const utkast = (falt: string, varde: string) => kontoUtkast[nyckel(falt)] ?? varde;
                const andrat = (falt: string, varde: string) => (kontoUtkast[nyckel(falt)] ?? varde) !== varde;
                const satt = (falt: string, v: string) => setKontoUtkast({ ...kontoUtkast, [nyckel(falt)]: v });
                return (
                  <li key={r.id} className={`px-5 py-4 ${rod ? "bg-red-50/50" : gul ? "bg-amber-50/40" : ""}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${rod ? "bg-red-500" : gul ? "bg-amber-400" : "bg-emerald-500"}`} />
                      <span className="font-medium text-gray-900">{r.etikett}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {r.typ === "forbetalt" ? "Förbetalt" : "Efterskott"}
                      </span>
                      {r.betalkort_sista_fyra && (
                        <span className="text-xs text-gray-500">kort som slutar på {r.betalkort_sista_fyra}</span>
                      )}
                      {r.fakturalank && (
                        <a href={r.fakturalank} target="_blank" rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                          Öppna hos leverantören <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Saldo</dt>
                        <dd className="tabular-nums font-medium text-gray-900">
                          {r.saldo_belopp === null ? "inte ifyllt" : valutabelopp(r.saldo_belopp, r.saldo_valuta)}
                        </dd>
                        <dd className="text-xs text-gray-500">
                          {alderText(r.saldoAlderDagar, r.saldo_kalla)}
                          {r.saldoSek !== null && r.saldo_valuta !== "SEK"
                            ? ` · ${krHel(r.saldoSek)} med kursen ${r.kurs.toLocaleString("sv-SE")}`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Takt per dag</dt>
                        <dd className="tabular-nums font-medium text-gray-900">{kr(r.takt7.snittPerDag)}</dd>
                        <dd className="text-xs text-gray-500">
                          {r.takt7.tunt ? "för kort mätperiod än så länge" : `snitt över ${r.takt7.namnare} dagar`}
                          {" · 30 dagar: "}{kr(r.takt30.snittPerDag)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Dagar kvar</dt>
                        <dd className={`tabular-nums font-medium ${rod ? "text-red-700" : gul ? "text-amber-700" : "text-gray-900"}`}>
                          {r.typ === "efterskott" ? "gäller inte" : r.dagarKvar === null ? "går inte att räkna" : Math.floor(r.dagarKvar)}
                        </dd>
                        <dd className="text-xs text-gray-500">
                          {r.typ === "efterskott"
                            ? "faktureras i efterskott"
                            : r.dagarKvar === null
                              ? r.saldo_belopp === null ? "saldot saknas" : "ingen uppmätt förbrukning"
                              : "med sjudagarssnittet"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Prognos månad</dt>
                        <dd className="tabular-nums font-medium text-gray-900">{krHel(r.prognosSek)}</dd>
                        <dd className="text-xs text-gray-500">
                          {r.forra_fakturan_sek
                            ? `förra fakturan ${krHel(r.forra_fakturan_sek)}`
                            : r.typ === "efterskott" ? "fyll i förra fakturan nedan" : "trettiodagarssnittet gånger 30"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-gray-500">Denna månad</dt>
                        <dd className="tabular-nums font-medium text-gray-900">{kr(r.manadHittills)}</dd>
                        <dd className="text-xs text-gray-500">uppmätt hittills</dd>
                      </div>
                    </dl>

                    {r.larmniva !== "gron" && (
                      <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${rod ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
                        <strong>{r.larmorsak.charAt(0).toUpperCase() + r.larmorsak.slice(1)}.</strong>{" "}
                        {r.rekommendation ? r.rekommendation.klartext : "Fyll på hos leverantören innan det tar stopp."}
                      </p>
                    )}

                    {r.saldo_fel && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        Saldot gick inte att hämta automatiskt: {r.saldo_fel}. Siffran ovan är den senast kända.
                      </p>
                    )}
                    {r.notering && <p className="mt-2 text-xs text-gray-500">{r.notering}</p>}

                    {/* Ägarstyrda fält. Ett konto med automatiskt saldo får inget manuellt
                        saldofält: hade det skrivits över hade hämtningen tystnat. */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                      {!r.harApi && (
                        <label className="inline-flex items-center gap-2">
                          <span>Saldo ({r.saldo_valuta})</span>
                          <input type="number" min={0} step="0.01" placeholder="skriv in"
                            value={utkast("saldo_belopp", r.saldo_belopp === null ? "" : String(r.saldo_belopp))}
                            onChange={(e) => satt("saldo_belopp", e.target.value)}
                            className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                          {andrat("saldo_belopp", r.saldo_belopp === null ? "" : String(r.saldo_belopp)) && (
                            <button disabled={sparar}
                              onClick={() => patcha({ konto: { id: r.id, saldo_belopp: kontoUtkast[nyckel("saldo_belopp")] === "" ? null : Number(kontoUtkast[nyckel("saldo_belopp")]) } })}
                              className="rounded-lg bg-gray-900 px-2 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                          )}
                        </label>
                      )}
                      <label className="inline-flex items-center gap-2">
                        <span>Förra fakturan (kr)</span>
                        <input type="number" min={0} step="1" placeholder="skriv in"
                          value={utkast("forra_fakturan_sek", r.forra_fakturan_sek === null ? "" : String(r.forra_fakturan_sek))}
                          onChange={(e) => satt("forra_fakturan_sek", e.target.value)}
                          className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                        {andrat("forra_fakturan_sek", r.forra_fakturan_sek === null ? "" : String(r.forra_fakturan_sek)) && (
                          <button disabled={sparar}
                            onClick={() => patcha({ konto: { id: r.id, forra_fakturan_sek: kontoUtkast[nyckel("forra_fakturan_sek")] === "" ? null : Number(kontoUtkast[nyckel("forra_fakturan_sek")]) } })}
                            className="rounded-lg bg-gray-900 px-2 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                        )}
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span>Påfyllningssteg ({r.saldo_valuta})</span>
                        <input type="number" min={0} step="1" placeholder="okänt"
                          value={utkast("pafyllningssteg", r.pafyllningssteg === null ? "" : String(r.pafyllningssteg))}
                          onChange={(e) => satt("pafyllningssteg", e.target.value)}
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                        {andrat("pafyllningssteg", r.pafyllningssteg === null ? "" : String(r.pafyllningssteg)) && (
                          <button disabled={sparar}
                            onClick={() => patcha({ konto: { id: r.id, pafyllningssteg: kontoUtkast[nyckel("pafyllningssteg")] === "" ? null : Number(kontoUtkast[nyckel("pafyllningssteg")]) } })}
                            className="rounded-lg bg-gray-900 px-2 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                        )}
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span>Kort slutar på</span>
                        <input inputMode="numeric" maxLength={4} placeholder="1234"
                          value={utkast("betalkort_sista_fyra", r.betalkort_sista_fyra || "")}
                          onChange={(e) => satt("betalkort_sista_fyra", e.target.value)}
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                        {andrat("betalkort_sista_fyra", r.betalkort_sista_fyra || "") && (
                          <button disabled={sparar}
                            onClick={() => patcha({ konto: { id: r.id, betalkort_sista_fyra: kontoUtkast[nyckel("betalkort_sista_fyra")] } })}
                            className="rounded-lg bg-gray-900 px-2 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                        )}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Trösklarna. De ligger i databasen så de går att skruva utan ny version. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-600">
              <span className="font-medium text-gray-700">Larmgränser</span>
              {([
                ["gulDagar", "Gult under (dagar)", data.inkop.trosklar.gulDagar],
                ["rodDagar", "Rött under (dagar)", data.inkop.trosklar.rodDagar],
                ["gulPrognosProcent", "Gult över (procent av förra fakturan)", data.inkop.trosklar.gulPrognosProcent],
              ] as const).map(([falt, etikett, varde]) => (
                <label key={falt} className="inline-flex items-center gap-2">
                  <span>{etikett}</span>
                  <input type="number" min={1}
                    value={troskelUtkast[falt] ?? String(varde)}
                    onChange={(e) => setTroskelUtkast({ ...troskelUtkast, [falt]: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                  {(troskelUtkast[falt] ?? String(varde)) !== String(varde) && (
                    <button disabled={sparar}
                      onClick={() => patcha({ trosklar: { [falt]: Number(troskelUtkast[falt]) } })}
                      className="rounded-lg bg-gray-900 px-2 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                  )}
                </label>
              ))}
            </div>
          </section>

          {/* ── K3-INKÖP: bruttomarginal per kund ──────────────────────────────
              Intäkten kommer ur HQ:s intäktsrader, kostnaden ur händelseloggen.
              En kund utan ifyllt pris får ALDRIG marginalen noll: då hade en lucka
              sett ut som en mätning. */}
          <section id="marginal" className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-gray-900">
                <Percent className="h-5 w-5 text-emerald-500" /> Marginal per kund
              </h2>
              <span className="text-sm text-gray-500">
                {data.marginal.manad}. Abonnemang plus sålda påfyllningar minus faktisk AI-kostnad.
              </span>
            </div>

            <div className="grid gap-4 border-b border-gray-100 px-5 py-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Intäkt</p>
                <p className="tabular-nums text-lg font-semibold text-gray-900">{krHel(data.marginal.summa.intaktSek)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">AI-kostnad</p>
                <p className="tabular-nums text-lg font-semibold text-gray-900">{kr(data.marginal.summa.aiKostnadSek)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Bruttomarginal</p>
                <p className="tabular-nums text-lg font-semibold text-emerald-700">
                  {krHel(data.marginal.summa.marginalSek)}
                  {data.marginal.summa.marginalProcent !== null && ` (${Math.round(data.marginal.summa.marginalProcent)} procent)`}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Utan pris</p>
                <p className="tabular-nums text-lg font-semibold text-amber-600">{data.marginal.summa.utanPris}</p>
                <p className="text-xs text-gray-500">räknas inte in i totalen</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-2.5 font-medium">Kund</th>
                    <th className="px-3 py-2.5 text-right font-medium">Abonnemang</th>
                    <th className="px-3 py-2.5 text-right font-medium">Påfyllningar</th>
                    <th className="px-3 py-2.5 text-right font-medium">AI-kostnad</th>
                    <th className="px-3 py-2.5 text-right font-medium">Marginal</th>
                    <th className="px-5 py-2.5 text-right font-medium">Procent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.marginal.rader.map((m) => (
                    <tr key={m.tenantId} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-2.5 font-medium text-gray-800">
                        {m.namn}
                        {m.prisSaknas && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            pris saknas
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                        {m.abonnemangSek === null ? <span className="text-amber-600">saknas</span> : krHel(m.abonnemangSek)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{m.topupSek ? krHel(m.topupSek) : "0 kr"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{kr(m.aiKostnadSek)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${m.marginalSek === null ? "text-gray-400" : m.marginalSek < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {m.marginalSek === null ? "går inte att räkna" : krHel(m.marginalSek)}
                      </td>
                      <td className={`px-5 py-2.5 text-right tabular-nums ${m.marginalProcent === null ? "text-gray-400" : m.marginalProcent < 0 ? "text-red-600" : "text-gray-700"}`}>
                        {m.marginalProcent === null ? "" : `${Math.round(m.marginalProcent)} procent`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kopplingen mellan intäktsrad och kund. Utan den gissar uträkningen på
                namnlikhet, och en felmatchad rad hade sett ut som en sanning. */}
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
              <p className="text-xs font-medium text-gray-700">Koppla intäktsrad till kund</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Raderna kommer från Founder HQ. Är namnen olika i HQ och i plattformen behöver kopplingen sättas här,
                annars står kunden som &quot;pris saknas&quot;.
              </p>
              <ul className="mt-2 space-y-1.5">
                {data.marginal.mrrVal.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="min-w-32 font-medium text-gray-800">{v.kund}</span>
                    <span className="tabular-nums text-gray-500">{krHel(v.belopp_ex_moms)} per månad</span>
                    <select
                      value={v.client_id || ""}
                      onChange={(e) => patcha({ mrrKoppling: { mrrId: v.id, tenantId: e.target.value || null } })}
                      disabled={sparar}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1">
                      <option value="">Ingen koppling (matchas på namn)</option>
                      {data.marginal.rader.map((m) => (
                        <option key={m.tenantId} value={m.tenantId}>{m.namn}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Providerhälsa */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Tjänsternas läge</h2>
            {data.health.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga anrop loggade än. Så fort något genereras dyker tjänsterna upp här.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.health.map((h) => (
                  <li key={h.provider} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${h.rod ? "bg-red-500" : h.fel_senaste_timmen > 0 ? "bg-amber-400" : "bg-emerald-500"}`} />
                    <span className="min-w-28 font-medium text-gray-900">{h.provider}</span>
                    <span className="text-gray-500">Senast klart: {tid(h.senaste_ok)}</span>
                    {h.senaste_fel && (
                      <span className="text-gray-500">
                        Senaste fel: {tid(h.senaste_fel)} ({FELKLASS_TEXT[h.senaste_felklass || "other"]})
                      </span>
                    )}
                    <span className="ml-auto tabular-nums text-gray-400">{h.ok_senaste_timmen} klara / {h.fel_senaste_timmen} fel senaste timmen</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Per klient, mot taket */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per klient</h2>
            {data.perTenant.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga anrop den här månaden än.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.perTenant.map((t) => {
                  const rod = t.procent >= 100;
                  const gul = !rod && t.procent >= 75;
                  return (
                    <li key={t.tenantId || "utan"} className="px-5 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-gray-900">{t.namn}</span>
                        <span className={`tabular-nums text-sm ${rod ? "font-semibold text-red-600" : gul ? "font-semibold text-amber-600" : "text-gray-600"}`}>
                          {kr(t.kostnad)} av {kr(t.tak)} ({Math.round(t.procent)} procent)
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(1, t.procent))}%`, background: rod ? "#dc2626" : gul ? "#d97706" : "linear-gradient(90deg,#34d399,#059669)" }} />
                      </div>
                      {/* K2-3: credits SIDA VID SIDA med kronorna. Divergerar de är priserna fel. */}
                      {t.credits && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span className="tabular-nums">
                            <strong className="text-gray-900">{t.creditSaldo}</strong> credits kvar av {t.credits.kvot + t.credits.extra}
                            {t.credits.extra > 0 ? ` (varav ${t.credits.extra} köpta)` : ""}
                          </span>
                          <span className="tabular-nums text-gray-500">{t.credits.anvant} använda</span>
                          {t.tenantId && (
                            <span className="inline-flex items-center gap-1.5">
                              <input type="number" min={0}
                                value={kvotUtkast[t.tenantId] ?? String(t.credits.kvot)}
                                onChange={(e) => setKvotUtkast({ ...kvotUtkast, [t.tenantId!]: e.target.value })}
                                className="w-20 rounded-lg border border-gray-200 px-2 py-0.5 text-right tabular-nums" />
                              <span className="text-gray-500">credits per månad</span>
                              {(kvotUtkast[t.tenantId] ?? String(t.credits.kvot)) !== String(t.credits.kvot) && (
                                <button onClick={() => patcha({ kvot: { tenantId: t.tenantId, credits: Number(kvotUtkast[t.tenantId!]) } })}
                                  disabled={sparar} className="rounded-lg bg-gray-900 px-2 py-0.5 font-medium text-white disabled:opacity-50">Spara</button>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Larmet ur beställningen: kronorna tar slut trots att credits finns kvar. */}
                      {t.felprissatt && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <strong>Creditsen är felprissatta för den här klienten.</strong> Kostnadstaket är nått men {t.creditSaldo} credits
                          finns kvar, så kunden tror att hon har utrymme och blir stoppad ändå. Höj creditpriset eller taket.
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{t.anrop} anrop{t.fel > 0 ? `, ${t.fel} fel` : ""}</span>
                        {rod && <span className="font-medium text-red-600">Nya genereringar är stoppade för den här klienten tills taket höjs eller månaden vänder.</span>}
                        {t.tenantId && (
                          insattning?.tenantId === t.tenantId ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <input type="number" value={insattning.credits} placeholder="antal"
                                onChange={(e) => setInsattning({ ...insattning, credits: e.target.value })}
                                className="w-20 rounded-lg border border-gray-200 px-2 py-1" />
                              <input value={insattning.note} placeholder="Notering (obligatorisk)"
                                onChange={(e) => setInsattning({ ...insattning, note: e.target.value })}
                                className="w-64 rounded-lg border border-gray-200 px-2 py-1" />
                              <button
                                onClick={async () => { await patcha({ insattning: { tenantId: t.tenantId, credits: Number(insattning.credits), note: insattning.note } }); setInsattning(null); }}
                                disabled={sparar || !insattning.note.trim() || !insattning.credits}
                                className="rounded-lg bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-40">Sätt in</button>
                              <button onClick={() => setInsattning(null)} className="text-gray-500 underline">Avbryt</button>
                            </span>
                          ) : (
                            <button onClick={() => setInsattning({ tenantId: t.tenantId!, credits: "", note: "" })}
                              className="font-medium text-gray-700 underline">Sätt in credits</button>
                          )
                        )}
                        {t.tenantId && (redigerar === t.tenantId ? (
                          <span className="inline-flex items-center gap-2">
                            <input type="number" min={0} value={nyttTak} onChange={(e) => setNyttTak(e.target.value)}
                              className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                            <button onClick={() => sparaTak(t.tenantId!)} disabled={sparar}
                              className="rounded-lg bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                            <button onClick={() => setRedigerar(null)} className="text-gray-500 underline">Avbryt</button>
                          </span>
                        ) : (
                          <button onClick={() => { setRedigerar(t.tenantId!); setNyttTak(String(t.tak)); }}
                            className="font-medium text-gray-700 underline">Ändra taket</button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* K2-3: påfyllningar att besluta. Ingen betalning i systemet — du godkänner,
              creditsen sätts in, fakturan går utanför. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold text-gray-900">Påfyllningar</h2>
              {vantande.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  {vantande.length} väntar på ditt beslut
                </span>
              )}
            </div>
            {data.ordrar.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga kunder har beställt påfyllning än.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.ordrar.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-gray-900">{o.namn}</span>
                    <span className="tabular-nums text-gray-600">{o.credits} credits för {kr(Number(o.price_sek))}</span>
                    <span className="text-xs text-gray-400">beställd {tid(o.created_at)}</span>
                    {o.status === "pending" ? (
                      <span className="ml-auto flex items-center gap-2">
                        <button onClick={() => patcha({ orderId: o.id, godkann: true })} disabled={sparar}
                          className="rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                          Godkänn och sätt in
                        </button>
                        <button onClick={() => patcha({ orderId: o.id, godkann: false })} disabled={sparar}
                          className="rounded-lg border border-gray-200 px-3 py-1 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                          Avslå
                        </button>
                      </span>
                    ) : (
                      <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${o.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {o.status === "approved" ? "Godkänd" : "Avslagen"}{o.decided_at ? ` ${tid(o.decided_at)}` : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* K2-3: creditpriserna, ägarstyrda utan deploy. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold text-gray-900">Vad saker kostar i credits</h2>
              <span className="text-sm text-gray-500">Ändringen gäller direkt, ingen ny version behövs.</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {data.creditPriser.map((p) => (
                <li key={p.action} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="font-medium text-gray-900">{p.label}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{p.action}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <input type="number" min={0}
                      value={prisUtkast[p.action] ?? String(p.credits)}
                      onChange={(e) => setPrisUtkast({ ...prisUtkast, [p.action]: e.target.value })}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                    <span className="text-gray-500">credits</span>
                    {(prisUtkast[p.action] ?? String(p.credits)) !== String(p.credits) && (
                      <button onClick={() => patcha({ creditPris: { action: p.action, credits: Number(prisUtkast[p.action]) } })}
                        disabled={sparar} className="rounded-lg bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per tjänst (betalas per anrop)</h2>
            <Stapel rader={data.perProvider} max={maxProvider} etikett="Tjänst" />
          </section>

          {/* Fasta abonnemang. De går inte att mäta per anrop men är verkliga pengar varje
              månad — utan dem visar vyn bara halva sanningen. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold text-gray-900">Fasta abonnemang</h2>
              <span className="text-sm text-gray-500">Betalas per månad oavsett användning. Fyll i beloppet från fakturan.</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {data.fasta.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className={`font-medium ${f.aktiv ? "text-gray-900" : "text-gray-400 line-through"}`}>{f.namn}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{f.kategori}</span>
                  {f.belopp_sek === 0 && f.aktiv && (
                    <span className="text-xs font-medium text-amber-600">belopp saknas, totalen är för låg tills du fyllt i det</span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <input
                      type="number" min={0} step="1"
                      value={fastUtkast[f.id] ?? String(f.belopp_sek)}
                      onChange={(e) => setFastUtkast({ ...fastUtkast, [f.id]: e.target.value })}
                      className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums"
                    />
                    <span className="text-gray-500">kr per månad</span>
                    {(fastUtkast[f.id] ?? String(f.belopp_sek)) !== String(f.belopp_sek) && (
                      <button onClick={() => patcha({ fastId: f.id, belopp: Number(fastUtkast[f.id]) })} disabled={sparar}
                        className="rounded-lg bg-gray-900 px-2.5 py-1 font-medium text-white disabled:opacity-50">Spara</button>
                    )}
                    <button onClick={() => patcha({ fastId: f.id, aktiv: !f.aktiv })} disabled={sparar}
                      className="text-xs text-gray-500 underline">{f.aktiv ? "Räkna inte med" : "Räkna med"}</button>
                  </span>
                </li>
              ))}
              <li className="flex flex-wrap items-center gap-3 bg-gray-50 px-5 py-3 text-sm">
                <input value={nyttNamn} onChange={(e) => setNyttNamn(e.target.value)} placeholder="Lägg till en tjänst du betalar för"
                  className="flex-1 min-w-56 rounded-lg border border-gray-200 px-3 py-1.5" />
                <button onClick={() => { patcha({ nyFast: { namn: nyttNamn } }); setNyttNamn(""); }}
                  disabled={sparar || !nyttNamn.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 font-medium text-white disabled:opacity-40">Lägg till</button>
              </li>
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Per flöde</h2>
            <Stapel rader={data.perFlow} max={maxFlow} etikett="Flöde" />
          </section>

          {/* Fellogg med hela svarskroppen — regeln från betalningsspärren. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <h2 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">
              Senaste felen {data.fel.length > 0 && <span className="text-sm font-normal text-gray-500">({data.fel.length})</span>}
            </h2>
            {data.fel.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">Inga fel den här månaden. Bra läge.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.fel.map((f, i) => (
                  <li key={i}>
                    <button onClick={() => setOppetFel(oppetFel === i ? null : i)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm hover:bg-gray-50">
                      {oppetFel === i ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                      <span className="tabular-nums text-gray-500">{tid(f.created_at)}</span>
                      <span className="font-medium text-gray-900">{f.provider}</span>
                      <span className="text-gray-600">{f.flow}</span>
                      <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${f.error_class === "billing" || f.error_class === "auth" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {FELKLASS_TEXT[f.error_class || "other"]}{f.http_status ? ` ${f.http_status}` : ""}
                      </span>
                    </button>
                    {oppetFel === i && (
                      <pre className="mx-5 mb-3 max-h-72 overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
                        {f.error_body || "Ingen svarskropp sparades för det här felet."}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
