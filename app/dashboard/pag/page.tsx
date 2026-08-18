"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PauseCircle,
  RefreshCw,
  Sun,
  TrendingUp,
} from "lucide-react";
import { DashHero, HeroChip, LivePill, StatTile } from "@/components/ui/dash";

// PÅ G — överblicken. En sida som svarar på "vad ska jag göra härnäst, och i vilken
// ordning", sorterad på nästa åtgärdsdatum i stället för på steg eller belopp.
//
// Varje rad leder till SAMMA kort som Fokus idag, Dagens drag och städningen pekar på
// (/dashboard/driv/<id>) — en affär, ett kort, ingen parallell yta.

interface PagRad {
  id: string;
  namn: string;
  foretag: string | null;
  kontakt: string | null;
  stegNamn: string | null;
  varde: number;
  nastaSteg: string | null;
  nastaDatum: string | null;
  dagarTill: number | null;
  dagarISteget: number | null;
  ghlContactId: string | null;
}
interface PagSvar {
  idag: string;
  senastSynkad: string | null;
  synkFel: string | null;
  fack: { forsenat: PagRad[]; idag: PagRad[]; kommande: PagRad[]; utanPlan: PagRad[]; vilande: PagRad[] };
  summa: { iSpel: number; antalISpel: number; utanPlan: number; vilande: number };
  error?: string;
}

const kr = (v: number) => v.toLocaleString("sv-SE") + " kr";

/** "i dag", "i morgon", "om 3 dagar", "2 dagar sen" — läsbart utan att räkna själv. */
function nardagText(dagar: number | null): string {
  if (dagar === null) return "ingen plan";
  if (dagar === 0) return "i dag";
  if (dagar === 1) return "i morgon";
  if (dagar === -1) return "1 dag sen";
  if (dagar < 0) return `${Math.abs(dagar)} dagar sen`;
  return `om ${dagar} dagar`;
}

function datumKort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export default function PagPage() {
  const [primary, setPrimary] = useState("#4f46e5");
  const [data, setData] = useState<PagSvar | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [synkar, setSynkar] = useState(false);
  const [visaVilande, setVisaVilande] = useState(false);

  const ladda = useCallback(async (tvinga = false) => {
    if (tvinga) setSynkar(true);
    try {
      const r = await fetch(`/api/pag${tvinga ? "?synk=1" : ""}`);
      setData(await r.json());
    } finally {
      setLaddar(false);
      setSynkar(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
    ladda();
  }, [ladda]);

  if (laddar) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Hämtar läget…
      </div>
    );
  }
  if (!data || data.error) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-sm text-gray-600">
        {data?.error || "Kunde inte läsa pipelinen."}
      </div>
    );
  }

  const { fack, summa } = data;
  const attGoraNu = fack.forsenat.length + fack.idag.length;

  return (
    <div className="space-y-8">
      <DashHero
        title="På G"
        subtitle="Alla affärer i spel, i den ordning de behöver dig. Klicka en rad för att öppna kortet."
        accent={primary}
        icon={TrendingUp}
        eyebrow={<LivePill label={synkar ? "synkar" : "live ur MySales"} />}
        chips={
          <>
            <HeroChip icon={CalendarClock} label={`${attGoraNu} att göra nu`} />
            <HeroChip icon={TrendingUp} label={`${kr(summa.iSpel)} i spel`} />
            <HeroChip icon={PauseCircle} label={`${summa.vilande} vilande`} />
          </>
        }
        right={
          <button
            onClick={() => ladda(true)}
            disabled={synkar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 disabled:opacity-50"
          >
            {synkar ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Uppdatera nu
          </button>
        }
      />

      {data.synkFel && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Spegeln kunde inte uppdateras: {data.synkFel} Siffrorna nedan är från{" "}
          {data.senastSynkad ? new Date(data.senastSynkad).toLocaleString("sv-SE") : "en tidigare körning"}.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Försenat" value={fack.forsenat.length} icon={AlertTriangle} tone="amber" i={0} />
        <StatTile label="I dag" value={fack.idag.length} icon={Sun} tone="blue" i={1} />
        <StatTile label="Framåt" value={fack.kommande.length} icon={CalendarClock} tone="emerald" i={2} />
        <StatTile label="Utan plan" value={summa.utanPlan} sub="riskerar tyst död" icon={AlertTriangle} tone="slate" i={3} />
      </div>

      <Sektion
        rubrik="Försenat"
        hjalp="Datumet har passerat. Börja här."
        rader={fack.forsenat}
        primary={primary}
        ton="amber"
        tomText="Inget försenat — snyggt."
      />
      <Sektion
        rubrik="I dag"
        hjalp={`Planerat till ${datumKort(data.idag)}.`}
        rader={fack.idag}
        primary={primary}
        ton="blue"
        tomText="Inget inplanerat i dag."
      />
      <Sektion
        rubrik="Framåt"
        hjalp="Har ett datum och sköter sig själv tills dess."
        rader={fack.kommande}
        primary={primary}
        ton="emerald"
        tomText="Inget planerat framåt."
      />
      <Sektion
        rubrik="Utan plan"
        hjalp="Ingen nästa åtgärd satt. Äldst i steget överst — det är de som tyst dör."
        rader={fack.utanPlan}
        primary={primary}
        ton="slate"
        tomText="Varje affär har en plan. Ovanligt bra läge."
      />

      {/* Vilande ligger utanför standardvyn med flit — parkerat är inte pågående.
          De vaknar av sig själva när återkontaktdatumet infaller. */}
      <section className="space-y-3">
        <button
          onClick={() => setVisaVilande((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900"
        >
          <PauseCircle className="w-4 h-4" />
          Vilande ({summa.vilande})
          <ArrowRight className={`w-4 h-4 transition-transform ${visaVilande ? "rotate-90" : ""}`} />
        </button>
        {visaVilande && (
          <Sektion rubrik="" hjalp="" rader={fack.vilande} primary={primary} ton="slate" tomText="Inget parkerat." />
        )}
      </section>
    </div>
  );
}

const TON_UI: Record<string, { bricka: string; ikon: string; chip: string }> = {
  amber: { bricka: "bg-amber-100", ikon: "text-amber-600", chip: "bg-amber-50 text-amber-700" },
  blue: { bricka: "bg-blue-100", ikon: "text-blue-600", chip: "bg-blue-50 text-blue-700" },
  emerald: { bricka: "bg-emerald-100", ikon: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700" },
  slate: { bricka: "bg-slate-100", ikon: "text-slate-600", chip: "bg-slate-100 text-slate-600" },
};

function Sektion({
  rubrik,
  hjalp,
  rader,
  primary,
  ton,
  tomText,
}: {
  rubrik: string;
  hjalp: string;
  rader: PagRad[];
  primary: string;
  ton: keyof typeof TON_UI;
  tomText: string;
}) {
  const ui = TON_UI[ton];
  return (
    <section className="space-y-3">
      {rubrik && (
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg">{rubrik}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{hjalp}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${ui.chip}`}>
            {rader.length}
          </span>
        </div>
      )}
      {rader.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-8 text-center text-sm text-gray-400 shadow-sm">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-gray-300" />
          {tomText}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
          {rader.map((r) => (
            <a
              key={r.id}
              href={`/dashboard/driv/${r.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ui.bricka}`}>
                <CalendarClock className={`w-[18px] h-[18px] ${ui.ikon}`} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-gray-900 truncate">{r.namn}</span>
                <span className="block text-xs text-gray-500 truncate mt-0.5">
                  {r.foretag && <span>{r.foretag} · </span>}
                  {r.stegNamn}
                  {r.dagarISteget !== null && <span> · {r.dagarISteget} dagar i steget</span>}
                </span>
              </span>

              <span className="hidden md:block min-w-0 flex-1">
                <span className="block text-sm text-gray-700 truncate">
                  {r.nastaSteg || <span className="text-gray-400">Ingen nästa åtgärd satt</span>}
                </span>
                {r.nastaDatum && (
                  <span className="block text-xs text-gray-500 mt-0.5 tabular-nums">
                    {datumKort(r.nastaDatum)} · {nardagText(r.dagarTill)}
                  </span>
                )}
              </span>

              <span className="text-right flex-shrink-0">
                <span className="block text-sm font-bold text-gray-900 tabular-nums">
                  {r.varde > 0 ? kr(r.varde) : <span className="text-gray-300 font-medium">okänt värde</span>}
                </span>
                <span className="block md:hidden text-xs text-gray-500 tabular-nums mt-0.5">
                  {nardagText(r.dagarTill)}
                </span>
              </span>

              <ArrowRight
                className="w-4 h-4 flex-shrink-0 text-gray-300 group-hover:translate-x-0.5 transition-transform"
                style={{ color: primary }}
              />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
