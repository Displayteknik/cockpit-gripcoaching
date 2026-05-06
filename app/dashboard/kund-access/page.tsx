"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, RefreshCw, ExternalLink, Lock, Unlock, AlertTriangle } from "lucide-react";

interface Access {
  token: string;
  enabled: boolean;
  name: string;
}

export default function KundAccessPage() {
  const [access, setAccess] = useState<Access | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/clients/customer-access");
      const d = await r.json();
      if (!d.error) setAccess(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle() {
    if (!access) return;
    setBusy(true);
    await fetch("/api/clients/customer-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !access.enabled }),
    });
    await load();
    setBusy(false);
  }

  async function rotate() {
    if (!confirm("Rotera token? Den nuvarande länken slutar fungera direkt.")) return;
    setBusy(true);
    await fetch("/api/clients/customer-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate_token: true }),
    });
    await load();
    setBusy(false);
  }

  const url = access ? `${typeof window !== "undefined" ? window.location.origin : ""}/k/${access.token}` : "";

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Laddar...
      </div>
    );
  }

  if (!access) return <div className="text-gray-500">Kunde inte ladda access-info.</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">MySales Pro — kund-access</h1>
        <p className="text-gray-500 text-sm mt-1">
          Ge {access.name} en personlig länk till sin egen vy där de själva kan skapa innehåll, hantera DMs och se sina inlägg.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              {access.enabled ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  <span>Kund-access är aktiv</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span>Kund-access är AVAKTIVERAD</span>
                </>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {access.enabled
                ? "Kunden kan logga in via länken nedan."
                : "Slå på för att kunden ska kunna använda sin länk."}
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
              access.enabled
                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : access.enabled ? "Stäng av" : "Slå på"}
          </button>
        </div>

        {access.enabled && (
          <>
            <div>
              <div className="text-xs uppercase font-medium text-gray-500 mb-1">Personlig inloggningslänk</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={url}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono outline-none"
                />
                <button
                  onClick={copy}
                  className="px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Kopierat" : "Kopiera"}
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Öppna
                </a>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Skicka till kunden via mejl eller SMS. Länken bör behandlas som ett lösenord.
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={rotate}
                disabled={busy}
                className="text-sm text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded flex items-center gap-1.5"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Rotera token
              </button>
              <div className="text-xs text-gray-500 mt-1">
                Skapar en ny länk och gör den nuvarande ogiltig. Använd om en länk har läckt.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold mb-1">Vad ser kunden?</div>
          Kunden ser bara sin egen brand-profil, sin generator, sina inlägg och sina DM-kontakter — aldrig
          andra klienter, dina specialister eller dina inställningar.
        </div>
      </div>
    </div>
  );
}
