"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface Tenant {
  client_id: string;
  name: string;
  ig_username: string | null;
  page_name: string | null;
  source: string | null;
  status: string;
  last_checked_at: string | null;
  last_error: string | null;
}
interface Resp { owner: { status?: string } | null; tenants: Tenant[] }

const BADGE: Record<string, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-700", label: "OK" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", label: "Varning" },
  dead: { dot: "bg-red-500", text: "text-red-700", label: "Död" },
  unknown: { dot: "bg-gray-300", text: "text-gray-500", label: "Ej kollad" },
};

function Badge({ status }: { status: string }) {
  const b = BADGE[status] || BADGE.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${b.text}`}>
      <span className={`w-2 h-2 rounded-full ${b.dot}`} /> {b.label}
    </span>
  );
}

export default function MetaConnectionsHealth() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/meta/health?all=1");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }

  if (loading && !data) return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  if (!data || data.tenants.length === 0) {
    return <p className="text-sm text-gray-500">Inga kopplade Instagram-konton än.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Uppdateras dagligen av hälsovakten</span>
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Uppdatera
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {data.tenants.map((t) => (
          <div key={t.client_id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{t.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {t.ig_username ? `@${t.ig_username}` : "—"}
                {t.source && t.source !== "oauth" ? ` · ${t.source}` : ""}
                {t.status !== "ok" && t.last_error ? ` · ${t.last_error}` : ""}
              </div>
            </div>
            <Badge status={t.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
