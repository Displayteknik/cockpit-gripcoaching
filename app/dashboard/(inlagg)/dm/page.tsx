"use client";

import SmartTextarea from "@/components/SmartTextarea";

import { useEffect, useState, type CSSProperties } from "react";
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
  Pencil,
} from "lucide-react";

type Stage = "new" | "acknowledge" | "connect" | "offer" | "won" | "lost";

interface Contact {
  id: string;
  ig_username: string;
  display_name: string | null;
  source: string | null;
  source_post: string | null;
  stage: Stage;
  notes: string | null;
  next_action: string | null;
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

const STAGES: { id: Stage; label: string; icon: React.ComponentType<{ className?: string }>; color: string; desc: string }[] = [
  { id: "new", label: "Ny", icon: UserPlus, color: "bg-blue-500", desc: "Första kontakten — ej besvarad" },
  { id: "acknowledge", label: "Acknowledge", icon: Handshake, color: "bg-amber-500", desc: "Första svaret skickat — gett värde" },
  { id: "connect", label: "Connect", icon: MessageCircle, color: "bg-purple-500", desc: "Dialog pågår — behov identifierat" },
  { id: "offer", label: "Offer", icon: Target, color: "bg-emerald-500", desc: "Erbjudande presenterat" },
];

// Rent visuellt: mjuka färgbrickor per steg (matchar STAGES-färgerna, ändrar ingen logik).
const STAGE_STYLES: Record<Stage, { tile: string; icon: string }> = {
  new: { tile: "bg-blue-50", icon: "text-blue-600" },
  acknowledge: { tile: "bg-amber-50", icon: "text-amber-600" },
  connect: { tile: "bg-purple-50", icon: "text-purple-600" },
  offer: { tile: "bg-emerald-50", icon: "text-emerald-600" },
  won: { tile: "bg-emerald-50", icon: "text-emerald-600" },
  lost: { tile: "bg-rose-50", icon: "text-rose-600" },
};

export default function DMPage() {
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
          Från första kommentar till bokad kund — ACO-flödet (Acknowledge / Connect / Offer).
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
        <button
          onClick={() => setTab("automation")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            tab === "automation" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Automation
        </button>
      </div>

      {tab === "pipeline" ? <PipelineView /> : <AutomationView />}
    </div>
  );
}

function PipelineView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

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
      alert("GHL-synk: " + d.error);
    } else {
      load();
    }
  }

  const won = contacts.filter((c) => c.stage === "won").length;
  const lost = contacts.filter((c) => c.stage === "lost").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-gray-600">
            <span className="tabular-nums font-bold text-gray-900">{contacts.length - won - lost}</span>
            i pipeline
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-1.5 text-sm text-emerald-700">
            <Trophy className="w-3.5 h-3.5" />
            <span className="tabular-nums font-bold">{won}</span> bokade
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
            Lägg till din första — t.ex. någon som kommenterat eller skickat ett DM — så följer du resan från första kontakt till bokad kund. Klicka <strong className="text-gray-700">Lägg till kontakt</strong> uppe till höger.
          </p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onAdded={load} />}
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
}: {
  contact: Contact;
  onDragStart: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onSyncGhl: () => void;
  onMoveTo: (s: Stage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(contact.notes || "");
  const [next, setNext] = useState(contact.next_action || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/dm/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, next_action: next }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 hover:shadow-md transition-shadow cursor-move"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">@{contact.ig_username}</div>
          {contact.display_name && (
            <div className="text-xs text-gray-500 truncate">{contact.display_name}</div>
          )}
          {contact.source && (
            <div className="text-xs text-gray-400 mt-0.5">via {contact.source}</div>
          )}
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

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anteckningar..."
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
          />
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Nästa steg..."
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
          />
          <div className="flex gap-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded-lg font-semibold shadow-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Spara
            </button>
            <button onClick={() => setEditing(false)} className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
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
          {contact.stage !== "lost" && (
            <button
              onClick={() => onMoveTo("lost")}
              className="text-xs text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
              title="Förlorad"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={onSyncGhl}
          className={`text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
            contact.synced_to_ghl
              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          title={contact.synced_to_ghl ? "Synkad till GHL" : "Skicka till GHL"}
        >
          {contact.synced_to_ghl ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          GHL
        </button>
      </div>
    </div>
  );
}

function AddContactModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [username, setUsername] = useState("");
  const [source, setSource] = useState("kommentar");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!username.trim()) return;
    setSaving(true);
    await fetch("/api/dm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ig_username: username, source, notes }),
    });
    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-[18px] h-[18px] text-purple-600" />
          </div>
          <h3 className="font-display font-bold text-lg text-gray-900">Lägg till kontakt</h3>
        </div>
        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Instagram-användarnamn (utan @)"
            autoFocus
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
          >
            <option value="kommentar">Kommentar</option>
            <option value="dm">DM</option>
            <option value="manuell">Manuellt tillagd</option>
            <option value="import">Import</option>
          </select>
          <SmartTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Anteckningar (valfritt)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-300"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
              Avbryt
            </button>
            <button
              onClick={save}
              disabled={saving || !username.trim()}
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
          placeholder="Auto-svar — skriv som du själv hade svarat. Använd {namn} för att ge personen deras egna namn."
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
