"use client";

// MySales-kopplingen per kund, i Inställningar.
//
// Håkans två invändningar 13/8, båda befogade:
//   1. "varför ska jag behöva lägga det på hennes inläggssida" — kopplingen låg begravd i
//      Skapa inlägg och dök bara upp när man råkade välja Facebook eller LinkedIn. Den hör
//      hemma här, bland integrationerna, per kund.
//   2. "en kod från private integration ska väl räcka?" — den räcker nu. Nyckeln skrivs
//      till båda ställena den behövdes på (se app/api/studio/ghl-config).
//
// ⚠ Rutan visar vilka BEHÖRIGHETER nyckeln faktiskt har, inte bara att den sparades.
// Mätt 13/8: For Balance, AluCon och Makzy hade alla en nyckel som gav 401 på allt. En
// nyckel som ser sparad ut men inte fungerar är värre än ingen nyckel alls.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Link2, Loader2, Unplug } from "lucide-react";

interface Behorighet { namn: string; ok: boolean; status: number | null; betyder: string }
interface Kanal { platform: string; namn: string; utgangen?: boolean }

export default function MySalesConnect() {
  const [status, setStatus] = useState<{
    connected: boolean;
    locationId: string;
    studio?: { finns: boolean; behorigheter: Behorighet[] };
    fokus?: { finns: boolean; sammaNyckel: boolean; behorigheter: Behorighet[] };
  } | null>(null);
  const [loc, setLoc] = useState("");
  const [pit, setPit] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState("");
  const [resultat, setResultat] = useState<{ behorigheter: Behorighet[]; kanaler: Kanal[]; coachRader: number; varning?: string } | null>(null);

  const las = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/ghl-config");
      const d = await r.json();
      setStatus(d);
      if (d.locationId) setLoc(d.locationId);
    } catch { /* status är valfri — formuläret fungerar ändå */ }
  }, []);
  useEffect(() => { las(); }, [las]);

  const koppla = useCallback(async () => {
    setFel(""); setResultat(null); setSparar(true);
    try {
      const r = await fetch("/api/studio/ghl-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.trim(), pit: pit.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setFel(d.error || "Kopplingen misslyckades."); return; }
      setResultat({ behorigheter: d.behorigheter || [], kanaler: d.kanaler || [], coachRader: d.coachRader || 0, varning: d.varning });
      setPit(""); // nyckeln ska inte ligga kvar i ett fält efter sparning
      await las();
    } catch (e) { setFel((e as Error).message); } finally { setSparar(false); }
  }, [loc, pit, las]);

  const kopplaFran = useCallback(async () => {
    setSparar(true); setResultat(null);
    try { await fetch("/api/studio/ghl-config", { method: "DELETE" }); await las(); }
    finally { setSparar(false); }
  }, [las]);

  return (
    <div className="space-y-3">
      {status?.connected ? (
        <>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
            <Check className="w-3.5 h-3.5" /> Kopplad
          </span>
          <span className="text-gray-500 font-mono text-sm">{status.locationId}</span>
          <button onClick={kopplaFran} disabled={sparar}
            className="ml-auto inline-flex items-center gap-1 text-sm text-gray-400 hover:text-red-600 disabled:opacity-40">
            <Unplug className="w-3.5 h-3.5" /> Koppla från
          </button>
        </div>
        {/* Sanningen INNAN man rör något. Håkans invändning: han hade ett fält men inget
            sätt att se vad som gällde, och klistrade därför in i blindo. Två nycklar =
            två besked, för det ÄR två olika nycklar med olika behörigheter. */}
        <div className="grid sm:grid-cols-2 gap-2">
          {([
            ["Kanaler och kundlista", status.studio],
            ["Fokus, DM och leads", status.fokus],
          ] as const).map(([rubrik, del]) => {
            const trasiga = (del?.behorigheter || []).filter((b) => !b.ok);
            const allaOk = !!del?.finns && trasiga.length === 0 && (del?.behorigheter.length ?? 0) > 0;
            return (
              <div key={rubrik} className={`rounded-lg border px-3 py-2 ${allaOk ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {allaOk
                    ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                  <span className={allaOk ? "text-emerald-800" : "text-amber-900"}>{rubrik}</span>
                </div>
                <p className={`text-sm mt-0.5 ${allaOk ? "text-emerald-700" : "text-amber-800"}`}>
                  {!del?.finns
                    ? "Ingen nyckel sparad."
                    : allaOk
                      ? "Allt fungerar."
                      : `Nekas: ${trasiga.map((b) => b.namn.toLowerCase()).join(", ")}.`}
                </p>
              </div>
            );
          })}
        </div>
        {status.fokus?.finns && !status.fokus.sammaNyckel && (
          <p className="text-sm text-gray-500">
            De två rutorna använder olika nycklar. Klistrar du in en nyckel nedan som klarar
            alla fyra behörigheterna tar den över båda, och då räcker en enda.
          </p>
        )}
        </>
      ) : (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Den här kunden är inte kopplad. Utan koppling kan Cockpit varken se kundens kanaler
          eller publicera åt henne.
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">1. Location-id</label>
          <input value={loc} onChange={(e) => setLoc(e.target.value)}
            placeholder="t.ex. HRRSfU2eczG7Dxm81Ac9"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-gray-400"
            name="mysales-location" autoComplete="off" data-lpignore="true" data-1p-ignore spellCheck={false} />
          <p className="text-sm text-gray-500 mt-1">Står i MySales-adressen efter <code>/location/</code>.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            2. Nyckeln från Private Integration
          </label>
          {/* ⚠ type="text", INTE password. Med password autofyllde webbläsaren in ett sparat
              lösenord, fältet såg ifyllt ut med prickar, och Håkan kunde inte se var han
              skulle klistra in. autoComplete="off" räcker inte på lösenordsfält i Chrome.
              Nyckeln visas alltså i klartext medan den klistras in — den lämnar ändå aldrig
              servern efteråt (GET returnerar den aldrig) och töms ur fältet vid sparning. */}
          <input value={pit} onChange={(e) => setPit(e.target.value)} type="text"
            placeholder="pit-..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-gray-400"
            name="mysales-nyckel-falt" autoComplete="new-password" data-lpignore="true" data-1p-ignore
            data-form-type="other" spellCheck={false} />
          {status?.connected && (
            <p className="text-sm text-gray-500 mt-1">
              Fältet är tomt med flit. En sparad nyckel visas aldrig igen — klistra in en ny
              bara när du vill byta.
            </p>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 space-y-1.5">
          <p className="text-sm font-semibold text-gray-700">Så skapar du nyckeln</p>
          <p className="text-sm text-gray-600">
            I <strong>kundens</strong> MySales: Settings → Private Integrations → skapa en, döp
            den till <strong>Cockpit</strong>, och kryssa i dessa fyra:
          </p>
          <ul className="text-sm text-gray-600 space-y-0.5 pl-1">
            <li>· <strong>Social Planner</strong> — kanalerna och publiceringen</li>
            <li>· <strong>Users</strong> — avsändare vid publicering</li>
            <li>· <strong>Contacts</strong> — kundlistan (taggarna följer med här)</li>
            <li>· <strong>Opportunities</strong> — Fokus idag, DM och pipeline</li>
          </ul>
          <p className="text-sm text-gray-500">
            Rutan provar de fyra ovan. Samma nyckel används dessutom av onboardingen när ett
            konto sätts upp från grunden (custom values, taggar, workflows) — så skapar du en
            ny nyckel: <strong>behåll allt den gamla integrationen hade</strong> och lägg till,
            ta aldrig bort. Missar du Opportunities sparas nyckeln ändå, men Fokus fortsätter
            använda den nyckel som lades in vid onboardingen.
          </p>
        </div>
        <button onClick={koppla} disabled={sparar || !loc.trim() || !pit.trim()}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40">
          {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Testa och koppla
        </button>
      </div>

      {fel && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {/* Sparas aldrig vid fel — annars ser gränssnittet kopplat ut medan ingenting fungerar. */}
          <span>{fel} Nyckeln sparades inte.</span>
        </div>
      )}

      {resultat && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="text-sm font-semibold text-gray-700">Vad nyckeln faktiskt får göra</div>
          <ul className="space-y-1">
            {resultat.behorigheter.map((b) => (
              <li key={b.namn} className="flex items-start gap-2 text-sm">
                {b.ok
                  ? <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                <span className={b.ok ? "text-gray-700" : "text-amber-800"}>
                  <strong>{b.namn}</strong>
                  {b.ok ? " — fungerar" : ` — nekas (${b.status ?? "inget svar"}). Utan den: ${b.betyder.toLowerCase()}.`}
                </span>
              </li>
            ))}
          </ul>
          {resultat.kanaler.length > 0 && (
            <div className="text-sm text-gray-600 pt-1 border-t border-gray-200">
              Kanaler vi ser hos kunden:{" "}
              {resultat.kanaler.map((k) => `${k.platform}${k.utgangen ? " (behöver förnyas)" : ""}`).join(", ")}
            </div>
          )}
          {resultat.coachRader > 0 && (
            <div className="text-sm text-gray-500">
              Samma nyckel används nu även av Fokus och kundlistan.
            </div>
          )}
          {/* En smalare nyckel skriver aldrig över en bredare. Sägs rakt ut, annars ser en
              halv koppling ut som en hel. */}
          {resultat.varning && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{resultat.varning}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
