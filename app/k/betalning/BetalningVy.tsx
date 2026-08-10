"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2, CreditCard, Calendar, FileText, Download, Plus, Check, AlertTriangle, ExternalLink,
} from "lucide-react";

// BETAL-1 (B-3) — kundens betalsida. Klarspråk, inga tankstreck, inga interna ord.
//
// Fyra saker kunden ska kunna göra själv:
//   se nästa betalning · läsa vad som ingår · hämta sina kvitton · byta betalkort

interface Kvitto {
  id: string; nummer: string | null; belopp: number; moms: number;
  status: string; datum: string | null; pdf: string | null; lank: string | null;
}

interface Data {
  status: "aktiv" | "forsenad" | "paminnelser" | "sparrad";
  besked: { ton: string; rubrik: string; text: string; knapp: string } | null;
  plan: {
    namn: string | null; beskrivning: string | null;
    belopp_ex_moms: number; belopp_inkl_moms: number; momssats: number;
    intervall_text: string | null; betalsatt: string | null; aktivt: boolean; sags_upp: boolean;
  };
  nasta_betalning: string | null;
  nasta_betalning_text: string;
  kvitton: Kvitto[];
  kan_hantera_kort: boolean;
  kort: { marke: string; sista_fyra: string; giltigt_till: string } | null;
  foretag: { namn: string | null; org_nr: string | null };
}

/** Kortmärket som kunden känner igen det. Stripe svarar "visa", hon läser "Visa". */
function kortnamn(marke: string): string {
  const k: Record<string, string> = {
    visa: "Visa", mastercard: "Mastercard", amex: "American Express",
    discover: "Discover", diners: "Diners Club", jcb: "JCB", unionpay: "UnionPay",
  };
  return k[marke?.toLowerCase()] || "Kort";
}

const kr = (n: number) => `${new Intl.NumberFormat("sv-SE").format(Math.round(n))} kr`;
const langtDatum = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "Inget datum satt";
const kortDatum = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function BetalningVy({ primaryColor }: { primaryColor: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(true);
  const [jobbar, setJobbar] = useState("");
  const [kvittotext, setKvittotext] = useState("");

  const hamta = useCallback(async () => {
    try {
      const r = await fetch("/api/k/betalning");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Kunde inte hämta dina uppgifter");
      setData(j);
      setFel("");
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => {
    hamta();
    // Kommer kunden tillbaka från en genomförd betalning ska hon få ett kvitto på skärmen,
    // inte bara ett tyst saldo som råkar ha ändrats.
    const p = new URLSearchParams(window.location.search);
    if (p.get("kop") === "klart") setKvittotext("Tack. Dina tokens är påfyllda och ligger på kontot.");
    if (p.get("tecknat") === "klart") setKvittotext("Tack. Ditt abonnemang är igång.");
  }, [hamta]);

  async function knapp(atgard: "portal" | "tokens") {
    setJobbar(atgard);
    setFel("");
    try {
      const r = await fetch("/api/k/betalning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atgard }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.besked || "Det gick inte just nu");
      // Behövs kundens egen medverkan skickar servern med en länk. Annars är köpet klart
      // och vi visar kvittot direkt utan att skicka henne någonstans.
      if (j.url) { window.location.href = j.url; return; }
      setKvittotext(j.besked || "Klart.");
      setJobbar("");
      await hamta();
    } catch (e) {
      setFel((e as Error).message);
      setJobbar("");
    }
  }

  if (laddar) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina uppgifter…</div>;
  }
  if (fel && !data) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>;
  }
  if (!data) return null;

  const sparrad = data.status === "sparrad";

  return (
    <div className="space-y-5 max-w-3xl">
      {kvittotext && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          <Check className="h-4 w-4 flex-shrink-0" /> {kvittotext}
        </div>
      )}

      {/* Spärrad: beskedet står först och störst. Kunden ska inte behöva leta. */}
      {sparrad && data.besked && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-display text-lg font-bold text-red-900">{data.besked.rubrik}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-red-800">{data.besked.text}</p>
            </div>
          </div>
          {data.kan_hantera_kort && (
            <button
              onClick={() => knapp("portal")}
              disabled={!!jobbar}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
            >
              {jobbar === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {data.besked.knapp}
            </button>
          )}
        </div>
      )}

      {/* Nästa betalning — den viktigaste siffran, störst. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Calendar className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Nästa betalning</span>
        </div>

        {data.nasta_betalning ? (
          <>
            <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <div className="font-display text-3xl font-bold text-gray-900 tabular-nums">
                {kr(data.plan.belopp_inkl_moms)}
              </div>
              <div className="pb-1 text-sm text-gray-600">
                {langtDatum(data.nasta_betalning)} · {data.nasta_betalning_text.toLowerCase()}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500 tabular-nums">
              {kr(data.plan.belopp_ex_moms)} plus moms {data.plan.momssats} procent
              {data.plan.intervall_text ? `, ${data.plan.intervall_text.toLowerCase()}` : ""}.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            Ingen kommande betalning är inlagd. Har du frågor om ditt abonnemang, hör av dig till din rådgivare.
          </p>
        )}

        {data.plan.sags_upp && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Ditt abonnemang avslutas vid periodens slut. Vill du fortsätta, hör av dig så ordnar vi det.
          </p>
        )}
      </section>

      {/* Vad som ingår. */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-gray-900">Din plan</h2>
        <p className="mt-2 text-sm text-gray-700">
          <strong>{data.plan.namn || "Inget abonnemang registrerat"}</strong>
          {data.plan.beskrivning ? ` — ${data.plan.beskrivning}` : ""}
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 flex-shrink-0" /> Alla texter du orkar skriva, utan gräns</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 flex-shrink-0" /> Tokens varje månad för bilder och video</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600 flex-shrink-0" /> Alla verktyg i din portal</li>
        </ul>

        {/* Vilket kort som ligger inne. Kunden ska aldrig behöva gissa vad som dras. */}
        {data.kort && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <CreditCard className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="text-gray-700">
              {kortnamn(data.kort.marke)} som slutar på <strong className="tabular-nums">{data.kort.sista_fyra}</strong>
            </span>
            <span className="text-gray-500">giltigt till {data.kort.giltigt_till}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
          {data.kan_hantera_kort && !sparrad && (
            <button
              onClick={() => knapp("portal")}
              disabled={!!jobbar}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              {jobbar === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Hantera betalkort
            </button>
          )}
          {!sparrad && (
            <button
              onClick={() => knapp("tokens")}
              disabled={!!jobbar}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              {jobbar === "tokens" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {data.kort ? `Köp fler tokens med kortet som slutar på ${data.kort.sista_fyra}` : "Köp fler tokens"}
            </button>
          )}
        </div>
      </section>

      {/* Kvitton. */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-6 py-4 font-display text-lg font-semibold text-gray-900">Dina kvitton</h2>
        {data.kvitton.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            Här dyker dina kvitton upp så fort första betalningen gått igenom.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.kvitton.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
                <span className="w-28 shrink-0 text-gray-500">{kortDatum(k.datum)}</span>
                <span className="min-w-0 flex-1 text-gray-800">
                  {k.nummer || "Faktura"}
                  <span className="ml-2 text-xs text-gray-500 tabular-nums">varav moms {kr(k.moms)}</span>
                </span>
                <span className="tabular-nums font-semibold text-gray-900">{kr(k.belopp)}</span>
                <Statusmarke status={k.status} />
                {k.pdf ? (
                  <a href={k.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: primaryColor }}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                ) : k.lank ? (
                  <a href={k.lank} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: primaryColor }}>
                    <ExternalLink className="h-4 w-4" /> Öppna
                  </a>
                ) : (
                  <span className="text-gray-300"><FileText className="h-4 w-4" /></span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.foretag.namn && (
        <p className="text-xs text-gray-500">
          Fakturor ställs ut av {data.foretag.namn}
          {data.foretag.org_nr ? `, organisationsnummer ${data.foretag.org_nr}` : ""}.
        </p>
      )}

      {fel && <p className="text-sm text-red-600">{fel}</p>}
    </div>
  );
}

function Statusmarke({ status }: { status: string }) {
  const betald = status === "paid";
  const text = betald ? "Betald" : status === "open" ? "Obetald" : status === "void" ? "Makulerad" : status;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        betald ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {text}
    </span>
  );
}
