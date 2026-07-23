"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Loader2, RefreshCw, Mail, Phone, Building2, CalendarClock, AlertCircle,
  CheckCircle2, ChevronDown, Plus, Mic, Radio, ImageIcon, ClipboardPaste, X,
  Sparkles, ExternalLink, ArrowUpCircle, Trash2, Undo2,
} from "lucide-react";

// Lobbyn i Cockpit — kontakterna INNAN de blir affärer i pipelinen.
// Full port av MySales Coach-Lobbyn (`src/pages/Lobby.tsx`) i Cockpits ljusa design:
// klistra in bild → Gemini skapar kontakten, prata in ny/uppdatering, synka till
// MySales (GHL) med ett klick, öppna ärendet direkt, redigera inline, radera.

type Status = "new" | "contacted" | "dialog" | "ready" | "passed";
type Platform = "linkedin" | "fb" | "ig" | "email" | "phone" | "web" | "other";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  platform: Platform | null;
  status: Status;
  last_message: string | null;
  sentiment: number | null;
  next_step: string | null;
  next_contact_date: string | null;
  last_contact_at: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  ghl_contact_id: string | null;
}

const STATUS: Record<Status, { label: string; chip: string }> = {
  new: { label: "Okänd", chip: "bg-slate-100 text-slate-600 border-slate-200" },
  contacted: { label: "Kontaktad", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  dialog: { label: "Dialog", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ready: { label: "Redo", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  passed: { label: "I MySales", chip: "bg-gray-100 text-gray-500 border-gray-200" },
};
const STATUS_ORDER: Status[] = ["new", "contacted", "dialog", "ready", "passed"];

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" }, { value: "fb", label: "Facebook" },
  { value: "ig", label: "Instagram" }, { value: "email", label: "E-post" },
  { value: "phone", label: "Telefon" }, { value: "web", label: "Webb" }, { value: "other", label: "Annat" },
];
const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

// ── Web Speech (sv-SE) typer ─────────────────────────────────────────────────
interface ISpeechRecognition extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((e: Event) => void) | null; onresult: ((e: ISpeechEvent) => void) | null;
}
interface ISpeechResult { isFinal: boolean; [i: number]: { transcript: string } }
interface ISpeechEvent extends Event { resultIndex: number; results: { length: number } & { [i: number]: ISpeechResult } }
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

function dagarSedan(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function datumDiff(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d + "T00:00:00");
  const idag = new Date(); idag.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - idag.getTime()) / 86400000);
}
function visaDatum(d: string | null): string {
  const diff = datumDiff(d);
  if (diff === null) return "—";
  if (diff === 0) return "Idag";
  if (diff === 1) return "Imorgon";
  if (diff < 0) return `${Math.abs(diff)}d sedan`;
  if (diff <= 6) return `Om ${diff}d`;
  return new Date(d + "T00:00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}
function matchaNamn(cs: Contact[], namn: string): Contact | undefined {
  const n = namn.toLowerCase().trim();
  if (!n) return undefined;
  const fornamn = n.split(" ")[0];
  return cs.find((c) => c.name.toLowerCase() === n)
    || cs.find((c) => c.name.toLowerCase().includes(n))
    || cs.find((c) => c.name.toLowerCase().startsWith(fornamn));
}
function gruppera(cs: Contact[]) {
  const forsenat: Contact[] = [], idag: Contact[] = [], kommande: Contact[] = [], utanDatum: Contact[] = [];
  for (const c of cs) {
    const diff = datumDiff(c.next_contact_date);
    if (diff === null) utanDatum.push(c);
    else if (diff < 0) forsenat.push(c);
    else if (diff === 0) idag.push(c);
    else kommande.push(c);
  }
  const byDate = (a: Contact, b: Contact) => (a.next_contact_date || "").localeCompare(b.next_contact_date || "");
  forsenat.sort(byDate); kommande.sort(byDate);
  return { forsenat, idag, kommande, utanDatum };
}

export default function LobbyClient({ primaryColor = "#6366f1" }: { primaryColor?: string }) {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mysalesBase, setMysalesBase] = useState<string | null>(null);
  const [sparar, setSparar] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "alla">("alla");
  const [toast, setToast] = useState<{ text: string; typ: "ok" | "fel" } | null>(null);

  // Formulär + AI
  const [visaForm, setVisaForm] = useState(false);
  const [extraherar, setExtraherar] = useState(false);
  const [pastedImg, setPastedImg] = useState<string | null>(null);

  // Röst
  const [lyssnar, setLyssnar] = useState(false);
  const [transkript, setTranskript] = useState("");
  const [rostAnalys, setRostAnalys] = useState(false);
  const [oppenId, setOppenId] = useState<string | null>(null); // kontext för röst-uppdatering
  const recRef = useRef<ISpeechRecognition | null>(null);

  const visaToast = useCallback((text: string, typ: "ok" | "fel" = "ok") => {
    setToast({ text, typ });
    setTimeout(() => setToast(null), typ === "fel" ? 6000 : 3500);
  }, []);

  const ladda = useCallback(() => {
    setLoading(true);
    fetch("/api/lobby/contacts")
      .then((r) => r.json())
      .then((d) => {
        setLinked(d.linked !== false);
        setContacts(d.contacts || []);
        setMysalesBase(d.mysalesBase || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { ladda(); }, [ladda]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const spara = useCallback(async (id: string, changes: Partial<Contact>) => {
    setSparar(id);
    const innan = contacts;
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    try {
      const r = await fetch("/api/lobby/contacts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, changes }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.contact) setContacts((cs) => cs.map((c) => (c.id === id ? d.contact : c)));
    } catch {
      setContacts(innan);
      visaToast("Kunde inte spara", "fel");
    } finally { setSparar(null); }
  }, [contacts, visaToast]);

  const skapa = useCallback(async (fields: Partial<Contact> & { name: string }): Promise<Contact | null> => {
    try {
      const r = await fetch("/api/lobby/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.contact) { setContacts((cs) => [d.contact, ...cs]); return d.contact; }
      return null;
    } catch { visaToast("Kunde inte skapa kontakt", "fel"); return null; }
  }, [visaToast]);

  const radera = useCallback(async (id: string) => {
    const innan = contacts;
    setContacts((cs) => cs.filter((c) => c.id !== id));
    try {
      const r = await fetch(`/api/lobby/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch { setContacts(innan); visaToast("Kunde inte radera", "fel"); }
  }, [contacts, visaToast]);

  // ── Synka till MySales (GHL) ──────────────────────────────────────────────────
  const synka = useCallback(async (c: Contact) => {
    setSparar(c.id);
    visaToast(`Synkar ${c.name} till MySales…`);
    try {
      const r = await fetch("/api/lobby/sync", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }),
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: "passed", ghl_contact_id: d.ghlContactId } : x)));
        visaToast(`${c.name} är nu i MySales`);
        if (d.mysalesUrl) window.open(d.mysalesUrl, "_blank");
      } else {
        visaToast(d.error || "Synk misslyckades", "fel");
      }
    } catch { visaToast("Nätverksfel vid synk", "fel"); }
    finally { setSparar(null); }
  }, [visaToast]);

  const oppnaIMysales = useCallback((c: Contact) => {
    if (c.ghl_contact_id && mysalesBase) {
      window.open(`${mysalesBase}/customers/detail/${c.ghl_contact_id}`, "_blank");
    }
  }, [mysalesBase]);

  // ── Bild → kontakt ────────────────────────────────────────────────────────────
  const extrahera = useCallback(async (dataUrl: string) => {
    setExtraherar(true);
    setPastedImg(dataUrl);
    try {
      const r = await fetch("/api/lobby/extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const c = await skapa({
        name: d.name || "Okänd kontakt", company: d.company || "", title: d.title || "",
        platform: (PLATFORMS.find((p) => p.value === d.platform)?.value) || "linkedin",
        email: d.email || "", phone: d.phone || "", last_message: d.last_message || "",
        next_step: d.next_step || "", next_contact_date: d.next_contact_date || "", notes: d.notes || "",
      });
      if (c) { visaToast(`${c.name} lades till`); setVisaForm(false); setPastedImg(null); }
    } catch { visaToast("Kunde inte läsa bilden", "fel"); }
    finally { setExtraherar(false); }
  }, [skapa, visaToast]);

  const bildFil = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => { const url = ev.target?.result as string; if (url) extrahera(url); };
    reader.readAsDataURL(file);
  }, [extrahera]);

  // ── Röst ────────────────────────────────────────────────────────────────────
  const parseNyRost = useCallback(async (t: string) => {
    setRostAnalys(true);
    try {
      const r = await fetch("/api/lobby/parse-voice", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: t }),
      });
      const d = await r.json();
      if (d.intent === "log_activity" && d.contact_name) {
        const match = matchaNamn(contacts, d.contact_name);
        if (match) {
          const changes: Partial<Contact> = { last_contact_at: new Date().toISOString() };
          if (d.next_step) changes.next_step = d.next_step;
          if (d.next_contact_date) changes.next_contact_date = d.next_contact_date;
          if (d.last_message) changes.last_message = d.last_message;
          if (d.activity_type === "response_received") changes.status = "dialog";
          if (d.activity_type === "meeting_booked") changes.status = "ready";
          await spara(match.id, changes);
          visaToast(`${match.name} uppdaterad`);
          return;
        }
      }
      const c = await skapa({
        name: d.name || "Okänd kontakt", company: d.company || "", title: d.title || "",
        platform: (PLATFORMS.find((p) => p.value === d.platform)?.value) || "other",
        last_message: d.last_message || t.slice(0, 300), next_step: d.next_step || "",
        next_contact_date: d.next_contact_date || "", notes: d.notes || "",
      });
      if (c) visaToast(`${c.name} lades till`);
    } catch { visaToast("Kunde inte tolka rösten", "fel"); }
    finally { setRostAnalys(false); setTranskript(""); }
  }, [contacts, skapa, spara, visaToast]);

  const rostUppdatera = useCallback(async (t: string, id: string) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setRostAnalys(true);
    try {
      const r = await fetch("/api/lobby/voice-update", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: t, contact: c }),
      });
      const upd = await r.json();
      if (r.ok && Object.keys(upd).length) {
        if (upd.notes && c.notes) upd.notes = c.notes + "\n" + upd.notes;
        await spara(id, upd);
        visaToast(`Uppdaterat: ${Object.keys(upd).join(", ")}`);
      } else visaToast("Kunde inte tolka", "fel");
    } catch { visaToast("Fel vid uppdatering", "fel"); }
    finally { setRostAnalys(false); setTranskript(""); }
  }, [contacts, spara, visaToast]);

  const startaRost = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { visaToast("Röst stöds ej — använd Chrome eller Edge", "fel"); return; }
    const rec = new SR();
    rec.lang = "sv-SE"; rec.continuous = true; rec.interimResults = true;
    let slutText = "";
    rec.onstart = () => setLyssnar(true);
    rec.onresult = (e: ISpeechEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) slutText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setTranskript(slutText + interim);
    };
    rec.onend = () => {
      setLyssnar(false);
      const t = slutText.trim();
      if (t) { if (oppenId) rostUppdatera(t, oppenId); else parseNyRost(t); }
      else setTranskript("");
    };
    rec.onerror = (e: Event) => {
      setLyssnar(false); setTranskript("");
      const err = (e as unknown as { error?: string }).error || "";
      if (err === "not-allowed") visaToast("Mikrofon blockerad — tillåt i adressfältet", "fel");
      else if (err === "no-speech") visaToast("Inget tal uppfångat — prova igen", "fel");
      else if (err) visaToast(`Röstfel: ${err}`, "fel");
    };
    recRef.current = rec;
    rec.start();
  }, [oppenId, parseNyRost, rostUppdatera, visaToast]);

  const stoppaRost = useCallback(() => recRef.current?.stop(), []);

  // ── Vyer ──────────────────────────────────────────────────────────────────────
  const aktiva = useMemo(() => contacts.filter((c) => c.status !== "passed"), [contacts]);
  const passade = useMemo(() => contacts.filter((c) => c.status === "passed"), [contacts]);
  const synliga = useMemo(
    () => (filter === "alla" ? aktiva : aktiva.filter((c) => c.status === filter)),
    [aktiva, filter],
  );
  const grupper = useMemo(() => gruppera(synliga), [synliga]);
  const allaGrupper = useMemo(() => gruppera(aktiva), [aktiva]);

  const oppetNamn = oppenId ? contacts.find((c) => c.id === oppenId)?.name?.split(" ")[0] : null;

  const kortProps = (c: Contact) => ({
    c, spara, sparar: sparar === c.id, radera, synka, oppnaIMysales,
    kanOppna: !!(c.ghl_contact_id && mysalesBase),
    oppen: oppenId === c.id, setOppen: (v: boolean) => setOppenId(v ? c.id : null),
  });

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}>
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
              <Users className="w-3.5 h-3.5" /> Lobbyn
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Dina kontakter före affären</h1>
            <p className="text-white/80 mt-1.5 text-sm max-w-lg">
              Klistra in, prata in eller skriv. När kontakten är redo — synka till MySales med ett klick.
            </p>
          </div>
          {linked && (
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={lyssnar ? stoppaRost : startaRost} disabled={rostAnalys}
                title={oppetNamn ? `Tala in → uppdatera ${oppetNamn}` : "Tala in en ny kontakt"}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-colors ${
                  lyssnar ? "bg-red-500/90 text-white" : "bg-white/15 hover:bg-white/25 text-white/90"
                } ${rostAnalys ? "opacity-50" : ""}`}>
                {lyssnar ? <><Radio className="w-3.5 h-3.5 animate-pulse" /> Stoppa</>
                  : rostAnalys ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyserar…</>
                  : <><Mic className="w-3.5 h-3.5" /> {oppetNamn ? `Tala → ${oppetNamn}` : "Tala in"}</>}
              </button>
              <button onClick={() => setVisaForm((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 bg-white text-gray-900 hover:bg-white/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Lägg till
              </button>
            </div>
          )}
        </div>
        {linked && !loading && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-md">
            <HeroKpi label="Aktiva" value={String(aktiva.length)} />
            <HeroKpi label="Försenade" value={String(allaGrupper.forsenat.length)} />
            <HeroKpi label="Idag" value={String(allaGrupper.idag.length)} />
          </div>
        )}
      </div>

      {/* Röst-overlay */}
      {(lyssnar || rostAnalys) && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-start gap-3">
          {lyssnar ? <Radio className="w-4 h-4 text-red-500 animate-pulse mt-0.5" /> : <Loader2 className="w-4 h-4 text-gray-400 animate-spin mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-500">
              {lyssnar ? (oppetNamn ? `Lyssnar — uppdaterar ${oppetNamn}…` : "Lyssnar…") : "Gemini tolkar…"}
            </div>
            {transkript && <p className="text-sm text-gray-700 italic mt-1">"{transkript}"</p>}
          </div>
        </div>
      )}

      {/* Lägg till-form */}
      {visaForm && linked && (
        <LaggTillForm
          extraherar={extraherar} pastedImg={pastedImg} setPastedImg={setPastedImg}
          onBild={bildFil} onExtrahera={extrahera}
          onManuell={async (f) => { const c = await skapa(f); if (c) { visaToast(`${c.name} lades till`); setVisaForm(false); } }}
          onAvbryt={() => { setVisaForm(false); setPastedImg(null); }}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
      ) : !linked ? (
        <TomRuta ikon={Building2} titel="Ingen koppling än"
          text="Lobbyn visas när klienten är kopplad till MySales Coach via sin GHL-location." />
      ) : aktiva.length === 0 && passade.length === 0 ? (
        <TomRuta ikon={Users} titel="Inga kontakter än" text="Klistra in en bild, prata in eller klicka Lägg till." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterKnapp aktiv={filter === "alla"} onClick={() => setFilter("alla")} label={`Alla (${aktiva.length})`} />
            {STATUS_ORDER.filter((s) => s !== "passed").map((s) => {
              const n = aktiva.filter((c) => c.status === s).length;
              return n ? <FilterKnapp key={s} aktiv={filter === s} onClick={() => setFilter(s)} label={`${STATUS[s].label} (${n})`} /> : null;
            })}
          </div>

          <Grupp titel="Försenade" kontakter={grupper.forsenat} ton="röd" render={kortProps} />
          <Grupp titel="Att göra idag" kontakter={grupper.idag} ton="gul" render={kortProps} />
          <Grupp titel="Kommande" kontakter={grupper.kommande} ton="neutral" render={kortProps} />
          <Grupp titel="Utan datum" kontakter={grupper.utanDatum} ton="neutral" render={kortProps} />

          {passade.length > 0 && (
            <details className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900">
                Passade till MySales ({passade.length})
              </summary>
              <div className="px-3 pb-3 space-y-2">
                {passade.map((c) => <Rad key={c.id} {...kortProps(c)} />)}
              </div>
            </details>
          )}
        </>
      )}

      {toast && (
        <div onClick={() => setToast(null)}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-sm max-w-sm text-center cursor-pointer border ${
            toast.typ === "fel" ? "bg-white border-red-200 text-red-700" : "bg-gray-900 border-gray-900 text-white"
          }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ── Delkomponenter ────────────────────────────────────────────────────────────

function HeroKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur ring-1 ring-white/10">
      <div className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function TomRuta({ ikon: Ikon, titel, text }: { ikon: React.ComponentType<{ className?: string }>; titel: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <Ikon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <div className="font-semibold text-gray-900">{titel}</div>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{text}</p>
    </div>
  );
}

function FilterKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
        aktiv ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}>{label}</button>
  );
}

function LaggTillForm({
  extraherar, pastedImg, setPastedImg, onBild, onExtrahera, onManuell, onAvbryt,
}: {
  extraherar: boolean;
  pastedImg: string | null;
  setPastedImg: (v: string | null) => void;
  onBild: (f: File) => void;
  onExtrahera: (dataUrl: string) => void;
  onManuell: (f: Partial<Contact> & { name: string }) => void;
  onAvbryt: () => void;
}) {
  const [rawText, setRawText] = useState("");
  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [nextStep, setNextStep] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [notes, setNotes] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTimeout(() => taRef.current?.focus(), 100); }, []);

  const paste = (e: React.ClipboardEvent) => {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (img) { e.preventDefault(); const f = img.getAsFile(); if (f) onBild(f); }
  };
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("image/"));
    if (f) onBild(f);
  };
  const klistraIn = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find((x) => x.startsWith("image/"));
        if (t) { const blob = await it.getType(t); onBild(new File([blob], "paste.png", { type: t })); return; }
      }
      const text = await navigator.clipboard.readText();
      setRawText((p) => p + text); taRef.current?.focus();
    } catch { taRef.current?.focus(); }
  };
  const spara = () => {
    if (!rawText.trim()) return;
    const namn = rawText.split("\n")[0].trim().split(" ").slice(0, 3).join(" ") || "Okänd kontakt";
    onManuell({ name: namn, company, platform, last_message: rawText.slice(0, 300), next_step: nextStep, next_contact_date: nextDate, notes });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Sparkles className="w-4 h-4" style={{ color: "#7c3aed" }} /> Klistra in bild → Gemini skapar kontakten direkt
        </div>
        <button onClick={klistraIn} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900">
          <ClipboardPaste className="w-3.5 h-3.5" /> Klistra in
        </button>
      </div>

      {pastedImg ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img src={pastedImg} alt="" className="max-h-48 w-full object-contain bg-gray-50" />
          {extraherar && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              <span className="text-xs text-gray-600">Gemini läser bilden…</span>
            </div>
          )}
          <button onClick={() => setPastedImg(null)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center">
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      ) : (
        <label onDrop={drop} onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center gap-2 p-5 rounded-xl border border-dashed border-gray-300 hover:border-gray-400 cursor-pointer text-gray-500 transition-colors">
          <ImageIcon className="w-5 h-5" />
          <span className="text-xs text-center">Dra &amp; släpp skärmbild, mejl, visitkort eller konversation</span>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onBild(f); }} />
        </label>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="flex-1 border-t border-gray-200" /> eller fyll i manuellt <span className="flex-1 border-t border-gray-200" />
      </div>

      <textarea ref={taRef} value={rawText} onChange={(e) => setRawText(e.target.value)} onPaste={paste} rows={3}
        placeholder="Klistra in mejl, konversation eller skriv vad du vet. Första raden = namn."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400 resize-none" />

      <div className="grid grid-cols-2 gap-3">
        <Falt etikett="Företag" varde={company} onChange={setCompany} placeholder="Företagsnamn…" />
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Plattform</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-400 bg-white">
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <Falt etikett="Nästa steg" varde={nextStep} onChange={setNextStep} placeholder="T.ex. Skicka offert…" />
        <Falt etikett="Nästa kontakt" varde={nextDate} onChange={setNextDate} typ="date" />
        <div className="col-span-2">
          <Falt etikett="Anteckningar" varde={notes} onChange={setNotes} placeholder="Fritext…" />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onAvbryt} className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5">Avbryt</button>
        <button onClick={spara} disabled={!rawText.trim() || extraherar}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gray-900 text-white rounded-lg px-3 py-1.5 disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> Spara kontakt
        </button>
      </div>
    </div>
  );
}

function Grupp({
  titel, kontakter, ton, render,
}: {
  titel: string;
  kontakter: Contact[];
  ton: "röd" | "gul" | "neutral";
  render: (c: Contact) => React.ComponentProps<typeof Rad>;
}) {
  if (!kontakter.length) return null;
  const Ikon = ton === "röd" ? AlertCircle : ton === "gul" ? CalendarClock : CheckCircle2;
  const färg = ton === "röd" ? "text-red-500" : ton === "gul" ? "text-amber-500" : "text-gray-400";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Ikon className={`w-5 h-5 ${färg}`} />
        <h2 className="font-display font-bold text-gray-900 text-lg">{titel}</h2>
        <span className="text-xs text-gray-400">({kontakter.length})</span>
      </div>
      <div className="space-y-2">{kontakter.map((c) => <Rad key={c.id} {...render(c)} />)}</div>
    </section>
  );
}

function Rad({
  c, spara, sparar, radera, synka, oppnaIMysales, kanOppna, oppen, setOppen,
}: {
  c: Contact;
  spara: (id: string, ch: Partial<Contact>) => void;
  sparar: boolean;
  radera: (id: string) => void;
  synka: (c: Contact) => void;
  oppnaIMysales: (c: Contact) => void;
  kanOppna: boolean;
  oppen: boolean;
  setOppen: (v: boolean) => void;
}) {
  const [visaStatus, setVisaStatus] = useState(false);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const st = STATUS[c.status] || STATUS.new;
  const dagar = dagarSedan(c.last_contact_at);
  const diff = datumDiff(c.next_contact_date);

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${oppen ? "border-gray-300 ring-1 ring-gray-200" : "border-gray-100"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOppen(!oppen)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{c.name}</span>
            {c.company && <span className="text-sm text-gray-500 truncate">· {c.company}</span>}
            {sparar && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {c.platform && <span>{PLATFORM_LABEL[c.platform] || c.platform}</span>}
            {dagar !== null && <span className={dagar >= 5 ? "text-red-500 font-medium" : ""}>Kontakt {dagar}d sedan</span>}
            {c.next_contact_date && (
              <span className={diff !== null && diff < 0 ? "text-red-500 font-medium" : diff === 0 ? "text-amber-600 font-medium" : ""}>
                Nästa: {visaDatum(c.next_contact_date)}
              </span>
            )}
          </div>
        </button>

        <div className="relative flex-shrink-0">
          <button onClick={() => setVisaStatus(!visaStatus)}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${st.chip}`}>
            {st.label} <ChevronDown className="w-3 h-3" />
          </button>
          {visaStatus && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisaStatus(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                {STATUS_ORDER.map((s) => (
                  <button key={s} onClick={() => { spara(c.id, { status: s }); setVisaStatus(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${s === c.status ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                    {STATUS[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {oppen && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:underline"><Mail className="w-4 h-4 text-gray-400" /> {c.email}</a>}
            {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-800 hover:underline"><Phone className="w-4 h-4 text-gray-400" /> {c.phone}</a>}
            {c.title && <span className="text-gray-500">{c.title}</span>}
          </div>

          {c.last_message && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Senaste meddelande</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.last_message}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Falt etikett="Nästa steg" varde={c.next_step || ""} onChange={(v) => spara(c.id, { next_step: v })} placeholder="Vad ska hända härnäst?" commitOnBlur />
            <Falt etikett="Nästa kontakt" varde={c.next_contact_date || ""} onChange={(v) => spara(c.id, { next_contact_date: v })} typ="date" commitOnBlur />
          </div>

          {c.notes && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Anteckningar</div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}

          {/* Åtgärder */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {c.status !== "passed" ? (
              <button onClick={() => synka(c)} disabled={sparar}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                style={{ background: "#059669" }}>
                <ArrowUpCircle className="w-3.5 h-3.5" /> Synka till MySales
              </button>
            ) : (
              <>
                {kanOppna && (
                  <button onClick={() => oppnaIMysales(c)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-1.5 hover:bg-emerald-100">
                    <ExternalLink className="w-3.5 h-3.5" /> Öppna i MySales
                  </button>
                )}
                <button onClick={() => spara(c.id, { status: "ready" })}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                  <Undo2 className="w-3.5 h-3.5" /> Ångra
                </button>
              </>
            )}
            {bekraftaRadera ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <button onClick={() => radera(c.id)} className="font-semibold text-red-600 hover:underline">Radera?</button>
                <button onClick={() => setBekraftaRadera(false)} className="text-gray-400 hover:text-gray-600">avbryt</button>
              </span>
            ) : (
              <button onClick={() => setBekraftaRadera(true)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 ml-auto">
                <Trash2 className="w-3.5 h-3.5" /> Radera
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Falt({
  etikett, varde, onChange, placeholder, typ = "text", commitOnBlur = false,
}: {
  etikett: string; varde: string; onChange: (v: string) => void;
  placeholder?: string; typ?: string; commitOnBlur?: boolean;
}) {
  const [utkast, setUtkast] = useState(varde);
  useEffect(() => { setUtkast(varde); }, [varde]);
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">{etikett}</span>
      <input type={typ} value={utkast} placeholder={placeholder}
        onChange={(e) => { setUtkast(e.target.value); if (!commitOnBlur) onChange(e.target.value); }}
        onBlur={() => { if (commitOnBlur && utkast !== varde) onChange(utkast); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-400 bg-white" />
    </label>
  );
}
