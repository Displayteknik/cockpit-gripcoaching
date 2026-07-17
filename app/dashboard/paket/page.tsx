"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Check, Package, Megaphone, Users as UsersIcon, Copy, RefreshCw,
  Plus, Sparkles, Circle, CheckCircle2, MinusCircle,
} from "lucide-react";
import { DashHero, LivePill } from "@/components/ui/dash";

// ── Typer ───────────────────────────────────────────────────────────────────
interface Module {
  id: string; label: string; description: string | null; owner_area: string | null;
  active: boolean; in_pro_default: boolean; campaign: boolean; campaign_label: string | null; campaign_until: string | null;
}
interface TenantRow {
  id: string; label: string; description: string | null; in_pro_default: boolean;
  active: boolean; effective: boolean; source: "standard" | "kampanj" | "manuell" | null; override: "add" | "remove" | null;
}
interface Client { id: string; name: string; primary_color?: string }
interface PlatformUser {
  id: string; email: string; client_id: string; role: string; active: boolean;
  activated_at: string | null; invited_at: string; login_token: string; clients?: { name: string } | null;
}

type Tab = "standard" | "kund" | "anvandare";

export default function PaketPage() {
  const [tab, setTab] = useState<Tab>("standard");
  return (
    <div className="max-w-4xl space-y-6">
      <DashHero
        title="Paket & moduler"
        subtitle="Styr vad som ingår i MySales Pro, kör kampanjer, och ge enskilda kunder extra moduler — allt slår igenom direkt, utan deploy."
        icon={Package}
        eyebrow={<LivePill label="MySales Pro" />}
      />

      <div className="flex gap-1 border-b border-gray-200">
        {([
          { k: "standard", label: "Pro-standard", icon: Package },
          { k: "kund", label: "Per kund", icon: UsersIcon },
          { k: "anvandare", label: "Användare", icon: UsersIcon },
        ] as { k: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.k ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "standard" && <ProStandard />}
      {tab === "kund" && <PerKund />}
      {tab === "anvandare" && <Anvandare />}
    </div>
  );
}

// ── Vy 1: Pro-standard ──────────────────────────────────────────────────────
function ProStandard() {
  const [mods, setMods] = useState<Module[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/platform/modules");
    setMods(await r.json());
  }
  useEffect(() => { load(); }, []);

  async function patch(id: string, body: Partial<Module>) {
    setBusy(id);
    await fetch("/api/platform/modules", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await load();
    setBusy(null);
  }

  if (!mods) return <Spinner />;
  const live = mods.filter((m) => m.active);
  const kommande = mods.filter((m) => !m.active);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Bocka i vilka moduler som ingår i MySales Pro-standarden. Ändringar slår mot <strong>alla Pro-kunder</strong> direkt.
        Vill du köra en kampanj — slå på "Ingår just nu" och skriv texten kunden ser.
      </p>
      {live.map((m) => (
        <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900">{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
            </div>
            <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
              <span className="text-xs text-gray-500">Ingår i Pro</span>
              <input type="checkbox" checked={m.in_pro_default} disabled={busy === m.id}
                onChange={(e) => patch(m.id, { in_pro_default: e.target.checked })} className="w-4 h-4 rounded" />
            </label>
          </div>
          {/* Kampanj */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={m.campaign} disabled={busy === m.id}
                onChange={(e) => patch(m.id, { campaign: e.target.checked })} className="w-4 h-4 rounded" />
              <Megaphone className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-gray-700">Kampanj — "Ingår just nu"</span>
            </label>
            {m.campaign && (
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                <input defaultValue={m.campaign_label || ""} placeholder='T.ex. "Just nu ingår även Innehållsstudion"'
                  onBlur={(e) => e.target.value !== (m.campaign_label || "") && patch(m.id, { campaign_label: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                <input type="date" defaultValue={m.campaign_until || ""}
                  onBlur={(e) => e.target.value !== (m.campaign_until || "") && patch(m.id, { campaign_until: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            )}
          </div>
        </div>
      ))}
      {kommande.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-xs uppercase font-semibold text-gray-400 mb-2">Kommande (ingen kundvy än)</div>
          <div className="flex flex-wrap gap-2">
            {kommande.map((m) => (
              <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-500">{m.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vy 2: Per kund ──────────────────────────────────────────────────────────
function PerKund() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { fetch("/api/clients").then((r) => r.json()).then((d) => Array.isArray(d) && setClients(d)); }, []);
  useEffect(() => {
    if (!clientId) { setRows(null); return; }
    fetch(`/api/platform/tenant?clientId=${clientId}`).then((r) => r.json()).then(setRows);
  }, [clientId]);

  async function act(moduleId: string, action: "add" | "remove" | "reset") {
    setBusy(moduleId);
    const r = await fetch("/api/platform/tenant", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, moduleId, action }),
    });
    setRows(await r.json());
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Ge eller dra enskilda moduler för en kund — utöver Pro-standarden. Ändring gäller direkt, ingen deploy.</p>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full max-w-sm">
        <option value="">Välj kund…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {rows && (
        <div className="space-y-2">
          {rows.filter((r) => r.active).map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {r.effective
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  : <MinusCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">{r.label}</div>
                  <div className="text-xs text-gray-400">
                    {r.effective ? <SourceBadge source={r.source} /> : "Ingår inte"}
                    {r.override && <span className="ml-1 text-indigo-500">· manuell override</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {r.effective
                  ? <button disabled={busy === r.id} onClick={() => act(r.id, "remove")} className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">Dra bort</button>
                  : <button disabled={busy === r.id} onClick={() => act(r.id, "add")} className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Lägg till</button>}
                {r.override && <button disabled={busy === r.id} onClick={() => act(r.id, "reset")} className="text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">Återställ</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: TenantRow["source"] }) {
  const map: Record<string, string> = { standard: "Standard", kampanj: "✨ Kampanj", manuell: "Manuell" };
  return <span>{source ? map[source] : ""}</span>;
}

// ── Vy 3: Användare ─────────────────────────────────────────────────────────
function Anvandare() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("customer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { fetch("/api/clients").then((r) => r.json()).then((d) => Array.isArray(d) && setClients(d)); }, []);
  async function load() {
    const url = clientId ? `/api/platform/users?clientId=${clientId}` : "/api/platform/users";
    const r = await fetch(url); const d = await r.json();
    setUsers(Array.isArray(d) ? d : []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  async function invite() {
    setErr(""); setBusy(true);
    const r = await fetch("/api/platform/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, email, role }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setEmail(""); await load();
  }
  async function toggle(u: PlatformUser) {
    await fetch("/api/platform/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, active: !u.active }) });
    await load();
  }
  async function rotate(u: PlatformUser) {
    await fetch("/api/platform/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, rotate_token: true }) });
    await load();
  }
  function link(u: PlatformUser) { return `${typeof window !== "undefined" ? window.location.origin : ""}/k/${u.login_token}`; }
  async function copy(u: PlatformUser) { await navigator.clipboard.writeText(link(u)); setCopied(u.id); setTimeout(() => setCopied(""), 1800); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Koppla en kund-användare (e-post) till en tenant. Varje användare får en <strong>egen inloggningslänk</strong> — aldrig delade konton, aldrig lösenord. Avaktivera = länken slutar fungera direkt.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-full">
          <option value="">Välj kund…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {clientId && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="namn@kund.se" type="email" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="customer">Kund</option>
              <option value="customer_member">Medlem</option>
            </select>
            <button onClick={invite} disabled={busy || !email} className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Bjud in
            </button>
          </div>
        )}
        {err && <div className="text-sm text-rose-600">{err}</div>}
      </div>

      {users && users.length > 0 && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{u.email}</div>
                  <div className="text-xs text-gray-400">
                    {u.clients?.name || ""} · {u.role === "customer_member" ? "Medlem" : "Kund"} ·{" "}
                    {u.active ? <span className="text-emerald-600">aktiv</span> : <span className="text-rose-500">avaktiverad</span>}
                    {u.activated_at ? " · inloggad" : " · ej inloggad än"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => copy(u)} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1">
                    {copied === u.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Länk
                  </button>
                  <button onClick={() => rotate(u)} title="Ny länk (gammal dör)" className="text-xs px-2 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><RefreshCw className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggle(u)} className={`text-xs px-2.5 py-1.5 rounded-lg ${u.active ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                    {u.active ? "Avaktivera" : "Aktivera"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {users && users.length === 0 && clientId && <div className="text-sm text-gray-400">Inga användare för den här kunden än.</div>}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center gap-2 text-gray-500 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>;
}
