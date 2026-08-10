"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, Save, Plug, RefreshCw, Send, Lock, Unlock, Check,
  AlertTriangle, Copy, TrendingUp, Users, Clock, Ban, ExternalLink,
} from "lucide-react";
import Kundaffarer, { type Avtal, type Plan } from "./Kundaffarer";
import KopplaStripe from "./KopplaStripe";

// BETAL-1 — ownervyn. Fem flikar, en sanning.
//
// Hemligheterna kommer maskerade från servern och skickas bara tillbaka när Håkan
// faktiskt skrivit in en ny nyckel. Ett tomt fält betyder "rör inte", aldrig "radera".

// ── Typer ───────────────────────────────────────────────────────────────────

interface Installningar {
  stripe_lage: "test" | "live";
  stripe_secret_key_maskerad: string | null;
  stripe_webhook_secret_maskerad: string | null;
  stripe_publik_nyckel: string | null;
  stripe_kopplad: boolean;
  foretagsnamn: string | null; org_nr: string | null; moms_nr: string | null;
  momssats: number; faktura_avsandare: string | null;
  antal_paminnelser: number; paminnelse_dagar: number[]; gracedagar: number; dunning_aktiv: boolean;
}



interface Handelse {
  id: string; stripe_event_id: string | null; typ: string;
  sammanfattning: string | null; hanterad: boolean; fel: string | null; created_at: string;
}

interface Obetald {
  stripe_invoice_id: string; klient: string; nummer: string | null;
  belopp_sek: number; status: string; faktura_datum: string | null; hosted_invoice_url: string | null;
}

interface Data {
  installningar: Installningar;
  webhook_adress: string;
  avtal: Avtal[];
  sammanfattning: {
    mrr: number; arsvarde: number; antal_aktiva: number;
    antal_utan_affar: number; antal_forsenade: number; antal_sparrade: number; nasta_30_dagar: number;
  };
  planer: Plan[];
  handelser: Handelse[];
  obetalda: Obetald[];
}

// ── Hjälpare ────────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat("sv-SE");
const kr = (n: number) => `${nf.format(Math.round(n))} kr`;
const datum = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "";
const tidpunkt = (s: string) =>
  new Date(s).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const FLIKAR = [
  { id: "affarer", label: "Kundaffärer" },
  { id: "stripe", label: "Stripe" },
  { id: "koppla", label: "Koppla ihop" },
  { id: "planer", label: "Planer och priser" },
  { id: "paminnelser", label: "Påminnelser och spärr" },
  { id: "handelser", label: "Händelser" },
] as const;
type FlikId = (typeof FLIKAR)[number]["id"];

const BETALSTATUS_TEXT: Record<string, string> = {
  aktiv: "Betalar", forsenad: "Försenad", paminnelser: "Påmind", sparrad: "Pausad",
};
const BETALSTATUS_STIL: Record<string, string> = {
  aktiv: "bg-emerald-50 text-emerald-700",
  forsenad: "bg-amber-50 text-amber-700",
  paminnelser: "bg-orange-50 text-orange-700",
  sparrad: "bg-red-50 text-red-700",
};

// ── Huvudkomponent ──────────────────────────────────────────────────────────

export default function BetalningAdmin() {
  const [data, setData] = useState<Data | null>(null);
  const [flik, setFlik] = useState<FlikId>("affarer");
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState("");
  const [kvitto, setKvitto] = useState("");

  const hamta = useCallback(async () => {
    try {
      const r = await fetch("/api/billing");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta uppgifterna");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  const skicka = useCallback(
    async (body: Record<string, unknown>): Promise<{ ok: boolean; besked?: string; [k: string]: unknown }> => {
      setFel("");
      try {
        const r = await fetch("/api/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || j.besked || "Det gick inte");
        if (j.besked) setKvitto(j.besked);
        await hamta();
        return j;
      } catch (e) {
        setFel((e as Error).message);
        return { ok: false };
      }
    },
    [hamta],
  );

  if (laddar) {
    return <div className="flex items-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar…</div>;
  }
  if (!data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel || "Ingen data"}</div>;
  }

  return (
    <div className="space-y-6">
      <Nyckeltal s={data.sammanfattning} kopplad={data.installningar.stripe_kopplad} lage={data.installningar.stripe_lage} />

      <div className="flex flex-wrap gap-1.5 border-b border-gray-100">
        {FLIKAR.map((f) => (
          <button
            key={f.id}
            onClick={() => setFlik(f.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              flik === f.id ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {kvitto && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{kvitto}</span>
          <button onClick={() => setKvitto("")} className="text-emerald-600 hover:text-emerald-900">Stäng</button>
        </div>
      )}
      {fel && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {fel}
        </div>
      )}

      {flik === "affarer" && (
        <Kundaffarer
          avtal={data.avtal}
          planer={data.planer}
          momssats={data.installningar.momssats}
          skicka={skicka}
        />
      )}
      {flik === "stripe" && <StripeFlik inst={data.installningar} webhookUrl={data.webhook_adress} skicka={skicka} />}
      {flik === "koppla" && (
        <KopplaStripe
          klienter={data.avtal.map((a) => ({ client_id: a.client_id, klient: a.klient }))}
          planer={data.planer}
          kopplad={data.installningar.stripe_kopplad}
          momssats={data.installningar.momssats}
          skicka={skicka}
        />
      )}
      {flik === "planer" && <Planer planer={data.planer} kopplad={data.installningar.stripe_kopplad} skicka={skicka} />}
      {flik === "paminnelser" && <Paminnelser data={data} skicka={skicka} />}
      {flik === "handelser" && <Handelser data={data} />}
    </div>
  );
}

// ── Nyckeltal ───────────────────────────────────────────────────────────────

function Nyckeltal({ s, kopplad, lage }: { s: Data["sammanfattning"]; kopplad: boolean; lage: string }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kort ikon={<TrendingUp className="w-[18px] h-[18px]" />} farg="emerald" etikett="Intäkt per månad" varde={kr(s.mrr)} under={`${kr(s.arsvarde)} på ett år`} />
        <Kort ikon={<Users className="w-[18px] h-[18px]" />} farg="blue" etikett="Betalande kunder" varde={String(s.antal_aktiva)} under={s.antal_utan_affar ? `${s.antal_utan_affar} utan affär` : "Alla har en affär"} />
        <Kort ikon={<Clock className="w-[18px] h-[18px]" />} farg="amber" etikett="Kommer in 30 dagar" varde={kr(s.nasta_30_dagar)} under="Exklusive moms" />
        <Kort ikon={<Ban className="w-[18px] h-[18px]" />} farg={s.antal_sparrade || s.antal_forsenade ? "red" : "gray"} etikett="Behöver åtgärd" varde={String(s.antal_forsenade + s.antal_sparrade)} under={`${s.antal_forsenade} försenade, ${s.antal_sparrade} pausade`} />
      </div>

      {!kopplad && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Stripe är inte kopplat än. Affärerna nedan fungerar ändå, de sköts som faktura tills du kopplar på kortbetalning.
        </div>
      )}
      {kopplad && lage === "test" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Stripe kör i testläge. Inga riktiga pengar rör sig.
        </div>
      )}
    </div>
  );
}

const FARGER: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  gray: "bg-gray-100 text-gray-500",
};

function Kort({ ikon, farg, etikett, varde, under }: { ikon: React.ReactNode; farg: string; etikett: string; varde: string; under: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${FARGER[farg]}`}>{ikon}</span>
        <span className="text-xs text-gray-500 uppercase font-medium tracking-wide leading-tight">{etikett}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{varde}</div>
      <div className="mt-1 text-xs text-gray-500">{under}</div>
    </div>
  );
}

// ── Flik: Stripe ────────────────────────────────────────────────────────────

function StripeFlik({ inst, webhookUrl, skicka }: { inst: Installningar; webhookUrl: string; skicka: (b: Record<string, unknown>) => Promise<{ ok: boolean; besked?: string }> }) {
  const [form, setForm] = useState({
    stripe_lage: inst.stripe_lage,
    stripe_secret_key: "",
    stripe_webhook_secret: "",
    stripe_publik_nyckel: inst.stripe_publik_nyckel || "",
    foretagsnamn: inst.foretagsnamn || "",
    org_nr: inst.org_nr || "",
    moms_nr: inst.moms_nr || "",
    momssats: String(inst.momssats),
    faktura_avsandare: inst.faktura_avsandare || "",
  });
  const [sparar, setSparar] = useState(false);
  const [testar, setTestar] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; besked: string } | null>(null);
  const [kopierad, setKopierad] = useState(false);
  const satt = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));


  async function spara() {
    setSparar(true);
    await skicka({
      installningar: {
        ...form,
        momssats: Number(form.momssats),
        // Tomma hemliga fält betyder "rör inte" — servern lämnar då nyckeln orörd.
        stripe_secret_key: form.stripe_secret_key || undefined,
        stripe_webhook_secret: form.stripe_webhook_secret || undefined,
      },
    });
    setForm((f) => ({ ...f, stripe_secret_key: "", stripe_webhook_secret: "" }));
    setSparar(false);
  }

  async function testa() {
    setTestar(true);
    const r = await skicka({ atgard: "testa_stripe" });
    setTest({ ok: !!r.ok, besked: r.besked || "" });
    setTestar(false);
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">Koppling till Stripe</h2>
          <p className="mt-1 text-sm text-gray-600">
            Nycklarna hittar du i Stripe under Utvecklare, API-nycklar. De sparas krypterade och
            visas aldrig i klartext igen.
          </p>
        </div>

        <Falt etikett="Läge">
          <Valj value={form.stripe_lage} onChange={(v) => satt("stripe_lage", v)}>
            <option value="test">Testläge, inga riktiga pengar</option>
            <option value="live">Skarpt läge, riktiga betalningar</option>
          </Valj>
        </Falt>

        <Falt
          etikett="Hemlig nyckel"
          hjalp={inst.stripe_secret_key_maskerad ? `Sparad: ${inst.stripe_secret_key_maskerad}. Lämna tomt för att behålla den.` : "Börjar med sk_test_ eller sk_live_."}
        >
          <Input type="password" value={form.stripe_secret_key} onChange={(v) => satt("stripe_secret_key", v)} placeholder={inst.stripe_secret_key_maskerad || "sk_test_..."} />
        </Falt>

        <Falt
          etikett="Webhook-hemlighet"
          hjalp={inst.stripe_webhook_secret_maskerad ? `Sparad: ${inst.stripe_webhook_secret_maskerad}. Lämna tomt för att behålla den.` : "Börjar med whsec_. Du får den när du lagt till adressen nedan i Stripe."}
        >
          <Input type="password" value={form.stripe_webhook_secret} onChange={(v) => satt("stripe_webhook_secret", v)} placeholder={inst.stripe_webhook_secret_maskerad || "whsec_..."} />
        </Falt>

        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adress att lägga in i Stripe</div>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-sm text-gray-800">{webhookUrl}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(webhookUrl); setKopierad(true); setTimeout(() => setKopierad(false), 2000); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              {kopierad ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {kopierad ? "Kopierad" : "Kopiera"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Lägg till den i Stripe under Utvecklare, Webhooks. Välj händelserna invoice.paid,
            invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted
            och checkout.session.completed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <button onClick={spara} disabled={sparar} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
            {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara
          </button>
          <button onClick={testa} disabled={testar} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            {testar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Testa kopplingen
          </button>
        </div>

        {test && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${test.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            {test.besked}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">Dina företagsuppgifter</h2>
          <p className="mt-1 text-sm text-gray-600">Det här syns på kundens kvitto och på hennes betalsida.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Falt etikett="Företagsnamn"><Input value={form.foretagsnamn} onChange={(v) => satt("foretagsnamn", v)} placeholder="MySales" /></Falt>
          <Falt etikett="Organisationsnummer"><Input value={form.org_nr} onChange={(v) => satt("org_nr", v)} placeholder="556123-4567" /></Falt>
          <Falt etikett="Momsregistreringsnummer"><Input value={form.moms_nr} onChange={(v) => satt("moms_nr", v)} placeholder="SE556123456701" /></Falt>
          <Falt etikett="Momssats i procent"><Input type="number" value={form.momssats} onChange={(v) => satt("momssats", v)} /></Falt>
          <Falt etikett="Avsändare för påminnelsemejl" hjalp="Måste vara verifierad hos Resend.">
            <Input type="email" value={form.faktura_avsandare} onChange={(v) => satt("faktura_avsandare", v)} placeholder="faktura@mysales.se" />
          </Falt>
        </div>
        <button onClick={spara} disabled={sparar} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40">
          {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara
        </button>
      </section>
    </div>
  );
}

// ── Flik: planer ────────────────────────────────────────────────────────────

function Planer({ planer, kopplad, skicka }: { planer: Plan[]; kopplad: boolean; skicka: (b: Record<string, unknown>) => Promise<{ ok: boolean }> }) {
  const [utkast, setUtkast] = useState<Record<string, string>>({});
  const [synkar, setSynkar] = useState(false);

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-gray-600">
        Priserna här styr vad kunden ser och vad som skapas i Stripe. Ändrar du ett pris som redan
        finns i Stripe fortsätter befintliga kunder på det gamla priset tills du skapar ett nytt.
      </p>

      <div className="space-y-3">
        {planer.map((p) => (
          <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-gray-900">{p.label}</h3>
                  {p.stripe_price_id ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Finns i Stripe</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Bara här</span>
                  )}
                  {!p.active && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Avstängd</span>}
                </div>
                <p className="mt-1 text-sm text-gray-600">{p.beskrivning}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {p.typ === "abonnemang" ? "Abonnemang" : "Engångsköp"}
                  {p.credits ? `, ger ${p.credits} tokens` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={utkast[p.id] ?? String(p.belopp_sek)}
                  onChange={(v) => setUtkast((u) => ({ ...u, [p.id]: v }))}
                  klass="w-28 text-right"
                />
                <span className="text-sm text-gray-500">kr</span>
                <button
                  onClick={() => skicka({ plan: { id: p.id, belopp_sek: Number(utkast[p.id] ?? p.belopp_sek) } })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Spara
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={async () => { setSynkar(true); await skicka({ atgard: "synka_planer" }); setSynkar(false); }}
        disabled={!kopplad || synkar}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        title={kopplad ? "" : "Koppla Stripe först"}
      >
        {synkar ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Skapa saknade priser i Stripe
      </button>
    </div>
  );
}

// ── Flik: påminnelser och spärr ─────────────────────────────────────────────

function Paminnelser({ data, skicka }: { data: Data; skicka: (b: Record<string, unknown>) => Promise<{ ok: boolean; rader?: unknown }> }) {
  const inst = data.installningar;
  const [form, setForm] = useState({
    antal_paminnelser: String(inst.antal_paminnelser),
    paminnelse_dagar: inst.paminnelse_dagar.join(", "),
    gracedagar: String(inst.gracedagar),
    dunning_aktiv: inst.dunning_aktiv,
  });
  const [kor, setKor] = useState(false);
  const [logg, setLogg] = useState<string[]>([]);

  const behoverAtgard = data.avtal.filter((a) => a.betalstatus !== "aktiv");

  return (
    <div className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">Så fungerar trappan</h2>
          <p className="mt-1 text-sm text-gray-600">
            Går en betalning inte igenom får kunden en gul ruta direkt, med full tillgång kvar.
            Därefter går påminnelser ut enligt schemat nedan. Först efter sista påminnelsen pausas
            kontot, och då når kunden bara sin betalsida. Ingenting raderas någonsin.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.dunning_aktiv}
            onChange={(e) => setForm((f) => ({ ...f, dunning_aktiv: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
          />
          <span className="text-sm">
            <span className="font-semibold text-gray-900">Automatiken är påslagen</span>
            <span className="block text-gray-600">
              Är den av skickas inga påminnelser och ingen kund pausas, oavsett status. Du kan
              fortfarande pausa enskilda kunder manuellt nedan.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Falt etikett="Antal påminnelser"><Input type="number" value={form.antal_paminnelser} onChange={(v) => setForm((f) => ({ ...f, antal_paminnelser: v }))} /></Falt>
          <Falt etikett="Dagar efter första miss" hjalp="Komma mellan.">
            <Input value={form.paminnelse_dagar} onChange={(v) => setForm((f) => ({ ...f, paminnelse_dagar: v }))} placeholder="0, 7, 14" />
          </Falt>
          <Falt etikett="Extra dagar innan paus"><Input type="number" value={form.gracedagar} onChange={(v) => setForm((f) => ({ ...f, gracedagar: v }))} /></Falt>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => skicka({
              installningar: {
                antal_paminnelser: Number(form.antal_paminnelser),
                paminnelse_dagar: form.paminnelse_dagar.split(",").map((d) => Number(d.trim())).filter((d) => Number.isFinite(d)),
                gracedagar: Number(form.gracedagar),
                dunning_aktiv: form.dunning_aktiv,
              },
            })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <Save className="w-4 h-4" /> Spara
          </button>
          <button
            onClick={async () => { setKor(true); const r = await skicka({ atgard: "kor_dunning" }); setLogg((r.rader as string[]) || []); setKor(false); }}
            disabled={kor}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {kor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Kör trappan nu
          </button>
        </div>

        {logg.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {logg.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 font-display text-lg font-bold text-gray-900">Pausa eller låsa upp en kund</h2>
        {behoverAtgard.length === 0 && (
          <p className="px-6 py-6 text-sm text-gray-500">Ingen kund har något betalproblem just nu.</p>
        )}
        <ul className="divide-y divide-gray-50">
          {data.avtal.map((a) => (
            <li key={a.client_id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
              <span className="min-w-0 flex-1 font-medium text-gray-900">{a.klient}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BETALSTATUS_STIL[a.betalstatus] || "bg-gray-100 text-gray-600"}`}>
                {BETALSTATUS_TEXT[a.betalstatus] || a.betalstatus}
              </span>
              <button
                onClick={() => skicka({ override: { client_id: a.client_id, varde: "frys", note: "Pausad manuellt från ownervyn." } })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Lock className="w-3.5 h-3.5" /> Pausa
              </button>
              <button
                onClick={() => skicka({ override: { client_id: a.client_id, varde: "las_upp", note: "Upplåst manuellt från ownervyn." } })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Unlock className="w-3.5 h-3.5" /> Lås upp
              </button>
              <button
                onClick={() => skicka({ override: { client_id: a.client_id, varde: null } })}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Automatik
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Flik: händelser ─────────────────────────────────────────────────────────

function Handelser({ data }: { data: Data }) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 font-display text-lg font-bold text-gray-900">Obetalda fakturor</h2>
        {data.obetalda.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">Inga obetalda fakturor.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.obetalda.map((f) => (
              <li key={f.stripe_invoice_id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
                <span className="w-28 shrink-0 text-gray-500">{datum(f.faktura_datum)}</span>
                <span className="min-w-0 flex-1 font-medium text-gray-900">{f.klient}</span>
                <span className="text-gray-600">{f.nummer}</span>
                <span className="tabular-nums font-semibold text-gray-900">{kr(f.belopp_sek)}</span>
                {f.hosted_invoice_url && (
                  <a href={f.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                    <ExternalLink className="w-4 h-4" /> Öppna
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 font-display text-lg font-bold text-gray-900">Senaste från Stripe</h2>
        {data.handelser.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">
            Inga händelser än. De dyker upp här så fort Stripe hör av sig första gången.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.handelser.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                <span className="w-32 shrink-0 text-gray-500">{tidpunkt(h.created_at)}</span>
                <span className="min-w-0 flex-1 text-gray-800">{h.sammanfattning || h.typ}</span>
                {h.fel ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700" title={h.fel}>Fel</span>
                ) : h.hanterad ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Klar</span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Väntar</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Små byggstenar ──────────────────────────────────────────────────────────

function Falt({ etikett, hjalp, children }: { etikett: string; hjalp?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{etikett}</span>
      {children}
      {hjalp && <span className="mt-1 block text-xs text-gray-500">{hjalp}</span>}
    </label>
  );
}

function Input({
  value, onChange, type = "text", placeholder, klass = "",
}: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; klass?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${klass || "w-full"}`}
    />
  );
}

function Valj({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
    >
      {children}
    </select>
  );
}
