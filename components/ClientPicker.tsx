"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus, Loader2, X, Building2 } from "lucide-react";

interface Client {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  primary_color: string;
  resource_module: string;
}

export default function ClientPicker() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [active, setActive] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", industry: "", public_url: "", resource_module: "generic" });
  const [creating, setCreating] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const [list, current] = await Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/clients/active").then((r) => r.json()),
    ]);
    setClients(list || []);
    setActive(current);
  }

  async function switchTo(id: string) {
    await fetch("/api/clients/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: id }),
    });
    setOpen(false);
    router.refresh();
    // Hård reload för att klient-kontext ska gälla överallt
    setTimeout(() => window.location.reload(), 100);
  }

  async function createClient() {
    if (!newClient.name.trim()) return;
    setCreating(true);
    const r = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    setCreating(false);
    if (!r.ok) { alert("Fel: " + (await r.text())); return; }
    const created = await r.json();
    await switchTo(created.id);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: active?.primary_color || "#94a3b8" }}
        />
        <div className="text-left">
          <div className="text-sm font-semibold text-gray-900 leading-tight">{active?.name || "—"}</div>
          {active?.industry && <div className="text-[10px] text-gray-500 leading-tight">{active.industry}</div>}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2 max-h-80 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-4">Inga klienter än</div>
              ) : (
                clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => switchTo(c.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                      active?.id === c.id ? "bg-gray-100" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.primary_color }} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{c.name}</div>
                        {c.industry && <div className="text-xs text-gray-500 truncate">{c.industry}</div>}
                      </div>
                    </div>
                    {active?.id === c.id && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => { setOpen(false); setShowNew(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-700 hover:bg-purple-50 font-medium"
              >
                <Plus className="w-4 h-4" />
                Ny klient
              </button>
            </div>
          </div>
        </>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-blue" />
                Ny klient
              </h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <Input label="Företagsnamn" value={newClient.name} onChange={(v) => setNewClient({ ...newClient, name: v })} required />
              <Input label="Bransch" value={newClient.industry} onChange={(v) => setNewClient({ ...newClient, industry: v })} placeholder="t.ex. coaching, frisör, restaurang" />
              <Input label="Publik URL" value={newClient.public_url} onChange={(v) => setNewClient({ ...newClient, public_url: v })} placeholder="https://..." />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Resursmodul</label>
                <select
                  value={newClient.resource_module}
                  onChange={(e) => setNewClient({ ...newClient, resource_module: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                >
                  <option value="generic">Generisk (bara marknad/SEO/social)</option>
                  <option value="automotive">Automotive (fordon-CRUD)</option>
                  <option value="art">Konst (verk + utställningar)</option>
                  <option value="services">Tjänsteföretag (tjänste-CRUD)</option>
                  <option value="ecommerce">E-handel (produkt-CRUD)</option>
                </select>
                <div className="text-xs text-gray-400 mt-1">Styr vilka flikar som visas i dashboarden för klienten.</div>
              </div>
              <button
                onClick={createClient}
                disabled={creating || !newClient.name.trim()}
                className="w-full mt-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Skapa klient
              </button>
              <p className="text-xs text-gray-400">Efter skapande växlar systemet automatiskt till denna klient. Gå till Profil → kör ICP-wizard.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-1 block">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
      />
    </div>
  );
}
