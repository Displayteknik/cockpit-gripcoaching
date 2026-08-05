"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CalendarCheck, Coins, Command, ExternalLink, Flag, Receipt, RefreshCw,
  Server, Sunrise, Target, TrendingUp, Trash2, Users, Wallet,
} from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";
import Tystnadslistan, { useTystnad } from "./kontakt/Tystnadslistan";
import LikviditetsVy, { type CashRad, type Likviditet } from "./Likviditet";
import { mysalesKontaktUrl } from "@/lib/mysales";

// HQ-1 — Founder HQ, ägarens kommandobrygga.
// Grip driver återkommande intäkt, Displayteknik driver pipeline. Båda ligger på samma
// sida så dagen kan börja på ett ställe. Pipelinen ÄGS av MySales: här läses den bara,
// och varje ändring görs i MySales. Inga AI-anrop i den här modulen.

interface PipelineKort {
  ghl_opportunity_id: string;
  namn: string | null;
  kontakt: string | null;
  foretag: string | null;
  ghl_contact_id: string | null;
  location_id: string;
  pipeline_namn: string | null;
  steg_namn: string | null;
  varde: number;
  harledd_status: "open" | "won" | "lost";
  senast_uppdaterad: string | null;
  uppfoljning_datum: string | null;
  uppfoljning_titel: string | null;
  // LIKVID-1: betalstatusen följer med kortet, så tabellen slipper en andra hämtning.
  finans: {
    fakturerat: number;
    betalt: number;
    forvantat_betaldatum: string | null;
    forfallodatum: string | null;
    notering: string | null;
  };
  sannolikhet: number;
}

interface LarmRad {
  id: string;
  text: string;
  niva: "gul" | "rod";
  /** Vad larmet gäller: "Likviditet" (LIKVID-1) eller "Inköp" (K3). */
  etikett?: string;
  /** Vart man går för att göra något åt det. */
  lank?: string;
}

interface SannolikhetRad {
  steg_id: string;
  steg_namn: string | null;
  position: number | null;
  procent: number;
  agarsatt: boolean;
}

interface MrrRad {
  id: string; bolag: string; kund: string; niva: string;
  belopp_ex_moms: number; startdatum: string | null; status: string; notering: string | null;
}
interface FastRad {
  id: string; bolag: string; tjanst: string; belopp_per_man: number; valuta: string; notering: string | null;
}
interface TaskRad { id: string; titel: string; bolag: string; datum: string | null; klar: boolean }

// PLAN-1: dagens kalender, samma spegel som planeringsvyn läser.
interface DagensHandelse {
  id: string; titel: string | null; heldag: boolean;
  start: string | null; slut: string | null;
  tidstyp: string | null; farg: string | null; lank: string | null;
}
const KALENDERFARG: Record<string, string> = {
  teal: "#14b8a6", coral: "#fb7185", blue: "#3b82f6", purple: "#a855f7", gray: "#94a3b8",
};

interface Data {
  idag: string;
  vecka: { start: string; slut: string };
  morgonlistan: { larm: LarmRad[]; handelser?: DagensHandelse[]; kort: PipelineKort[]; uppgifter: TaskRad[] };
  grip: { mrr: number; pionjarer: number; pionjarMal: number; gdam: number; gdamMal: number; mal: number; procent: number };
  mrr: MrrRad[];
  dt: {
    summaOppna: number; antalOppna: number;
    perSteg: { steg: string; steg_id?: string | null; pipeline: string; antal: number; summa: number }[];
    vunnetManaden: number; antalVunna: number; uppfoljningarVeckan: number;
    // LIKVID-1: de tre summorna som ersatte klumpsumman.
    iSpelOfakturerat: number; antalISpel: number;
    fakturreratObetalt: number; antalFakturerade: number;
    aldstaForfallodatum: string | null; antalForfallna: number;
    betalt: number;
  };
  pipeline: PipelineKort[];
  likviditet: Likviditet[];
  cash: CashRad[];
  sannolikheter: SannolikhetRad[];
  fasta: FastRad[];
  kostnadPerBolag: { bolag: string; perValuta: { valuta: string; summa: number }[]; saknarBelopp: number }[];
  aiPerKund: { kund: string; intakt: number; aiKostnad: number }[];
  tasks: TaskRad[];
  synk: { senastSynkad: string | null; ok: boolean; fel: string | null; locationId: string | null; utanforUrvalet: number };
}

const NIVAER: Record<string, string> = {
  grund: "Grund", pro: "Pro (pionjär)", gdam: "GDÅM", bollplanket: "Bollplanket", konsult: "Konsult", ovrigt: "Övrigt",
};
const STATUSAR: Record<string, string> = { aktiv: "Aktiv", pausad: "Pausad", avslutad: "Avslutad" };
const BOLAGSNAMN: Record<string, string> = { grip: "GripCoaching", dt: "Displayteknik", privat: "Privat" };

const kr = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;
const belopp = (n: number, valuta: string) =>
  `${n.toLocaleString("sv-SE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${valuta}`;
const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString("sv-SE") : "");
const tid = (s: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig");

/** Länk till kortets kontakt i MySales. GHL öppnar affären från kontaktvyn. */
const mysalesLank = (k: PipelineKort) => mysalesKontaktUrl(k.location_id, k.ghl_contact_id);

export default function HqPage() {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  // KONTAKT-1: samma hook som den egna vyn, sa HQ och /kontakt aldrig visar olika sanning.
  const { data: kontakt, laddar: laddarKontakt, hamta: hamtaKontakt } = useTystnad();
  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [raderar, setRaderar] = useState<string | null>(null);
  const [nyTask, setNyTask] = useState({ titel: "", bolag: "grip", datum: "" });
  const [nyMrr, setNyMrr] = useState({ kund: "", bolag: "grip", niva: "pro", belopp_ex_moms: "", startdatum: "" });
  const [nyFast, setNyFast] = useState({ tjanst: "", bolag: "grip", belopp_per_man: "", valuta: "SEK", notering: "" });
  const [fastUtkast, setFastUtkast] = useState<Record<string, string>>({});
  const [mrrUtkast, setMrrUtkast] = useState<Record<string, string>>({});
  // LIKVID-1: utkast för betalstatus per affär och för sannolikhet per steg.
  const [finansUtkast, setFinansUtkast] = useState<Record<string, string>>({});
  const [sannUtkast, setSannUtkast] = useState<Record<string, string>>({});

  const hamta = useCallback(async (tvinga = false) => {
    setLaddar(true);
    try {
      const r = await fetch(`/api/hq${tvinga ? "?uppdatera=1" : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta HQ");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  async function skicka(metod: "POST" | "PATCH", kropp: Record<string, unknown>) {
    setSparar(true);
    try {
      const r = await fetch("/api/hq", {
        method: metod,
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

  async function taBort(typ: string, id: string) {
    setSparar(true);
    try {
      const r = await fetch(`/api/hq?typ=${typ}&id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte ta bort raden");
      setRaderar(null);
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  }

  const antalIMorgonlistan =
    (data?.morgonlistan.larm?.length || 0) +
    (data?.morgonlistan.handelser?.length || 0) +
    (data?.morgonlistan.kort.length || 0) +
    (data?.morgonlistan.uppgifter.length || 0);

  return (
    <div className="space-y-6">
      <DashHero
        title="Founder HQ"
        subtitle="Dagens lista, den återkommande intäkten i GripCoaching och Displaytekniks pipeline ur MySales. Affärerna ändras i MySales, här läses de bara."
        icon={Command}
        eyebrow={<LivePill label="idag" />}
        chips={
          data ? (
            <>
              <HeroChip icon={Sunrise} label={`${antalIMorgonlistan} att ta tag i idag`} />
              <HeroChip icon={TrendingUp} label={`${kr(data.grip.mrr)} i månadsintäkt`} />
              <HeroChip icon={Target} label={`${kr(data.dt.iSpelOfakturerat)} i spel, ofakturerat`} />
              <HeroChip icon={Receipt} label={`${kr(data.dt.fakturreratObetalt)} fakturerat, obetalt`} />
            </>
          ) : undefined
        }
        right={
          <button onClick={() => hamta(true)} disabled={laddar}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Uppdatera nu
          </button>
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {/* Går MySales inte att nå ska sidan ändå fungera. Då visas den sparade spegeln
          med sin tidsstämpel, så det aldrig är oklart hur färska siffrorna är. */}
      {data && !data.synk.ok && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Kunde inte hämta pipelinen från MySales just nu.</p>
            <p className="mt-1">
              Siffrorna nedan kommer från senast sparade hämtning: {tid(data.synk.senastSynkad)}. Orsak: {data.synk.fel}
            </p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* ── Morgonlistan ─────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-gray-900">
                <Sunrise className="h-5 w-5 text-amber-500" /> Morgonlistan
              </h2>
              <span className="text-sm text-gray-500">
                Affärer och uppgifter som förfaller idag eller är passerade. Pipelinen hämtad {tid(data.synk.senastSynkad)}.
              </span>
            </div>

            {antalIMorgonlistan === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-500">
                Inget förfaller idag. Lägg till en uppgift längst ner om du vill styra morgondagen redan nu.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {/* Larmen ligger överst i samma lista som allt annat som förfaller.
                    Ingen egen banner, ingen andra väg in i vyn. Likviditet kommer ur
                    LIKVID-1, inköpslarmen ur K3 och lib/inkop, båda i samma form. */}
                {(data.morgonlistan.larm || []).map((larm) => (
                  <li key={larm.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        larm.niva === "rod" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {larm.etikett || "Likviditet"}
                    </span>
                    <span className={`font-medium ${larm.niva === "rod" ? "text-red-700" : "text-amber-800"}`}>
                      {larm.text}
                    </span>
                    <a href={larm.lank || "#likviditet"} className="ml-auto font-medium text-indigo-600 hover:text-indigo-800">
                      {larm.etikett === "Uppstart" ? "Öppna uppstarten"
                        : larm.etikett === "Bollen hos dig" || larm.etikett === "Tystnad" || larm.etikett === "Offert" ? "Öppna kontakten"
                        : larm.lank && !larm.lank.startsWith("#") ? "Se inköpsläget" : "Se prognosen"}
                    </a>
                  </li>
                ))}
                {/* PLAN-1: dagens händelser ligger näst överst, efter larmen men före
                    affärer och uppgifter. Dagen läses bäst i den ordning den inträffar. */}
                {(data.morgonlistan.handelser || []).map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: KALENDERFARG[h.farg || "gray"] }} />
                      {h.tidstyp || "Kalender"}
                    </span>
                    <span className="font-medium text-gray-900">{h.titel || "Namnlös händelse"}</span>
                    <span className="tabular-nums text-gray-500">{h.heldag ? "hela dagen" : `${h.start} till ${h.slut}`}</span>
                    <a href="/dashboard/hq/planering" className="ml-auto font-medium text-indigo-600 hover:text-indigo-800">
                      Se veckan
                    </a>
                  </li>
                ))}
                {data.morgonlistan.kort.map((k) => {
                  const lank = mysalesLank(k);
                  const forsenad = k.uppfoljning_datum ? datum(k.uppfoljning_datum) < datum(`${data.idag}T12:00:00Z`) : false;
                  return (
                    <li key={k.ghl_opportunity_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Affär</span>
                      <span className="min-w-0 font-medium text-gray-900">{k.namn || k.kontakt || "Namnlös affär"}</span>
                      <span className="text-gray-500">{k.steg_namn}</span>
                      {k.uppfoljning_titel && <span className="text-gray-600">{k.uppfoljning_titel}</span>}
                      <span className={`tabular-nums ${forsenad ? "font-semibold text-red-600" : "text-gray-500"}`}>
                        {datum(k.uppfoljning_datum)}
                      </span>
                      {k.varde > 0 && <span className="tabular-nums text-gray-500">{kr(k.varde)}</span>}
                      {lank && (
                        <a href={lank} target="_blank" rel="noreferrer"
                          className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800">
                          Öppna i MySales <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  );
                })}
                {data.morgonlistan.uppgifter.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                    <input type="checkbox" checked={t.klar} disabled={sparar}
                      onChange={() => skicka("PATCH", { typ: "task", id: t.id, klar: true })}
                      aria-label={`Bocka av ${t.titel}`}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{BOLAGSNAMN[t.bolag]}</span>
                    <span className="font-medium text-gray-900">{t.titel}</span>
                    <span className={`tabular-nums ${t.datum && t.datum < data.idag ? "font-semibold text-red-600" : "text-gray-500"}`}>
                      {t.datum}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Egna uppgifter: allt som inte är en affär i MySales hör hemma här. */}
            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <input value={nyTask.titel} onChange={(e) => setNyTask({ ...nyTask, titel: e.target.value })}
                placeholder="Vad ska göras?" className="min-w-56 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
              <select value={nyTask.bolag} onChange={(e) => setNyTask({ ...nyTask, bolag: e.target.value })}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                <option value="grip">GripCoaching</option>
                <option value="dt">Displayteknik</option>
                <option value="privat">Privat</option>
              </select>
              <input type="date" value={nyTask.datum} onChange={(e) => setNyTask({ ...nyTask, datum: e.target.value })}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
              <button
                onClick={async () => { await skicka("POST", { typ: "task", ...nyTask }); setNyTask({ titel: "", bolag: "grip", datum: "" }); }}
                disabled={sparar || !nyTask.titel.trim()}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                Lägg till
              </button>
            </div>
          </section>

          {/* ── Grip: MRR-motorn ─────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-gray-900">GripCoaching</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Aktiv månadsintäkt ex moms" value={Math.round(data.grip.mrr)} sub={kr(data.grip.mrr)} icon={TrendingUp} tone="emerald" i={0} />
              <StatTile label="Pionjärer" value={data.grip.pionjarer} sub={`${data.grip.pionjarer} av ${data.grip.pionjarMal}`} icon={Users} tone="blue" i={1} />
              <StatTile label="GDÅM" value={data.grip.gdam} sub={`${data.grip.gdam} av ${data.grip.gdamMal}`} icon={Flag} tone="violet" i={2} />
              <StatTile label="Andel av målet i procent" value={Math.round(data.grip.procent)} sub={`Målet är ${kr(data.grip.mal)} per månad`} icon={Target} tone="amber" i={3} />
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800">Vägen till {kr(data.grip.mal)} per månad</span>
                <span className="tabular-nums text-gray-600">{kr(data.grip.mrr)} av {kr(data.grip.mal)}</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-gray-100">
                <div className="h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(1, data.grip.procent))}%`, background: "linear-gradient(90deg,#34d399,#059669)" }} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
                <h3 className="font-display text-lg font-semibold text-gray-900">Alla intäktsrader</h3>
                <span className="text-sm text-gray-500">Beloppen är exklusive moms, per månad.</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-2.5 font-medium">Kund</th>
                      <th className="px-3 py-2.5 font-medium">Bolag</th>
                      <th className="px-3 py-2.5 font-medium">Nivå</th>
                      <th className="px-3 py-2.5 text-right font-medium">Per månad</th>
                      <th className="px-3 py-2.5 font-medium">Start</th>
                      <th className="px-3 py-2.5 font-medium">Läge</th>
                      <th className="px-5 py-2.5 font-medium">Ta bort</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mrr.length === 0 && (
                      <tr><td colSpan={7} className="px-5 py-6 text-sm text-gray-500">Inga intäktsrader inlagda än.</td></tr>
                    )}
                    {data.mrr.map((r) => (
                      <tr key={r.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-2.5 font-medium text-gray-900">{r.kund}</td>
                        <td className="px-3 py-2.5">
                          <select value={r.bolag} disabled={sparar}
                            onChange={(e) => skicka("PATCH", { typ: "mrr", id: r.id, bolag: e.target.value })}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                            <option value="grip">GripCoaching</option>
                            <option value="dt">Displayteknik</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select value={r.niva} disabled={sparar}
                            onChange={(e) => skicka("PATCH", { typ: "mrr", id: r.id, niva: e.target.value })}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                            {Object.entries(NIVAER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-2">
                            <input type="number" min={0} value={mrrUtkast[r.id] ?? String(r.belopp_ex_moms)}
                              onChange={(e) => setMrrUtkast({ ...mrrUtkast, [r.id]: e.target.value })}
                              className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                            {(mrrUtkast[r.id] ?? String(r.belopp_ex_moms)) !== String(r.belopp_ex_moms) && (
                              <button onClick={() => skicka("PATCH", { typ: "mrr", id: r.id, belopp_ex_moms: Number(mrrUtkast[r.id]) })}
                                disabled={sparar} className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">Spara</button>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={r.startdatum || ""} disabled={sparar}
                            onChange={(e) => skicka("PATCH", { typ: "mrr", id: r.id, startdatum: e.target.value })}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          <select value={r.status} disabled={sparar}
                            onChange={(e) => skicka("PATCH", { typ: "mrr", id: r.id, status: e.target.value })}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                            {Object.entries(STATUSAR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-2.5">
                          {raderar === r.id ? (
                            <span className="inline-flex items-center gap-2 text-xs">
                              <button onClick={() => taBort("mrr", r.id)} disabled={sparar}
                                className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50">Ja, ta bort</button>
                              <button onClick={() => setRaderar(null)} className="text-gray-500 underline">Avbryt</button>
                            </span>
                          ) : (
                            <button onClick={() => setRaderar(r.id)} aria-label={`Ta bort ${r.kund}`}
                              className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
                <input value={nyMrr.kund} onChange={(e) => setNyMrr({ ...nyMrr, kund: e.target.value })}
                  placeholder="Ny kund" className="min-w-44 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                <select value={nyMrr.bolag} onChange={(e) => setNyMrr({ ...nyMrr, bolag: e.target.value })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                  <option value="grip">GripCoaching</option>
                  <option value="dt">Displayteknik</option>
                </select>
                <select value={nyMrr.niva} onChange={(e) => setNyMrr({ ...nyMrr, niva: e.target.value })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                  {Object.entries(NIVAER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="number" min={0} value={nyMrr.belopp_ex_moms}
                  onChange={(e) => setNyMrr({ ...nyMrr, belopp_ex_moms: e.target.value })}
                  placeholder="kr per månad" className="w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums" />
                <input type="date" value={nyMrr.startdatum} onChange={(e) => setNyMrr({ ...nyMrr, startdatum: e.target.value })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                <button
                  onClick={async () => { await skicka("POST", { typ: "mrr", ...nyMrr }); setNyMrr({ kund: "", bolag: "grip", niva: "pro", belopp_ex_moms: "", startdatum: "" }); }}
                  disabled={sparar || !nyMrr.kund.trim() || nyMrr.belopp_ex_moms === ""}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                  Lägg till
                </button>
              </div>
            </div>
          </section>

          {/* ── Displayteknik: pipelinen ur MySales ──────────────────────── */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-gray-900">Displayteknik</h2>
              <span className="text-sm text-gray-500">Läses från MySales. Ändringar gör du i MySales, inte här.</span>
            </div>
            {/* Ett urval som inte redovisas läses som "allt". Därför står det här hur
                många kort som ligger utanför den pipeline du jobbar i. */}
            {data.synk.utanforUrvalet > 0 && (
              <p className="text-sm text-gray-500">
                Siffrorna gäller pipelinen du jobbar i. {data.synk.utanforUrvalet} kort ligger i andra pipelines i MySales
                och räknas inte här.
              </p>
            )}
            {/* Den gamla klumpsumman blandade in delbetalda affärer. Nu står de tre
                lägena var för sig: det som inte är fakturerat, det som är fakturerat
                men obetalt, och det som faktiskt kommit in. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile
                label="I spel, ofakturerat"
                value={Math.round(data.dt.iSpelOfakturerat)}
                sub={`${kr(data.dt.iSpelOfakturerat)} på ${data.dt.antalISpel} affärer, viktat på steget`}
                icon={Target}
                tone="blue"
                i={0}
              />
              <StatTile
                label="Fakturerat, obetalt"
                value={Math.round(data.dt.fakturreratObetalt)}
                sub={
                  data.dt.antalFakturerade === 0
                    ? "Inga obetalda fakturor inlagda"
                    : `${data.dt.antalFakturerade} fakturor${
                        data.dt.aldstaForfallodatum ? `, äldsta förfaller ${data.dt.aldstaForfallodatum}` : ""
                      }${data.dt.antalForfallna ? `, varav ${data.dt.antalForfallna} passerade` : ""}`
                }
                icon={Receipt}
                tone={data.dt.antalForfallna > 0 ? "amber" : "slate"}
                i={1}
              />
              <StatTile
                label="Betalt i år"
                value={Math.round(data.dt.betalt)}
                sub={`${kr(data.dt.betalt)} inbokat som betalt`}
                icon={Wallet}
                tone="emerald"
                i={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Affärer i spel" value={data.dt.antalOppna} sub={`${data.dt.perSteg.length} steg med affärer i`} icon={Command} tone="slate" i={0} />
              <StatTile label="Vunnet denna månad" value={Math.round(data.dt.vunnetManaden)} sub={`${kr(data.dt.vunnetManaden)} på ${data.dt.antalVunna} affärer`} icon={TrendingUp} tone="emerald" i={1} />
              <StatTile label="Uppföljningar denna vecka" value={data.dt.uppfoljningarVeckan} sub={`${data.vecka.start} till ${data.vecka.slut}`} icon={CalendarCheck} tone="violet" i={2} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
                <h3 className="font-display text-lg font-semibold text-gray-900">Så ligger affärerna</h3>
                <span className="text-sm text-gray-500">
                  Sannolikheten styr viktningen i I spel och i likviditetsprognosen. Ändra den och den blir din.
                </span>
              </div>
              {data.dt.perSteg.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">Inga affärer i spel just nu.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {data.dt.perSteg.map((s) => {
                    const sann = data.sannolikheter.find((x) => x.steg_id === s.steg_id);
                    const nyckel = `sann-${s.steg_id}`;
                    const varde = sannUtkast[nyckel] ?? String(sann?.procent ?? 50);
                    return (
                      <li key={`${s.pipeline}|${s.steg}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-sm">
                        <span className="font-medium text-gray-900">{s.steg}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{s.pipeline}</span>
                        <span className="ml-auto inline-flex items-center gap-1.5">
                          <input type="number" min={0} max={100} value={varde} disabled={sparar || !s.steg_id}
                            onChange={(e) => setSannUtkast({ ...sannUtkast, [nyckel]: e.target.value })}
                            aria-label={`Sannolikhet för ${s.steg}`}
                            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                          <span className="text-xs text-gray-500">procent</span>
                          {varde !== String(sann?.procent ?? 50) && (
                            <button onClick={() => skicka("PATCH", { typ: "sannolikhet", steg_id: s.steg_id, procent: Number(varde) })}
                              disabled={sparar} className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">Spara</button>
                          )}
                          {!sann?.agarsatt && <span className="text-xs text-gray-400">utgångspunkt</span>}
                        </span>
                        <span className="w-24 text-right tabular-nums text-gray-600">{s.antal} {s.antal === 1 ? "affär" : "affärer"}</span>
                        <span className="w-32 text-right tabular-nums text-gray-900">{kr(s.summa)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
                <h3 className="font-display text-lg font-semibold text-gray-900">Korten</h3>
                <span className="text-sm text-gray-500">
                  Sorterade på uppföljningsdatum. Fakturerat, betalt och datumen fyller du i här, affären ändrar du i MySales.
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[74rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-2.5 font-medium">Affär</th>
                      <th className="px-3 py-2.5 font-medium">Steg</th>
                      <th className="px-3 py-2.5 text-right font-medium">Värde</th>
                      <th className="px-3 py-2.5 text-right font-medium">Fakturerat</th>
                      <th className="px-3 py-2.5 text-right font-medium">Betalt</th>
                      <th className="px-3 py-2.5 text-right font-medium">Kvar</th>
                      <th className="px-3 py-2.5 font-medium">Förväntat betalt</th>
                      <th className="px-3 py-2.5 font-medium">Förfaller</th>
                      <th className="px-5 py-2.5 font-medium">MySales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pipeline.length === 0 && (
                      <tr><td colSpan={9} className="px-5 py-6 text-sm text-gray-500">
                        Ingen pipeline hämtad än. Tryck på Uppdatera nu.
                      </td></tr>
                    )}
                    {data.pipeline.map((k) => {
                      const lank = mysalesLank(k);
                      const f = k.finans;
                      // Kvar att fakturera lagras aldrig. Den räknas alltid som affärens
                      // belopp minus det som fakturerats, så två fält aldrig säger emot varandra.
                      const kvar = Math.max(0, k.varde - f.fakturerat);
                      const obetalt = Math.max(0, f.fakturerat - f.betalt);
                      const forfallen = !!f.forfallodatum && obetalt > 0 && f.forfallodatum < data.idag;
                      const falt = (namn: "fakturerat" | "betalt") => `${k.ghl_opportunity_id}|${namn}`;
                      const varde = (namn: "fakturerat" | "betalt") =>
                        finansUtkast[falt(namn)] ?? String(f[namn]);
                      const andrad = (namn: "fakturerat" | "betalt") => varde(namn) !== String(f[namn]);
                      return (
                        <tr key={k.ghl_opportunity_id} className={`border-b border-gray-50 last:border-0 ${forfallen ? "bg-red-50/60" : ""}`}>
                          <td className="px-5 py-2.5">
                            <span className="font-medium text-gray-900">{k.namn || k.kontakt || "Namnlös affär"}</span>
                            {k.foretag && <span className="ml-2 text-xs text-gray-500">{k.foretag}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              k.harledd_status === "won" ? "bg-emerald-100 text-emerald-700"
                                : k.harledd_status === "lost" ? "bg-gray-100 text-gray-500"
                                : "bg-blue-50 text-blue-700"}`}>
                              {k.steg_namn || "okänt steg"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{k.varde > 0 ? kr(k.varde) : ""}</td>
                          {(["fakturerat", "betalt"] as const).map((namn) => (
                            <td key={namn} className="px-3 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1">
                                <input type="number" min={0} step="0.01" value={varde(namn)} disabled={sparar}
                                  aria-label={`${namn} för ${k.namn || k.ghl_opportunity_id}`}
                                  onChange={(e) => setFinansUtkast({ ...finansUtkast, [falt(namn)]: e.target.value })}
                                  className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                                {andrad(namn) && (
                                  <button
                                    onClick={() => skicka("PATCH", { typ: "finans", opportunity_id: k.ghl_opportunity_id, [namn]: Number(varde(namn)) })}
                                    disabled={sparar}
                                    className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">Spara</button>
                                )}
                              </span>
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{kvar > 0 ? kr(kvar) : ""}</td>
                          <td className="px-3 py-2.5">
                            <input type="date" value={f.forvantat_betaldatum || ""} disabled={sparar}
                              aria-label={`Förväntat betaldatum för ${k.namn || k.ghl_opportunity_id}`}
                              onChange={(e) => skicka("PATCH", { typ: "finans", opportunity_id: k.ghl_opportunity_id, forvantat_betaldatum: e.target.value })}
                              className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <input type="date" value={f.forfallodatum || ""} disabled={sparar}
                                aria-label={`Faktura förfallodatum för ${k.namn || k.ghl_opportunity_id}`}
                                onChange={(e) => skicka("PATCH", { typ: "finans", opportunity_id: k.ghl_opportunity_id, forfallodatum: e.target.value })}
                                className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                              {forfallen && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  Passerad
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-5 py-2.5">
                            {lank && (
                              <a href={lank} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800">
                                Öppna <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── KONTAKT-1: tystnadslistan, direkt under Displayteknik-tabellen ── */}
          <div id="kontakt" className="scroll-mt-6 space-y-4">
            {kontakt && (
              <Tystnadslistan data={kontakt} laddar={laddarKontakt} onUppdatera={() => hamtaKontakt(true)} onFel={setFel} />
            )}
          </div>

          {/* ── Likviditet ───────────────────────────────────────────────── */}
          <div id="likviditet" className="scroll-mt-6">
            <LikviditetsVy likviditet={data.likviditet} cash={data.cash} sparar={sparar} skicka={skicka} taBort={taBort} />
          </div>

          {/* ── Kostnader ────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-gray-900">Fasta kostnader</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.kostnadPerBolag.map((b) => (
                <div key={b.bolag} className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <Server className="h-4 w-4 text-gray-400" /> {BOLAGSNAMN[b.bolag]}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {b.perValuta.length === 0 && <span className="text-sm text-gray-500">Inga kostnader inlagda.</span>}
                    {b.perValuta.map((v) => (
                      <span key={v.valuta} className="font-display text-2xl font-bold tabular-nums text-gray-900">
                        {belopp(v.summa, v.valuta)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Per månad. Valutorna räknas inte om till varandra.</p>
                  {b.saknarBelopp > 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      {b.saknarBelopp} {b.saknarBelopp === 1 ? "post saknar" : "poster saknar"} belopp, summan är för låg tills du fyllt i dem.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <h3 className="border-b border-gray-100 px-5 py-3.5 font-display text-lg font-semibold text-gray-900">Vad som betalas varje månad</h3>
              <ul className="divide-y divide-gray-50">
                {data.fasta.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{BOLAGSNAMN[f.bolag]}</span>
                    <span className="font-medium text-gray-900">{f.tjanst}</span>
                    {f.notering && <span className="text-xs text-gray-500">{f.notering}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      <input type="number" min={0} step="0.01"
                        value={fastUtkast[f.id] ?? String(f.belopp_per_man)}
                        onChange={(e) => setFastUtkast({ ...fastUtkast, [f.id]: e.target.value })}
                        className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right tabular-nums" />
                      <select value={f.valuta} disabled={sparar}
                        onChange={(e) => skicka("PATCH", { typ: "fast", id: f.id, valuta: e.target.value })}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                        <option value="SEK">SEK</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                      {(fastUtkast[f.id] ?? String(f.belopp_per_man)) !== String(f.belopp_per_man) && (
                        <button onClick={() => skicka("PATCH", { typ: "fast", id: f.id, belopp_per_man: Number(fastUtkast[f.id]) })}
                          disabled={sparar} className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50">Spara</button>
                      )}
                      {raderar === f.id ? (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <button onClick={() => taBort("fast", f.id)} disabled={sparar}
                            className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50">Ja, ta bort</button>
                          <button onClick={() => setRaderar(null)} className="text-gray-500 underline">Avbryt</button>
                        </span>
                      ) : (
                        <button onClick={() => setRaderar(f.id)} aria-label={`Ta bort ${f.tjanst}`}
                          className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </span>
                  </li>
                ))}
                <li className="flex flex-wrap items-center gap-2 bg-gray-50 px-5 py-3">
                  <input value={nyFast.tjanst} onChange={(e) => setNyFast({ ...nyFast, tjanst: e.target.value })}
                    placeholder="Ny tjänst" className="min-w-44 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
                  <select value={nyFast.bolag} onChange={(e) => setNyFast({ ...nyFast, bolag: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                    <option value="grip">GripCoaching</option>
                    <option value="dt">Displayteknik</option>
                  </select>
                  <input type="number" min={0} step="0.01" value={nyFast.belopp_per_man}
                    onChange={(e) => setNyFast({ ...nyFast, belopp_per_man: e.target.value })}
                    placeholder="per månad" className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums" />
                  <select value={nyFast.valuta} onChange={(e) => setNyFast({ ...nyFast, valuta: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                    <option value="SEK">SEK</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <input value={nyFast.notering} onChange={(e) => setNyFast({ ...nyFast, notering: e.target.value })}
                    placeholder="Notering" className="w-40 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                  <button
                    onClick={async () => { await skicka("POST", { typ: "fast", ...nyFast }); setNyFast({ tjanst: "", bolag: "grip", belopp_per_man: "", valuta: "SEK", notering: "" }); }}
                    disabled={sparar || !nyFast.tjanst.trim() || nyFast.belopp_per_man === ""}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
                    Lägg till
                  </button>
                </li>
              </ul>
            </div>

            {/* Kopplingen till kostnadsmodulen: bara kunder vars namn matchar en klient
                i plattformen. Ingen match betyder inget påstående, inte noll kronor. */}
            {data.aiPerKund.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-gray-900">
                    <Coins className="h-5 w-5 text-gray-400" /> Intäkt mot AI-kostnad
                  </h3>
                  <span className="text-sm text-gray-500">Denna månad, för de kunder vars namn matchar en klient i plattformen.</span>
                </div>
                <ul className="divide-y divide-gray-50">
                  {data.aiPerKund.map((r) => (
                    <li key={r.kund} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <span className="font-medium text-gray-900">{r.kund}</span>
                      <span className="ml-auto tabular-nums text-emerald-700">{kr(r.intakt)} in</span>
                      <span className="w-32 text-right tabular-nums text-gray-600">{kr(r.aiKostnad)} i AI</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <p className="pb-2 text-center text-xs text-gray-400">
            Letar du efter länklistan med appar och genvägar? Den ligger på{" "}
            <a href="/dashboard/genvagar" className="font-medium text-gray-500 underline">Genvägar och appar</a>.
          </p>
        </>
      )}
    </div>
  );
}
