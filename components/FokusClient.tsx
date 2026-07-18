"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2, Building2, Send, MessageSquare, Repeat, Reply, CalendarCheck, FileText, Trophy, Users } from "lucide-react";

interface Overview {
  linked: boolean;
  activity?: { messages: number; offers: number; followups: number; responses: number; meetings: number };
  pipeline?: { total: number };
  quotes?: { total: number; won: number; wonValue: number };
}

function kr(n?: number) { return typeof n === "number" ? n.toLocaleString("sv-SE") + " kr" : "—"; }

export default function FokusClient({ primaryColor = "#1A6B3C" }: { primaryColor?: string }) {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<Overview>({ linked: false });

  useEffect(() => {
    fetch("/api/fokus/overview").then((r) => r.json()).then(setD).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl px-7 py-8 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 60%, ${primaryColor}aa 100%)` }}>
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-white/80 mb-2">
            <Zap className="w-3.5 h-3.5" /> Fokusmotor
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Din säljöversikt</h1>
          <p className="text-white/80 mt-1.5 text-sm">Din aktivitet, pipeline och offerter från MySales Coach — senaste 30 dagarna.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10"><Loader2 className="w-4 h-4 animate-spin" /> Laddar…</div>
      ) : !d.linked ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <div className="font-semibold text-gray-900">Ingen koppling än</div>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Din säljöversikt visas här när kontot är kopplat till MySales Coach.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display font-bold text-gray-900 text-lg">Aktivitet (30 dgr)</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Stat icon={MessageSquare} label="Meddelanden" value={d.activity?.messages} c={primaryColor} />
              <Stat icon={Send} label="Offerter skickade" value={d.activity?.offers} c={primaryColor} />
              <Stat icon={Repeat} label="Uppföljningar" value={d.activity?.followups} c={primaryColor} />
              <Stat icon={Reply} label="Svar" value={d.activity?.responses} c={primaryColor} />
              <Stat icon={CalendarCheck} label="Möten bokade" value={d.activity?.meetings} c={primaryColor} />
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="font-display font-bold text-gray-900 text-lg">Pipeline & offerter</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat icon={Users} label="Kontakter i pipeline" value={d.pipeline?.total} c={primaryColor} />
              <Stat icon={FileText} label="Offerter totalt" value={d.quotes?.total} c={primaryColor} />
              <Stat icon={Trophy} label="Vunna offerter" value={d.quotes?.won} c={primaryColor} />
              <Stat icon={Trophy} label="Vunnet värde" text={kr(d.quotes?.wonValue)} c={primaryColor} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, text, c }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value?: number; text?: string; c: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${c}14` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: c }} />
      </span>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{text ?? (value ?? 0)}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
