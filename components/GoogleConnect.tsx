"use client";

import { useEffect, useState } from "react";
import { Loader2, ExternalLink, Check, X, RefreshCw, Globe, AlertCircle } from "lucide-react";

interface GscSite { siteUrl: string; permissionLevel: string }
interface Connection { email: string; gsc_site: string | null; ga_property_id: string | null; created_at: string; updated_at: string }
interface Status { configured: boolean; connected: boolean; connection: Connection | null }

export default function GoogleConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [sites, setSites] = useState<GscSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => { reload(); checkUrlParams(); }, []);

  function checkUrlParams() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("google_ok") === "1") {
      window.history.replaceState(null, "", "/dashboard/installningar");
      setTimeout(() => alert("Google anslutet!"), 50);
    }
    const err = url.searchParams.get("google_error");
    if (err) {
      window.history.replaceState(null, "", "/dashboard/installningar");
      alert("Google-fel: " + err);
    }
  }

  async function reload() {
    const r = await fetch("/api/google/status");
    if (r.ok) setStatus(await r.json());
  }

  async function loadSites() {
    setLoadingSites(true);
    const r = await fetch("/api/google/gsc/sites");
    if (r.ok) setSites(await r.json());
    else alert("Fel: " + (await r.text()));
    setLoadingSites(false);
  }

  async function selectSite(site: string) {
    await fetch("/api/google/gsc/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site }),
    });
    reload();
  }

  async function disconnect() {
    if (!confirm("Koppla från Google?")) return;
    await fetch("/api/google/status", { method: "DELETE" });
    setSites([]);
    reload();
  }

  if (!status) return <div className="p-3 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin inline" /></div>;

  if (!status.configured) {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Google-OAuth ej satt upp.</strong> Lägg <code className="bg-white px-1 rounded">GOOGLE_CLIENT_ID</code> + <code className="bg-white px-1 rounded">GOOGLE_CLIENT_SECRET</code> i env.
              <button onClick={() => setShowSetup(!showSetup)} className="block text-amber-700 underline mt-1">{showSetup ? "Dölj" : "Visa"} setup-steg</button>
            </div>
          </div>
        </div>
        {showSetup && <SetupSteps />}
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="space-y-3">
        <a href="/api/google/auth" className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 transition-colors">
          <GoogleIcon />
          Anslut Google för denna klient
        </a>
        <button onClick={() => setShowSetup(!showSetup)} className="block text-xs text-gray-500 underline">{showSetup ? "Dölj" : "Visa"} setup-instruktioner</button>
        {showSetup && <SetupSteps />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <div>
            <div className="text-sm font-medium text-gray-900">Anslutet som {status.connection?.email}</div>
            <div className="text-xs text-gray-500">Sedan {status.connection ? new Date(status.connection.created_at).toLocaleDateString("sv-SE") : ""}</div>
          </div>
        </div>
        <button onClick={disconnect} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded">Koppla från</button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            Search Console-property
          </label>
          <button onClick={loadSites} disabled={loadingSites} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
            {loadingSites ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {sites.length === 0 ? "Hämta sites" : "Uppdatera"}
          </button>
        </div>
        {status.connection?.gsc_site && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm text-blue-900 mb-2">
            ✓ Aktiv: <strong>{status.connection.gsc_site}</strong>
          </div>
        )}
        {sites.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sites.map((s) => (
              <button
                key={s.siteUrl}
                onClick={() => selectSite(s.siteUrl)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                  status.connection?.gsc_site === s.siteUrl
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "bg-white border-gray-200 hover:border-blue-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{s.siteUrl}</span>
                  <span className="text-xs text-gray-500 ml-2">{s.permissionLevel}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function SetupSteps() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-2">
      <div className="font-medium text-gray-900">Setup (~10 min, gör en gång):</div>
      <ol className="list-decimal pl-5 space-y-1 text-gray-700">
        <li>Gå till <a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noopener" className="text-blue-600 underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a></li>
        <li>Skapa nytt projekt eller välj befintligt</li>
        <li>APIs &amp; Services → Library → aktivera <strong>Google Search Console API</strong> och <strong>Google Analytics Data API</strong></li>
        <li>OAuth consent screen → External → fyll i app-namn + e-post → spara</li>
        <li>Credentials → Create Credentials → OAuth client ID → Web application</li>
        <li>Authorized redirect URI: <code className="bg-white px-1 rounded text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/google/callback` : "/api/google/callback"}</code></li>
        <li>Kopiera <strong>Client ID</strong> och <strong>Client Secret</strong></li>
        <li>Sätt i env (lokalt: <code className="bg-white px-1 rounded text-xs">.env.local</code>, prod: Vercel env vars):
          <div className="bg-gray-900 text-emerald-300 rounded p-2 mt-1 font-mono text-xs">
            GOOGLE_CLIENT_ID=...<br />GOOGLE_CLIENT_SECRET=...
          </div>
        </li>
        <li>Starta om dev-servern → klicka "Anslut Google" här</li>
      </ol>
    </div>
  );
}
