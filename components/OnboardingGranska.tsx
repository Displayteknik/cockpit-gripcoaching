"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, Building2, CheckCircle2, Circle, ExternalLink, Globe, Link2, Loader2,
  MapPin, MinusCircle, Plus, Quote, RefreshCw, Rocket, Save, Search, Sparkles,
  Trash2, XCircle,
} from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile, type Tone } from "@/components/ui/dash";
import { fetchJson } from "@/lib/safe-fetch";
import { harVarde, klassAv, kravsGranskning, arStandardTillaten } from "@/lib/onboard/typer";
import type { Analys, Falt, Forslag, ForslagNyckel, Kalltyp, Konflikt, Oppettid, Tjanst } from "@/lib/onboard/typer";

// ONBOARD-1, granskningsvyn. Enda indata är kundens webbadress — allt annat kommer
// från analysen. Varje rad visar därför VAR värdet kommer ifrån, för utan den
// kopplingen går "läst på kontaktsidan" inte att skilja från "modellen gissade".

// ── Källmarkören ────────────────────────────────────────────────────────────
const KALLA: Record<Kalltyp, { text: string; chip: string }> = {
  schema:   { text: "Sajtens strukturerade data", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200/70" },
  sajt:     { text: "Läst på sajten",             chip: "bg-sky-50 text-sky-700 ring-sky-200/70" },
  gbp:      { text: "Google-profil",              chip: "bg-amber-50 text-amber-800 ring-amber-200/70" },
  harlett:  { text: "Härlett ur sajttexten",      chip: "bg-violet-50 text-violet-700 ring-violet-200/70" },
  manuell:  { text: "Ändrat av dig",              chip: "bg-indigo-50 text-indigo-700 ring-indigo-200/70" },
  standard: { text: "Standardvärde",              chip: "bg-slate-100 text-slate-600 ring-slate-200/70" },
};

const ROLL_TEXT: Record<string, string> = {
  start: "Startsida", kontakt: "Kontakt", tjanster: "Tjänster", priser: "Priser",
  om: "Om oss", omdomen: "Omdömen", ovrig: "Övrig sida",
};

const INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100";

// ── Fältregistret ───────────────────────────────────────────────────────────
type Editor = "text" | "lang" | "nummer" | "lista" | "citatlista" | "farger" | "tjanster" | "oppettider" | "lankar";

interface FaltDef { nyckel: ForslagNyckel; etikett: string; editor: Editor; platshallare?: string }

interface Grupp {
  titel: string;
  beskrivning: string;
  ikon: React.ComponentType<{ className?: string }>;
  ton: string;
  falt: FaltDef[];
}

const GRUPPER: Grupp[] = [
  {
    titel: "Företagsfakta",
    beskrivning: "Går till kundkortet och kundens konto i MySales.",
    ikon: Building2,
    ton: "bg-sky-100 text-sky-700",
    falt: [
      { nyckel: "foretagsnamn", etikett: "Företagsnamn", editor: "text" },
      { nyckel: "kontaktperson", etikett: "Kontaktperson", editor: "text" },
      { nyckel: "epost", etikett: "E-post", editor: "text", platshallare: "namn@kund.se" },
      { nyckel: "telefon", etikett: "Telefon", editor: "text" },
      { nyckel: "adress", etikett: "Gatuadress", editor: "text" },
      { nyckel: "postnummer", etikett: "Postnummer", editor: "text" },
      { nyckel: "ort", etikett: "Ort", editor: "text" },
      { nyckel: "land", etikett: "Land", editor: "text" },
      { nyckel: "tidszon", etikett: "Tidszon", editor: "text" },
      { nyckel: "hemsida", etikett: "Webbadress", editor: "text" },
    ],
  },
  {
    titel: "Profil och tonläge",
    beskrivning: "Styr hur AI:n skriver åt kunden.",
    ikon: Sparkles,
    ton: "bg-violet-100 text-violet-700",
    falt: [
      { nyckel: "bransch", etikett: "Bransch", editor: "text" },
      { nyckel: "tagline", etikett: "Tagline", editor: "lang" },
      { nyckel: "malgruppPrimar", etikett: "Primär målgrupp", editor: "lang" },
      { nyckel: "malgruppSekundar", etikett: "Sekundär målgrupp", editor: "lang" },
      { nyckel: "smartpunkter", etikett: "Kundens smärtpunkter", editor: "lista" },
      { nyckel: "tonlage", etikett: "Tonläge", editor: "lang" },
      { nyckel: "erbjudanden", etikett: "Tjänster och priser", editor: "tjanster" },
      { nyckel: "kundcitat", etikett: "Kundcitat", editor: "citatlista" },
      { nyckel: "usp", etikett: "Vad som skiljer dem från andra", editor: "lang" },
    ],
  },
  {
    titel: "Hämtat från sajten",
    beskrivning: "Öppettider, kanaler och grafiskt.",
    ikon: Globe,
    ton: "bg-emerald-100 text-emerald-700",
    falt: [
      { nyckel: "oppettider", etikett: "Öppettider", editor: "oppettider" },
      { nyckel: "bokningslank", etikett: "Bokningslänk", editor: "text", platshallare: "https://www.bokadirekt.se/places/…" },
      { nyckel: "socialaLankar", etikett: "Sociala kanaler", editor: "lankar" },
      { nyckel: "logotyp", etikett: "Logotyp (bildadress)", editor: "text" },
      { nyckel: "fargpalett", etikett: "Färger", editor: "farger" },
    ],
  },
  {
    titel: "Google-profil",
    beskrivning: "Företagets sida på Google.",
    ikon: MapPin,
    ton: "bg-amber-100 text-amber-700",
    falt: [
      { nyckel: "gbpKategori", etikett: "Kategori i Google", editor: "text" },
      { nyckel: "gbpBetyg", etikett: "Betyg i Google", editor: "nummer" },
      { nyckel: "gbpAntalRecensioner", etikett: "Antal recensioner", editor: "nummer" },
    ],
  },
];

const ALLA_FALT: FaltDef[] = GRUPPER.flatMap((g) => g.falt);

/** Vilken grupp ett fält hör till. Behålls som liten etikett när vyn sorteras på klass. */
const GRUPP_FOR_FALT = new Map<ForslagNyckel, string>(
  GRUPPER.flatMap((g) => g.falt.map((f) => [f.nyckel, g.titel] as [ForslagNyckel, string])),
);

// ── ONBOARD-2: vyn sorteras på KLASS, inte på fältordning ───────────────────
//
// Skälet är hur granskningen faktiskt går till. Direkta fält — telefonnummer, adress,
// pris — ögnas igenom; står det fel syns det direkt. Belagda tolkningar är där felen
// sitter, för de ser alltid rimliga ut. Ligger de utspridda mellan självklarheter läses
// de med samma halva uppmärksamhet som resten. Samlade läses de noga.
type Sektion = "val" | "belagd_tolkning" | "standard" | "direkt" | "saknas";

const SEKTIONER: { id: Sektion; titel: string; beskrivning: string; ton: string }[] = [
  {
    id: "val",
    titel: "Kräver ditt val",
    beskrivning: "Källorna säger emot varandra, eller belägget är svagt. Inget här får godkännas passivt.",
    ton: "bg-rose-100 text-rose-700",
  },
  {
    id: "belagd_tolkning",
    titel: "Belagd tolkning",
    beskrivning: "Utläst ur källtexten, med citat som stöd. Här sitter felen — läs citatet, inte bara värdet.",
    ton: "bg-violet-100 text-violet-700",
  },
  {
    id: "standard",
    titel: "Standardvärde utan belägg",
    beskrivning: "Tillåtet bara för de fält GoHighLevel kräver för att kunna skapa kontot.",
    ton: "bg-amber-100 text-amber-700",
  },
  {
    id: "direkt",
    titel: "Direkt ur källan",
    beskrivning: "Står ordagrant på sajten eller i dess strukturerade data. Går att ögna igenom.",
    ton: "bg-sky-100 text-sky-700",
  },
  {
    id: "saknas",
    titel: "Saknas",
    beskrivning: "Inget belägg hittades. Fälten lämnas tomma och blir frågor till kunden.",
    ton: "bg-gray-100 text-gray-600",
  },
];

function sektionFor(nyckel: ForslagNyckel, falt: Falt<unknown> | undefined): Sektion {
  if (!falt || !harVarde(falt)) return "saknas";
  if (kravsGranskning(falt, nyckel)) return "val";
  const k = klassAv(falt.kalla);
  if (k === "belagd_tolkning") return "belagd_tolkning";
  if (k === "standard") return "standard";
  return "direkt";
}

const KLASS_ETIKETT: Record<string, { text: string; chip: string }> = {
  direkt: { text: "Direkt", chip: "bg-sky-50 text-sky-700 ring-sky-200/70" },
  belagd_tolkning: { text: "Belagd tolkning", chip: "bg-violet-50 text-violet-700 ring-violet-200/70" },
  standard: { text: "Standard — inget belägg", chip: "bg-amber-50 text-amber-800 ring-amber-200/70" },
  manuell: { text: "Din ändring", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200/70" },
};

// ── API-svar ────────────────────────────────────────────────────────────────
interface AnalysSvar { id: string; analys: Analys }
interface ProvSteg { namn: string; status: string; detalj?: string | null }
/**
 * Kontraktet utåt är snake_case (routen översätter från provisionera():s camelCase).
 * camelCase-varianterna läses ändå — en tom ruta för att ett fält bytt skrivsätt är
 * ett dyrt sätt att upptäcka en omdöpning.
 */
interface ProvSvar {
  ok: boolean;
  torrkorning?: boolean;
  steg: ProvSteg[];
  client_id?: string | null;
  ghl_location_id?: string | null;
  inloggnings_url?: string | null;
  clientId?: string | null;
  ghlLocationId?: string | null;
  inloggningsUrl?: string | null;
  fel?: string | null;
}
interface HamtaSvar {
  id: string; status: string | null; analys: Analys | null; forslag: Forslag | null;
  client_id: string | null; ghl_location_id: string | null; steg: ProvSteg[] | null; fel: string | null;
}

/** Felet bär sin egen rubrik — "sajten gick inte att läsa" är fel svar på ett sparfel. */
interface Fel { rubrik: string; text: string; hjalp?: string }

function arTomt(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

// ── Huvudkomponent ──────────────────────────────────────────────────────────
export default function OnboardingGranska({ primaryColor = "#4f46e5" }: { primaryColor?: string }) {
  const [url, setUrl] = useState("");
  const [epost, setEpost] = useState("");
  const [lage, setLage] = useState<"tom" | "analyserar" | "granska">("tom");
  const [sek, setSek] = useState(0);
  const [fel, setFel] = useState<Fel | null>(null);

  const [id, setId] = useState<string | null>(null);
  const [analys, setAnalys] = useState<Analys | null>(null);
  const [forslag, setForslag] = useState<Forslag | null>(null);
  const ursprung = useRef<Forslag | null>(null);

  const [sparar, setSparar] = useState(false);
  const [sparat, setSparat] = useState(false);
  const [visaRuta, setVisaRuta] = useState(false);
  const [torrkorning, setTorrkorning] = useState(false);
  const [provisionerar, setProvisionerar] = useState(false);
  const [prov, setProv] = useState<ProvSvar | null>(null);

  // ?id=… gör granskningen delbar och överlever en omladdning. Läses ur
  // window.location — useSearchParams kräver Suspense och har hängt här förut.
  useEffect(() => {
    const befintligt = new URLSearchParams(window.location.search).get("id");
    if (!befintligt) return;
    setLage("analyserar");
    fetchJson<HamtaSvar>(`/api/onboarding/${encodeURIComponent(befintligt)}`)
      .then((d) => {
        const f = d.forslag ?? d.analys?.forslag ?? null;
        if (d.fel) setFel({ rubrik: "Körningen stannade på ett fel", text: d.fel });
        if (!d.analys || !f) {
          if (!d.fel) setFel({ rubrik: "Analysen gick inte att hämta", text: "Körningen saknar både analys och förslag." });
          setLage("tom");
          return;
        }
        setId(d.id); setAnalys(d.analys); setForslag(f);
        ursprung.current = d.analys.forslag;
        // Har kontot redan provisionerats visas stegen direkt, så man ser vad som hände.
        if (d.steg && d.steg.length > 0) {
          setProv({
            ok: d.status === "klar",
            steg: d.steg,
            client_id: d.client_id ?? undefined,
            ghl_location_id: d.ghl_location_id ?? undefined,
          });
        }
        setLage("granska");
      })
      .catch((e: Error) => { setFel({ rubrik: "Analysen gick inte att hämta", text: e.message }); setLage("tom"); });
  }, []);

  useEffect(() => {
    if (lage !== "analyserar") return;
    setSek(0);
    const t = setInterval(() => setSek((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [lage]);

  async function analysera() {
    if (!url.trim()) return;
    setFel(null); setProv(null); setLage("analyserar");
    try {
      const d = await fetchJson<AnalysSvar>("/api/onboarding/analysera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), epost: epost.trim() || undefined }),
      });
      setId(d.id); setAnalys(d.analys); setForslag(d.analys.forslag);
      ursprung.current = d.analys.forslag;
      window.history.replaceState(null, "", `?id=${encodeURIComponent(d.id)}`);
      setLage("granska");
    } catch (e) {
      // 422 = sajten gick inte att läsa. Då visas felet stort — aldrig ett tomt formulär.
      setFel({
        rubrik: "Sajten gick inte att läsa",
        text: e instanceof Error ? e.message : "Analysen misslyckades.",
        hjalp: "Kontrollera adressen, eller testa med och utan www. Vi fyller hellre i noll fält än fel fält.",
      });
      setLage("tom");
    }
  }

  // Håkans ändring vinner alltid: källan blir "manuell" och beläggen nollas,
  // eftersom ett citat från sajten inte längre belägger ett omskrivet värde.
  const satt = useCallback((nyckel: ForslagNyckel, nyttVarde: unknown) => {
    setSparat(false);
    setForslag((f) => {
      if (!f) return f;
      const original = ursprung.current ? (ursprung.current[nyckel] as Falt<unknown>) : null;
      // ONBOARD-2: när Håkan väljer eller skriver är konflikten avgjord — `konflikt`
      // nollställs, annars ligger varningsrutan kvar efter att valet redan är gjort.
      const nytt: Falt<unknown> = arTomt(nyttVarde)
        ? {
            varde: null, kalla: null, kallUrl: null, konflikt: null, citat: null, sakerhet: null,
            saknasVarfor: original?.saknasVarfor ?? "Du tömde fältet.",
          }
        : {
            varde: nyttVarde, kalla: "manuell", kallUrl: null, konflikt: null, citat: null,
            sakerhet: "hog", saknasVarfor: null,
          };
      return { ...(f as object), [nyckel]: nytt } as unknown as Forslag;
    });
  }, []);

  async function spara(): Promise<boolean> {
    if (!id || !forslag) return false;
    setSparar(true);
    try {
      await fetchJson(`/api/onboarding/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forslag }),
      });
      setSparat(true);
      return true;
    } catch (e) {
      setFel({
        rubrik: "Ändringarna kunde inte sparas",
        text: e instanceof Error ? e.message : "Kunde inte spara.",
      });
      return false;
    } finally {
      setSparar(false);
    }
  }

  async function provisionera() {
    if (!id) return;
    setProvisionerar(true); setFel(null);
    const sparades = await spara();
    if (!sparades) { setProvisionerar(false); return; }
    try {
      const d = await fetchJson<ProvSvar>(`/api/onboarding/${encodeURIComponent(id)}/provisionera`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torrkorning }),
      });
      setProv(d);
      setVisaRuta(false);
    } catch (e) {
      setFel({
        rubrik: "Provisioneringen kunde inte köras",
        text: e instanceof Error ? e.message : "Provisioneringen misslyckades.",
      });
      setVisaRuta(false);
    } finally {
      setProvisionerar(false);
    }
  }

  const ifyllda = useMemo(() => {
    if (!forslag) return 0;
    return ALLA_FALT.filter((d) => harVarde(forslag[d.nyckel] as Falt<unknown>)).length;
  }, [forslag]);

  return (
    <div className="space-y-8 pb-16">
      <DashHero
        title="Onboarding av ny kund"
        subtitle="Klistra in kundens webbadress. Vi läser sajten och fyller i ett förslag som du granskar — inget skapas förrän du säger till."
        icon={Rocket}
        accent={primaryColor}
        eyebrow={<LivePill label="Onboarding" />}
        chips={
          analys ? (
            <>
              <HeroChip icon={Globe} label={`${analys.skrap.lastaSidor.length} lästa sidor`} />
              <HeroChip icon={CheckCircle2} label={`${ifyllda} av ${ALLA_FALT.length} fält ifyllda`} />
              {analys.skrap.missar.length > 0 && (
                <HeroChip icon={AlertTriangle} label={`${analys.skrap.missar.length} sidor gick inte att läsa`} />
              )}
            </>
          ) : undefined
        }
      />

      {fel && <Felruta fel={fel} onStang={() => setFel(null)} />}

      {lage === "tom" && (
        <StartLage
          url={url} setUrl={setUrl} epost={epost} setEpost={setEpost}
          primaryColor={primaryColor} onKor={analysera}
        />
      )}

      {lage === "analyserar" && <VantLage url={url} sek={sek} />}

      {lage === "granska" && analys && forslag && (
        <>
          <SkrapSammanfattning analys={analys} ifyllda={ifyllda} />

          <div key={id ?? "form"} className="space-y-6">
            {SEKTIONER.map((sek) => {
              const falt = ALLA_FALT.filter(
                (d) => sektionFor(d.nyckel, forslag[d.nyckel] as Falt<unknown>) === sek.id,
              );
              if (!falt.length) return null;
              return (
                <section key={sek.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${sek.ton}`}>
                      {sek.id === "val" ? (
                        <AlertTriangle className="h-[18px] w-[18px]" />
                      ) : sek.id === "belagd_tolkning" ? (
                        <Sparkles className="h-[18px] w-[18px]" />
                      ) : sek.id === "direkt" ? (
                        <Building2 className="h-[18px] w-[18px]" />
                      ) : (
                        <MinusCircle className="h-[18px] w-[18px]" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-bold text-gray-900">
                        {sek.titel}
                        <span className="ml-2 text-sm font-medium text-gray-400">{falt.length}</span>
                      </h2>
                      <p className="text-xs text-gray-500">{sek.beskrivning}</p>
                    </div>
                  </header>
                  <div className="divide-y divide-gray-100">
                    {falt.map((d) => (
                      <FaltRad
                        key={d.nyckel}
                        def={d}
                        falt={forslag[d.nyckel] as Falt<unknown>}
                        onChange={(v) => satt(d.nyckel, v)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {prov && <Provisioneringssvar prov={prov} />}

          <div className="sticky bottom-0 -mx-4 border-t border-gray-100 bg-white/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                {sparat ? "Ändringarna är sparade." : "Ändringar sparas när du klickar Spara utkast eller godkänner."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void spara()}
                  disabled={sparar}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {sparar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Spara utkast
                </button>
                <button
                  onClick={() => setVisaRuta(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ background: primaryColor }}
                >
                  <Rocket className="h-4 w-4" />
                  Godkänn och skapa kontot
                </button>
              </div>
            </div>
          </div>

          {visaRuta && (
            <Bekraftelseruta
              forslag={forslag}
              primaryColor={primaryColor}
              torrkorning={torrkorning}
              setTorrkorning={setTorrkorning}
              arbetar={provisionerar}
              onAvbryt={() => setVisaRuta(false)}
              onKor={provisionera}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Startläge ───────────────────────────────────────────────────────────────
function StartLage({
  url, setUrl, epost, setEpost, primaryColor, onKor,
}: {
  url: string; setUrl: (v: string) => void; epost: string; setEpost: (v: string) => void;
  primaryColor: string; onKor: () => void;
}) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${primaryColor}1a` }}>
          <Search className="h-5 w-5" style={{ color: primaryColor }} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900">Kundens webbadress</h2>
          <p className="text-xs text-gray-500">Det är allt vi behöver för att komma igång.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="onb-url" className="mb-1.5 block text-sm font-medium text-gray-700">
            Webbadress
          </label>
          <input
            id="onb-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onKor(); }}
            placeholder="kundensdoman.se"
            inputMode="url"
            autoComplete="off"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="onb-epost" className="mb-1.5 block text-sm font-medium text-gray-700">
            E-post för inloggning <span className="font-normal text-gray-400">— frivilligt</span>
          </label>
          <input
            id="onb-epost"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onKor(); }}
            placeholder="namn@kund.se"
            type="email"
            autoComplete="off"
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Hittar vi en adress på sajten fyller vi i den åt dig. Fyll bara i här om du vet en bättre.
          </p>
        </div>
        <button
          onClick={onKor}
          disabled={!url.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
          style={{ background: primaryColor }}
        >
          <Sparkles className="h-4 w-4" />
          Analysera sajten
        </button>
        <p className="text-xs text-gray-500">Analysen tar 20–40 sekunder. Låt fliken vara öppen.</p>
      </div>
    </section>
  );
}

// ── Väntläge ────────────────────────────────────────────────────────────────
const FASER = [
  { vid: 0, text: "Hämtar startsidan" },
  { vid: 6, text: "Letar upp kontakt, tjänster och priser" },
  { vid: 14, text: "Läser sidorna och plockar ut fakta" },
  { vid: 24, text: "Sätter ihop förslaget" },
];

function VantLage({ url, sek }: { url: string; sek: number }) {
  const aktiv = FASER.filter((f) => sek >= f.vid).length - 1;
  const andel = Math.min(95, Math.round((sek / 40) * 100));
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-gray-900">Läser sajten</h2>
          <p className="truncate text-xs text-gray-500">{url || "Hämtar sparad analys…"}</p>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${andel}%` }} />
      </div>

      <ol className="mt-5 space-y-2.5">
        {FASER.map((f, i) => (
          <li key={f.text} className="flex items-center gap-2.5 text-sm">
            {i < aktiv ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            ) : i === aktiv ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-indigo-500" />
            ) : (
              <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
            )}
            <span className={i <= aktiv ? "text-gray-900" : "text-gray-400"}>{f.text}</span>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-xs text-gray-500">
        Det tar 20–40 sekunder. <span className="tabular-nums">{sek} s</span> hittills. Stäng inte fliken.
      </p>
    </section>
  );
}

// ── Fel ─────────────────────────────────────────────────────────────────────
function Felruta({ fel, onStang }: { fel: Fel; onStang: () => void }) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-rose-900">{fel.rubrik}</h2>
          <p className="mt-1 text-sm text-rose-800">{fel.text}</p>
          {fel.hjalp && <p className="mt-2 text-xs text-rose-700">{fel.hjalp}</p>}
        </div>
        <button onClick={onStang} className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">
          Stäng
        </button>
      </div>
    </section>
  );
}

// ── Sammanfattning av skrapningen ───────────────────────────────────────────
function SkrapSammanfattning({ analys, ifyllda }: { analys: Analys; ifyllda: number }) {
  const s = analys.skrap;
  const saknas = ALLA_FALT.length - ifyllda;
  const tiles: { label: string; value: number; sub: string; icon: React.ComponentType<{ className?: string }>; tone: Tone }[] = [
    { label: "Lästa sidor", value: s.lastaSidor.length, sub: "på kundens sajt", icon: Globe, tone: "blue" },
    { label: "Ifyllda fält", value: ifyllda, sub: `av ${ALLA_FALT.length}`, icon: CheckCircle2, tone: "emerald" },
    { label: "Fält som saknas", value: saknas, sub: "med förklaring", icon: MinusCircle, tone: saknas > 0 ? "amber" : "slate" },
    { label: "Sidor vi missade", value: s.missar.length, sub: "gick inte att läsa", icon: AlertTriangle, tone: s.missar.length > 0 ? "amber" : "slate" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-gray-900">Så här läste vi sajten</h2>
        <a
          href={s.rotUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900"
        >
          {s.rotUrl.replace(/^https?:\/\//, "")} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map((t, i) => (
          <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} icon={t.icon} tone={t.tone} i={i} />
        ))}
      </div>

      {s.varning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{s.varning}</p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              s.behovdeRendering ? "bg-amber-50 text-amber-800 ring-amber-200/70" : "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
            }`}
          >
            {s.behovdeRendering ? <RefreshCw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {s.behovdeRendering
              ? "Sajten behövde renderas — den är JS-driven eller blockerade oss"
              : "Läst direkt, ingen rendering behövdes"}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Sidor vi läste</div>
          <ul className="flex flex-wrap gap-2">
            {s.lastaSidor.map((p) => (
              <li key={p.url}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 hover:border-gray-300"
                >
                  <span className="font-semibold">{ROLL_TEXT[p.roll] ?? p.roll}</span>
                  <span className="truncate text-gray-400">{p.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                  <span className="tabular-nums text-gray-400">{Math.round(p.tecken / 1000)}k tecken</span>
                  {p.via === "rendering" && <span className="text-amber-600">renderad</span>}
                </a>
              </li>
            ))}
            {s.lastaSidor.length === 0 && <li className="text-xs text-gray-400">Ingen sida kunde läsas.</li>}
          </ul>
        </div>

        {s.missar.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Sidor som inte gick att läsa
            </div>
            <ul className="space-y-1.5">
              {s.missar.map((m) => (
                <li key={m.url} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-medium text-gray-700">{m.url}</span>
                  {m.status !== null && <span className="tabular-nums text-rose-600">HTTP {m.status}</span>}
                  <span className="text-gray-500">{m.orsak}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ── En fältrad ──────────────────────────────────────────────────────────────
function FaltRad({ def, falt, onChange }: { def: FaltDef; falt: Falt<unknown>; onChange: (v: unknown) => void }) {
  const finns = harVarde(falt);
  const kalla = falt.kalla ? KALLA[falt.kalla] : null;
  const klass = klassAv(falt.kalla);
  const klassEtikett = klass ? KLASS_ETIKETT[klass] : null;
  const konflikter = (falt.konflikt ?? []) as Konflikt<unknown>[];
  const harKonflikt = konflikter.length > 1;
  // Ett standardvärde på ett fält som INTE står på undantagslistan är ett fel i motorn,
  // inte ett värde. Grinden i index.ts ska ha tömt det — syns det ändå ska det synas skarpt.
  const otillatenStandard = falt.kalla === "standard" && !arStandardTillaten(def.nyckel);

  return (
    <div className={`px-4 py-4 sm:px-5 ${harKonflikt ? "bg-rose-50/40" : finns ? "" : "bg-amber-50/40"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-sm font-semibold text-gray-900">{def.etikett}</span>
        <span className="text-xs text-gray-400">{GRUPP_FOR_FALT.get(def.nyckel)}</span>
        {klassEtikett && finns && (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${klassEtikett.chip}`}>
            {klassEtikett.text}
          </span>
        )}
        {kalla ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${kalla.chip}`}>
            {kalla.text}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200/70">
            Saknas
          </span>
        )}
        {falt.sakerhet === "lag" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200/70">
            <AlertTriangle className="h-3 w-3" /> Låg säkerhet — kontrollera
          </span>
        )}
        {falt.kallUrl && (
          <a
            href={falt.kallUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Se källan <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {!finns && falt.saknasVarfor && (
        <p className="mb-2 flex items-start gap-2 text-xs text-amber-900">
          <MinusCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
          <span>{falt.saknasVarfor}</span>
        </p>
      )}

      {/* Standardvärde ska aldrig se ut som ett läst värde. */}
      {falt.kalla === "standard" && finns && (
        <p className="mb-2 flex items-start gap-2 text-xs text-amber-900">
          <MinusCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
          <span>
            {otillatenStandard
              ? "Standardvärde utan belägg på ett fält som inte kräver det. Detta ska inte hända — kontrollera värdet innan du godkänner."
              : "Inget belägg hittades på sajten. Värdet är vårt standardval, som GoHighLevel kräver för att kunna skapa kontot."}
          </span>
        </p>
      )}

      {/* ONBOARD-2: konflikten. Motorn väljer aldrig tyst — Håkan väljer. */}
      {harKonflikt && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <p className="mb-2 flex items-start gap-2 text-xs font-semibold text-rose-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Källorna säger olika. Välj vilken som gäller — inget väljs åt dig.</span>
          </p>
          <div className="space-y-1.5">
            {konflikter.map((k, i) => {
              const text = typeof k.varde === "string" ? k.varde : JSON.stringify(k.varde);
              const vald = JSON.stringify(k.varde) === JSON.stringify(falt.varde);
              return (
                <button
                  key={`${text}-${i}`}
                  type="button"
                  onClick={() => onChange(k.varde)}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                    vald
                      ? "border-rose-300 bg-white font-semibold text-gray-900"
                      : "border-transparent bg-white/70 text-gray-700 hover:border-rose-200 hover:bg-white"
                  }`}
                >
                  {vald ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-600" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                  )}
                  <span className="min-w-0">
                    <span className="block break-words">{text}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {KALLA[k.kalla]?.text ?? k.kalla}
                      {k.kallUrl ? ` · ${k.kallUrl}` : ""}
                    </span>
                    {k.citat && (
                      <span className="mt-0.5 block break-words text-xs italic text-gray-400">”{k.citat}”</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Redigerare def={def} falt={falt} onChange={onChange} />

      {falt.citat && (
        <blockquote className="mt-2 flex items-start gap-2 border-l-2 border-gray-200 pl-3 text-xs italic text-gray-500">
          <Quote className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-300" />
          <span>{falt.citat}</span>
        </blockquote>
      )}
    </div>
  );
}

function Redigerare({ def, falt, onChange }: { def: FaltDef; falt: Falt<unknown>; onChange: (v: unknown) => void }) {
  const v = falt.varde;

  if (def.editor === "text") {
    return (
      <input
        value={typeof v === "string" ? v : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.platshallare ?? "Fyll i själv om du vet"}
        className={INPUT}
      />
    );
  }

  if (def.editor === "lang") {
    return (
      <textarea
        value={typeof v === "string" ? v : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={def.platshallare ?? "Fyll i själv om du vet"}
        className={`${INPUT} resize-y`}
      />
    );
  }

  if (def.editor === "nummer") {
    return (
      <input
        value={typeof v === "number" ? String(v) : ""}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".").trim();
          const n = Number(t);
          onChange(t === "" || Number.isNaN(n) ? null : n);
        }}
        inputMode="decimal"
        placeholder="—"
        className={`${INPUT} max-w-[10rem] tabular-nums`}
      />
    );
  }

  if (def.editor === "lista" || def.editor === "citatlista") {
    const rader = Array.isArray(v) ? (v as string[]) : [];
    const lang = def.editor === "citatlista";
    return (
      <div className="space-y-2">
        {rader.map((rad, i) => (
          <div key={i} className="flex items-start gap-2">
            {lang ? (
              <textarea
                value={rad}
                rows={2}
                onChange={(e) => onChange(rader.map((r, j) => (j === i ? e.target.value : r)))}
                className={`${INPUT} resize-y`}
              />
            ) : (
              <input
                value={rad}
                onChange={(e) => onChange(rader.map((r, j) => (j === i ? e.target.value : r)))}
                className={INPUT}
              />
            )}
            <TaBort onClick={() => onChange(rader.filter((_, j) => j !== i))} />
          </div>
        ))}
        <LaggTill onClick={() => onChange([...rader, ""])} text="Lägg till rad" />
      </div>
    );
  }

  if (def.editor === "farger") {
    const farger = Array.isArray(v) ? (v as string[]) : [];
    return (
      <div className="space-y-2">
        {farger.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-9 w-9 flex-shrink-0 rounded-lg border border-gray-200"
              style={{ background: /^#[0-9a-fA-F]{3,8}$/.test(f) ? f : "#ffffff" }}
              aria-hidden="true"
            />
            <input
              value={f}
              onChange={(e) => onChange(farger.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="#1a1a1a"
              className={`${INPUT} max-w-[12rem]`}
            />
            <TaBort onClick={() => onChange(farger.filter((_, j) => j !== i))} />
          </div>
        ))}
        <LaggTill onClick={() => onChange([...farger, "#"])} text="Lägg till färg" />
      </div>
    );
  }

  if (def.editor === "tjanster") {
    const rader = Array.isArray(v) ? (v as Tjanst[]) : [];
    return (
      <div className="space-y-2">
        {rader.length > 0 && (
          <div className="hidden gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:flex">
            <span className="flex-1">Tjänst</span>
            <span className="w-40">Pris, som det står</span>
            <span className="w-9" />
          </div>
        )}
        {rader.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={r.namn}
              onChange={(e) => onChange(rader.map((x, j) => (j === i ? { ...x, namn: e.target.value } : x)))}
              placeholder="Tjänstens namn"
              className={INPUT}
            />
            <div className="flex items-center gap-2">
              <input
                value={r.pris ?? ""}
                onChange={(e) =>
                  onChange(rader.map((x, j) => (j === i ? { ...x, pris: e.target.value || null } : x)))
                }
                placeholder="1 445 kr"
                className={`${INPUT} sm:w-40`}
              />
              <TaBort onClick={() => onChange(rader.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
        <LaggTill onClick={() => onChange([...rader, { namn: "", pris: null }])} text="Lägg till tjänst" />
      </div>
    );
  }

  if (def.editor === "oppettider") {
    const rader = Array.isArray(v) ? (v as Oppettid[]) : [];
    return (
      <div className="space-y-2">
        {rader.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={r.dag}
              onChange={(e) => onChange(rader.map((x, j) => (j === i ? { ...x, dag: e.target.value } : x)))}
              placeholder="Måndag"
              className={`${INPUT} sm:w-44`}
            />
            <div className="flex items-center gap-2">
              <input
                value={r.tider}
                onChange={(e) => onChange(rader.map((x, j) => (j === i ? { ...x, tider: e.target.value } : x)))}
                placeholder="08:00–17:00"
                className={INPUT}
              />
              <TaBort onClick={() => onChange(rader.filter((_, j) => j !== i))} />
            </div>
          </div>
        ))}
        <LaggTill onClick={() => onChange([...rader, { dag: "", tider: "" }])} text="Lägg till dag" />
      </div>
    );
  }

  // lankar
  return <LankarRedigerare varde={(v as Record<string, string>) ?? {}} onChange={onChange} />;
}

// Egen state här: nyckeln är själva fältet, och att bygga om objektet under
// skrivningen skulle slå ihop två halvskrivna rader med samma namn.
function LankarRedigerare({
  varde, onChange,
}: { varde: Record<string, string>; onChange: (v: unknown) => void }) {
  const [rader, setRader] = useState<{ namn: string; url: string }[]>(() =>
    Object.entries(varde ?? {}).map(([namn, url]) => ({ namn, url })),
  );

  function skicka(nya: { namn: string; url: string }[]) {
    setRader(nya);
    const rec: Record<string, string> = {};
    for (const r of nya) if (r.namn.trim()) rec[r.namn.trim()] = r.url;
    onChange(Object.keys(rec).length ? rec : null);
  }

  return (
    <div className="space-y-2">
      {rader.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={r.namn}
            onChange={(e) => skicka(rader.map((x, j) => (j === i ? { ...x, namn: e.target.value } : x)))}
            placeholder="Facebook"
            className={`${INPUT} sm:w-44`}
          />
          <div className="flex items-center gap-2">
            <Link2 className="hidden h-4 w-4 flex-shrink-0 text-gray-300 sm:block" />
            <input
              value={r.url}
              onChange={(e) => skicka(rader.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              className={INPUT}
            />
            <TaBort onClick={() => skicka(rader.filter((_, j) => j !== i))} />
          </div>
        </div>
      ))}
      <LaggTill onClick={() => skicka([...rader, { namn: "", url: "" }])} text="Lägg till kanal" />
    </div>
  );
}

function TaBort({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ta bort raden"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function LaggTill({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-900"
    >
      <Plus className="h-3.5 w-3.5" /> {text}
    </button>
  );
}

// ── Bekräftelse före provisionering ─────────────────────────────────────────
function strang(f: Falt<unknown>): string | null {
  return typeof f.varde === "string" && f.varde.trim() ? f.varde.trim() : null;
}
function antal(f: Falt<unknown>): number {
  return Array.isArray(f.varde) ? f.varde.length : 0;
}

function Bekraftelseruta({
  forslag, primaryColor, torrkorning, setTorrkorning, arbetar, onAvbryt, onKor,
}: {
  forslag: Forslag; primaryColor: string; torrkorning: boolean;
  setTorrkorning: (v: boolean) => void; arbetar: boolean; onAvbryt: () => void; onKor: () => void;
}) {
  const namn = strang(forslag.foretagsnamn) ?? "Kunden (namn saknas)";
  const punkter: string[] = [
    `Kund i Cockpit: ${namn}`,
    `Konto i MySales${strang(forslag.ort) ? ` — ${strang(forslag.ort)}, ${strang(forslag.land) ?? "land saknas"}` : ""}${
      strang(forslag.tidszon) ? `, tidszon ${strang(forslag.tidszon)}` : ""
    }`,
    `Brand-profil: ${strang(forslag.bransch) ?? "bransch saknas"}, tonläge ${strang(forslag.tonlage) ?? "saknas"}`,
    `${antal(forslag.erbjudanden)} tjänster, ${antal(forslag.smartpunkter)} smärtpunkter, ${antal(forslag.kundcitat)} kundcitat`,
  ];
  const epost = strang(forslag.epost);
  punkter.push(epost ? `Inloggning kopplas till ${epost}` : "Ingen e-post ifylld — inloggningen får kopplas manuellt");

  // Rutan renderas bara efter ett klick, alltså aldrig under serverrenderingen.
  if (typeof document === "undefined") return null;

  // Portal: en fixed overlay inuti dashboard-innehållet kan fångas av en
  // transformerad förälder och hamna fel. Body är alltid rätt.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${primaryColor}1a` }}>
            <Rocket className="h-5 w-5" style={{ color: primaryColor }} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">Det här skapas nu</h2>
            <p className="text-xs text-gray-500">Läs igenom innan du kör. Inget har skapats än.</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {punkter.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-gray-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <input
            type="checkbox"
            checked={torrkorning}
            onChange={(e) => setTorrkorning(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded"
          />
          <span className="text-xs text-gray-700">
            <span className="font-semibold text-gray-900">Testkör först.</span> Visar alla steg utan att något skapas
            på riktigt.
          </span>
        </label>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            onClick={onKor}
            disabled={arbetar}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: primaryColor }}
          >
            {arbetar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {torrkorning ? "Testkör" : "Ja, skapa kontot"}
          </button>
          <button
            onClick={onAvbryt}
            disabled={arbetar}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Resultat av provisioneringen ────────────────────────────────────────────
// Statusarna kommer från lib/onboard/provisionera: klar | hoppade | fel | torr.
function StegIkon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "fel") return <XCircle className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-rose-500" />;
  if (s === "hoppade") return <MinusCircle className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-gray-300" />;
  if (s === "torr") return <Circle className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-indigo-400" />;
  if (s === "klar") return <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-emerald-500" />;
  return <Circle className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-gray-300" />;
}

function Provisioneringssvar({ prov }: { prov: ProvSvar }) {
  const klientId = prov.client_id ?? prov.clientId ?? null;
  const locationId = prov.ghl_location_id ?? prov.ghlLocationId ?? null;
  const inloggningsUrl = prov.inloggnings_url ?? prov.inloggningsUrl ?? null;
  const torr = prov.torrkorning === true;

  const ram = torr
    ? "border-indigo-200 bg-indigo-50/50"
    : prov.ok
    ? "border-emerald-200 bg-emerald-50/50"
    : "border-rose-200 bg-rose-50/60";

  return (
    <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${ram}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            torr ? "bg-indigo-100" : prov.ok ? "bg-emerald-100" : "bg-rose-100"
          }`}
        >
          {prov.ok ? (
            <CheckCircle2 className={`h-5 w-5 ${torr ? "text-indigo-600" : "text-emerald-600"}`} />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-gray-900">
            {torr ? "Testkörning klar — inget skapades" : prov.ok ? "Klart, kontot är skapat" : "Något steg gick fel"}
          </h2>
          <p className="text-xs text-gray-600">{prov.steg.length} steg kördes. Resultat per steg nedan.</p>
        </div>
      </div>

      {prov.fel && (
        <p className="mt-4 rounded-xl bg-white/80 px-3 py-2.5 text-sm text-rose-800">{prov.fel}</p>
      )}

      <ul className="mt-4 space-y-2.5">
        {prov.steg.map((s, i) => (
          <li key={`${s.namn}-${i}`} className="flex items-start gap-2.5 rounded-xl bg-white/70 px-3 py-2.5">
            <StegIkon status={s.status} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">{s.namn}</div>
              {s.detalj && <div className="text-xs text-gray-600">{s.detalj}</div>}
            </div>
          </li>
        ))}
      </ul>

      {(klientId || locationId || inloggningsUrl) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/70 pt-4 text-xs">
          {inloggningsUrl && (
            <a
              href={inloggningsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 font-semibold text-white hover:bg-gray-800"
            >
              Öppna kundens inloggning <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {klientId && (
            <span className="rounded-lg bg-white px-2.5 py-2 text-gray-700">
              Klient-id <span className="font-mono">{klientId}</span>
            </span>
          )}
          {locationId && (
            <span className="rounded-lg bg-white px-2.5 py-2 text-gray-700">
              MySales-konto <span className="font-mono">{locationId}</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
