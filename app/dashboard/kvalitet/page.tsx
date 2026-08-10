"use client";

// G-9 — kvalitetssidan. Byråvy: blev texterna bättre när en regel skärptes?
//
// ⚠ SIDANS ENDA HÅRDA REGEL: en nolla får aldrig se ut som ett mätvärde. SEO-verktyget
// gick ut till kund med nollor som lästes som mätningar, och det upprepas inte här.
// Därför skiljer sidan på tre lägen och skriver ut vilket som gäller:
//   MÄTT      — det finns tillräckligt med genereringar för att en andel ska betyda något
//   FÖR FÅ    — det finns rader, men för få för att räkna andel på (siffran visas ändå)
//   SAKNAS    — ingen data alls, och det står rakt ut
//
// Sidan visar heller aldrig ett "kvalitetsbetyg". Vyn räknar det som gick att räkna:
// hur många genereringar, hur många som kasserades, hur många som blev ett inlägg, och
// hur många som saknar kostnadskoppling. Vad som är BRA av det är en bedömning, inte en
// mätning — och den bedömningen gör Håkan, inte sidan.

import { useEffect, useState } from "react";
import { BarChart3, Loader2, AlertTriangle } from "lucide-react";

interface Rad {
  promptVersion: string;
  syfte: string;
  antal: number;
  kasserade: number;
  publicerade: number;
  utanKostnadskoppling: number;
  forsta: string | null;
  senaste: string | null;
  andelPublicerade: number | null;
  andelKasserade: number | null;
}

interface Svar {
  rader: Rad[] | null;
  minForAndel: number;
  totalt: number;
  utanKostnadskoppling: number;
  error?: string;
}

const datum = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) : "—";

/** Andel som text. null → uttrycklig förklaring, aldrig "0 %". */
// Parentesen är inte kosmetik: utan den renderades "0" följt av "0 %" som "00 %" och
// "0" följt av "för få" som "0för få". Upptäckt genom att läsa den riktiga sidan, inte koden.
function andelText(andel: number | null, antal: number, min: number): string {
  if (andel === null) return `(för få — ${antal} av ${min})`;
  return `(${Math.round(andel * 100)} %)`;
}

export default function KvalitetPage() {
  const [svar, setSvar] = useState<Svar | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/kvalitet");
        const d = (await r.json()) as Svar;
        if (!r.ok) throw new Error(d.error || "Kunde inte hämta mätdatan");
        setSvar(d);
      } catch (e) {
        setFel((e as Error).message);
      } finally {
        setLaddar(false);
      }
    })();
  }, []);

  // Gruppera per promptversion så före/efter går att läsa i en blick.
  const versioner = svar?.rader
    ? Array.from(new Set(svar.rader.map((r) => r.promptVersion)))
        .map((v) => ({
          version: v,
          rader: svar.rader!.filter((r) => r.promptVersion === v),
          senaste: svar.rader!.filter((r) => r.promptVersion === v).map((r) => r.senaste ?? "").sort().reverse()[0] ?? "",
        }))
        .sort((a, b) => b.senaste.localeCompare(a.senaste))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
          <BarChart3 className="w-5 h-5 text-brand-blue" />
        </span>
        <div>
          <h1 className="font-display font-bold text-gray-900 text-xl">Kvalitet per regeluppsättning</h1>
          <p className="text-sm text-gray-500">
            Varje gång en skrivregel ändras får den ett nytt versionsnummer. Här ser du vad varje version faktiskt producerade.
          </p>
        </div>
      </div>

      {laddar && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Hämtar mätdatan…
        </div>
      )}

      {fel && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Kunde inte läsa mätdatan.</strong> {fel}
          <div className="mt-1 text-red-700">
            Sidan visar hellre det här beskedet än en tom tabell — en tom tabell hade sett ut som &quot;inga genereringar&quot;.
          </div>
        </div>
      )}

      {/* SAKNAS-läget, uttryckligt. Aldrig en tom tabell som ser mätt ut. */}
      {!laddar && !fel && (!svar?.rader || svar.rader.length === 0) && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
          <strong>Ingen mätdata finns ännu.</strong>
          <p className="mt-1">
            Det betyder inte att kvaliteten är noll — det betyder att inga genereringar har loggats.
            Siffror dyker upp här så fort texter börjar skapas.
          </p>
        </div>
      )}

      {!laddar && !fel && svar?.rader && svar.rader.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{svar.totalt}</div>
              <div className="text-xs text-gray-500 mt-0.5">genereringar loggade</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{versioner.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">regeluppsättningar</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{svar.utanKostnadskoppling}</div>
              <div className="text-xs text-gray-500 mt-0.5">saknar kostnadskoppling</div>
            </div>
          </div>

          {svar.utanKostnadskoppling > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <strong>{svar.utanKostnadskoppling} genereringar går inte att prissätta.</strong> De skapades utan att
                kopplas till en kostnadsrad. Det är en lucka i mätningen, inte en kostnad på noll.
              </div>
            </div>
          )}

          {versioner.map(({ version, rader }) => (
            <div key={version} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-gray-900">{version}</h2>
                <span className="text-xs text-gray-500">
                  {datum(rader.map((r) => r.forsta ?? "").sort()[0] ?? null)} – {datum(rader.map((r) => r.senaste ?? "").sort().reverse()[0] ?? null)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="px-5 py-2 font-medium">Typ av text</th>
                      <th className="px-5 py-2 font-medium text-right">Gjorda</th>
                      <th className="px-5 py-2 font-medium text-right">Kasserade</th>
                      <th className="px-5 py-2 font-medium text-right">Blev inlägg</th>
                      <th className="px-5 py-2 font-medium text-right">Utan kostnad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rader.map((r) => (
                      <tr key={`${r.promptVersion}-${r.syfte}`} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-2.5 text-gray-900">{r.syfte}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-gray-900">{r.antal}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">
                          {r.kasserade}
                          <span className="text-xs text-gray-400 ml-1.5">
                            {andelText(r.andelKasserade, r.antal, svar.minForAndel)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-gray-600">
                          {r.publicerade}
                          <span className="text-xs text-gray-400 ml-1.5">
                            {andelText(r.andelPublicerade, r.antal, svar.minForAndel)}
                          </span>
                        </td>
                        <td className={`px-5 py-2.5 text-right tabular-nums ${r.utanKostnadskoppling > 0 ? "text-amber-700" : "text-gray-400"}`}>
                          {r.utanKostnadskoppling}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 space-y-1.5">
            <p><strong>Så läser du tabellen.</strong></p>
            <p><strong>Gjorda</strong> = antal genereringar. <strong>Kasserade</strong> = texter som skrevs om eller valdes bort. <strong>Blev inlägg</strong> = texter som faktiskt sparades.</p>
            <p>
              Andelen räknas bara när det finns minst {svar.minForAndel} genereringar. Under det står &quot;för få&quot; —
              en procentsats ur ett par rader lurar ögat mer än den hjälper.
            </p>
            <p>
              <strong>Testkörningar räknas med.</strong> DoD-skripten genererar text utan att spara den, så
              &quot;blev inlägg&quot; är lågt för versioner som testats hårt. Det är en mätning av vad som hände,
              inte ett omdöme om texterna — men den skillnaden syns inte i tabellen, så den står här.
            </p>
            <p>
              Sidan sätter inget betyg. Den räknar det som gick att räkna. Vad som är bra av det är din bedömning.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
