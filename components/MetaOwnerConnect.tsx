"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, AlertCircle, Unlink, ShieldCheck } from "lucide-react";

interface Owner {
  connected: boolean;
  fb_user_name: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: string | null;
  last_checked_at: string | null;
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function MetaOwnerConnect() {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    // Läs engångsfeedback från callbacken och städa bort den ur URL:en.
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected")) setFlash({ ok: true, msg: `Anslutet: ${p.get("connected")}` });
    else if (p.get("error")) setFlash({ ok: false, msg: p.get("error") || "Något gick fel" });
    if (p.get("connected") || p.get("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    reload();
  }, []);

  async function reload() {
    const r = await fetch("/api/meta/owner");
    if (r.ok) setOwner(await r.json());
  }

  async function disconnect() {
    if (!confirm("Koppla från Meta? Alla tenants tappar då möjligheten att koppla nya IG-konton tills du ansluter igen.")) return;
    setBusy(true);
    await fetch("/api/meta/owner", { method: "DELETE" });
    setBusy(false);
    reload();
  }

  if (!owner) return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;

  const dLeft = daysLeft(owner.token_expires_at);
  const expiring = dLeft != null && dLeft <= 7;

  return (
    <div className="space-y-3">
      {flash && (
        <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${flash.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-red-50 border border-red-200 text-red-900"}`}>
          {flash.ok ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span>{flash.msg}</span>
        </div>
      )}

      {owner.connected ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Anslutet — {owner.fb_user_name || "Meta-konto"}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {owner.token_expires_at
                    ? <>Token giltig till {new Date(owner.token_expires_at).toLocaleDateString("sv-SE")} {dLeft != null && <span className={expiring ? "text-amber-700 font-medium" : ""}>({dLeft} dgr kvar)</span>}</>
                    : "Token utan känt utgångsdatum"}
                </div>
                {owner.scopes?.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1 break-words">{owner.scopes.join(", ")}</div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <a href="/api/meta/oauth/start" className="text-xs bg-white border border-gray-200 hover:border-blue-300 text-gray-700 px-3 py-1.5 rounded-lg text-center font-medium">Koppla om</a>
              <button onClick={disconnect} disabled={busy} className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />} Koppla från
              </button>
            </div>
          </div>
          {expiring && (
            <div className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
              Token går snart ut. Klicka <strong>Koppla om</strong> för att förnya innan den slutar fungera.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>Anslut ditt Facebook/Meta-konto en gång. Därefter kan varje tenant koppla sitt Instagram-konto via en dropdown — utan att du klistrar in tokens manuellt.</div>
          </div>
          <a href="/api/meta/oauth/start" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-95">
            Anslut Meta
          </a>
        </div>
      )}
    </div>
  );
}
