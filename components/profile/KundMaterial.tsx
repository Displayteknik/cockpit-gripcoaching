"use client";

// PROFIL-2 — ytan där kunden själv fyller i berättelser och kundernas egna ord.
//
// Varför den finns: kvalitetsmätaren har sagt "Lägg till 3 kundberättelser" och
// "Klistra in 5 riktiga kundcitat" sedan PROFIL-1, men materialet gick bara att fylla i
// via intake-flödet som kunden aldrig ser. Åtgärden pekade på en dörr som inte fanns.
//
// Två saker styr utformningen:
//  1. **Frågorna gör jobbet.** En tom ruta med rubriken "Story-bank" ger tomma svar.
//     Fälten frågar i stället efter det som faktiskt behövs: vad hände, vad blev det.
//  2. **Kundens egna ord ska klistras in, inte skrivas om.** Hjälptexten säger det rakt
//     ut, för det är hela poängen med materialet — sanningskravet tillåter citat bara
//     om de är äkta.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, MessageSquareQuote, BookOpen } from "lucide-react";

interface Berattelse { id: string; hook: string; idea_seed: string | null; notes: string | null; redigerbar: boolean }
interface Kundord { id: string; phrase: string; category: string; context: string | null }

const KATEGORI_ETIKETT: Record<string, string> = {
  vocabulary: "Ord de använder",
  catchphrase: "Uttryck som fastnar",
  objection: "Tvekan eller invändning",
  transformation: "Före och efter",
};

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none transition-colors";

export default function KundMaterial({ onChange }: { onChange?: () => void }) {
  const [berattelser, setBerattelser] = useState<Berattelse[]>([]);
  const [kundord, setKundord] = useState<Kundord[]>([]);
  const [laddar, setLaddar] = useState(true);
  const [fel, setFel] = useState("");
  const [sparar, setSparar] = useState("");

  // Formulär
  const [bRubrik, setBRubrik] = useState("");
  const [bText, setBText] = useState("");
  const [bResultat, setBResultat] = useState("");
  const [kFras, setKFras] = useState("");
  const [kKategori, setKKategori] = useState("vocabulary");
  const [kSammanhang, setKSammanhang] = useState("");

  const hamta = useCallback(async () => {
    try {
      const r = await fetch("/api/profile/material");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte hämta materialet");
      setBerattelser(d.berattelser || []);
      setKundord(d.kundord || []);
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setLaddar(false);
    }
  }, []);

  useEffect(() => { hamta(); }, [hamta]);

  const laggTill = useCallback(async (typ: "berattelse" | "kundord", kropp: Record<string, string>) => {
    setFel(""); setSparar(typ);
    try {
      const r = await fetch("/api/profile/material", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typ, ...kropp }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kunde inte spara");
      if (typ === "berattelse") { setBRubrik(""); setBText(""); setBResultat(""); }
      else { setKFras(""); setKSammanhang(""); }
      await hamta();
      onChange?.(); // mätaren ska röra sig direkt — annars ser det ut som att inget hände
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar("");
    }
  }, [hamta, onChange]);

  const taBort = useCallback(async (typ: "berattelse" | "kundord", id: string) => {
    setFel("");
    try {
      const r = await fetch(`/api/profile/material?typ=${typ}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Kunde inte ta bort");
      await hamta();
      onChange?.();
    } catch (e) {
      setFel((e as Error).message);
    }
  }, [hamta, onChange]);

  if (laddar) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar ditt material…</div>;
  }

  return (
    <div className="space-y-6">
      {fel && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{fel}</div>}

      {/* ── Kundberättelser ── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-[18px] h-[18px] text-gray-500" />
          </span>
          <div>
            <h2 className="font-display font-bold text-gray-900">Kundberättelser</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Riktiga saker som hänt med riktiga kunder. Skrivhjälpen får bara berätta historier som står här —
              saknas de blir varje text en allmän observation.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vad handlade det om?</label>
            <input value={bRubrik} onChange={(e) => setBRubrik(e.target.value)} className={inputCls}
              placeholder="En rad som sammanfattar, t.ex. Kunden hade väntat i tre år" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vad hände?</label>
            <textarea value={bText} onChange={(e) => setBText(e.target.value)} rows={3} className={inputCls}
              placeholder="Berätta som du skulle berätta det för en kollega. Namn, plats eller datum gör den användbar." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vad blev resultatet? <span className="text-gray-400 font-normal">(valfritt)</span></label>
            <input value={bResultat} onChange={(e) => setBResultat(e.target.value)} className={inputCls}
              placeholder="Gärna med en siffra, om du har en" />
          </div>
          <button
            onClick={() => laggTill("berattelse", { rubrik: bRubrik, text: bText, resultat: bResultat })}
            disabled={sparar === "berattelse" || !bRubrik.trim() || bText.trim().length < 20}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40">
            {sparar === "berattelse" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Spara berättelsen
          </button>
        </div>

        {berattelser.length > 0 && (
          <ul className="space-y-2">
            {berattelser.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{b.hook}</div>
                  {b.idea_seed && <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{b.idea_seed}</p>}
                  {!b.redigerbar && <span className="text-[11px] text-gray-400">Kom från uppstartssamtalet</span>}
                </div>
                {b.redigerbar && (
                  <button onClick={() => taBort("berattelse", b.id)} title="Ta bort"
                    className="p-1.5 rounded text-gray-300 hover:text-rose-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Kundernas egna ord ── */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <MessageSquareQuote className="w-[18px] h-[18px] text-gray-500" />
          </span>
          <div>
            <h2 className="font-display font-bold text-gray-900">Kundernas egna ord</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Klistra in ordagrant vad kunderna säger, med deras stavning och deras tvekan.
              Skriv inte om det till bättre svenska — det är just de oputsade orden som gör texterna igenkännbara.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Vad sa kunden?</label>
            <textarea value={kFras} onChange={(e) => setKFras(e.target.value)} rows={2} className={inputCls}
              placeholder="Ordagrant, som det sas eller skrevs" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Vilken sorts uttryck?</label>
              <select value={kKategori} onChange={(e) => setKKategori(e.target.value)} className={inputCls}>
                {Object.entries(KATEGORI_ETIKETT).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">När sa de det? <span className="text-gray-400 font-normal">(valfritt)</span></label>
              <input value={kSammanhang} onChange={(e) => setKSammanhang(e.target.value)} className={inputCls}
                placeholder="t.ex. i ett mejl efter första mötet" />
            </div>
          </div>
          <button
            onClick={() => laggTill("kundord", { fras: kFras, kategori: kKategori, sammanhang: kSammanhang })}
            disabled={sparar === "kundord" || !kFras.trim()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40">
            {sparar === "kundord" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Spara citatet
          </button>
        </div>

        {kundord.length > 0 && (
          <ul className="space-y-2">
            {kundord.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 italic">”{k.phrase}”</p>
                  <span className="text-[11px] text-gray-400">{KATEGORI_ETIKETT[k.category] || k.category}{k.context ? ` · ${k.context}` : ""}</span>
                </div>
                <button onClick={() => taBort("kundord", k.id)} title="Ta bort"
                  className="p-1.5 rounded text-gray-300 hover:text-rose-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
