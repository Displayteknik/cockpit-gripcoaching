"use client";

// MySales-kopplingen per kund, i Inställningar.
//
// Håkans invändningar 13/8, alla befogade:
//   1. "varför ska jag behöva lägga det på hennes inläggssida" — kopplingen låg begravd i
//      Skapa inlägg och dök bara upp när man råkade välja Facebook eller LinkedIn. Den hör
//      hemma här, bland integrationerna, per kund.
//   2. "en kod från private integration ska väl räcka?" — den räcker, om den är bred nog.
//   3. "nu fanns ju bara ett ställe att klistra in på, då blev det ju fel" — ett fält, ingen
//      möjlighet att se vad som gällde.
//   4. "gör två fält, en total nyckel om jag vill det och en nyckel för det sociala" — det
//      är det här bygget. Fältet är inte längre ett fält som koden tolkar åt honom; han
//      pekar själv ut vad nyckeln ska gälla, och rutan säger vad som redan ligger inne.
//
// ⚠ Rutan visar vilka BEHÖRIGHETER varje sparad nyckel faktiskt har, inte bara att den
// sparades. Mätt 13/8: For Balance, AluCon och Makzy hade alla en nyckel som gav 401 på
// allt. En nyckel som ser sparad ut men inte fungerar är värre än ingen nyckel alls.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Link2, Loader2, Unplug } from "lucide-react";

interface Behorighet { namn: string; ok: boolean; status: number | null; betyder: string }
interface Kanal { platform: string; namn: string; utgangen?: boolean }
type Mal = "allt" | "socialt";

interface Resultat {
  mal: Mal;
  behorigheter: Behorighet[];
  kanaler: Kanal[];
  coachRader: number;
  varning?: string;
  notis?: string;
  kanTvinga?: boolean;
}

export default function MySalesConnect() {
  const [status, setStatus] = useState<{
    connected: boolean;
    locationId: string;
    studio?: { finns: boolean; behorigheter: Behorighet[] };
    fokus?: { finns: boolean; sammaNyckel: boolean; behorigheter: Behorighet[] };
  } | null>(null);
  const [loc, setLoc] = useState("");
  const [pitAllt, setPitAllt] = useState("");
  const [pitSocial, setPitSocial] = useState("");
  const [sparar, setSparar] = useState<Mal | null>(null);
  const [fel, setFel] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const las = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/ghl-config");
      const d = await r.json();
      setStatus(d);
      if (d.locationId) setLoc(d.locationId);
    } catch { /* status är valfri — formuläret fungerar ändå */ }
  }, []);
  useEffect(() => { las(); }, [las]);

  const koppla = useCallback(async (mal: Mal, tvinga = false) => {
    const pit = (mal === "allt" ? pitAllt : pitSocial).trim();
    setFel(""); setResultat(null); setSparar(mal);
    try {
      const r = await fetch("/api/studio/ghl-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.trim(), pit, mal, tvinga }),
      });
      const d = await r.json();
      if (!r.ok) { setFel(d.error || "Kopplingen misslyckades."); return; }
      setResultat({
        mal, behorigheter: d.behorigheter || [], kanaler: d.kanaler || [],
        coachRader: d.coachRader || 0, varning: d.varning, notis: d.notis, kanTvinga: d.kanTvinga,
      });
      // Nyckeln ska inte ligga kvar i ett fält efter sparning — utom när den kan behöva
      // skrivas igen med tvinga, då fältet fylls på nytt av knappen nedan.
      if (mal === "allt" && !d.kanTvinga) setPitAllt("");
      if (mal === "socialt") setPitSocial("");
      await las();
    } catch (e) { setFel((e as Error).message); } finally { setSparar(null); }
  }, [loc, pitAllt, pitSocial, las]);

  const kopplaFran = useCallback(async () => {
    setSparar("socialt"); setResultat(null);
    try { await fetch("/api/studio/ghl-config", { method: "DELETE" }); await las(); }
    finally { setSparar(null); }
  }, [las]);

  const faltCls = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100";
  const skydd = { autoComplete: "new-password" as const, "data-lpignore": "true", "data-1p-ignore": true, "data-form-type": "other", spellCheck: false };

  return (
    <div className="space-y-4">
      {/* ── VAD SOM LIGGER INNE NU ─────────────────────────────────────────────────────
          Sanningen INNAN man rör något. Håkans invändning: han hade ett fält men inget
          sätt att se vad som gällde, och klistrade därför in i blindo. Två nycklar =
          två besked, för det ÄR två olika nycklar med olika behörigheter. */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-700">Nycklar som ligger inne nu</span>
          {status?.connected && (
            <>
              <span className="text-sm text-gray-400 font-mono">{status.locationId}</span>
              <button onClick={kopplaFran} disabled={!!sparar}
                className="ml-auto inline-flex items-center gap-1 text-sm text-gray-400 hover:text-red-600 disabled:opacity-40">
                <Unplug className="w-3.5 h-3.5" /> Koppla från
              </button>
            </>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {([
            ["Totalnyckeln", "Fokus, DM, leads och onboarding", status?.fokus],
            ["Kanalnyckeln", "Kanaler, publicering och kundlista", status?.studio],
          ] as const).map(([rubrik, vad, del]) => {
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
                <p className={`text-sm ${allaOk ? "text-emerald-700" : "text-amber-800"}`}>{vad}</p>
                <p className={`text-sm mt-0.5 font-medium ${allaOk ? "text-emerald-700" : "text-amber-900"}`}>
                  {!del?.finns
                    ? "Ingen nyckel sparad."
                    : allaOk
                      ? "Sparad, allt fungerar."
                      : `Sparad, men nekas: ${trasiga.map((b) => b.namn.toLowerCase()).join(", ")}.`}
                </p>
              </div>
            );
          })}
        </div>
        {status?.fokus?.finns && status?.studio?.finns && (
          <p className="text-sm text-gray-500 mt-1.5">
            {status.fokus.sammaNyckel
              ? "Det är samma nyckel på båda ställena — en enda räcker alltså för den här kunden."
              : "De två är olika nycklar. Vill du ha en enda: klistra in den i totalfältet nedan."}
          </p>
        )}
      </div>

      {/* ── 1. LOCATION-ID ───────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">1. Location-id (kundens MySales-id)</label>
        <input value={loc} onChange={(e) => setLoc(e.target.value)}
          placeholder="t.ex. HRRSfU2eczG7Dxm81Ac9"
          className={faltCls} name="mysales-location" {...skydd} />
        <p className="text-sm text-gray-500 mt-1">Står i MySales-adressen efter <code>/location/</code>. Gäller båda nycklarna nedan.</p>
      </div>

      {/* ── 2. TOTALNYCKELN ──────────────────────────────────────────────────────────── */}
      {/* ⚠ type="text", INTE password. Med password autofyllde webbläsaren in ett sparat
          lösenord, fältet såg ifyllt ut med prickar, och Håkan kunde inte se var han skulle
          klistra in. autoComplete="off" räcker inte på lösenordsfält i Chrome. Nyckeln syns
          alltså i klartext medan den klistras in — den lämnar ändå aldrig servern efteråt
          (GET returnerar den aldrig) och töms ur fältet vid sparning. */}
      <div className="rounded-xl border-2 border-gray-900 p-4 space-y-2">
        <div>
          <label className="block text-base font-bold text-gray-900">2. Totalnyckel — gäller allt</label>
          <p className="text-sm text-gray-600 mt-0.5">
            Skrivs till <strong>båda</strong> ställena: kanalerna, publiceringen och kundlistan
            — och Fokus idag, DM-tavlan, leadflödet och onboardingen. Det här är samma fält som
            nyckeln vid onboardingen låg i.
          </p>
        </div>
        <input value={pitAllt} onChange={(e) => setPitAllt(e.target.value)} type="text"
          placeholder="Klistra in totalnyckeln här (pit-…)"
          className={faltCls} name="mysales-totalnyckel" {...skydd} />
        <button onClick={() => koppla("allt")} disabled={!!sparar || !loc.trim() || !pitAllt.trim()}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40">
          {sparar === "allt" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Testa och spara totalnyckeln
        </button>
      </div>

      {/* ── 3. KANALNYCKELN ──────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-300 p-4 space-y-2">
        <div>
          <label className="block text-base font-bold text-gray-900">3. Bara sociala kanaler</label>
          <p className="text-sm text-gray-600 mt-0.5">
            Skrivs <strong>bara</strong> till kanalerna, publiceringen och kundlistan. Fokus, DM
            och leads behåller sin egen nyckel — den rörs aldrig härifrån.
          </p>
        </div>
        <input value={pitSocial} onChange={(e) => setPitSocial(e.target.value)} type="text"
          placeholder="Klistra in kanalnyckeln här (pit-…)"
          className={faltCls} name="mysales-kanalnyckel" {...skydd} />
        <button onClick={() => koppla("socialt")} disabled={!!sparar || !loc.trim() || !pitSocial.trim()}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-40">
          {sparar === "socialt" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Testa och spara kanalnyckeln
        </button>
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
          ta aldrig bort. En nyckel utan Opportunities hör hemma i kanalfältet.
        </p>
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
          <div className="text-sm font-semibold text-gray-700">
            {resultat.mal === "allt" ? "Totalnyckeln" : "Kanalnyckeln"} — vad den faktiskt får göra
          </div>
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
          {resultat.notis && <div className="text-sm text-gray-500">{resultat.notis}</div>}
          {resultat.coachRader > 0 && (
            <div className="text-sm text-gray-500">
              Samma nyckel används nu även av Fokus, DM och leads.
            </div>
          )}
          {/* En smalare nyckel skriver aldrig över en bredare av misstag. Men beslutet är
              Håkans: han ser exakt vad som saknas och kan skriva över ändå. */}
          {resultat.varning && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{resultat.varning}</span>
              </div>
              {resultat.kanTvinga && (
                <button onClick={() => koppla("allt", true)} disabled={!!sparar || !pitAllt.trim()}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 disabled:opacity-40">
                  {sparar === "allt" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Skriv över Fokus-nyckeln ändå
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
