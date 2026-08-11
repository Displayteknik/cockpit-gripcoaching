"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Save, Trash2, Plus, Pencil, Search, X, ArrowRight, Check,
  AlertTriangle, Mail, CalendarDays, Wallet, Info,
} from "lucide-react";
import {
  laggTill, rullaFram, nastaBetalningKlartext, dagarTill, medMoms, langtDatum,
  INTERVALL_TEXT, type Intervall, type Betalsatt, type AvtalStatus,
} from "@/lib/billing/datum";

// BETAL-1 — fliken Kundaffärer. Byggd för INMATNING, inte bara för visning.
//
// Håkan ska kunna sitta ner en gång och föra in alla kunder han har. Därför:
//   · filtret "Saknar affär" så han ser exakt vad som är kvar
//   · "Spara och nästa kund" så han slipper stänga och öppna för varje rad
//   · nästa betalning räknas fram MEDAN han skriver, med samma funktioner som servern
//   · inga native-dropdowns i de fält han rör oftast
//
// Sparknappen skickar bara det som faktiskt fyllts i. Ett tomt fält betyder "vet inte än",
// aldrig "nollställ".

// ── Typer ───────────────────────────────────────────────────────────────────

export interface Avtal {
  client_id: string; klient: string; slug: string; primary_color: string;
  plan_id: string | null; plan_label: string | null;
  belopp_sek: number; belopp_inkl_moms: number;
  intervall: string; intervall_text: string;
  betalsatt: string; betalsatt_text: string; kalla: string;
  startdatum: string | null; nasta_betalning: string | null; nasta_betalning_text: string;
  dagar_kvar: number | null; bindningstid_slut: string | null;
  status: string; betalstatus: string;
  faktura_epost: string | null; kontaktperson: string | null; anteckning: string | null;
  manadsvarde: number; har_stripe_kund: boolean; stripe_status: string | null;
  tokens: { anvant: number; tak: number } | null;
}

export interface Plan {
  id: string; label: string; beskrivning: string | null; typ: string;
  belopp_sek: number; intervall: string; credits: number | null;
  stripe_price_id: string | null; active: boolean;
}

const nf = new Intl.NumberFormat("sv-SE");
const kr = (n: number) => `${nf.format(Math.round(n))} kr`;
const kortDatum = (s: string | null) =>
  s ? new Date(`${s}T00:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

const BETALSTATUS_TEXT: Record<string, string> = {
  aktiv: "Betalar", forsenad: "Försenad", paminnelser: "Påmind", sparrad: "Pausad",
};
const BETALSTATUS_STIL: Record<string, string> = {
  aktiv: "bg-emerald-50 text-emerald-700",
  forsenad: "bg-amber-50 text-amber-700",
  paminnelser: "bg-orange-50 text-orange-700",
  sparrad: "bg-red-50 text-red-700",
};

const harAffar = (a: Avtal) => a.belopp_sek > 0 || !!a.nasta_betalning || !!a.plan_id;

type Filter = "alla" | "saknar" | "utan_mejl" | "problem";

// ── Listan ──────────────────────────────────────────────────────────────────

export default function Kundaffarer({
  avtal, planer, momssats, skicka,
}: {
  avtal: Avtal[];
  planer: Plan[];
  momssats: number;
  skicka: (b: Record<string, unknown>) => Promise<{ ok: boolean }>;
}) {
  const [sok, setSok] = useState("");
  const [filter, setFilter] = useState<Filter>("alla");
  const [oppen, setOppen] = useState<string | null>(null);

  const klara = avtal.filter(harAffar).length;
  const utanMejl = avtal.filter((a) => harAffar(a) && !a.faktura_epost).length;
  const problem = avtal.filter((a) => a.betalstatus !== "aktiv").length;

  const synliga = useMemo(() => {
    const s = sok.trim().toLowerCase();
    return avtal.filter((a) => {
      if (s && !a.klient.toLowerCase().includes(s)) return false;
      if (filter === "saknar") return !harAffar(a);
      if (filter === "utan_mejl") return harAffar(a) && !a.faktura_epost;
      if (filter === "problem") return a.betalstatus !== "aktiv";
      return true;
    });
  }, [avtal, sok, filter]);

  // "Spara och nästa" hoppar till nästa kund som fortfarande saknar affär.
  function nastaUtanAffar(efter: string): string | null {
    const i = avtal.findIndex((a) => a.client_id === efter);
    for (let n = i + 1; n < avtal.length; n++) if (!harAffar(avtal[n])) return avtal[n].client_id;
    for (let n = 0; n < i; n++) if (!harAffar(avtal[n])) return avtal[n].client_id;
    return null;
  }

  const aktiv = oppen ? avtal.find((a) => a.client_id === oppen) || null : null;

  return (
    <div className="space-y-4">
      {/* Framsteg + snabbstart. Ska svara pa "hur langt har jag kommit". */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-[18px] h-[18px] text-emerald-600" />
          </span>
          <div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">
              {klara} av {avtal.length} kunder har en affär inlagd
            </div>
            <div className="text-xs text-gray-500">
              {klara === avtal.length
                ? "Alla är inlagda."
                : "Fyll i resten så visar listan när varje betalning kommer."}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={sok}
              onChange={(e) => setSok(e.target.value)}
              placeholder="Sök kund"
              className="w-44 rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
          </div>
          {klara < avtal.length && (
            <button
              onClick={() => setOppen(avtal.find((a) => !harAffar(a))!.client_id)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Fyll i nästa
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip aktiv={filter === "alla"} onClick={() => setFilter("alla")}>Alla {avtal.length}</Chip>
        <Chip aktiv={filter === "saknar"} onClick={() => setFilter("saknar")} ton={avtal.length - klara ? "amber" : undefined}>
          Saknar affär {avtal.length - klara}
        </Chip>
        <Chip aktiv={filter === "utan_mejl"} onClick={() => setFilter("utan_mejl")} ton={utanMejl ? "amber" : undefined}>
          Saknar fakturamejl {utanMejl}
        </Chip>
        <Chip aktiv={filter === "problem"} onClick={() => setFilter("problem")} ton={problem ? "red" : undefined}>
          Betalproblem {problem}
        </Chip>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {synliga.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            Ingen kund matchar. Rensa sökningen eller välj Alla.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Kund</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium text-right">Belopp</th>
                  <th className="px-4 py-3 font-medium">Nästa betalning</th>
                  <th className="px-4 py-3 font-medium">Betalsätt</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Tokens</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {synliga.map((a) => {
                  const registrerad = harAffar(a);
                  return (
                    <tr
                      key={a.client_id}
                      onClick={() => setOppen(a.client_id)}
                      className={`cursor-pointer hover:bg-gray-50/70 ${registrerad ? "" : "bg-amber-50/30"}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: a.primary_color }}
                          >
                            {a.klient.charAt(0).toUpperCase()}
                          </span>
                          <span className="font-medium text-gray-900">{a.klient}</span>
                          {registrerad && !a.faktura_epost && (
                            <span title="Saknar fakturamejl, kan inte påminnas">
                              <Mail className="w-3.5 h-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{a.plan_label || <span className="text-gray-300">Ingen</span>}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {a.belopp_sek > 0 ? (
                          <>
                            <div className="font-semibold text-gray-900">{kr(a.belopp_sek)}</div>
                            <div className="text-xs text-gray-500">{kr(a.belopp_inkl_moms)} med moms</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {a.nasta_betalning ? (
                          <>
                            <div className="font-medium text-gray-900">{kortDatum(a.nasta_betalning)}</div>
                            <div className={`text-xs ${(a.dagar_kvar ?? 0) < 0 ? "font-medium text-red-600" : "text-gray-500"}`}>
                              {a.nasta_betalning_text}
                            </div>
                          </>
                        ) : (
                          <span className="text-amber-700">Inte inlagd än</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {registrerad ? a.betalsatt_text : <span className="text-gray-300">—</span>}
                        {a.kalla === "stripe" && <span className="ml-1.5 text-xs text-gray-400">(Stripe styr)</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {registrerad ? (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BETALSTATUS_STIL[a.betalstatus] || "bg-gray-100 text-gray-600"}`}>
                            {BETALSTATUS_TEXT[a.betalstatus] || a.betalstatus}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                        {registrerad && a.status !== "aktiv" && (
                          <div className="mt-1 text-xs text-gray-400">Avtal: {a.status}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">
                        {a.tokens ? `${nf.format(a.tokens.anvant)} / ${nf.format(a.tokens.tak)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                          {registrerad ? <><Pencil className="w-3.5 h-3.5" /> Ändra</> : <><Plus className="w-3.5 h-3.5" /> Fyll i</>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {aktiv && (
        <Redigerare
          key={aktiv.client_id}
          avtal={aktiv}
          planer={planer}
          momssats={momssats}
          harNasta={!!nastaUtanAffar(aktiv.client_id)}
          onStang={() => setOppen(null)}
          onSpara={async (input, gaVidare) => {
            await skicka({ avtal: input });
            setOppen(gaVidare ? nastaUtanAffar(aktiv.client_id) : null);
          }}
          onRadera={async () => { await skicka({ radera_avtal: aktiv.client_id }); setOppen(null); }}
        />
      )}
    </div>
  );
}

function Chip({
  children, aktiv, onClick, ton,
}: { children: React.ReactNode; aktiv: boolean; onClick: () => void; ton?: "amber" | "red" }) {
  const bas = "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border";
  if (aktiv) return <button onClick={onClick} className={`${bas} border-gray-900 bg-gray-900 text-white`}>{children}</button>;
  const fargad = ton === "red" ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
    : ton === "amber" ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50";
  return <button onClick={onClick} className={`${bas} ${fargad}`}>{children}</button>;
}

// ── Redigeraren ─────────────────────────────────────────────────────────────

function Redigerare({
  avtal, planer, momssats, harNasta, onStang, onSpara, onRadera,
}: {
  avtal: Avtal;
  planer: Plan[];
  momssats: number;
  harNasta: boolean;
  onStang: () => void;
  onSpara: (i: Record<string, unknown>, gaVidare: boolean) => Promise<void>;
  onRadera: () => Promise<void>;
}) {
  const abonnemang = planer.filter((p) => p.typ === "abonnemang" && p.active);
  const [form, setForm] = useState({
    plan_id: avtal.plan_id || "",
    belopp_sek: avtal.belopp_sek ? String(avtal.belopp_sek) : "",
    intervall: (avtal.intervall || "manad") as Intervall,
    betalsatt: (avtal.betalsatt || "faktura") as Betalsatt,
    startdatum: avtal.startdatum || "",
    nasta_betalning: avtal.nasta_betalning || "",
    bindningstid_slut: avtal.bindningstid_slut || "",
    status: (avtal.status || "aktiv") as AvtalStatus,
    faktura_epost: avtal.faktura_epost || "",
    kontaktperson: avtal.kontaktperson || "",
    anteckning: avtal.anteckning || "",
  });
  const [sparar, setSparar] = useState<"" | "spara" | "nasta">("");
  const forstaFalt = useRef<HTMLInputElement>(null);
  // "Eget upplägg" ska inte se förvalt ut bara för att plan_id är tomt. En grön ram
  // signalerar ett val, och för en kund utan affär är inget val gjort än.
  const [egetValt, setEgetValt] = useState(harAffar(avtal) && !avtal.plan_id);

  const satt = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const stripestyrt = avtal.kalla === "stripe";
  const registrerad = harAffar(avtal);

  // Escape stänger. En modal utan escape är en modal man känner sig fast i.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onStang(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onStang]);

  // ★ Samma räkning som servern gör vid sparning, körd här och nu. Håkan ska se datumet
  // innan han sparar, inte efteråt.
  const vald = abonnemang.find((p) => p.id === form.plan_id) || null;
  const belopp = Number(form.belopp_sek) > 0 ? Number(form.belopp_sek) : Number(vald?.belopp_sek) || 0;
  const forhandsDatum = useMemo(() => {
    if (form.nasta_betalning) return form.nasta_betalning;
    if (form.startdatum) return rullaFram(form.startdatum, form.intervall);
    return null;
  }, [form.nasta_betalning, form.startdatum, form.intervall]);
  const dagar = dagarTill(forhandsDatum);

  async function spara(gaVidare: boolean) {
    setSparar(gaVidare ? "nasta" : "spara");
    await onSpara(
      {
        client_id: avtal.client_id,
        plan_id: form.plan_id || null,
        belopp_sek: form.belopp_sek ? Number(form.belopp_sek) : null,
        intervall: form.intervall,
        betalsatt: form.betalsatt,
        startdatum: form.startdatum || null,
        nasta_betalning: form.nasta_betalning || null,
        bindningstid_slut: form.bindningstid_slut || null,
        status: form.status,
        faktura_epost: form.faktura_epost,
        kontaktperson: form.kontaktperson,
        anteckning: form.anteckning,
      },
      gaVidare,
    );
    setSparar("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8" onClick={onStang}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Rubrik */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold flex-shrink-0"
            style={{ background: avtal.primary_color }}
          >
            {avtal.klient.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-gray-900 truncate">{avtal.klient}</h3>
            <p className="text-sm text-gray-500">{registrerad ? "Ändra affären" : "Lägg in affären"}</p>
          </div>
          <button onClick={onStang} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Stäng">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Förhandsvisning — svarar direkt pa "nar kommer pengarna". */}
        <div className={`px-6 py-4 ${forhandsDatum ? "bg-emerald-50/60" : "bg-gray-50"}`}>
          {forhandsDatum ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CalendarDays className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span className="text-sm text-gray-700">Nästa betalning</span>
              <span className="font-display text-lg font-bold text-gray-900">{langtDatum(forhandsDatum)}</span>
              <span className={`text-sm ${(dagar ?? 0) < 0 ? "font-medium text-red-600" : "text-gray-500"}`}>
                {nastaBetalningKlartext(forhandsDatum).toLowerCase()}
              </span>
              {belopp > 0 && (
                <span className="ml-auto text-sm tabular-nums text-gray-700">
                  <strong>{kr(medMoms(belopp, momssats))}</strong> med moms
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="h-4 w-4 flex-shrink-0" />
              Välj plan och fyll i när affären startade, så räknas nästa betalning fram här.
            </div>
          )}
        </div>

        <div className="space-y-6 px-6 py-5">
          {stripestyrt && (
            <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              Den här kunden betalar via Stripe. Datum och belopp styrs därifrån, så ändringar
              här påverkar inte vad kunden faktiskt debiteras.
            </div>
          )}

          {/* Plan som kort, inte som dropdown. */}
          <div>
            <Etikett>Vilken plan</Etikett>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {abonnemang.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { satt("plan_id", p.id); setEgetValt(false); }}
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    form.plan_id === p.id
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{p.label}</span>
                    {form.plan_id === p.id && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  <div className="mt-0.5 text-sm tabular-nums text-gray-600">{kr(p.belopp_sek)} ex moms</div>
                </button>
              ))}
              <button
                onClick={() => { satt("plan_id", ""); setEgetValt(true); }}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  egetValt
                    ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">Eget upplägg</div>
                <div className="mt-0.5 text-sm text-gray-600">Skriv beloppet själv</div>
              </button>
            </div>
          </div>

          {/* Belopp med snabbval. */}
          <div>
            <Etikett hjalp={vald ? `Lämna tomt så gäller planens ${kr(vald.belopp_sek)}.` : "Ange vad kunden betalar per period, exklusive moms."}>
              Belopp per period
            </Etikett>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  ref={forstaFalt}
                  type="number"
                  value={form.belopp_sek}
                  onChange={(e) => satt("belopp_sek", e.target.value)}
                  placeholder={vald ? String(vald.belopp_sek) : "0"}
                  className="w-36 rounded-lg border border-gray-200 py-2.5 pl-4 pr-10 text-right text-sm tabular-nums focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">kr</span>
              </div>
              {abonnemang.map((p) => (
                <button
                  key={p.id}
                  onClick={() => satt("belopp_sek", String(p.belopp_sek))}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 tabular-nums"
                >
                  {nf.format(p.belopp_sek)}
                </button>
              ))}
              {form.belopp_sek && (
                <button onClick={() => satt("belopp_sek", "")} className="text-xs text-gray-500 hover:text-gray-900">
                  Rensa
                </button>
              )}
              {belopp > 0 && (
                <span className="ml-auto text-sm tabular-nums text-gray-500">
                  {kr(medMoms(belopp, momssats))} med moms
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Etikett>Hur ofta</Etikett>
              <Segment
                value={form.intervall}
                onChange={(v) => satt("intervall", v as Intervall)}
                val={[
                  { v: "manad", t: "Månad" },
                  { v: "kvartal", t: "Kvartal" },
                  { v: "ar", t: "År" },
                  { v: "engang", t: "Engång" },
                ]}
              />
              <p className="mt-1.5 text-xs text-gray-500">{INTERVALL_TEXT[form.intervall]}</p>
            </div>

            <div>
              <Etikett>Hur betalar kunden</Etikett>
              <Segment
                value={form.betalsatt}
                onChange={(v) => satt("betalsatt", v as Betalsatt)}
                val={[
                  { v: "faktura", t: "Faktura" },
                  { v: "stripe", t: "Kort" },
                  { v: "swish", t: "Swish" },
                  { v: "annat", t: "Annat" },
                ]}
              />
            </div>

            <div>
              <Etikett hjalp="Första betalningsdagen. Resten räknas fram.">Affären startade</Etikett>
              <Datum value={form.startdatum} onChange={(v) => satt("startdatum", v)} />
            </div>

            <div>
              <Etikett hjalp="Lämna tomt så används datumet ovan.">Nästa betalning</Etikett>
              <div className="flex items-center gap-2">
                <Datum value={form.nasta_betalning} onChange={(v) => satt("nasta_betalning", v)} />
                {form.startdatum && !form.nasta_betalning && (
                  <button
                    onClick={() => satt("nasta_betalning", rullaFram(form.startdatum, form.intervall))}
                    className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    title="Skriv in det framräknade datumet så du kan justera det"
                  >
                    Fyll i
                  </button>
                )}
                {form.nasta_betalning && (
                  <button
                    onClick={() => satt("nasta_betalning", laggTill(form.nasta_betalning, form.intervall))}
                    className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    title="Flytta fram en period"
                  >
                    +1
                  </button>
                )}
              </div>
            </div>

            <div>
              <Etikett hjalp="Hit går fakturor och påminnelser.">E-post för faktura</Etikett>
              <Text
                type="email"
                value={form.faktura_epost}
                onChange={(v) => satt("faktura_epost", v)}
                placeholder="ekonomi@kunden.se"
              />
              {registrerad && !form.faktura_epost && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Utan adress kan kunden aldrig påminnas, och pausas därför aldrig heller.
                </p>
              )}
            </div>

            <div>
              <Etikett>Kontaktperson</Etikett>
              <Text value={form.kontaktperson} onChange={(v) => satt("kontaktperson", v)} placeholder="Anna Andersson" />
            </div>

            <div>
              <Etikett>Bindningstid slutar</Etikett>
              <Datum value={form.bindningstid_slut} onChange={(v) => satt("bindningstid_slut", v)} />
            </div>

            <div>
              <Etikett>Avtalets status</Etikett>
              <Segment
                value={form.status}
                onChange={(v) => satt("status", v as AvtalStatus)}
                val={[
                  { v: "aktiv", t: "Aktiv" },
                  { v: "pausad", t: "Pausad" },
                  { v: "avslutad", t: "Avslutad" },
                ]}
              />
            </div>
          </div>

          <div>
            <Etikett>Anteckning</Etikett>
            <textarea
              value={form.anteckning}
              onChange={(e) => satt("anteckning", e.target.value)}
              rows={2}
              placeholder="Rabatt första halvåret, uppsagd till årsskiftet, och så vidare."
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
          </div>
        </div>

        {/* Knappar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-6 py-4">
          {registrerad && (
            <button onClick={onRadera} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
              <Trash2 className="w-4 h-4" /> Ta bort
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={onStang} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Avbryt
            </button>
            <button
              onClick={() => spara(false)}
              disabled={!!sparar}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
            >
              {sparar === "spara" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara
            </button>
            {harNasta && (
              <button
                onClick={() => spara(true)}
                disabled={!!sparar}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              >
                {sparar === "nasta" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Spara och nästa kund
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Byggstenar ──────────────────────────────────────────────────────────────

function Etikett({ children, hjalp }: { children: React.ReactNode; hjalp?: string }) {
  return (
    <div className="mb-2">
      <span className="block text-sm font-medium text-gray-700">{children}</span>
      {hjalp && <span className="mt-0.5 block text-xs text-gray-500">{hjalp}</span>}
    </div>
  );
}

/** Segmenterad knapprad i stället för native dropdown. Alla val syns utan att klicka. */
function Segment({
  value, onChange, val,
}: { value: string; onChange: (v: string) => void; val: Array<{ v: string; t: string }> }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
      {val.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Text({
  value, onChange, placeholder, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
    />
  );
}

/**
 * Datumfält med svensk kvittens under.
 *
 * ⚠ Webbläsaren bestämmer själv formatet i ett date-fält, och står den på engelska visas
 * mm/dd/yyyy. Då är 03/04 antingen 3 april eller 4 mars, och den som fyller i tretton
 * kunder hinner gissa fel. Formatet går inte att tvinga bort, men datumet kan skrivas ut
 * i klartext bredvid — då syns misstaget direkt i stället för tre veckor senare.
 */
function Datum({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const klartext = langtDatum(value);
  return (
    <div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
      />
      {klartext && <p className="mt-1 text-xs font-medium text-gray-600">{klartext}</p>}
    </div>
  );
}
