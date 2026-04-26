"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

interface Status { connected: boolean; handle: string | null }

export default function InstagramConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { reload(); }, []);

  async function reload() {
    const r = await fetch("/api/instagram/connect");
    if (r.ok) setStatus(await r.json());
  }

  async function connect() {
    if (!accountId || !token) return;
    setBusy(true);
    const r = await fetch("/api/instagram/connect", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ig_account_id: accountId, ig_access_token: token, ig_handle: handle }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      alert(`Anslutet: @${d.profile?.username} (${d.profile?.followers_count} följare)`);
      setAccountId(""); setToken(""); setHandle("");
      reload();
    } else {
      alert("Fel: " + (d.error || "okänt"));
    }
  }

  async function disconnect() {
    if (!confirm("Koppla från Instagram?")) return;
    await fetch("/api/instagram/connect", { method: "DELETE" });
    reload();
  }

  async function sync() {
    setSyncing(true);
    const r = await fetch("/api/instagram/sync", { method: "POST" });
    const d = await r.json();
    setSyncing(false);
    if (r.ok) alert(`Synkat: ${d.profile?.followers_count} följare, ${d.insights_count} inläggs-metrics`);
    else alert("Fel: " + (d.error || "okänt"));
  }

  if (!status) return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;

  if (status.connected) {
    return (
      <div className="space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">Anslutet: @{status.handle}</div>
              <div className="text-xs text-gray-500">Direct publish + analytics-sync aktiverat</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={sync} disabled={syncing} className="text-xs bg-white border border-gray-200 hover:border-blue-300 text-gray-700 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50">
              {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Synka
            </button>
            <button onClick={disconnect} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded">Koppla från</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Sätt upp engångs:</strong> Hämta Instagram Business Account ID + Long-lived Access Token från Facebook Developer Portal.
            <button onClick={() => setShowSetup(!showSetup)} className="block underline mt-1">{showSetup ? "Dölj" : "Visa"} steg-för-steg</button>
          </div>
        </div>
      </div>

      {showSetup && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-2">
          <div className="font-medium text-gray-900">Setup (~15 min, gör en gång per klient):</div>
          <ol className="list-decimal pl-5 space-y-1 text-gray-700">
            <li>Klienten måste ha ett <strong>Instagram Business-konto</strong> kopplat till en Facebook-sida.</li>
            <li>Gå till <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="text-blue-600 underline inline-flex items-center gap-0.5">developers.facebook.com/apps <ExternalLink className="w-3 h-3" /></a> → Create App → Business.</li>
            <li>Lägg till produkterna <strong>Instagram Graph API</strong> + <strong>Facebook Login for Business</strong>.</li>
            <li>I Graph API Explorer: välj din app, generera User Token med scope: <code className="bg-white px-1 rounded text-xs">instagram_basic, instagram_content_publish, pages_read_engagement, pages_show_list</code>.</li>
            <li>Hämta IG Business Account ID: <code className="bg-white px-1 rounded text-xs">GET /me/accounts</code> → välj sida → <code className="bg-white px-1 rounded text-xs">GET /{`{page_id}`}?fields=instagram_business_account</code>.</li>
            <li>Konvertera till long-lived (60 dagar): <code className="bg-white px-1 rounded text-xs">GET /oauth/access_token?grant_type=fb_exchange_token...</code></li>
            <li>Klistra in IG Business Account ID + token nedan.</li>
          </ol>
          <div className="text-xs text-amber-700 mt-2">⚠ Tokens går ut efter 60 dagar — schemalägg renewal eller uppdatera manuellt.</div>
        </div>
      )}

      <div className="space-y-2">
        <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Instagram Business Account ID (numerisk)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Long-lived Access Token" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle (auto om tom)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <button onClick={connect} disabled={busy || !accountId || !token} className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Anslut Instagram
        </button>
      </div>
    </div>
  );
}
