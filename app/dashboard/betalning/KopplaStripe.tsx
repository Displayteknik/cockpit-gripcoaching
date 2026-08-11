"use client";

import { useState } from "react";
import { Loader2, Link2, Unlink, Check, AlertTriangle, Download, Info } from "lucide-react";

// BETAL-1c — koppla ihop Cockpit med abonnemang som REDAN rullar i Stripe.
//
// Håkan säljer via betallänkar, så kunderna har tecknat direkt i Stripe utan att gå
// genom Cockpit. Abonnemangen finns alltså, men systemet vet inte vilken Cockpit-kund
// varje Stripe-kund är. Den kopplingen görs här, en rad i taget.
//
// Förslag visas men tillämpas ALDRIG automatiskt. Ett felkopplat abonnemang skickar en
// påminnelse till fel företag, och det är värre än tretton klick.

interface Pris {
  price_id: string; produkt_id: string; produkt_namn: string;
  belopp_sek: number; intervall: string; kopplad_plan: string | null;
}

interface Abonnemang {
  subscription_id: string; stripe_customer_id: string;
  kund_namn: string | null; kund_epost: string | null;
  listpris_sek: number; belopp_sek: number; har_rabatt: boolean; rabatt_text: string | null;
  intervall: string; status: string;
  nasta_betalning: string | null; price_id: string | null;
  kopplad_klient: string | null; forslag_klient: string | null; forslag_skal: string | null;
}

interface Klient { client_id: string; klient: string }
interface Plan { id: string; label: string; belopp_sek: number; stripe_price_id: string | null; typ: string }

const nf = new Intl.NumberFormat("sv-SE");
const kr = (n: number) => `${nf.format(Math.round(n))} kr`;
const INTERVALL: Record<string, string> = { manad: "per månad", kvartal: "per kvartal", ar: "per år", engang: "engång" };

const STATUS_STIL: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  trialing: "bg-blue-50 text-blue-700",
  past_due: "bg-amber-50 text-amber-700",
  unpaid: "bg-red-50 text-red-700",
  canceled: "bg-gray-100 text-gray-500",
};

export default function KopplaStripe({
  klienter, planer, kopplad, momssats, skicka,
}: {
  klienter: Klient[];
  planer: Plan[];
  kopplad: boolean;
  momssats: number;
  skicka: (b: Record<string, unknown>) => Promise<{ ok: boolean; [k: string]: unknown }>;
}) {
  const [data, setData] = useState<{ priser: Pris[]; abonnemang: Abonnemang[]; antal_okopplade: number } | null>(null);
  const [laddar, setLaddar] = useState(false);
  const [fel, setFel] = useState("");
  const [val, setVal] = useState<Record<string, string>>({});
  const [jobbar, setJobbar] = useState("");

  const medMoms = (n: number) => Math.round(n * (1 + momssats / 100));

  async function las() {
    setLaddar(true);
    setFel("");
    const r = await skicka({ atgard: "las_stripe" });
    if (r.ok) {
      const d = r as unknown as { priser: Pris[]; abonnemang: Abonnemang[]; antal_okopplade: number };
      setData(d);
      // Förifyll väljarna med förslagen, men spara ingenting förrän Håkan trycker.
      const f: Record<string, string> = {};
      d.abonnemang.forEach((a) => { if (!a.kopplad_klient && a.forslag_klient) f[a.subscription_id] = a.forslag_klient; });
      setVal(f);
    } else {
      setFel((r.besked as string) || "Kunde inte läsa från Stripe");
    }
    setLaddar(false);
  }

  if (!kopplad) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 max-w-3xl">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div>
          <p className="font-semibold">Stripe är inte kopplat än</p>
          <p className="mt-1">Fyll i din hemliga nyckel under fliken Stripe först, så kan jag läsa vad du redan har där.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <span className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Download className="w-[18px] h-[18px] text-blue-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Hämta det du redan har i Stripe</p>
          <p className="mt-0.5 text-sm text-gray-600">
            Läser dina produkter, priser och löpande abonnemang. Ingenting skapas eller ändras i Stripe,
            det här är bara Cockpits sida av kopplingen.
          </p>
        </div>
        <button
          onClick={las}
          disabled={laddar}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        >
          {laddar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Hämta från Stripe
        </button>
      </div>

      {fel && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {fel}
        </div>
      )}

      {data && (
        <>
          {/* Priserna. Koppla ihop i stället för att skapa nya. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="font-display text-lg font-bold text-gray-900">Dina priser i Stripe</h2>
              <p className="mt-0.5 text-sm text-gray-600">
                Knyt ihop dem med planerna i Cockpit. Då används ditt befintliga pris, och ingen dubblett skapas.
              </p>
            </div>
            {data.priser.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-500">Inga aktiva priser hittades.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.priser.map((p) => (
                  <li key={p.price_id} className="flex flex-wrap items-center gap-3 px-6 py-3.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{p.produkt_namn}</span>
                      <span className="ml-2 text-gray-500">{INTERVALL[p.intervall] || p.intervall}</span>
                    </span>
                    <span className="tabular-nums text-right">
                      <span className="font-semibold text-gray-900">{kr(p.belopp_sek)}</span>
                      <span className="ml-2 text-xs text-gray-500">{kr(medMoms(p.belopp_sek))} med moms</span>
                    </span>
                    {p.kopplad_plan ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <Check className="h-3 w-3" /> {planer.find((x) => x.id === p.kopplad_plan)?.label || p.kopplad_plan}
                      </span>
                    ) : (
                      <select
                        defaultValue=""
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          setJobbar(p.price_id);
                          await skicka({ koppla_pris: { plan_id: e.target.value, price_id: p.price_id } });
                          await las();
                          setJobbar("");
                        }}
                        disabled={jobbar === p.price_id}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
                      >
                        <option value="">Koppla till plan…</option>
                        {planer.filter((x) => x.typ === "abonnemang").map((x) => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Abonnemangen. Kärnan i hela vyn. */}
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-gray-900">Löpande abonnemang</h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  Peka ut vilken Cockpit-kund varje abonnemang hör till. Först då vet systemet vem som betalar vad.
                </p>
              </div>
              {data.antal_okopplade > 0 && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                  {data.antal_okopplade} okopplade
                </span>
              )}
            </div>

            {data.abonnemang.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-500">Inga abonnemang hittades i Stripe.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.abonnemang.map((a) => {
                  const kopplad = !!a.kopplad_klient;
                  return (
                    <li key={a.subscription_id} className={`px-6 py-4 ${kopplad ? "" : "bg-amber-50/30"}`}>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900">{a.kund_namn || "Namn saknas i Stripe"}</div>
                          <div className="text-xs text-gray-500">{a.kund_epost || "ingen e-post"}</div>
                        </div>

                        <div className="tabular-nums text-right">
                          <div className="font-semibold text-gray-900">{kr(a.belopp_sek)}</div>
                          {a.har_rabatt ? (
                            <div className="text-xs text-amber-700">
                              rabatt från <span className="line-through">{kr(a.listpris_sek)}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">{INTERVALL[a.intervall] || a.intervall}</div>
                          )}
                        </div>

                        <div className="w-32 text-right">
                          <div className="text-gray-700">{a.nasta_betalning || "—"}</div>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STIL[a.status] || "bg-gray-100 text-gray-600"}`}>
                            {a.status}
                          </span>
                        </div>

                        {kopplad ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3 w-3" />
                              {klienter.find((k) => k.client_id === a.kopplad_klient)?.klient || "kopplad"}
                            </span>
                            <button
                              onClick={async () => { setJobbar(a.subscription_id); await skicka({ slapp_koppling: a.kopplad_klient }); await las(); setJobbar(""); }}
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700"
                            >
                              <Unlink className="h-3.5 w-3.5" /> Koppla loss
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={val[a.subscription_id] || ""}
                              onChange={(e) => setVal((v) => ({ ...v, [a.subscription_id]: e.target.value }))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
                            >
                              <option value="">Välj kund…</option>
                              {klienter.map((k) => <option key={k.client_id} value={k.client_id}>{k.klient}</option>)}
                            </select>
                            <button
                              onClick={async () => {
                                setJobbar(a.subscription_id);
                                await skicka({
                                  koppla: {
                                    client_id: val[a.subscription_id],
                                    stripe_customer_id: a.stripe_customer_id,
                                    subscription_id: a.subscription_id,
                                  },
                                });
                                await las();
                                setJobbar("");
                              }}
                              disabled={!val[a.subscription_id] || jobbar === a.subscription_id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-30"
                            >
                              {jobbar === a.subscription_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                              Koppla
                            </button>
                          </div>
                        )}
                      </div>

                      {a.rabatt_text && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                          <Info className="h-3.5 w-3.5 flex-shrink-0" />
                          {a.rabatt_text}. Beloppet ovan är det kunden faktiskt betalar, inte listpriset.
                        </p>
                      )}
                      {!kopplad && a.forslag_skal && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <Info className="h-3.5 w-3.5 flex-shrink-0" />
                          Förslaget bygger på {a.forslag_skal}. Kontrollera att det stämmer innan du kopplar.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
