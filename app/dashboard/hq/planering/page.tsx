"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ExternalLink,
  Info, LayoutGrid, RefreshCw, Sunrise, Target, Trash2, X,
} from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";
import Veckovy, { klocka, ramp, type VyHandelse } from "./Veckovy";

// PLAN-1 — planeringsmodulen. En skärm som visar hur veckan är disponerad över
// tidstyperna, och där planen ändras med ett drag i stället för ett besök i Google.
// Modellen: tisdag och torsdag är arbetsdagar, resten white space.
// Inga AI-anrop. Skrivningar mot Google sker bara på ett klick.

interface Tidstyp { id: string; namn: string; farg_ramp: string; sortering: number }
interface FordelningsRad { id: string; namn: string; farg: string; timmar: number; procent: number }
interface Nyckeltal { bokadeTimmar: number; timmarWhiteSpace: number; antalMoten: number; lifestyle: number | null; arbetstimmar: number }
interface Flagga { id: string; text: string }
interface MallForslag { mallId: string; titel: string; datum: string; start: string; slut: string; finnsRedan: boolean; krockar: string[] }
interface Uppgift { id: string; titel: string; bolag: string; datum: string | null }

interface Data {
  kopplad: boolean;
  authUrl?: string;
  epost?: string | null;
  idag: string;
  vecka: { start: string; slut: string; dagar: string[] };
  handelser: VyHandelse[];
  fordelning: FordelningsRad[];
  nyckeltal: Nyckeltal;
  flaggor: Flagga[];
  nastaVecka?: { vecka: { start: string; slut: string }; fordelning: FordelningsRad[]; nyckeltal: Nyckeltal; flaggor: Flagga[] };
  tidstyper: Tidstyp[];
  mallForslag: MallForslag[];
  uppgifter: Uppgift[];
  synk: { senastSynkad: string | null; ok: boolean; fel: string | null; lank?: string | null; lankText?: string | null };
}

const tim = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} h`;
const tid = (s: string | null) => (s ? new Date(s).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "aldrig");
const dagStr = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });

function flyttaVecka(datum: string, veckor: number): string {
  return new Date(new Date(`${datum}T12:00:00Z`).getTime() + veckor * 7 * 864e5).toISOString().slice(0, 10);
}

export default function PlaneringPage() {
  const [data, setData] = useState<Data | null>(null);
  const [vald, setVald] = useState<string>("");
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [sparar, setSparar] = useState(false);
  const [oppen, setOppen] = useState<VyHandelse | null>(null);
  const [raderar, setRaderar] = useState(false);
  const [nyRuta, setNyRuta] = useState<{ datum: string; start: string; slut: string; titel: string; tidstypId: string } | null>(null);
  const [mallRuta, setMallRuta] = useState<MallForslag[] | null>(null);
  const [mallSvar, setMallSvar] = useState<string>("");
  const [mobil, setMobil] = useState(false);
  const [mobilDagIdx, setMobilDagIdx] = useState(0);

  // Dagvy under 700 px. Ett veckorutnät med fem kolumner går inte att träffa med tummen.
  useEffect(() => {
    const kolla = () => setMobil(window.innerWidth < 700);
    kolla();
    window.addEventListener("resize", kolla);
    return () => window.removeEventListener("resize", kolla);
  }, []);

  const hamta = useCallback(async (datum?: string, tvinga = false) => {
    setLaddar(true);
    try {
      const p = new URLSearchParams();
      if (datum) p.set("vecka", datum);
      if (tvinga) p.set("uppdatera", "1");
      const r = await fetch(`/api/hq/planering${p.toString() ? `?${p}` : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta planeringen");
      setData(j);
      setVald(j.vecka.dagar[0]);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  // Kvittot från Google-kopplingen ligger i adressen efter återkomsten.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("kalender_fel")) setFel(`Kopplingen gick inte igenom: ${p.get("kalender_fel")}`);
    if (p.get("kalender_ok") || p.get("kalender_fel")) {
      window.history.replaceState({}, "", "/dashboard/hq/planering");
    }
  }, []);

  async function skicka(metod: "POST" | "PATCH" | "DELETE", kropp?: Record<string, unknown>, fraga?: string): Promise<boolean> {
    setSparar(true);
    try {
      const r = await fetch(`/api/hq/planering${fraga || ""}`, {
        method: metod,
        ...(kropp ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(kropp) } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte spara");
      setFel("");
      return true;
    } catch (e) {
      setFel((e as Error).message);
      return false;
    } finally {
      setSparar(false);
    }
  }

  /**
   * Optimistisk flytt: blocket ligger på sin nya plats direkt, och rullas tillbaka om
   * Google säger nej. Utan återrullningen skulle vyn påstå att flytten gick igenom.
   */
  const flytta = useCallback(async (id: string, datum: string, start: string, slut: string): Promise<boolean> => {
    const fore = data;
    if (!fore) return false;
    const minut = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    setData({
      ...fore,
      handelser: fore.handelser.map((h) =>
        h.google_event_id === id ? { ...h, datum, startMinut: minut(start), slutMinut: minut(slut) } : h),
    });
    const ok = await skicka("PATCH", { id, datum, start, slut });
    if (!ok) { setData(fore); return false; }
    await hamta(vald);
    return true;
  }, [data, hamta, vald]);

  // ⚠ Andra försvarslinjen mot samma krasch: även om ett svar någon gång skulle sakna
  // ett fält får sidan aldrig dö på det. En vy som inte går att öppna är värre än en
  // vy som visar noll.
  const kt = data?.nyckeltal;
  const handelser = data?.handelser ?? [];

  const mobilDag = useMemo(
    () => (mobil && data ? data.vecka.dagar[Math.max(0, Math.min(6, mobilDagIdx))] : undefined),
    [mobil, data, mobilDagIdx],
  );

  return (
    <div className="space-y-6">
      <DashHero
        title="Planering"
        subtitle="Din egen kalender, inte kundens — sidan visar samma vecka vilken kund du än har vald. Tisdag och torsdag är arbetsdagar, måndag, onsdag och fredag är white space. Dra ett block för att flytta det, ändringen går direkt till din kalender."
        icon={CalendarRange}
        eyebrow={<LivePill label="veckan" />}
        chips={
          data?.kopplad && kt ? (
            <>
              <HeroChip icon={CalendarDays} label={`${tim(kt.bokadeTimmar)} bokat`} />
              <HeroChip icon={Target} label={kt.lifestyle === null ? "ingen arbetstid inlagd" : `${Math.round(kt.lifestyle)} procent på tis och tors`} />
              <HeroChip icon={Sunrise} label={`${tim(kt.timmarWhiteSpace)} på white space`} />
            </>
          ) : undefined
        }
        right={
          data?.kopplad ? (
            <button onClick={() => hamta(vald, true)} disabled={laddar}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${laddar ? "animate-spin" : ""}`} /> Uppdatera nu
            </button>
          ) : undefined
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {/* Inte kopplad än. Säg det rakt ut i stället för att visa en tom vecka. */}
      {data && !data.kopplad && (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-8 text-center">
          <CalendarRange className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-xl font-semibold text-gray-900">Koppla din kalender</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-600">
            Planeringen läser din egen Google Kalender och skriver bara tillbaka det du själv drar eller klickar på.
            Inga inbjudningar skickas, och ingen annan än du kommer åt den här sidan.
          </p>
          <a href={data.authUrl}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
            Koppla Google Kalender <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* PLAN-2 (Håkans fynd 10/8): han bytte klient och såg SAMMA ifyllda vecka i två konton,
          och läste det som att veckoplanen låg ifylld hos kunderna. Datat är rätt — hq-tabellerna
          och kalenderspegeln har ingen klientkolumn alls, och routen är grindad på huvudadmin
          (`getAdminScope() !== null` → 403). Det är alltså ägarens EGEN kalender, en enda
          uppsättning. Felet var att sidan inte sa det: den ligger under klientväljaren och
          läste därför som den valda kundens vecka. Beskedet stod bara i det OKOPPLADE läget,
          alltså exakt där det inte behövdes. */}
      {data?.kopplad && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <p>
            <span className="font-medium text-gray-900">Det här är din egen kalender.</span>{" "}
            Ingen kund ser den, och innehållet byter inte när du växlar kund i väljaren högst upp —
            veckan nedan är densamma oavsett vem som står där.
          </p>
        </div>
      )}

      {data?.kopplad && kt && (
        <>
          {!data.synk.ok && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">{data.synk.fel}</p>
                {data.synk.senastSynkad && (
                  <p className="mt-1">Veckan nedan kommer från senast sparade hämtning: {tid(data.synk.senastSynkad)}.</p>
                )}
                {data.synk.lank && (
                  <a href={data.synk.lank} target="_blank" rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
                    {data.synk.lankText || "Åtgärda hos Google"} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Flaggorna. Mjuka, konstaterande, aldrig blockerande. */}
          {data.flaggor.length > 0 && (
            <div className="flex flex-wrap items-start gap-x-6 gap-y-1.5 rounded-2xl border border-gray-100 bg-white px-5 py-3.5 text-sm text-gray-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              {data.flaggor.map((f) => <span key={f.id}>{f.text}</span>)}
            </div>
          )}

          {/* Fördelningen */}
          <section className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-gray-900">Så fördelas veckan</h2>
              <span className="text-sm text-gray-500">{tim(kt.bokadeTimmar)} bokat, {dagStr(data.vecka.start)} till {dagStr(data.vecka.slut)}</span>
            </div>
            {data.fordelning.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Inget tidsatt den här veckan än.</p>
            ) : (
              <>
                <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
                  {data.fordelning.map((r) => (
                    <div key={r.id} title={`${r.namn}: ${tim(r.timmar)}`} style={{ width: `${r.procent}%`, background: ramp(r.farg).prick }} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {data.fordelning.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1.5 text-gray-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ramp(r.farg).prick }} />
                      {r.namn}
                      <span className="tabular-nums text-gray-500">{tim(r.timmar)} ({Math.round(r.procent)} procent)</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Bokade timmar" value={Math.round(kt.bokadeTimmar)} sub={tim(kt.bokadeTimmar)} icon={CalendarDays} tone="blue" i={0} />
            <StatTile label="Timmar bokade på white space-dagar" value={Math.round(kt.timmarWhiteSpace)} sub={`${tim(kt.timmarWhiteSpace)} på måndag, onsdag och fredag`} icon={Sunrise} tone="amber" i={1} />
            <StatTile label="Antal möten" value={kt.antalMoten} sub="block i Coaching och kunder" icon={LayoutGrid} tone="violet" i={2} />
            <StatTile label="Andel arbetstid på tisdag och torsdag i procent" value={kt.lifestyle === null ? 0 : Math.round(kt.lifestyle)}
              sub={kt.lifestyle === null ? "ingen arbetstid inlagd" : `${tim(kt.arbetstimmar)} arbetstid totalt`} icon={Target} tone="emerald" i={3} />
          </div>

          {/* Nästa vecka: avvikelser ska synas innan de inträffar. */}
          {data.nastaVecka && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-gray-100 bg-white px-5 py-3 text-sm">
              <span className="font-medium text-gray-800">Nästa vecka</span>
              <span className="tabular-nums text-gray-600">{tim(data.nastaVecka.nyckeltal.bokadeTimmar)} bokat</span>
              <span className="tabular-nums text-gray-600">
                {data.nastaVecka.nyckeltal.lifestyle === null ? "ingen arbetstid inlagd" : `${Math.round(data.nastaVecka.nyckeltal.lifestyle)} procent på tis och tors`}
              </span>
              <div className="flex h-2.5 w-40 overflow-hidden rounded-full bg-gray-100">
                {data.nastaVecka.fordelning.map((r) => (
                  <div key={r.id} title={`${r.namn}: ${tim(r.timmar)}`} style={{ width: `${r.procent}%`, background: ramp(r.farg).prick }} />
                ))}
              </div>
              {data.nastaVecka.flaggor.map((f) => <span key={f.id} className="text-gray-500">{f.text}</span>)}
              <button onClick={() => hamta(flyttaVecka(vald, 1))} className="ml-auto font-medium text-indigo-600 underline">Öppna nästa vecka</button>
            </div>
          )}

          {/* Navigering + mallveckan */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => hamta(flyttaVecka(vald, -1))} disabled={laddar}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" /> Föregående
            </button>
            <button onClick={() => hamta()} disabled={laddar}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Denna vecka
            </button>
            <button onClick={() => hamta(flyttaVecka(vald, 1))} disabled={laddar}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Nästa <ChevronRight className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-gray-500">{dagStr(data.vecka.start)} till {dagStr(data.vecka.slut)}</span>
            <button onClick={() => { setMallSvar(""); setMallRuta(data.mallForslag); }} disabled={sparar}
              className="ml-auto rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
              Lägg ut mallveckan
            </button>
          </div>

          {mobil && (
            <div className="flex flex-wrap items-center gap-1.5">
              {data.vecka.dagar.map((d, i) => (
                <button key={d} onClick={() => setMobilDagIdx(i)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                    i === mobilDagIdx ? "bg-indigo-600 text-white" : "border border-gray-200 bg-white text-gray-600"}`}>
                  {["mån", "tis", "ons", "tors", "fre", "lör", "sön"][i]} {d.slice(8)}
                </button>
              ))}
            </div>
          )}

          <Veckovy
            dagar={data.vecka.dagar}
            handelser={handelser}
            idag={data.idag}
            mobilDag={mobilDag}
            onFlytta={flytta}
            onOppna={setOppen}
            onSkapa={(datum, start, slut) => setNyRuta({ datum, start, slut, titel: "", tidstypId: "" })}
          />

          <p className="text-xs text-gray-400">
            Dra ett block för att flytta det, dra i nederkanten för att ändra längd, dubbelklicka på tom yta för att skapa nytt.
            Heldagar och händelser som Google skapat ur ett mejl är låsta och ändras i Google Kalender.
          </p>

          {/* Uppgifter som kan tidsättas. Punkt 7 i beställningen. */}
          {data.uppgifter.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
                <h2 className="font-display text-lg font-semibold text-gray-900">Uppgifter att tidsätta</h2>
                <span className="text-sm text-gray-500">Lägg en uppgift i kalendern så den får en plats i veckan.</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {data.uppgifter.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-gray-900">{u.titel}</span>
                    {u.datum && <span className="tabular-nums text-gray-500">{u.datum}</span>}
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <select defaultValue="" id={`dag-${u.id}`} className="rounded-lg border border-gray-200 px-2 py-1 text-sm">
                        <option value="">Välj dag</option>
                        {data.vecka.dagar.map((d, i) => (
                          <option key={d} value={d}>{["mån", "tis", "ons", "tors", "fre", "lör", "sön"][i]} {d.slice(8)}/{Number(d.slice(5, 7))}</option>
                        ))}
                      </select>
                      <input type="time" defaultValue="09:00" id={`tid-${u.id}`} step={900}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />
                      <button disabled={sparar}
                        onClick={async () => {
                          const d = (document.getElementById(`dag-${u.id}`) as HTMLSelectElement)?.value;
                          const t = (document.getElementById(`tid-${u.id}`) as HTMLInputElement)?.value || "09:00";
                          if (!d) { setFel("Välj vilken dag uppgiften ska ligga."); return; }
                          const slutMin = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + 60;
                          const ok = await skicka("POST", { typ: "uppgift", uppgiftId: u.id, datum: d, start: t, slut: klocka(slutMin) });
                          if (ok) await hamta(vald);
                        }}
                        className="rounded-lg bg-gray-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40">
                        Lägg i kalendern
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="pb-2 text-center text-xs text-gray-400">
            Kalendern läses från {data.epost || "ditt Google-konto"}. Hämtad {tid(data.synk.senastSynkad)}.{" "}
            <a href="/dashboard/hq" className="font-medium text-gray-500 underline">Tillbaka till Founder HQ</a>
          </p>
        </>
      )}

      {/* ── Panel för en händelse ─────────────────────────────────────────── */}
      {oppen && data && (
        <Ruta onStang={() => { setOppen(null); setRaderar(false); }}>
          <h3 className="font-display text-lg font-semibold text-gray-900">{oppen.titel || "Namnlös händelse"}</h3>
          <p className="mt-1 text-sm text-gray-600">
            {dagStr(oppen.datum)}{oppen.heldag ? ", hela dagen" : `, ${klocka(oppen.startMinut)} till ${klocka(oppen.slutMinut)}`}
          </p>
          {oppen.last && (
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {oppen.event_type === "FROM_GMAIL"
                ? "Den här skapades av Google ur ett mejl och kan bara ändras i Google Kalender."
                : "Heldagshändelser har ingen tid att flyttas på och ändras i Google Kalender."}
            </p>
          )}

          <label className="mt-4 block text-sm font-medium text-gray-700">Tidstyp</label>
          <select value={oppen.tidstyp?.id || ""} disabled={sparar}
            onChange={async (e) => {
              const ok = await skicka("PATCH", { id: oppen.google_event_id, tidstypId: e.target.value });
              if (ok) { setOppen(null); await hamta(vald); }
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {data.tidstyper.map((t) => <option key={t.id} value={t.id}>{t.namn}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-400">Valet sparas och gäller den här händelsen även nästa gång den hämtas.</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {oppen.html_lank && (
              <a href={oppen.html_lank} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Öppna i Google Kalender <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {raderar ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <button disabled={sparar}
                  onClick={async () => {
                    const ok = await skicka("DELETE", undefined, `?id=${encodeURIComponent(oppen.google_event_id)}`);
                    if (ok) { setOppen(null); setRaderar(false); await hamta(vald); }
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50">Ja, ta bort</button>
                <button onClick={() => setRaderar(false)} className="text-gray-500 underline">Avbryt</button>
              </span>
            ) : (
              <button onClick={() => setRaderar(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <Trash2 className="h-3.5 w-3.5" /> Ta bort
              </button>
            )}
          </div>
        </Ruta>
      )}

      {/* ── Ny händelse ───────────────────────────────────────────────────── */}
      {nyRuta && data && (
        <Ruta onStang={() => setNyRuta(null)}>
          <h3 className="font-display text-lg font-semibold text-gray-900">Ny händelse</h3>
          <p className="mt-1 text-sm text-gray-600">{dagStr(nyRuta.datum)}</p>
          <input autoFocus value={nyRuta.titel} onChange={(e) => setNyRuta({ ...nyRuta, titel: e.target.value })}
            placeholder="Vad gäller det?" className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="mt-3 flex items-center gap-2">
            <input type="time" step={900} value={nyRuta.start} onChange={(e) => setNyRuta({ ...nyRuta, start: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
            <span className="text-sm text-gray-500">till</span>
            <input type="time" step={900} value={nyRuta.slut} onChange={(e) => setNyRuta({ ...nyRuta, slut: e.target.value })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
          </div>
          <select value={nyRuta.tidstypId} onChange={(e) => setNyRuta({ ...nyRuta, tidstypId: e.target.value })}
            className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Tidstyp sätts av nyckelorden</option>
            {data.tidstyper.map((t) => <option key={t.id} value={t.id}>{t.namn}</option>)}
          </select>
          <div className="mt-5 flex items-center gap-2">
            <button disabled={sparar || !nyRuta.titel.trim()}
              onClick={async () => {
                const ok = await skicka("POST", { typ: "handelse", ...nyRuta });
                if (ok) { setNyRuta(null); await hamta(vald); }
              }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Skapa</button>
            <button onClick={() => setNyRuta(null)} className="text-sm text-gray-500 underline">Avbryt</button>
          </div>
        </Ruta>
      )}

      {/* ── Mallveckan: förhandsgranskning före allt annat ────────────────── */}
      {mallRuta && (
        <Ruta onStang={() => { setMallRuta(null); setMallSvar(""); }}>
          <h3 className="font-display text-lg font-semibold text-gray-900">Lägg ut mallveckan</h3>
          {mallSvar ? (
            <p className="mt-3 text-sm text-gray-700">{mallSvar}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-600">Det här skapas på veckan {dagStr(data!.vecka.start)} till {dagStr(data!.vecka.slut)}.</p>
              <ul className="mt-4 max-h-72 space-y-1.5 overflow-auto text-sm">
                {mallRuta.map((f) => (
                  <li key={f.mallId} className="flex flex-wrap items-baseline gap-x-2 border-b border-gray-50 pb-1.5 last:border-0">
                    <span className={`font-medium ${f.finnsRedan ? "text-gray-400 line-through" : "text-gray-900"}`}>{f.titel}</span>
                    <span className="tabular-nums text-gray-500">{dagStr(f.datum)} {f.start} till {f.slut}</span>
                    {f.finnsRedan && <span className="text-xs text-gray-400">ligger redan där, skapas inte igen</span>}
                    {!f.finnsRedan && f.krockar.length > 0 && (
                      <span className="text-xs text-amber-600">krockar med {f.krockar.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                {mallRuta.filter((f) => !f.finnsRedan).length} skapas, {mallRuta.filter((f) => f.finnsRedan).length} hoppas över.
              </p>
            </>
          )}
          <div className="mt-5 flex items-center gap-2">
            {!mallSvar && (
              <button disabled={sparar || mallRuta.every((f) => f.finnsRedan)}
                onClick={async () => {
                  setSparar(true);
                  try {
                    const r = await fetch("/api/hq/planering", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ typ: "mallvecka", vecka: vald, bekrafta: true }),
                    });
                    const j = await r.json();
                    if (!r.ok) throw new Error(j.error || "Kunde inte lägga ut mallveckan");
                    setMallSvar(
                      `${j.skapade.length} block skapades${j.hoppadeOver.length ? `, ${j.hoppadeOver.length} fanns redan` : ""}` +
                      (j.misslyckade?.length ? `. Följande gick inte igenom: ${j.misslyckade.map((m: { titel: string }) => m.titel).join(", ")}` : "."),
                    );
                    await hamta(vald);
                  } catch (e) {
                    setFel((e as Error).message);
                    setMallRuta(null);
                  } finally {
                    setSparar(false);
                  }
                }}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                Skapa dem
              </button>
            )}
            <button onClick={() => { setMallRuta(null); setMallSvar(""); }} className="text-sm text-gray-500 underline">
              {mallSvar ? "Stäng" : "Avbryt"}
            </button>
          </div>
        </Ruta>
      )}
    </div>
  );
}

function Ruta({ children, onStang }: { children: React.ReactNode; onStang: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onStang}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onStang} aria-label="Stäng" className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
