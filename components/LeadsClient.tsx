"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Loader2, Mail, Phone, Building2,
  ChevronDown, ChevronRight, Plus, Mic, Radio, ImageIcon, ClipboardPaste, X,
  Sparkles, ExternalLink, ArrowUpCircle, Trash2, Undo2, MessageSquare, Copy, Check,
  Globe, MonitorSmartphone,
} from "lucide-react";
import { LinkedinIcon, FacebookIcon, InstagramIcon } from "@/lib/module-icons";

// "Nya leads" (fd Lobbyn) — inflödet av nya kontakter från LinkedIn/IG/FB/mail/webb
// INNAN de blir affärer i pipelinen. Bygg på varje case med bild/röst/text, få
// AI-svarsförslag i din röst, öppna chatten direkt, och synka till MySales.

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
  profile_url: string | null;
  ghl_contact_id: string | null;
  pipeline_stage?: string | null;     // SÄKER match (ghl_contact_id) → kontakten är i MySales, döljs
  name_match_stage?: string | null;   // OSÄKER match (bara namn) → behåll leadet men flagga
}

const STATUS: Record<Status, { label: string; chip: string }> = {
  new: { label: "Okänd", chip: "bg-slate-100 text-slate-600 border-slate-200" },
  contacted: { label: "Kontaktad", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  dialog: { label: "Dialog", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ready: { label: "Redo", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  passed: { label: "I MySales", chip: "bg-gray-100 text-gray-500 border-gray-200" },
};
const STATUS_ORDER: Status[] = ["new", "contacted", "dialog", "ready", "passed"];

// Lead-pipelinen FÖRE MySales: egna steg med värme-nivå. När kontakten skickas till
// MySales (status "passed" ELLER matchad affär i pipelinen) lämnar den den här vyn helt.
const LEAD_STEG: { status: Status; label: string; varme: string; farg: string }[] = [
  { status: "new", label: "Ny lead", varme: "Kall", farg: "#64748b" },
  { status: "contacted", label: "Kontaktad", varme: "Ljummen", farg: "#3b82f6" },
  { status: "dialog", label: "Svar / dialog", varme: "Varm", farg: "#f59e0b" },
  { status: "ready", label: "Redo för MySales", varme: "Het", farg: "#ef4444" },
];
const VARME: Record<Status, { label: string; farg: string } | undefined> = {
  new: { label: "Kall", farg: "#64748b" },
  contacted: { label: "Ljummen", farg: "#3b82f6" },
  dialog: { label: "Varm", farg: "#f59e0b" },
  ready: { label: "Het", farg: "#ef4444" },
  passed: undefined,
};

const PLATFORMS: { value: Platform; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { value: "fb", label: "Facebook", icon: FacebookIcon },
  { value: "ig", label: "Instagram", icon: InstagramIcon },
  { value: "email", label: "E-post", icon: Mail },
  { value: "phone", label: "Telefon", icon: Phone },
  { value: "web", label: "Hemsida", icon: MonitorSmartphone },
  { value: "other", label: "Annat", icon: Globe },
];
const PLATFORM_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> =
  Object.fromEntries(PLATFORMS.map((p) => [p.value, { label: p.label, icon: p.icon }]));

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
// Direktlänk till chatt/profil. Prioritet: sparad profil-URL → plattforms-fallback.
function chattLank(c: Contact): { url: string; label: string } | null {
  const url = (c.profile_url || "").trim();
  if (url) return { url: url.startsWith("http") ? url : `https://${url}`, label: "Öppna chatt" };
  if (c.platform === "email" && c.email) return { url: `mailto:${c.email}`, label: "Skriv mejl" };
  if (c.platform === "phone" && c.phone) return { url: `tel:${c.phone}`, label: "Ring" };
  if (c.email) return { url: `mailto:${c.email}`, label: "Skriv mejl" };
  // LinkedIn: sök på namnet om ingen profil-URL sparats.
  if (c.platform === "linkedin") return { url: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(c.name)}`, label: "Sök på LinkedIn" };
  return null;
}

export default function LeadsClient({ primaryColor = "#6366f1" }: { primaryColor?: string }) {
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

  // Röst (kontextmedveten: oppenId satt → uppdatera det kortet, annars ny kontakt)
  const [lyssnar, setLyssnar] = useState(false);
  const [transkript, setTranskript] = useState("");
  const [rostAnalys, setRostAnalys] = useState(false);
  const [oppenId, setOppenId] = useState<string | null>(null);
  const oppenIdRef = useRef<string | null>(null);
  const recRef = useRef<ISpeechRecognition | null>(null);

  // Per-kort "bygg på" (bild) + svarsförslag
  const [byggerId, setByggerId] = useState<string | null>(null); // kort som just nu berikas via bild
  const [forslag, setForslag] = useState<Record<string, { ton: string; text: string }[]>>({});
  const [forslagLoad, setForslagLoad] = useState<string | null>(null);

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
  useEffect(() => { oppenIdRef.current = oppenId; }, [oppenId]);

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
      // Rulla bara tillbaka DET berörda kortet — inte hela listan (annars slås
      // en parallell lyckad ändring på ett annat kort ut). [buggfix 2026-07-21]
      setContacts((cs) => cs.map((c) => (c.id === id ? innan.find((x) => x.id === id) ?? c : c)));
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
      } else visaToast(d.error || "Synk misslyckades", "fel");
    } catch { visaToast("Nätverksfel vid synk", "fel"); }
    finally { setSparar(null); }
  }, [visaToast]);

  const oppnaIMysales = useCallback((c: Contact) => {
    if (c.ghl_contact_id && mysalesBase) window.open(`${mysalesBase}/customers/detail/${c.ghl_contact_id}`, "_blank");
  }, [mysalesBase]);

  // ── Bild → NY kontakt (i formuläret) ─────────────────────────────────────────
  const extrahera = useCallback(async (dataUrl: string) => {
    setExtraherar(true); setPastedImg(dataUrl);
    try {
      const r = await fetch("/api/lobby/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const c = await skapa({
        name: d.name || "Okänd kontakt", company: d.company || "", title: d.title || "",
        platform: (PLATFORMS.find((p) => p.value === d.platform)?.value) || "linkedin",
        email: d.email || "", phone: d.phone || "", profile_url: d.profile_url || "",
        last_message: d.last_message || "", next_step: d.next_step || "",
        next_contact_date: d.next_contact_date || "", notes: d.notes || "",
      });
      if (c) { visaToast(`${c.name} lades till`); setVisaForm(false); setPastedImg(null); }
    } catch { visaToast("Kunde inte läsa bilden", "fel"); }
    finally { setExtraherar(false); }
  }, [skapa, visaToast]);

  const bildFilNy = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => { const url = ev.target?.result as string; if (url) extrahera(url); };
    reader.readAsDataURL(file);
  }, [extrahera]);

  // ── Bild → BYGG PÅ befintligt kort (fyll tomma fält, uppdatera, append notes) ──
  const byggPaBild = useCallback(async (id: string, dataUrl: string) => {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    setByggerId(id);
    try {
      const r = await fetch("/api/lobby/extract", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: dataUrl }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const changes: Partial<Contact> = { last_contact_at: new Date().toISOString() };
      const fyllTomt = (k: "company" | "title" | "email" | "phone" | "profile_url") => {
        if (d[k] && !c[k]) (changes as Record<string, unknown>)[k] = d[k];
      };
      fyllTomt("company"); fyllTomt("title"); fyllTomt("email"); fyllTomt("phone"); fyllTomt("profile_url");
      if (d.last_message) changes.last_message = d.last_message;
      if (d.next_step) changes.next_step = d.next_step;
      if (d.next_contact_date) changes.next_contact_date = d.next_contact_date;
      if (d.notes) changes.notes = c.notes ? `${c.notes}\n---\n${d.notes}` : d.notes;
      await spara(id, changes);
      visaToast(`${c.name} uppdaterad från bild`);
    } catch { visaToast("Kunde inte läsa bilden", "fel"); }
    finally { setByggerId(null); }
  }, [contacts, spara, visaToast]);

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

  const startaRost = useCallback((forKortId?: string) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { visaToast("Röst stöds ej — använd Chrome eller Edge", "fel"); return; }
    if (recRef.current) { try { recRef.current.stop(); } catch { /* redan stoppad */ } } // stoppa ev. aktiv session först
    if (forKortId !== undefined) { setOppenId(forKortId); oppenIdRef.current = forKortId; }
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
      const mål = oppenIdRef.current;
      if (t) { if (mål) rostUppdatera(t, mål); else parseNyRost(t); }
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
  }, [parseNyRost, rostUppdatera, visaToast]);

  const stoppaRost = useCallback(() => recRef.current?.stop(), []);

  // ── Svarsförslag ──────────────────────────────────────────────────────────────
  const foreslaSvar = useCallback(async (id: string) => {
    setForslagLoad(id);
    try {
      const r = await fetch("/api/lobby/suggest-reply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (r.ok && d.suggestions?.length) setForslag((f) => ({ ...f, [id]: d.suggestions }));
      else visaToast(d.error || "Inga förslag kunde skapas", "fel");
    } catch { visaToast("Kunde inte hämta förslag", "fel"); }
    finally { setForslagLoad(null); }
  }, [visaToast]);

  // ── Vyer ──────────────────────────────────────────────────────────────────────
  // Lead-pipelinen FÖRE MySales. En kontakt som redan är i MySales (status "passed"
  // ELLER matchad affär i pipelinen) lämnar vyn helt — den hör hemma i Fokus idag.
  const iMysales = useMemo(() => contacts.filter((c) => c.status === "passed" || c.pipeline_stage), [contacts]);
  const leads = useMemo(() => contacts.filter((c) => c.status !== "passed" && !c.pipeline_stage), [contacts]);
  const synliga = useMemo(
    () => (filter === "alla" ? leads : leads.filter((c) => c.status === filter)),
    [leads, filter],
  );
  const varmaAntal = useMemo(() => leads.filter((c) => c.status === "dialog" || c.status === "ready").length, [leads]);

  const oppetNamn = oppenId ? contacts.find((c) => c.id === oppenId)?.name?.split(" ")[0] : null;

  const kortProps = (c: Contact): React.ComponentProps<typeof Rad> => ({
    c, spara, sparar: sparar === c.id, radera, synka, oppnaIMysales,
    kanOppna: !!(c.ghl_contact_id && mysalesBase),
    oppen: oppenId === c.id, setOppen: (v: boolean) => setOppenId(v ? c.id : null),
    startaRost, byggPaBild, bygger: byggerId === c.id,
    foreslaSvar, forslag: forslag[c.id], forslagLoad: forslagLoad === c.id,
    rostAktivForDetta: (lyssnar || rostAnalys) && oppenId === c.id,
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
              <Users className="w-3.5 h-3.5" /> Nya leads
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Din lead-pipeline före MySales</h1>
            <p className="text-white/80 mt-1.5 text-sm max-w-lg">
              Nya kontakter från alla kanaler — följ hur varma de blir från kall lead till redo, och skicka vidare till MySales när det är läge.
            </p>
          </div>
          {linked && (
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={lyssnar ? stoppaRost : () => startaRost(undefined)} disabled={rostAnalys}
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
                <Plus className="w-3.5 h-3.5" /> Nytt lead
              </button>
            </div>
          )}
        </div>
        {linked && !loading && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-md">
            <HeroKpi label="Leads i pipeline" value={String(leads.length)} />
            <HeroKpi label="Varma" value={String(varmaAntal)} />
            <HeroKpi label="I MySales" value={String(iMysales.length)} />
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

      {/* Nytt lead-form */}
      {visaForm && linked && (
        <NyttLeadForm
          extraherar={extraherar} pastedImg={pastedImg} setPastedImg={setPastedImg}
          onBild={bildFilNy} onManuell={async (f) => { const c = await skapa(f); if (c) { visaToast(`${c.name} lades till`); setVisaForm(false); } }}
          onAvbryt={() => { setVisaForm(false); setPastedImg(null); }}
        />
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
      ) : !linked ? (
        <TomRuta ikon={Building2} titel="Ingen koppling än"
          text="Nya leads visas när klienten är kopplad till MySales Coach via sin GHL-location." />
      ) : leads.length === 0 && iMysales.length === 0 ? (
        <TomRuta ikon={Users} titel="Inga leads än" text="Klistra in en skärmbild, prata in eller klicka Nytt lead." />
      ) : (
        <>
          {/* Lead-pipelinen som en tratt — kall → het. Klicka ett steg för att filtrera. */}
          <LeadPipelineTratt
            leads={leads}
            filter={filter}
            onFilter={(s) => setFilter(s)}
          />

          {/* Steg-sektioner (eller det filtrerade steget) */}
          {(filter === "alla" ? LEAD_STEG : LEAD_STEG.filter((s) => s.status === filter)).map((steg) => {
            const kontakter = synliga.filter((c) => c.status === steg.status);
            if (!kontakter.length) return null;
            return (
              <section key={steg.status} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: steg.farg }} />
                  <h2 className="font-display font-bold text-gray-900 text-lg">{steg.label}</h2>
                  <span className="text-xs text-gray-400">({kontakter.length})</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${steg.farg}1a`, color: steg.farg }}>
                    {steg.varme}
                  </span>
                </div>
                <div className="space-y-2">{kontakter.map((c) => <Rad key={c.id} {...kortProps(c)} />)}</div>
              </section>
            );
          })}

          {leads.length === 0 && (
            <p className="text-sm text-gray-500 py-2">Inga leads i pipelinen just nu — nya kontakter dyker upp här.</p>
          )}

          {/* Redan i MySales → hör hemma i Fokus idag. Bara en diskret rad, inga kort. */}
          {iMysales.length > 0 && (
            <a href="/dashboard/fokus"
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 px-1 pt-2">
              <ArrowUpCircle className="w-3.5 h-3.5" />
              {iMysales.length} {iMysales.length === 1 ? "kontakt är" : "kontakter är"} redan i MySales-pipelinen — hantera i Fokus idag →
            </a>
          )}
        </>
      )}

      {toast && (
        <div onClick={() => setToast(null)}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-sm max-w-sm text-center cursor-pointer border ${
            toast.typ === "fel" ? "bg-white border-red-200 text-red-700" : "bg-gray-900 border-gray-900 text-white"
          }`}>{toast.text}</div>
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

// Lead-pipelinen som en klickbar tratt: fyra steg med antal + värme-nivå, kall → het.
function LeadPipelineTratt({
  leads,
  filter,
  onFilter,
}: {
  leads: Contact[];
  filter: Status | "alla";
  onFilter: (s: Status | "alla") => void;
}) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
      {LEAD_STEG.map((steg, i) => {
        const n = leads.filter((c) => c.status === steg.status).length;
        const aktiv = filter === steg.status;
        return (
          <div key={steg.status} className="flex items-stretch flex-1 min-w-[120px]">
            <button
              onClick={() => onFilter(aktiv ? "alla" : steg.status)}
              className="flex-1 rounded-xl border p-3 text-left transition-all hover:shadow-sm"
              style={aktiv ? { borderColor: steg.farg, background: `${steg.farg}0f` } : { borderColor: "#f3f4f6", background: "#fff" }}
              title={aktiv ? "Visa alla steg" : `Visa bara ${steg.label}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: steg.farg }}>{n}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${steg.farg}1a`, color: steg.farg }}>
                  {steg.varme}
                </span>
              </div>
              <div className="text-[13px] font-semibold text-gray-800 mt-1.5 leading-tight">{steg.label}</div>
            </button>
            {i < LEAD_STEG.length - 1 && (
              <div className="flex items-center px-0.5 text-gray-300 flex-shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NyttLeadForm({
  extraherar, pastedImg, setPastedImg, onBild, onManuell, onAvbryt,
}: {
  extraherar: boolean;
  pastedImg: string | null;
  setPastedImg: (v: string | null) => void;
  onBild: (f: File) => void;
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
          <Sparkles className="w-4 h-4" style={{ color: "#7c3aed" }} /> Klistra in skärmbild → Gemini skapar leadet direkt
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
          <span className="text-xs text-center">Dra &amp; släpp skärmbild från LinkedIn, mejl, Instagram, visitkort…</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBild(f); }} />
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
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Kanal</span>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-400 bg-white">
            {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <Falt etikett="Nästa steg" varde={nextStep} onChange={setNextStep} placeholder="T.ex. Skicka offert…" />
        <Falt etikett="Nästa kontakt" varde={nextDate} onChange={setNextDate} typ="date" />
        <div className="col-span-2"><Falt etikett="Anteckningar" varde={notes} onChange={setNotes} placeholder="Fritext…" /></div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onAvbryt} className="text-sm font-medium text-gray-500 hover:text-gray-900 px-3 py-1.5">Avbryt</button>
        <button onClick={spara} disabled={!rawText.trim() || extraherar}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gray-900 text-white rounded-lg px-3 py-1.5 disabled:opacity-40">
          <Plus className="w-3.5 h-3.5" /> Spara lead
        </button>
      </div>
    </div>
  );
}

function Rad(props: {
  c: Contact;
  spara: (id: string, ch: Partial<Contact>) => void;
  sparar: boolean;
  radera: (id: string) => void;
  synka: (c: Contact) => void;
  oppnaIMysales: (c: Contact) => void;
  kanOppna: boolean;
  oppen: boolean;
  setOppen: (v: boolean) => void;
  startaRost: (id: string) => void;
  byggPaBild: (id: string, dataUrl: string) => void;
  bygger: boolean;
  foreslaSvar: (id: string) => void;
  forslag?: { ton: string; text: string }[];
  forslagLoad: boolean;
  rostAktivForDetta: boolean;
}) {
  const {
    c, spara, sparar, radera, synka, oppnaIMysales, kanOppna, oppen, setOppen,
    startaRost, byggPaBild, bygger, foreslaSvar, forslag, forslagLoad, rostAktivForDetta,
  } = props;
  const [visaStatus, setVisaStatus] = useState(false);
  const [bekraftaRadera, setBekraftaRadera] = useState(false);
  const [kopierad, setKopierad] = useState<number | null>(null);
  const st = STATUS[c.status] || STATUS.new;
  const dagar = dagarSedan(c.last_contact_at);
  const diff = datumDiff(c.next_contact_date);
  const meta = PLATFORM_META[c.platform || "other"] || PLATFORM_META.other;
  const KanalIkon = meta.icon;
  const chatt = chattLank(c);

  const bildInput = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const url = ev.target?.result as string; if (url) byggPaBild(c.id, url); };
    reader.readAsDataURL(file);
  };
  const kortPaste = (e: React.ClipboardEvent) => {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (img) { e.preventDefault(); bildInput(img.getAsFile()); }
  };
  const kopiera = async (text: string, i: number) => {
    try { await navigator.clipboard.writeText(text); setKopierad(i); setTimeout(() => setKopierad(null), 1500); } catch { /* noop */ }
  };

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${oppen ? "border-gray-300 ring-1 ring-gray-200" : "border-gray-100"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0" title={meta.label}>
          <KanalIkon className="w-4 h-4 text-gray-500" />
        </div>
        <button onClick={() => setOppen(!oppen)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{c.name}</span>
            {c.company && <span className="text-sm text-gray-500 truncate">· {c.company}</span>}
            {c.name_match_stage && (
              <span title={`En affär med samma namn finns i pipelinen (${c.name_match_stage}). Kolla att det inte är samma person.`}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                kan redan vara i pipeline
              </span>
            )}
            {sparar && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span>{meta.label}</span>
            {dagar !== null && <span className={dagar >= 5 ? "text-red-500 font-medium" : ""}>Kontakt {dagar}d sedan</span>}
            {c.next_contact_date && (
              <span className={diff !== null && diff < 0 ? "text-red-500 font-medium" : diff === 0 ? "text-amber-600 font-medium" : ""}>
                Nästa: {visaDatum(c.next_contact_date)}
              </span>
            )}
          </div>
        </button>

        {chatt && (
          <a href={chatt.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            title={chatt.label}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" /> {chatt.label}
          </a>
        )}

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
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60 space-y-3" onPaste={kortPaste}>
          {/* Bygg på-verktyg */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mr-1">Bygg på detta case:</span>
            <label className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${bygger ? "opacity-50 border-gray-200" : "border-gray-200 text-gray-700 hover:bg-white"}`}>
              {bygger ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              Klistra in bild
              <input type="file" accept="image/*" className="hidden" disabled={bygger}
                onChange={(e) => bildInput(e.target.files?.[0])} />
            </label>
            <button onClick={() => startaRost(c.id)} disabled={rostAktivForDetta}
              className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-2.5 py-1.5 transition-colors ${rostAktivForDetta ? "border-red-200 text-red-600 bg-red-50" : "border-gray-200 text-gray-700 hover:bg-white"}`}>
              {rostAktivForDetta ? <Radio className="w-3.5 h-3.5 animate-pulse" /> : <Mic className="w-3.5 h-3.5" />} Prata in
            </button>
            <button onClick={() => foreslaSvar(c.id)} disabled={forslagLoad}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-2.5 py-1.5 disabled:opacity-50"
              style={{ background: "#7c3aed" }}>
              {forslagLoad ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />} Förslag på svar
            </button>
          </div>

          {/* Svarsförslag */}
          {forslag && forslag.length > 0 && (
            <div className="space-y-2">
              {forslag.map((s, i) => (
                <div key={i} className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-violet-700">{s.ton}</span>
                    <button onClick={() => kopiera(s.text, i)} className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
                      {kopierad === i ? <><Check className="w-3.5 h-3.5" /> Kopierat</> : <><Copy className="w-3.5 h-3.5" /> Kopiera</>}
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Kontaktuppgifter + chatt (mobil) */}
          <div className="flex flex-wrap gap-4 text-sm">
            {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:underline"><Mail className="w-4 h-4 text-gray-400" /> {c.email}</a>}
            {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-800 hover:underline"><Phone className="w-4 h-4 text-gray-400" /> {c.phone}</a>}
            {c.title && <span className="text-gray-500">{c.title}</span>}
            {chatt && (
              <a href={chatt.url} target="_blank" rel="noreferrer" className="sm:hidden inline-flex items-center gap-1.5 text-gray-700 hover:underline">
                <ExternalLink className="w-4 h-4 text-gray-400" /> {chatt.label}
              </a>
            )}
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
            <div className="sm:col-span-2">
              <Falt etikett="Chatt-/profillänk" varde={c.profile_url || ""} onChange={(v) => spara(c.id, { profile_url: v })} placeholder="linkedin.com/in/… eller hemsida" commitOnBlur />
            </div>
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white rounded-lg px-3 py-1.5 disabled:opacity-40" style={{ background: "#059669" }}>
                <ArrowUpCircle className="w-3.5 h-3.5" /> Skicka till MySales
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
              <span className="inline-flex items-center gap-1.5 text-xs ml-auto">
                <button onClick={() => radera(c.id)} className="font-semibold text-red-600 hover:underline">Radera?</button>
                <button onClick={() => setBekraftaRadera(false)} className="text-gray-400 hover:text-gray-600">avbryt</button>
              </span>
            ) : (
              <button onClick={() => setBekraftaRadera(true)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 ml-auto">
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
