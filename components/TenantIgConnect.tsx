"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, Unlink, ChevronDown } from "lucide-react";
import { valideraIgId, valideraMetaToken } from "@/lib/studio/graph-fel";

interface Page { id: string; name: string; ig_username: string | null; has_ig: boolean }
interface PagesResp { owner_connected: boolean; pages: Page[]; error?: string }
interface Status {
  connected: boolean;
  source?: string | null;
  page_name?: string | null;
  ig_username?: string | null;
  followers_count?: number | null;
  status?: string | null;
}

export default function TenantIgConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pagesResp, setPagesResp] = useState<PagesResp | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Manuellt (fallback)
  const [mAcc, setMAcc] = useState("");
  const [mTok, setMTok] = useState("");
  const [mHandle, setMHandle] = useState("");

  useEffect(() => { void reload(); }, []);

  async function reload() {
    const [s, p] = await Promise.all([
      fetch("/api/meta/connect-tenant").then((r) => r.json()).catch(() => null),
      fetch("/api/meta/pages").then((r) => r.json()).catch(() => null),
    ]);
    setStatus(s);
    setPagesResp(p);
  }

  async function connect() {
    if (!selected) return;
    setBusy(true); setErr(null);
    const r = await fetch("/api/meta/connect-tenant", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: selected }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setSelected(""); void reload(); }
    else setErr(d.error || "Kunde inte ansluta.");
  }

  async function connectManual() {
    if (!mAcc || !mTok) return;
    // BILD-3: fånga förväxlade id-fält INNAN Meta-anropet (sid-id vs 17841-konto-id).
    const felId = valideraIgId(mAcc);
    if (felId) { setErr(felId); return; }
    const felTok = valideraMetaToken(mTok);
    if (felTok) { setErr(felTok); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/meta/connect-tenant/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ig_account_id: mAcc, ig_access_token: mTok, ig_handle: mHandle }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setMAcc(""); setMTok(""); setMHandle(""); setShowAdvanced(false); void reload(); }
    else setErr(d.error || "Kunde inte ansluta.");
  }

  async function disconnect() {
    if (!confirm("Koppla från Instagram för den här klienten?")) return;
    setBusy(true);
    await fetch("/api/meta/connect-tenant", { method: "DELETE" });
    setBusy(false);
    void reload();
  }

  if (!status || !pagesResp) return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;

  // Redan kopplat
  if (status.connected) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                Anslutet{status.ig_username ? `: @${status.ig_username}` : ""}
                {status.followers_count != null && <span className="text-gray-500 font-normal"> · {status.followers_count} följare</span>}
              </div>
              <div className="text-xs text-gray-500">
                {status.source === "oauth" ? "Kopplat via Meta-dropdown" : status.source === "manual" ? "Kopplat manuellt" : "Befintlig koppling"}
                {status.page_name ? ` · ${status.page_name}` : ""}
              </div>
            </div>
          </div>
          <button onClick={disconnect} disabled={busy} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />} Koppla från
          </button>
        </div>
      </div>
    );
  }

  // Ägaren inte ansluten → hänvisa till ägar-sidan
  if (!pagesResp.owner_connected) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Anslut ditt Meta-konto först, så kan du välja sida här.
          <a href="/dashboard/installningar/meta" className="block underline mt-1 font-medium">Öppna Meta-anslutning →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{err}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Välj sida att koppla</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="">— Välj Facebook-sida —</option>
          {pagesResp.pages.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.has_ig}>
              {p.name}{p.ig_username ? ` · @${p.ig_username}` : p.has_ig ? "" : " (inget IG kopplat)"}
            </option>
          ))}
        </select>
        {pagesResp.pages.length === 0 && (
          <div className="text-xs text-amber-700">Inga sidor hittades på ditt Meta-konto. Kontrollera behörigheterna.</div>
        )}
        <button
          onClick={connect}
          disabled={busy || !selected}
          className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Anslut Instagram
        </button>
      </div>

      {/* Avancerat: manuell inklistring (fallback) */}
      <div className="border-t border-gray-100 pt-2">
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} /> Avancerat — klistra in manuellt
        </button>
        {showAdvanced && (
          <div className="space-y-2 mt-2">
            <input value={mAcc} onChange={(e) => setMAcc(e.target.value)} placeholder="Instagram Business Account ID" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={mTok} onChange={(e) => setMTok(e.target.value)} type="password" placeholder="Access Token" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input value={mHandle} onChange={(e) => setMHandle(e.target.value)} placeholder="@handle (valfritt)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <button onClick={connectManual} disabled={busy || !mAcc || !mTok} className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Anslut manuellt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
