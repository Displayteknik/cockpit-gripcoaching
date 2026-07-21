"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Loader2, RefreshCw, Mail, Phone, Building2, CalendarClock,
  AlertCircle, CheckCircle2, ChevronDown,
} from "lucide-react";

// Lobbyn i Cockpit — kontakterna INNAN de blir affärer i pipelinen.
// Porterad från MySales Coach (`src/pages/Lobby.tsx`) men skriven i Cockpits
// ljusa designspråk istället för Coachens mörka. Data via /api/lobby/contacts.

type Status = "new" | "contacted" | "dialog" | "ready" | "passed";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  platform: string | null;
  status: Status;
  last_message: string | null;
  sentiment: number | null;
  next_step: string | null;
  next_contact_date: string | null;
  last_contact_at: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

const STATUS: Record<Status, { label: string; chip: string }> = {
  new: { label: "Okänd", chip: "bg-slate-100 text-slate-600 border-slate-200" },
  contacted: { label: "Kontaktad", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  dialog: { label: "Dialog", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ready: { label: "Redo", chip: "bg-amber-50 text-amber-700 border-amber-200" },
  passed: { label: "I MySales", chip: "bg-gray-100 text-gray-500 border-gray-200" },
};
const STATUS_ORDER: Status[] = ["new", "contacted", "dialog", "ready", "passed"];

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", fb: "Facebook", ig: "Instagram",
  email: "E-post", phone: "Telefon", web: "Webb", other: "Övrigt",
};

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

// Samma grupplogik som Coachen: försenat först, sen idag, sen kommande, sen odaterat.
function gruppera(contacts: Contact[]) {
  const forsenat: Contact[] = [], idag: Contact[] = [], kommande: Contact[] = [], utanDatum: Contact[] = [];
  for (const c of contacts) {
    const diff = datumDiff(c.next_contact_date);
    if (diff === null) utanDatum.push(c);
    else if (diff < 0) forsenat.push(c);
    else if (diff === 0) idag.push(c);
    else kommande.push(c);
  }
  kommande.sort((a, b) => (a.next_contact_date || "").localeCompare(b.next_contact_date || ""));
  forsenat.sort((a, b) => (a.next_contact_date || "").localeCompare(b.next_contact_date || ""));
  return { forsenat, idag, kommande, utanDatum };
}

export default function LobbyClient({ primaryColor = "#6366f1" }: { primaryColor?: string }) {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sparar, setSparar] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "alla">("alla");

  const ladda = useCallback(() => {
    setLoading(true);
    fetch("/api/lobby/contacts")
      .then((r) => r.json())
      .then((d) => {
        setLinked(d.linked !== false);
        setContacts(d.contacts || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { ladda(); }, [ladda]);

  const spara = useCallback(async (id: string, changes: Partial<Contact>) => {
    setSparar(id);
    // Optimistiskt — rullas tillbaka om servern säger nej.
    const innan = contacts;
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    try {
      const r = await fetch("/api/lobby/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, changes }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.contact) setContacts((cs) => cs.map((c) => (c.id === id ? d.contact : c)));
    } catch {
      setContacts(innan);
    } finally {
      setSparar(null);
    }
  }, [contacts]);

  const synliga = useMemo(
    () => (filter === "alla" ? contacts : contacts.filter((c) => c.status === filter)),
    [contacts, filter],
  );
  const grupper = useMemo(() => gruppera(synliga), [synliga]);

  const antalForsenat = gruppera(contacts).forsenat.length;
  const antalIdag = gruppera(contacts).idag.length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}
      >
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
              <Users className="w-3.5 h-3.5" /> Lobbyn
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Dina kontakter före affären</h1>
            <p className="text-white/80 mt-1.5 text-sm max-w-lg">
              Alla du pratat med men som inte blivit affär än. Ta de försenade först.
            </p>
          </div>
          <button
            onClick={ladda}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
          </button>
        </div>
        {linked && !loading && (
          <div className="relative mt-6 grid grid-cols-3 gap-3 max-w-md">
            <HeroKpi label="Kontakter" value={String(contacts.length)} />
            <HeroKpi label="Försenade" value={String(antalForsenat)} />
            <HeroKpi label="Idag" value={String(antalIdag)} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Laddar…
        </div>
      ) : !linked ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Ingen koppling än</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Lobbyn visas när klienten är kopplad till MySales Coach via sin GHL-location.
          </p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Inga kontakter än</div>
          <p className="text-sm text-gray-500 mt-1">Nya kontakter läggs till i MySales Coach.</p>
        </div>
      ) : (
        <>
          {/* Statusfilter */}
          <div className="flex flex-wrap gap-2">
            <FilterKnapp aktiv={filter === "alla"} onClick={() => setFilter("alla")} label={`Alla (${contacts.length})`} />
            {STATUS_ORDER.map((s) => {
              const n = contacts.filter((c) => c.status === s).length;
              if (!n) return null;
              return <FilterKnapp key={s} aktiv={filter === s} onClick={() => setFilter(s)} label={`${STATUS[s].label} (${n})`} />;
            })}
          </div>

          <Grupp titel="Försenade" kontakter={grupper.forsenat} ton="röd" spara={spara} sparar={sparar} />
          <Grupp titel="Att göra idag" kontakter={grupper.idag} ton="gul" spara={spara} sparar={sparar} />
          <Grupp titel="Kommande" kontakter={grupper.kommande} ton="neutral" spara={spara} sparar={sparar} />
          <Grupp titel="Utan datum" kontakter={grupper.utanDatum} ton="neutral" spara={spara} sparar={sparar} />
        </>
      )}
    </div>
  );
}

function HeroKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur ring-1 ring-white/10">
      <div className="text-[11px] uppercase tracking-wider text-white/70 font-semibold">{label}</div>
      <div className="text-xl font-bold text-white tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function FilterKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
        aktiv ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function Grupp({
  titel, kontakter, ton, spara, sparar,
}: {
  titel: string;
  kontakter: Contact[];
  ton: "röd" | "gul" | "neutral";
  spara: (id: string, c: Partial<Contact>) => void;
  sparar: string | null;
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
      <div className="space-y-2">
        {kontakter.map((c) => (
          <Rad key={c.id} c={c} spara={spara} sparar={sparar === c.id} />
        ))}
      </div>
    </section>
  );
}

function Rad({ c, spara, sparar }: { c: Contact; spara: (id: string, ch: Partial<Contact>) => void; sparar: boolean }) {
  const [oppen, setOppen] = useState(false);
  const [visaStatus, setVisaStatus] = useState(false);
  const st = STATUS[c.status] || STATUS.new;
  const dagar = dagarSedan(c.last_contact_at);
  const diff = datumDiff(c.next_contact_date);

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
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
          <button
            onClick={() => setVisaStatus(!visaStatus)}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${st.chip}`}
          >
            {st.label} <ChevronDown className="w-3 h-3" />
          </button>
          {visaStatus && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisaStatus(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => { spara(c.id, { status: s }); setVisaStatus(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${s === c.status ? "font-semibold text-gray-900" : "text-gray-600"}`}
                  >
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
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-gray-700 hover:underline">
                <Mail className="w-4 h-4 text-gray-400" /> {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-gray-800 hover:underline">
                <Phone className="w-4 h-4 text-gray-400" /> {c.phone}
              </a>
            )}
            {c.title && <span className="text-gray-500">{c.title}</span>}
          </div>

          {c.last_message && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Senaste meddelande</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.last_message}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Falt
              etikett="Nästa steg"
              varde={c.next_step || ""}
              onSpara={(v) => spara(c.id, { next_step: v })}
              placeholder="Vad ska hända härnäst?"
            />
            <Falt
              etikett="Nästa kontakt"
              varde={c.next_contact_date || ""}
              onSpara={(v) => spara(c.id, { next_contact_date: v })}
              typ="date"
            />
          </div>

          {c.notes && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1">Anteckningar</div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Falt({
  etikett, varde, onSpara, placeholder, typ = "text",
}: {
  etikett: string; varde: string; onSpara: (v: string) => void; placeholder?: string; typ?: string;
}) {
  const [utkast, setUtkast] = useState(varde);
  useEffect(() => { setUtkast(varde); }, [varde]);

  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">{etikett}</span>
      <input
        type={typ}
        value={utkast}
        placeholder={placeholder}
        onChange={(e) => setUtkast(e.target.value)}
        onBlur={() => { if (utkast !== varde) onSpara(utkast); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-gray-400 bg-white"
      />
    </label>
  );
}
