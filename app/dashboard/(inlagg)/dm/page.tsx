"use client";

import SmartTextarea from "@/components/SmartTextarea";
import { CoachPanel, type ScoredCard } from "@/components/FokusClient";
import { KANALER, kanalEtikett } from "@/lib/dm/skarmdump";
import type { FaltSpec } from "@/lib/ai/faltfordelning";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  UserPlus,
  Handshake,
  MessageCircle,
  Target,
  Zap,
  Plus,
  Trash2,
  Loader2,
  Send,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Trophy,
  XCircle,
  CalendarCheck,
  PauseCircle,
  Pencil,
  Sparkles,
  Image as ImageIcon,
  CalendarClock,
  Bell,
} from "lucide-react";

// DM-4 (Håkans fynd 11/8): "DM pipeline sitter inte ihop på samma sätt som pipeline i
// grundplanen, det fattas 2 steg". MySales Kund pipeline har sju fack — Ny, Bekräftad,
// Dialog, Erbjudande, Bokad, Vilande, Förlorad. VILANDE fanns inte här alls, och Bokad
// och Förlorad låg i en lista under tavlan i stället för som egna fack.
type Stage = "new" | "acknowledge" | "connect" | "offer" | "won" | "vilande" | "lost";

interface Contact {
  id: string;
  /** Saknas för kanaler utan handle (Messenger, LinkedIn) — namnet bär kontakten då. */
  ig_username: string | null;
  display_name: string | null;
  channel: string | null;
  source: string | null;
  source_post: string | null;
  stage: Stage;
  notes: string | null;
  next_action: string | null;
  next_action_at: string | null;
  reminder_at: string | null;
  ghl_contact_id: string | null;
  synced_to_ghl: boolean;
  created_at: string;
  updated_at: string;
}

interface Rule {
  id: string;
  keyword: string;
  match_mode: "contains" | "exact" | "starts_with";
  response: string;
  channel: "dm" | "comment" | "both";
  active: boolean;
  triggered_count: number;
}

// Samma sju fack som MySales Kund pipeline, i samma ordning. Namnen är kundens ord — byter
// man dem här slutar tavlan spegla grundplanen, och det var hela felet.
const STAGES: { id: Stage; label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }[] = [
  { id: "new", label: "Ny", icon: UserPlus, color: "bg-blue-500", desc: "Första kontakten, ej besvarad" },
  { id: "acknowledge", label: "Bekräftad", icon: Handshake, color: "bg-amber-500", desc: "Första svaret skickat, gett värde" },
  { id: "connect", label: "Dialog", icon: MessageCircle, color: "bg-purple-500", desc: "Dialog pågår, behov identifierat" },
  { id: "offer", label: "Erbjudande", icon: Target, color: "bg-emerald-500", desc: "Erbjudande presenterat" },
  { id: "won", label: "Bokad", icon: CalendarCheck, color: "bg-emerald-600", desc: "Tid bokad eller affär vunnen" },
  // VILANDE är inte en förlorad affär. Facket i MySales hette förut "Förlorad / Paus" och
  // slog ihop dem, vilket räknade varje parkerad kund som förlorad (FIX-1 B2). Nu är de skilda.
  { id: "vilande", label: "Vilande", icon: PauseCircle, color: "bg-slate-400", desc: "Parkerad, ska tas upp igen senare" },
  { id: "lost", label: "Förlorad", icon: XCircle, color: "bg-rose-500", desc: "Ingen affär, ingen uppföljning" },
];

/** De fack en kontakt aktivt arbetas i. Används där bara pågående kontakter räknas. */
const AKTIVA_STEG: Stage[] = ["new", "acknowledge", "connect", "offer"];

// Rent visuellt: mjuka färgbrickor per steg (matchar STAGES-färgerna, ändrar ingen logik).
const STAGE_STYLES: Record<Stage, { tile: string; icon: string }> = {
  new: { tile: "bg-blue-50", icon: "text-blue-600" },
  acknowledge: { tile: "bg-amber-50", icon: "text-amber-600" },
  connect: { tile: "bg-purple-50", icon: "text-purple-600" },
  offer: { tile: "bg-emerald-50", icon: "text-emerald-600" },
  won: { tile: "bg-emerald-50", icon: "text-emerald-600" },
  vilande: { tile: "bg-slate-100", icon: "text-slate-600" },
  lost: { tile: "bg-rose-50", icon: "text-rose-600" },
};

/**
 * ★ AUTO-SVAREN ÄR BORTA UR KUNDVYN (FIX-1/B1, Håkans beslut 2026-08-07).
 *
 * Fliken erbjöd att SYSTEMET skickar svar åt kunden: "När någon DM:ar eller kommenterar
 * med nyckelordet skickas auto-svaret." Det motsäger hela ramen produkten säljs på —
 * kunden skriver, systemet kommer ihåg. Metas 24-timmarsfönster pekar åt samma håll:
 * uppföljning dag 3 och dag 7 kan ändå inte skickas automatiskt.
 *
 * Funktionen är inte riven, den är flyttad. Admin behåller den som tillval; kunden ser
 * den inte alls. `/k/dm` renderar samma komponent som admin, så utan den här flaggan
 * hade den fortsatt synas för varje kund.
 */
export default function DMPage({ customerMode = false }: { customerMode?: boolean }) {
  const [tab, setTab] = useState<"pipeline" | "automation">("pipeline");
  // Alltid kundens färg: aktiv klient (kundens egen i /k, vald i admin) → överrida purple-accenten.
  const [accent, setAccent] = useState("#7c3aed");
  useEffect(() => {
    fetch("/api/clients/active").then((r) => (r.ok ? r.json() : null)).then((c) => { if (c?.primary_color) setAccent(c.primary_color); }).catch(() => {});
  }, []);
  const accentVars = {
    "--color-purple-50": `${accent}14`, "--color-purple-100": `${accent}26`, "--color-purple-300": accent,
    "--color-purple-500": accent, "--color-purple-600": accent, "--color-purple-700": accent,
  } as CSSProperties;

  return (
    <div className="max-w-7xl space-y-6" style={accentVars}>
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">DM & Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">
          {/* DM-4: raden räknade upp fyra steg medan grundplanen har sju. En rubrik som
              beskriver en annan tavla än den under är samma sorts tysta löfte som resten. */}
          Samma sju steg som i MySales: Ny → Bekräftad → Dialog → Erbjudande → Bokad, med Vilande för
          det som ska tas upp igen och Förlorad för det som inte blev något.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setTab("pipeline")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            tab === "pipeline" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Pipeline
        </button>
        {!customerMode && (
          <button
            onClick={() => setTab("automation")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === "automation" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Auto-svar (tillval)
          </button>
        )}
      </div>

      {/* Fail-closed: även om `tab` skulle stå på "automation" visas pipelinen i kundläge. */}
      {tab === "pipeline" || customerMode ? <PipelineView /> : <AutomationView />}
    </div>
  );
}

function PipelineView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [coachKontakt, setCoachKontakt] = useState<Contact | null>(null);
  // Kundens färg till coach-dialogen (samma accent som resten av vyn).
  const [coachAccent, setCoachAccent] = useState("#7c3aed");
  useEffect(() => {
    fetch("/api/clients/active").then((r) => (r.ok ? r.json() : null)).then((c) => { if (c?.primary_color) setCoachAccent(c.primary_color); }).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dm/contacts");
    const d = await r.json();
    setContacts(d.contacts || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function moveStage(id: string, newStage: Stage) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, stage: newStage } : c)));
    await fetch(`/api/dm/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
  }

  async function remove(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/dm/contacts/${id}`, { method: "DELETE" });
  }

  async function syncGhl(id: string) {
    const r = await fetch(`/api/dm/contacts/${id}/sync-ghl`, { method: "POST" });
    const d = await r.json();
    if (d.error) {
      alert("Kunde inte spara i kundregistret: " + d.error);
    } else {
      load();
    }
  }

  const won = contacts.filter((c) => c.stage === "won").length;
  const lost = contacts.filter((c) => c.stage === "lost").length;
  // DM-4: vilande är varken pågående eller avslutat. Räkningen "i pipeline" byggde förut på
  // "alla minus bokade och förlorade", vilket hade räknat en parkerad kontakt som pågående
  // arbete — exakt det fel som FIX-1 B2 handlar om, fast åt andra hållet.
  const vilande = contacts.filter((c) => c.stage === "vilande").length;
  const iPipeline = contacts.filter((c) => AKTIVA_STEG.includes(c.stage)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-gray-600">
            <span className="tabular-nums font-bold text-gray-900">{iPipeline}</span>
            i pipeline
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-emerald-700">
            <Trophy className="w-3.5 h-3.5" />
            <span className="tabular-nums font-bold">{won}</span> bokade
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-slate-600">
            <PauseCircle className="w-3.5 h-3.5" />
            <span className="tabular-nums font-bold">{vilande}</span> vilande
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-rose-600">
            <XCircle className="w-3.5 h-3.5" />
            <span className="tabular-nums font-bold">{lost}</span> förlorade
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Lägg till kontakt
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Laddar...</div>}

      {!loading && contacts.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-6 h-6 text-purple-600" />
          </div>
          <div className="font-display font-bold text-gray-900">Inga kontakter än</div>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Lägg till din första, t.ex. någon som kommenterat eller skickat ett DM, så följer du resan från första kontakt till bokad kund. Klicka <strong className="text-gray-700">Lägg till kontakt</strong> uppe till höger.
          </p>
        </div>
      )}

      {/* DM-4: sju fack, samma som grundplanen. På lg bryts de 4 + 3, på xl står de i rad. */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {STAGES.map((stage) => {
            const stageContacts = contacts.filter((c) => c.stage === stage.id);
            const Icon = stage.icon;
            const styles = STAGE_STYLES[stage.id];
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedId) {
                    moveStage(draggedId, stage.id);
                    setDraggedId(null);
                  }
                }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[400px] flex flex-col"
              >
                <div className="px-4 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`${styles.tile} w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-[18px] h-[18px] ${styles.icon}`} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-display font-bold text-sm text-gray-900 truncate">{stage.label}</span>
                      <span className="tabular-nums text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">
                        {stageContacts.length}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 leading-snug">{stage.desc}</div>
                </div>
                <div className="p-2.5 space-y-2.5 flex-1">
                  {stageContacts.length === 0 ? (
                    <div className="h-full min-h-[120px] flex items-center justify-center text-center px-3">
                      <span className="text-xs text-gray-400">Dra hit kontakter i det här steget</span>
                    </div>
                  ) : (
                    stageContacts.map((c) => (
                      <ContactCard
                        key={c.id}
                        contact={c}
                        onDragStart={() => setDraggedId(c.id)}
                        onUpdate={load}
                        onDelete={() => remove(c.id)}
                        onSyncGhl={() => syncGhl(c.id)}
                        onMoveTo={(s) => moveStage(c.id, s)}
                        onCoacha={() => setCoachKontakt(c)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DM-4: den gamla listan "Bokade & förlorade" är borta. Den fanns för att en
          avslutad kontakt annars försvann spårlöst när man markerade den — men nu har
          Bokad, Vilande och Förlorad egna fack på tavlan, och en lista som visar samma
          kontakter en andra gång blir en plats där siffrorna kan glida isär. */}

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onAdded={load} />}

      {/* Säljcoachen: samma dialog som i Fokus idag. Coachen hämtar själv kontakten,
          DM-konversationen och planerade uppföljningar via /api/fokus/coach. */}
      {coachKontakt && (
        <CoachPanel
          kort={kortFranKontakt(coachKontakt)}
          primaryColor={coachAccent}
          onClose={() => setCoachKontakt(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// DM-kontakt → det kort-format Säljcoachen redan talar. Värden coachen inte har på
// DM-sidan (affärsvärde, prioritet) lämnas neutrala: routen berikar själv ur databasen.
function kortFranKontakt(c: Contact): ScoredCard {
  const dagar = Math.max(0, Math.floor((Date.now() - new Date(c.updated_at || c.created_at).getTime()) / 86400000));
  return {
    id: c.id,
    namn: c.display_name || c.ig_username || "Kontakt",
    foretag: "",
    varde: 0,
    stegNamn: STAGES.find((s) => s.id === c.stage)?.label || (c.stage === "won" ? "Bokad" : c.stage === "lost" ? "Förlorad" : ""),
    typ: "kontakt",
    dagarISteget: dagar,
    dagarOverSla: 0,
    prioritet: 0,
    farg: "neutral",
    okantVarde: true,
    ghlContactId: c.ghl_contact_id || undefined,
    lagesText: `${dagar} ${dagar === 1 ? "dag" : "dagar"} sedan senaste rörelsen`,
    rekommenderatDrag: c.next_action || "",
  };
}


// ── DM-2: full redigeringsyta ────────────────────────────────────────────────
// Håkans krav 11/8: "när man redigerar en post är det för dåligt, den är jätte pluttig o
// stökig i storlek. öppna den fullt o säkerställ att det går smart o enkelt att prata in info".
//
// Tre saker som gör skillnad, och alla tre var trasiga i den inline-versionen:
//   1. PLATS. Fältet var 3 rader i text-xs inuti en 280 px kanban-kolumn. Nu 60 % av
//      fönsterhöjden, brödtext i normal storlek, i en yta som inte konkurrerar med kortet.
//   2. RÖSTEN. "Prata in" satt under ett pyttefält där transkriptionen inte gick att läsa
//      medan den kom in. Nu syns den i klartext, och knappen ligger där tummen är.
//   3. AVBRYT UTAN OLYCKA. Esc och klick utanför stänger, men bara när inget sparas — ett
//      halvsparat kort som stängs mitt i skrivningen är värre än ett extra klick.
function RedigeraKort({ contact, onSparad, onClose }: { contact: Contact; onSparad: () => void; onClose: () => void }) {
  // DM-3 (Håkans krav 11/8): "när man klickar på redigera så vill man ju kunna ändra ALLT på
  // kortet, inte bara en inforuta". Ytan ägde förut två fält — anteckningar och nästa steg —
  // och allt annat gick bara att ändra genom att dra kortet eller via dess knappar.
  // Nu bär den varje fält PATCH-vägen redan accepterar; inget behövde öppnas i API:t.
  const [namn, setNamn] = useState(contact.display_name || "");
  const [anvandarnamn, setAnvandarnamn] = useState(contact.ig_username || "");
  const [kanal, setKanal] = useState(contact.channel || "instagram");
  const [kalla, setKalla] = useState(contact.source || "manuell");
  const [lage, setLage] = useState<Stage>(contact.stage);
  const [motesTid, setMotesTid] = useState(isoTillFalt(contact.next_action_at));
  const [paminnelse, setPaminnelse] = useState(isoTillFalt(contact.reminder_at));
  const [next, setNext] = useState(contact.next_action || "");
  const [notes, setNotes] = useState(contact.notes || "");
  const [saving, setSaving] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  // Esc stänger. Lyssnaren tas bort när ytan stängs, annars äter den Esc i resten av sidan.
  useEffect(() => {
    const pa = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", pa);
    return () => window.removeEventListener("keydown", pa);
  }, [saving, onClose]);

  // ROST-1: dikteringen sorteras i ALLA fält här, inte bara i anteckningarna.
  function fyllFranRost(varden: Record<string, string>) {
    if (varden.namn) setNamn(varden.namn);
    if (varden.anvandarnamn) setAnvandarnamn(varden.anvandarnamn.replace(/^@/, ""));
    if (varden.kanal) setKanal(varden.kanal);
    if (varden.kalla) setKalla(varden.kalla);
    if (varden.lage) setLage(varden.lage as Stage);
    if (varden.motestid) setMotesTid(varden.motestid);
    if (varden.paminnelse) setPaminnelse(varden.paminnelse);
    if (varden.nastaSteg) setNext(varden.nastaSteg);
  }

  async function spara() {
    setSaving(true);
    setFel(null);
    try {
      const r = await fetch("/api/dm/contacts/" + contact.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: namn,
          ig_username: anvandarnamn,
          channel: kanal,
          source: kalla,
          stage: lage,
          notes,
          next_action: next,
          next_action_at: faltTillIso(motesTid),
          reminder_at: faltTillIso(paminnelse),
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        // Ett tyst misslyckande hade sett ut som en lyckad sparning: ytan stängs, ändringen är
        // borta, och nästa laddning visar det gamla värdet.
        setFel(d.error || "Kunde inte spara ändringen");
        return;
      }
      onSparad();
      onClose();
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const falt = "w-full px-3.5 py-2.5 text-base border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300";
  const etikett = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-gray-900 truncate">
              {contact.display_name || (contact.ig_username ? "@" + contact.ig_username : "Kontakt")}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Ändra vad du vill — allt på kortet går att rätta här.</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 -mr-2 text-gray-400 rounded-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40" title="Stäng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {fel && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fel}</div>}

          <div>
            <label className={etikett}>Namn</label>
            <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="För- och efternamn" className={falt} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={etikett}>Kanal</label>
              <select value={kanal} onChange={(e) => setKanal(e.target.value)} className={falt}>
                {KANALER.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className={etikett}>Användarnamn <span className="font-normal text-gray-400">(om du har det)</span></label>
              <input value={anvandarnamn} onChange={(e) => setAnvandarnamn(e.target.value)} placeholder="utan @" className={falt} />
            </div>
            <div>
              <label className={etikett}>Läge i pipelinen</label>
              <select value={lage} onChange={(e) => setLage(e.target.value as Stage)} className={falt}>
                {LAGEN.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className={etikett}>Kom in via</label>
              <select value={kalla} onChange={(e) => setKalla(e.target.value)} className={falt}>
                {KALLOR.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label className={etikett}>Bokad tid</label>
              <input type="datetime-local" value={motesTid} onChange={(e) => setMotesTid(e.target.value)} className={falt} />
            </div>
            <div>
              <label className={etikett}>Påminnelse</label>
              <input type="datetime-local" value={paminnelse} onChange={(e) => setPaminnelse(e.target.value)} className={falt} />
            </div>
          </div>

          <div>
            <label className={etikett}>Nästa steg</label>
            <input value={next} onChange={(e) => setNext(e.target.value)} placeholder="T.ex. Skicka förslag på två storlekar, senast fredag" className={falt} />
          </div>

          <div>
            <label className={etikett}>Vad har hänt i samtalet?</label>
            <p className="text-sm text-gray-500 mb-2">
              Prata in det med mikrofonen — namn, tid och nästa steg hamnar i sina egna fält, resten här.
            </p>
            <SmartTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              placeholder="T.ex. Hon frågade vad en skärm till entrén kostar och vill ha ett förslag före semestern."
              className="w-full px-4 py-3 text-base leading-relaxed border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
              faltschema={KONTAKT_ROSTFALT}
              onFalt={fyllFranRost}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-100 disabled:opacity-40">
            Avbryt
          </button>
          <button onClick={spara} disabled={saving} className="inline-flex items-center gap-2 bg-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:bg-purple-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  onDragStart,
  onUpdate,
  onDelete,
  onSyncGhl,
  onMoveTo,
  onCoacha,
}: {
  contact: Contact;
  onDragStart: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onSyncGhl: () => void;
  onMoveTo: (s: Stage) => void;
  onCoacha: () => void;
}) {
  // DM-3: kortet håller inget formulärstate längre. Redigeringsytan äger fälten, sparar
  // själv och ropar onUpdate när den lyckats — två kopior av samma värden kunde glida isär.
  const [editing, setEditing] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 hover:shadow-md transition-shadow cursor-move"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Namnet först. Användarnamnet finns bara på kanaler som har handles. */}
          <div className="font-semibold text-sm text-gray-900 truncate">
            {contact.display_name || `@${contact.ig_username}`}
          </div>
          {contact.display_name && contact.ig_username && (
            <div className="text-xs text-gray-500 truncate">@{contact.ig_username}</div>
          )}
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {kanalEtikett(contact.channel, contact.ig_username)}
            {contact.source ? ` · via ${contact.source}` : ""}
          </div>
        </div>
        <div className="flex gap-0.5">
          <button onClick={() => setEditing(!editing)} className="p-1.5 text-gray-400 rounded-lg hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Redigera">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 rounded-lg hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Ta bort">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* DM-2 (Håkans krav 11/8): redigeringen låg INNE i kortet — ett 3-raders fält i
          text-xs inuti en smal kanban-kolumn. "jätte pluttig o stökig i storlek". Nu öppnas
          den i full yta, med ett fält man faktiskt kan prata in i. Kortet blir inte högre av
          att man redigerar, och kolumnen hoppar inte till. */}
      {editing ? (
        <RedigeraKort contact={contact} onSparad={onUpdate} onClose={() => setEditing(false)} />
      ) : null}

      {(
        <>
          {contact.notes && (
            <div className="mt-2 text-xs text-gray-700 line-clamp-2 whitespace-pre-wrap">{contact.notes}</div>
          )}
          {contact.next_action && (
            <div className="mt-2 text-xs text-purple-700 font-medium flex items-start gap-1">
              <Target className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {contact.next_action}
            </div>
          )}
          {contact.next_action_at && (
            <div className="mt-1.5 text-xs text-emerald-700 font-medium flex items-start gap-1">
              <CalendarClock className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Bokat {narTid(contact.next_action_at)}
            </div>
          )}
          {contact.reminder_at && (
            <div className="mt-1 text-xs text-gray-500 flex items-start gap-1">
              <Bell className="w-3 h-3 mt-0.5 flex-shrink-0" />
              Påminnelse {narTid(contact.reminder_at)}
            </div>
          )}
        </>
      )}

      <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-1">
        <div className="flex gap-1">
          {contact.stage !== "won" && (
            <button
              onClick={() => onMoveTo("won")}
              className="text-xs text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg font-medium transition-colors"
              title="Markera som bokad"
            >
              <Trophy className="w-3.5 h-3.5" />
            </button>
          )}
          {contact.stage !== "vilande" && (
            <button
              onClick={() => onMoveTo("vilande")}
              className="text-xs text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
              title="Parkera som vilande — tas upp igen senare"
            >
              <PauseCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {contact.stage !== "lost" && (
            <button
              onClick={() => onMoveTo("lost")}
              className="text-xs text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
              title="Förlorad"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Säljcoach: exakt samma dialog och kontext som från Fokus idag. */}
          <button
            onClick={onCoacha}
            className="text-xs p-1.5 rounded-lg font-medium transition-colors hover:bg-purple-50"
            style={{ color: "var(--color-purple-600)" }}
            title="Coacha affären"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={onSyncGhl}
          className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
            contact.synced_to_ghl
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          title={contact.synced_to_ghl ? "Sparad i kundregister" : "Spara i kundregister"}
        >
          {contact.synced_to_ghl ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          Kundregister
        </button>
      </div>
    </div>
  );
}

// ── Tid: ISO ↔ fältet <input type="datetime-local"> (webbläsarens lokala tid) ──
// ── ROST-1 + DM-3: kontaktkortets fält, EN gång ─────────────────────────────
// Håkans två fynd 11/8:
//   · mikrofonen lade allt i fältet den stod under ("Elisabeth Andersson" → Anteckningar)
//   · "när man klickar på redigera vill man ju kunna ändra ALLT på kortet, inte bara en inforuta"
//
// Båda löses av samma sak: en lista över vad ett kontaktkort BÄR. Listan används av
// röstfördelningen (vart hör det jag säger?) och av redigeringsytan (vad får jag ändra?).
// Alternativen kommer ur samma listor som <select>-rutorna renderar — annars kan modellen
// svara ett värde som inte finns i rutan, och fältet blir tyst tomt.
const KALLOR: { id: string; label: string }[] = [
  { id: "kommentar", label: "Kommentar" },
  { id: "dm", label: "DM" },
  { id: "manuell", label: "Manuellt tillagd" },
  { id: "import", label: "Import" },
];

// Läget i pipelinen = grundplanens sju fack, inget mer. Listan lade förut till Bokad och
// Förlorad en andra gång; sedan DM-4 bär STAGES dem själv, och en dubblett i en <select>
// hade gett två rader med samma namn.
const LAGEN: { id: Stage; label: string }[] = STAGES.map((st) => ({ id: st.id, label: st.label }));

const KONTAKT_ROSTFALT: FaltSpec[] = [
  { nyckel: "namn", etikett: "Namn", typ: "text", hjalp: "för- och efternamn på personen" },
  { nyckel: "anvandarnamn", etikett: "Användarnamn", typ: "text", hjalp: "handle utan @" },
  { nyckel: "kanal", etikett: "Kanal", typ: "val", alternativ: KANALER.map((k) => k.id) },
  { nyckel: "kalla", etikett: "Kom in via", typ: "val", alternativ: KALLOR.map((k) => k.id) },
  { nyckel: "lage", etikett: "Läge i pipelinen", typ: "val", alternativ: LAGEN.map((l) => String(l.id)) },
  { nyckel: "motestid", etikett: "Bokad tid", typ: "datumtid" },
  { nyckel: "paminnelse", etikett: "Påminnelse", typ: "datumtid" },
  { nyckel: "nastaSteg", etikett: "Nästa steg", typ: "text", hjalp: "vad som ska hända härnäst" },
];

function isoTillFalt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function faltTillIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/** "måndag 3 augusti kl 10:00" — samma formulering som resten av flödet. */
function narTid(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleString("sv-SE", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    .replace(/(\d{2}:\d{2})$/, "kl $1")
    .replace(" kl kl ", " kl ");
}

interface Forifyllnad {
  display_name: string;
  ig_username: string;
  channel: string;
  source: string;
  stage: Stage;
  notes: string;
  next_action: string;
  next_action_at: string | null;
  reminder_at: string | null;
}
interface Tolkning {
  fas: string;
  utfall: string;
  varme: string;
  foreslogAv: string | null;
  bekraftadAv: string | null;
  motestidText: string;
  motestidLasbar: string;
  paminnelseLasbar: string;
}

// DM-4: EN lista, samma sju fack som tavlan och som grundplanen. Den handskrivna kopian
// saknade Vilande — och en <select> som saknar ett fack gör facket oanvändbart.
const STEG_VAL: { id: Stage; label: string }[] = LAGEN;

function AddContactModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [username, setUsername] = useState("");
  const [namn, setNamn] = useState("");
  const [kanal, setKanal] = useState("instagram");
  const [source, setSource] = useState("kommentar");
  const [stage, setStage] = useState<Stage>("new");
  const [notes, setNotes] = useState("");
  const [nastaSteg, setNastaSteg] = useState("");
  const [motesTid, setMotesTid] = useState("");
  const [paminnelse, setPaminnelse] = useState("");
  const [saving, setSaving] = useState(false);
  const [laser, setLaser] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [tolkning, setTolkning] = useState<Tolkning | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── ROST-1 (Håkans fynd 11/8): dikteringen ska hamna i RÄTT fält ────────────
  // Han klickade mikrofonen, sa "Elisabeth Andersson", och namnet landade i ANTECKNINGAR
  // medan namnrutan stod tom. Skärmdumpsvägen (lasAvBild) kunde fylla varje fält sedan
  // tidigare — rösten hade aldrig fått samma behandling.
  //
  // Schemat beskriver formuläret för fördelningen. Alternativen är EXAKT samma listor som
  // <select>-fälten renderar, så modellen aldrig kan svara ett värde som inte finns i rutan.
  const rostFalt = KONTAKT_ROSTFALT;

  // Fältnycklarna översätts till formulärets states. Okända nycklar kan inte komma hit —
  // routen skär bort allt som inte står i schemat ovan.
  function fyllFranRost(varden: Record<string, string>) {
    if (varden.namn) setNamn(varden.namn);
    if (varden.anvandarnamn) setUsername(varden.anvandarnamn.replace(/^@/, ""));
    if (varden.kanal) setKanal(varden.kanal);
    if (varden.kalla) setSource(varden.kalla);
    if (varden.lage) setStage(varden.lage as Stage);
    if (varden.motestid) setMotesTid(varden.motestid);
    if (varden.paminnelse) setPaminnelse(varden.paminnelse);
    if (varden.nastaSteg) setNastaSteg(varden.nastaSteg);
  }

  // Skärmdump → färdigt formulär. Allt bildläsningen får ut fyller fälten direkt:
  // användaren ska aldrig skriva in det som redan står i bilden.
  async function lasAvBild(file: File | Blob) {
    setFel(null);
    if (file.size > 8 * 1024 * 1024) {
      setFel("Bilden är för stor (max 8 MB)");
      return;
    }
    setLaser(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("läsfel"));
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/dm/extract-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const d = await r.json();
      if (!r.ok || !d.formular) {
        setFel(d.error || "Kunde inte läsa av bilden");
        return;
      }
      const f = d.formular as Forifyllnad;
      if (f.display_name) setNamn(f.display_name);
      if (f.ig_username) setUsername(f.ig_username);
      if (f.channel) setKanal(f.channel);
      if (f.source) setSource(f.source);
      if (f.stage) setStage(f.stage);
      if (f.notes) setNotes(f.notes);
      if (f.next_action) setNastaSteg(f.next_action);
      setMotesTid(isoTillFalt(f.next_action_at));
      setPaminnelse(isoTillFalt(f.reminder_at));
      setTolkning(d.tolkning as Tolkning);
    } catch {
      setFel("Kunde inte läsa av bilden");
    } finally {
      setLaser(false);
    }
  }

  // Ctrl+V var som helst i dialogen — även inne i anteckningsfältet. Fångas i
  // capture-fasen så att en inklistrad skärmdump ALLTID går till avläsningen som
  // förifyller formuläret, aldrig till den fria sammanfattningen. Text klistras in som vanligt.
  function onPasteCapture(e: React.ClipboardEvent) {
    if (laser) return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const f = item?.getAsFile();
    if (f) {
      e.preventDefault();
      e.stopPropagation();
      lasAvBild(f);
    }
  }

  const kanFortsatta = !!(namn.trim() || username.trim());

  async function save() {
    if (!kanFortsatta) return;
    setSaving(true);
    try {
      const r = await fetch("/api/dm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ig_username: username,
          display_name: namn,
          channel: kanal,
          source,
          stage,
          notes,
          next_action: nastaSteg,
          next_action_at: faltTillIso(motesTid),
          reminder_at: faltTillIso(paminnelse),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setFel(d.error || "Kunde inte spara kontakten");
        return;
      }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const kraverHandle = kanal === "instagram";
  const falt = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        onPasteCapture={onPasteCapture}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) lasAvBild(f);
        }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-[18px] h-[18px] text-purple-600" />
          </div>
          <h3 className="font-display font-bold text-lg text-gray-900">Lägg till kontakt</h3>
        </div>

        {/* Skärmdumpen först: den fyller resten av formuläret. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={laser}
          className="w-full border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-xl px-4 py-4 text-left hover:bg-purple-50 transition-colors disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-purple-100 flex items-center justify-center flex-shrink-0">
              {laser ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <ImageIcon className="w-4 h-4 text-purple-600" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                {laser ? "Läser av skärmdumpen…" : "Läs av en skärmdump av chatten"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Klistra in (Ctrl+V), släpp bilden här eller välj fil. Messenger, Instagram DM och LinkedIn.
              </div>
            </div>
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) lasAvBild(f);
            e.target.value = "";
          }}
        />

        {fel && <div className="mt-3 text-sm text-red-600">{fel}</div>}

        {/* Vad bilden gav — med rätt person på rätt replik. */}
        {tolkning && (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 space-y-1">
            <div className="text-sm font-semibold text-emerald-900">Avläst ur skärmdumpen</div>
            {tolkning.motestidText && (
              <div className="text-xs text-emerald-900/80">
                {tolkning.foreslogAv === "kontakt" ? (namn || "Kontakten") : "Du"} föreslog {tolkning.motestidText}
                {tolkning.bekraftadAv
                  ? ` · ${tolkning.bekraftadAv === "kontakt" ? (namn || "kontakten") : "du"} bekräftade`
                  : " · ingen bekräftelse än"}
              </div>
            )}
            {tolkning.motestidLasbar && (
              <div className="text-xs text-emerald-900/80">Möte: {tolkning.motestidLasbar}</div>
            )}
            {tolkning.paminnelseLasbar && (
              <div className="text-xs text-emerald-900/80">Påminnelse: {tolkning.paminnelseLasbar}</div>
            )}
            <div className="text-xs text-emerald-900/60">Ändra fritt nedan innan du lägger till.</div>
          </div>
        )}

        <div className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Namn</label>
            <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="För- och efternamn" autoFocus className={falt} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Kanal</label>
              <select value={kanal} onChange={(e) => setKanal(e.target.value)} className={falt}>
                {KANALER.map((k) => (
                  <option key={k.id} value={k.id}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Användarnamn <span className="font-normal text-gray-400">{kraverHandle ? "(om du har det)" : "(valfritt)"}</span>
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={kraverHandle ? "utan @" : "finns sällan här"}
                className={falt}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Läge i pipelinen</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as Stage)} className={falt}>
                {STEG_VAL.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Kom in via</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={falt}>
                <option value="kommentar">Kommentar</option>
                <option value="dm">DM</option>
                <option value="manuell">Manuellt tillagd</option>
                <option value="import">Import</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Bokad tid</label>
              <input type="datetime-local" value={motesTid} onChange={(e) => setMotesTid(e.target.value)} className={falt} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Påminnelse</label>
              <input type="datetime-local" value={paminnelse} onChange={(e) => setPaminnelse(e.target.value)} className={falt} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nästa steg</label>
            <input value={nastaSteg} onChange={(e) => setNastaSteg(e.target.value)} placeholder="Vad som ska hända härnäst" className={falt} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Anteckningar</label>
            <SmartTextarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Vad som sagts hittills, klistra in eller ladda upp en skärmdump, eller prata in det"
              className={falt}
              // KVALITET-3/10: Bild-knappen ska gå till den strukturerade avläsningen,
              // inte den fria sammanfattningen — den kastade om vem som sagt vad.
              onBild={async (f) => { await lasAvBild(f); return true; }}
              // ROST-1: säg "Elisabeth Andersson, kom in via kommentar, ring på tisdag" och
              // varje uppgift hamnar i sitt fält. Det som inte hör i ett fält stannar här.
              faltschema={rostFalt}
              onFalt={fyllFranRost}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
              Avbryt
            </button>
            <button
              onClick={save}
              disabled={saving || !kanFortsatta}
              title={kanFortsatta ? "" : "Fyll i namn eller användarnamn"}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Lägg till
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationView() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");
  const [matchMode, setMatchMode] = useState<"contains" | "exact" | "starts_with">("contains");
  const [channel, setChannel] = useState<"dm" | "comment" | "both">("both");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dm/rules");
    const d = await r.json();
    setRules(d.rules || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!keyword.trim() || !response.trim()) return;
    setSaving(true);
    await fetch("/api/dm/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, response, match_mode: matchMode, channel }),
    });
    setKeyword("");
    setResponse("");
    setSaving(false);
    load();
  }

  async function toggle(rule: Rule) {
    await fetch(`/api/dm/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/dm/rules/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Zap className="w-[18px] h-[18px] text-amber-600" />
          </div>
          <h3 className="font-display font-bold text-gray-900">Ny automatiseringsregel</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          När någon DM:ar eller kommenterar med nyckelordet skickas auto-svaret. Spara tid på upprepade frågor.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Nyckelord (t.ex. 'pris', 'boka tid')"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
          />
          <div className="flex gap-2">
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as "contains" | "exact" | "starts_with")}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
            >
              <option value="contains">Innehåller</option>
              <option value="exact">Exakt</option>
              <option value="starts_with">Börjar med</option>
            </select>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "dm" | "comment" | "both")}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
            >
              <option value="dm">DM</option>
              <option value="comment">Kommentar</option>
              <option value="both">Båda</option>
            </select>
          </div>
        </div>
        <SmartTextarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          placeholder="Auto-svar: skriv som du själv hade svarat. Använd {namn} för att ge personen deras egna namn."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-300"
        />
        <button
          onClick={add}
          disabled={saving || !keyword.trim() || !response.trim()}
          className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Lägg till regel
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Laddar regler...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-amber-600" />
          </div>
          <div className="font-display font-bold text-gray-900">Inga regler ännu</div>
          <p className="text-sm text-gray-500 mt-1.5">Lägg till din första automatiseringsregel i rutan ovan.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((rule) => (
            <div key={rule.id} className={`bg-white border rounded-xl shadow-sm p-4 flex items-start gap-3 ${rule.active ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
              <button onClick={() => toggle(rule)} className="flex-shrink-0 mt-1">
                {rule.active ? (
                  <ToggleRight className="w-8 h-8 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">"{rule.keyword}"</span>
                  <span className="text-xs text-gray-500">{rule.match_mode}</span>
                  <span className="text-xs text-gray-500">·</span>
                  <span className="text-xs text-gray-500">{rule.channel}</span>
                  {rule.triggered_count > 0 && (
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Triggat {rule.triggered_count}×
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{rule.response}</div>
              </div>
              <button
                onClick={() => remove(rule.id)}
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
