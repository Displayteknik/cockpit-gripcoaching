"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, AlertTriangle, Phone, Mail, Calendar, FileText, CheckSquare,
  MessageSquare, Check, X, RefreshCw, Tag, Reply, Send, StickyNote, CalendarClock,
  Search, ExternalLink, Paperclip,
} from "lucide-react";
import PipelineStegRad, { type StegInfo } from "@/components/PipelineStegRad";
import { CoachContextInput } from "@/components/FokusClient";
import { mysalesKontaktUrl } from "@/lib/mysales";

type SvarsData =
  | { kanal: "gmail"; tradId: string; messageIdHeader: string; motpart: string; amne: string }
  | { kanal: "ghl"; konversationTyp: string; motpart: string };

interface TidslinjePost {
  kalla: string; id: string; tidpunkt: string; riktning: "in" | "ut" | null;
  titel: string; snippet: string | null; kanalIkon: string; osaker?: boolean; lankId?: string;
  svar?: SvarsData; varning?: string; harBilaga?: boolean;
}
interface Prisrad {
  artikelnr: string; benamning: string; kategori: string | null; pris: number | null;
  enhet: string | null; franPris: boolean; giltigFran: string;
  tb?: { kr: number; pct: number; bastaInkopsvag: string | null };
}
interface DrivKort {
  lage: {
    ghlOpportunityId: string; ghlContactId: string | null; namn: string | null; foretag: string | null;
    epost: string | null; telefon: string | null; taggar: string[]; stegNamn: string | null;
    stegInfo: StegInfo | null; varde: number;
    dagarISteget: number | null; nastaSteg: { titel: string; datum: string } | null; saknarNastaSteg: boolean;
    locationId: string;
  };
  senasteKontakt: { text: string; bollenHos: "kund" | "oss" | "okant" };
  tidslinje: TidslinjePost[];
  foreslagnaLankar: Array<{ id: string; belagg: string; ref_typ: string }>;
  prislista: Prisrad[];
  offertForslag: { offertId: string; titel: string; datum: string } | null;
  fel: string[];
  hamtadTidsstampel: string;
  error?: string;
}

const KALLA_IKON: Record<string, React.ElementType> = {
  ghl_konversation: MessageSquare, gmail: Mail, kalender: Calendar, offert: FileText, uppgift: CheckSquare,
};

function kr(v: number) {
  return v.toLocaleString("sv-SE") + " kr";
}

function datumText(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function isoTillInputvarde(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
}

export default function DrivKortPage({ params }: { params: Promise<{ oppId: string }> }) {
  const { oppId } = usePromise(params);
  const [primary, setPrimary] = useState("#4f46e5");
  const [kort, setKort] = useState<DrivKort | null>(null);
  const [laddar, setLaddar] = useState(true);
  const [beslutar, setBeslutar] = useState<string | null>(null);

  // Svara
  const [utkastFor, setUtkastFor] = useState<string | null>(null);
  const [utkastText, setUtkastText] = useState("");
  const [genererar, setGenererar] = useState(false);
  const [skickar, setSkickar] = useState(false);
  const [skickaFel, setSkickaFel] = useState<string | null>(null);

  // Nästa steg
  const [nsRedigeras, setNsRedigeras] = useState(false);
  const [nsTitel, setNsTitel] = useState("");
  const [nsDatum, setNsDatum] = useState("");
  const [nsSparar, setNsSparar] = useState(false);

  // Anteckna
  const [noteringText, setNoteringText] = useState("");
  const [noteringSparar, setNoteringSparar] = useState(false);
  const [noteringKvitto, setNoteringKvitto] = useState<string | null>(null);

  // Pris + offert (DRIV-3)
  const [prisSok, setPrisSok] = useState("");
  const [offertForslagSparar, setOffertForslagSparar] = useState(false);
  const [offertForslagDold, setOffertForslagDold] = useState(false);

  // Läs hela mejlet — hämtas live på klick, sparas ingenstans (1C)
  const [lasFor, setLasFor] = useState<string | null>(null);
  const [lasText, setLasText] = useState("");
  const [lasar, setLasar] = useState(false);
  const [lasFel, setLasFel] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => { if (c?.primary_color) setPrimary(c.primary_color); }).catch(() => {});
  }, []);

  async function ladda() {
    setLaddar(true);
    try {
      const r = await fetch(`/api/driv/kort/${oppId}`);
      const d = await r.json();
      setKort(d);
      if (d?.lage) {
        setNsTitel(d.lage.nastaSteg?.titel || "Följ upp");
        setNsDatum(d.lage.nastaSteg ? isoTillInputvarde(d.lage.nastaSteg.datum) : isoTillInputvarde(new Date(Date.now() + 86400000).toISOString()));
      }
    } catch {
      setKort({ error: "Kunde inte nå servern. Kontrollera anslutningen och försök igen." } as unknown as DrivKort);
    } finally {
      setLaddar(false);
    }
  }

  useEffect(() => { ladda(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [oppId]);

  // DRIV-4: kommer man hit från "Dagens drag" (?auto=1) är utkastet redan förberett —
  // generera det direkt på det senaste inkommande meddelandet, ingen extra klick krävs.
  // Bara en gång: annars startar en ny generering vid varje "ladda()" (t.ex. efter Skicka).
  const [autoKord, setAutoKord] = useState(false);
  useEffect(() => {
    if (autoKord || !kort || kort.error) return;
    if (new URLSearchParams(window.location.search).get("auto") !== "1") return;
    const forsta = kort.tidslinje.find((t) => t.riktning === "in" && t.svar);
    if (forsta) genereraUtkast(forsta);
    setAutoKord(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kort]);

  async function beslutaLank(id: string, beslut: "bekraftad" | "avvisad") {
    setBeslutar(id);
    try {
      await fetch("/api/driv/lank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, beslut }) });
      await ladda();
    } finally {
      setBeslutar(null);
    }
  }

  // Läs hela mejlet live (1C: full kropp hämtas bara på klick, sparas aldrig).
  async function lasMeddelande(post: TidslinjePost) {
    if (lasFor === post.id) { setLasFor(null); return; } // klick igen = stäng
    setLasFor(post.id);
    setLasText("");
    setLasFel(null);
    setLasar(true);
    try {
      const r = await fetch(`/api/driv/meddelande?id=${encodeURIComponent(post.id)}`);
      const d = await r.json();
      if (d.error) { setLasFel(d.error); return; }
      setLasText(d.kropp || "(inget innehåll hittades)");
    } catch {
      setLasFel("Kunde inte hämta mejlet just nu.");
    } finally {
      setLasar(false);
    }
  }

  async function genereraUtkast(post: TidslinjePost) {
    if (!post.svar) return;
    setUtkastFor(post.id);
    setUtkastText("");
    setSkickaFel(null);
    setGenererar(true);
    try {
      const r = await fetch("/api/driv/utkast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oppId,
          kanal: post.svar.kanal,
          motpart: post.svar.motpart,
          amne: post.svar.kanal === "gmail" ? post.svar.amne : undefined,
          senasteText: post.snippet || "",
        }),
      });
      const d = await r.json();
      setUtkastText(d.text || "");
      if (d.error) setSkickaFel(d.error);
    } catch {
      setSkickaFel("Kunde inte skapa ett utkast just nu.");
    } finally {
      setGenererar(false);
    }
  }

  async function skickaUtkast(post: TidslinjePost) {
    if (!post.svar || !kort?.lage.ghlContactId || !utkastText.trim()) return;
    setSkickar(true);
    setSkickaFel(null);
    try {
      const r = await fetch("/api/driv/skicka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghlContactId: kort.lage.ghlContactId, text: utkastText.trim(), svar: post.svar }),
      });
      const d = await r.json();
      if (!d.ok) { setSkickaFel(d.error || "Kunde inte skicka."); return; }
      setUtkastFor(null);
      setUtkastText("");
      await ladda(); // 1D: verifierad vid nästa hämtning
    } catch {
      setSkickaFel("Kunde inte skicka just nu.");
    } finally {
      setSkickar(false);
    }
  }

  async function sparaNastaSteg() {
    if (!kort?.lage.ghlContactId || !nsTitel.trim() || !nsDatum) return;
    setNsSparar(true);
    try {
      const r = await fetch("/api/driv/nasta-steg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghlContactId: kort.lage.ghlContactId, titel: nsTitel.trim(), datum: new Date(nsDatum).toISOString() }),
      });
      const d = await r.json();
      if (!d.ok) { alert(d.error || "Kunde inte spara nästa steg."); return; }
      setNsRedigeras(false);
      await ladda();
    } finally {
      setNsSparar(false);
    }
  }

  // DRIV-3: Håkan godkänner förslaget om dag 3-uppföljning — ALDRIG automatiskt satt.
  async function godkannOffertForslag() {
    if (!kort?.lage.ghlContactId || !kort.offertForslag) return;
    setOffertForslagSparar(true);
    try {
      const r = await fetch("/api/driv/nasta-steg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghlContactId: kort.lage.ghlContactId, titel: kort.offertForslag.titel, datum: kort.offertForslag.datum }),
      });
      const d = await r.json();
      if (!d.ok) { alert(d.error || "Kunde inte spara uppföljningen."); return; }
      setOffertForslagDold(true);
      await ladda();
    } finally {
      setOffertForslagSparar(false);
    }
  }

  async function sparaNotering() {
    if (!kort?.lage.ghlContactId || !noteringText.trim()) return;
    setNoteringSparar(true);
    setNoteringKvitto(null);
    try {
      const r = await fetch("/api/driv/notering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ghlContactId: kort.lage.ghlContactId, text: noteringText.trim() }),
      });
      const d = await r.json();
      if (!d.ok) { setNoteringKvitto(d.error || "Kunde inte spara anteckningen."); return; }
      setNoteringText("");
      setNoteringKvitto("Sparad på kontakten i MySales.");
    } finally {
      setNoteringSparar(false);
    }
  }

  if (laddar && !kort) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Hämtar kortet…
      </div>
    );
  }

  if (!kort || kort.error) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <div className="text-gray-700 font-medium">{kort?.error || "Något gick fel."}</div>
        <button onClick={ladda} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ background: primary }}>
          <RefreshCw className="w-4 h-4" /> Försök igen
        </button>
      </div>
    );
  }

  const { lage, senasteKontakt, tidslinje, foreslagnaLankar, prislista, offertForslag, fel } = kort;
  const kanalNamn = (k: SvarsData) => (k.kanal === "gmail" ? "Gmail" : "MySales (samma kanal som tråden)");

  // Samma URL-mönster som Fokus idag redan använder för "Skapa offert" (FokusClient.tsx).
  const offertParams = new URLSearchParams({ kund: lage.namn || "", foretag: lage.foretag || "", opp: lage.ghlOpportunityId });
  if (lage.ghlContactId) offertParams.set("kontakt", lage.ghlContactId);
  const offertHref = `/dashboard/offert?${offertParams}`;
  const mysalesHref = mysalesKontaktUrl(lage.locationId, lage.ghlContactId);

  const prisTraffar = prislista.filter((p) => {
    const s = prisSok.trim().toLowerCase();
    if (!s) return true;
    return p.benamning.toLowerCase().includes(s) || p.artikelnr.toLowerCase().includes(s);
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href="/dashboard/fokus" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Tillbaka till Fokus idag
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-gray-900 text-2xl">{lage.namn || "Namnlös affär"}</h1>
            {lage.foretag && lage.foretag !== lage.namn && <div className="text-sm text-gray-500 mt-0.5">{lage.foretag}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{kr(lage.varde)}</div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{lage.stegNamn || "Okänt steg"}</span>
          </div>
        </div>

        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
          style={{ background: senasteKontakt.bollenHos === "oss" ? "#fef2f2" : `${primary}0f`, color: senasteKontakt.bollenHos === "oss" ? "#b91c1c" : "#374151" }}
        >
          {senasteKontakt.text}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          {lage.epost && <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {lage.epost}</span>}
          {lage.telefon && <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {lage.telefon}</span>}
          {lage.dagarISteget !== null && <span className="text-gray-400">{lage.dagarISteget} dagar i steget</span>}
        </div>
        {lage.taggar.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lage.taggar.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"><Tag className="w-3 h-3" />{t}</span>
            ))}
          </div>
        )}

        {/* Nästa steg — röd brist om det saknas, aldrig ett tomt fält */}
        <div className="mt-4 space-y-2.5">
          {!nsRedigeras ? (
            <button
              onClick={() => setNsRedigeras(true)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg ${lage.nastaSteg ? "" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
              style={lage.nastaSteg ? { background: `${primary}14`, color: primary } : undefined}
            >
              {lage.nastaSteg ? (
                <>Nästa steg: {lage.nastaSteg.titel} · {datumText(lage.nastaSteg.datum)}</>
              ) : (
                <><AlertTriangle className="w-4 h-4" /> Inget nästa steg satt — klicka för att sätta ett</>
              )}
            </button>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2.5">
              <input
                value={nsTitel}
                onChange={(e) => setNsTitel(e.target.value)}
                placeholder="Vad ska göras?"
                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  value={nsDatum}
                  onChange={(e) => setNsDatum(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
                <button
                  onClick={sparaNastaSteg}
                  disabled={nsSparar || !nsTitel.trim() || !nsDatum}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg text-white disabled:opacity-40"
                  style={{ background: primary }}
                >
                  {nsSparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Spara i MySales
                </button>
                <button onClick={() => setNsRedigeras(false)} className="text-sm text-gray-500 hover:text-gray-700 px-2">Avbryt</button>
              </div>
            </div>
          )}
        </div>

        {/* Flytta steg — samma skrivväg som Fokus idag (/api/fokus/move-stage) */}
        {lage.stegInfo && lage.stegInfo.steg.length > 1 && (
          <div className="mt-4">
            <PipelineStegRad oppId={lage.ghlOpportunityId} stegInfo={lage.stegInfo} primaryColor={primary} onMoved={ladda} stor />
          </div>
        )}

        {/* DRIV-3: Skapa offert — samma URL-mönster/väg som Fokus idag redan använder */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <a
            href={offertHref}
            title="Öppnar offertmotorn med kunden ifylld"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-white border shadow-sm hover:bg-gray-50"
            style={{ borderColor: `${primary}55`, color: primary }}
          >
            <FileText className="w-4 h-4" /> Skapa offert <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {mysalesHref && (
            <a
              href={mysalesHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Öppna i MySales <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* DRIV-3: dag 3-uppföljning på en skickad offert — förslag, aldrig automatiskt */}
      {offertForslag && !offertForslagDold && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Förslag:</span> sätt en uppföljning — {offertForslag.titel} · {datumText(offertForslag.datum)}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={godkannOffertForslag}
              disabled={offertForslagSparar}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40"
              style={{ background: primary }}
            >
              {offertForslagSparar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Godkänn
            </button>
            <button onClick={() => setOffertForslagDold(true)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Inte nu</button>
          </div>
        </div>
      )}

      {/* DRIV-3: prisrutan — säljlagrets publika priser, read-only */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-display font-bold text-gray-900 text-sm">Prislista</h2>
          {prislista[0]?.giltigFran && <span className="text-xs text-gray-400">Prislista per {prislista[0].giltigFran}</span>}
        </div>
        {prislista.length === 0 ? (
          <div className="text-sm text-gray-400">Ingen prislista hittad.</div>
        ) : (
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={prisSok}
                onChange={(e) => setPrisSok(e.target.value)}
                placeholder="Sök produkt…"
                className="w-full text-sm rounded-lg border border-gray-200 pl-9 pr-3 py-2 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
              />
            </div>
            <div className="space-y-1.5">
              {prisTraffar.map((p) => (
                <div key={p.artikelnr} className="flex items-center justify-between gap-3 text-sm py-1.5 border-t border-gray-50 first:border-t-0">
                  <span className="text-gray-700 flex items-center gap-2 min-w-0">
                    <span className="truncate">{p.benamning}</span>
                    {p.tb && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0"
                        title={`Täckningsbidrag ${p.tb.kr.toLocaleString("sv-SE")} kr, bästa inköpsväg ${p.tb.bastaInkopsvag || "okänd"}. Endast synligt här, aldrig för kund.`}
                      >
                        TB {p.tb.pct}%
                      </span>
                    )}
                  </span>
                  <span className="font-semibold text-gray-900 tabular-nums flex-shrink-0">
                    {p.pris === null ? "Offereras" : `${p.franPris ? "Från " : ""}${p.pris.toLocaleString("sv-SE")} ${p.enhet || "kr"}`}
                  </span>
                </div>
              ))}
              {prisTraffar.length === 0 && <div className="text-sm text-gray-400 py-2">Inga träffar.</div>}
            </div>
          </>
        )}
      </div>

      {/* Föreslagna kopplingar */}
      {foreslagnaLankar.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 space-y-3">
          <h2 className="font-display font-bold text-gray-900 text-sm">Föreslagna kopplingar — behöver din bekräftelse</h2>
          {foreslagnaLankar.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-3.5 py-2.5 border border-amber-100">
              <div className="text-sm text-gray-700 min-w-0">{l.belagg}</div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => beslutaLank(l.id, "bekraftad")}
                  disabled={beslutar === l.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ background: primary }}
                >
                  <Check className="w-3.5 h-3.5" /> Bekräfta
                </button>
                <button
                  onClick={() => beslutaLank(l.id, "avvisad")}
                  disabled={beslutar === l.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" /> Avvisa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Källfel — visas men stoppar inte kortet */}
      {fel.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 space-y-1">
          {fel.map((f, i) => <div key={i}>{f}</div>)}
        </div>
      )}

      {/* Anteckna */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="font-display font-bold text-gray-900 text-sm inline-flex items-center gap-1.5"><StickyNote className="w-4 h-4" style={{ color: primary }} /> Anteckna</h2>
        <CoachContextInput
          value={noteringText}
          onChange={setNoteringText}
          onSubmit={sparaNotering}
          submitLabel={noteringSparar ? "Sparar…" : "Spara på kontakten"}
          placeholder="Skriv eller prata in vad som är på gång…"
          primaryColor={primary}
          rows={2}
          compact
        />
        {noteringKvitto && <div className="text-xs text-gray-500">{noteringKvitto}</div>}
      </div>

      {/* Tidslinjen */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-gray-900 text-lg">Tidslinje</h2>
        {tidslinje.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">Ingen aktivitet hittad ännu.</div>
        ) : (
          <div className="space-y-2.5">
            {tidslinje.map((t) => {
              const Icon = KALLA_IKON[t.kalla] || MessageSquare;
              const utkastAktivt = utkastFor === t.id;
              return (
                <div key={`${t.kalla}-${t.id}`} className={`bg-white border rounded-xl p-4 ${t.osaker ? "border-amber-200" : "border-gray-100"}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: t.riktning === "in" ? "#fef2f2" : t.riktning === "ut" ? `${primary}14` : "#f3f4f6" }}
                    >
                      <Icon className="w-4 h-4" style={{ color: t.riktning === "in" ? "#b91c1c" : t.riktning === "ut" ? primary : "#6b7280" }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{t.titel}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{datumText(t.tidpunkt)}</span>
                      </div>
                      {t.snippet && <div className="text-sm text-gray-500 mt-0.5">{t.snippet}</div>}
                      {t.varning && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> {t.varning}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {t.kalla === "gmail" && (
                          <button
                            onClick={() => lasMeddelande(t)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            <Mail className="w-3.5 h-3.5" /> {lasFor === t.id ? "Dölj mejlet" : "Läs mejlet"}
                          </button>
                        )}
                        {t.svar && !utkastAktivt && (
                          <button
                            onClick={() => genereraUtkast(t)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            <Reply className="w-3.5 h-3.5" /> Utkast
                          </button>
                        )}
                        {t.harBilaga && (
                          <a
                            href={`/api/driv/bilaga?id=${encodeURIComponent(t.id)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            <Paperclip className="w-3.5 h-3.5" /> Se bilaga
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {lasFor === t.id && (
                    <div className="mt-3 ml-11">
                      {lasar ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar mejlet…</div>
                      ) : lasFel ? (
                        <div className="text-sm text-red-600">{lasFel}</div>
                      ) : (
                        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl px-3.5 py-2.5 max-h-80 overflow-y-auto">
                          {lasText}
                        </div>
                      )}
                    </div>
                  )}

                  {utkastAktivt && t.svar && (
                    <div className="mt-3 ml-11 space-y-2.5">
                      {genererar ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Skriver ett utkast…</div>
                      ) : (
                        <>
                          <textarea
                            value={utkastText}
                            onChange={(e) => setUtkastText(e.target.value)}
                            rows={5}
                            className="w-full text-sm rounded-xl border border-gray-200 px-3.5 py-2.5 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                          />
                          <div className="text-xs text-gray-500">
                            Skickas till <span className="font-medium text-gray-700">{t.svar.motpart}</span> via <span className="font-medium text-gray-700">{kanalNamn(t.svar)}</span>
                          </div>
                          {skickaFel && <div className="text-xs text-red-600">{skickaFel}</div>}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => skickaUtkast(t)}
                              disabled={skickar || !utkastText.trim()}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg text-white disabled:opacity-40"
                              style={{ background: primary }}
                            >
                              {skickar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Skicka
                            </button>
                            <button onClick={() => { setUtkastFor(null); setSkickaFel(null); }} className="text-sm text-gray-500 hover:text-gray-700 px-2">Avbryt</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
