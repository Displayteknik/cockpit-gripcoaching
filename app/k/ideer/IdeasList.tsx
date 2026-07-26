"use client";

import { useState } from "react";
import { Check, X, Loader2, Mail, MessageSquare, FileText, Sparkles } from "lucide-react";

interface Idea {
  id: string;
  type: string;
  body: string;
  voice_score: number | null;
  status: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  linkedin_post: MessageSquare,
  mejl: Mail,
  blog_idea: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  linkedin_post: "LinkedIn-inlägg",
  mejl: "Mejl-utkast",
  blog_idea: "Blogg-idé",
};

export default function IdeasList({
  initialIdeas,
  primaryColor,
}: {
  initialIdeas: Idea[];
  primaryColor: string;
}) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    try {
      const r = await fetch("/api/customer/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const d = await r.json();
      if (d.ok) {
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status: decision } : i)));
      }
    } finally {
      setBusy(null);
    }
  }

  const pending = ideas.filter((i) => i.status === "pending");
  const approved = ideas.filter((i) => i.status === "approved");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Sparkles className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          <h2 className="font-display font-bold text-gray-900 text-lg">Väntar på dig</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 tabular-nums">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          approved.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400">
              Inga förslag än. När Skrivhjälpen skapat idéer dyker de upp här för dig att godkänna eller avvisa.
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-sm text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" /> Alla utkast granskade. Bra jobbat!
            </div>
          )
        ) : (
          <div className="space-y-3">
            {pending.map((i) => {
              const Icon = TYPE_ICONS[i.type] || FileText;
              return (
                <div key={i.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                      <Icon className="w-4 h-4" style={{ color: primaryColor }} />
                    </span>
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      {TYPE_LABELS[i.type] ?? i.type}
                    </span>
                    {i.voice_score !== null && (
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 cursor-help" title="Hur mycket förslaget låter som du — din egen röst. 100 = träffar din ton perfekt.">
                        Röst {i.voice_score}/100
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(i.created_at).toLocaleDateString("sv-SE")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {i.body}
                  </p>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => decide(i.id, "approved")}
                      disabled={busy === i.id}
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-50"
                      style={{ background: primaryColor }}
                    >
                      {busy === i.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Godkänn
                    </button>
                    <button
                      onClick={() => decide(i.id, "rejected")}
                      disabled={busy === i.id}
                      className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" /> Avvisa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {approved.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-100">
              <Check className="w-[18px] h-[18px] text-emerald-600" />
            </span>
            <h2 className="font-display font-bold text-gray-900 text-lg">Godkända</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 tabular-nums">{approved.length}</span>
          </div>
          <div className="space-y-2">
            {approved.map((i) => {
              const Icon = TYPE_ICONS[i.type] || FileText;
              return (
                <div key={i.id} className="bg-white border border-emerald-100 rounded-2xl shadow-sm p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100 mt-0.5">
                    <Icon className="w-4 h-4 text-emerald-600" />
                  </span>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-1">
                      {TYPE_LABELS[i.type] ?? i.type}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {i.body.slice(0, 240)}
                      {i.body.length > 240 ? "…" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
