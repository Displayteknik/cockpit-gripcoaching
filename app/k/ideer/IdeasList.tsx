"use client";

import { useState } from "react";
import { Check, X, Loader2, Mail, MessageSquare, FileText } from "lucide-react";

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
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Väntar på dig ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
            Alla utkast granskade. Bra jobbat!
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((i) => {
              const Icon = TYPE_ICONS[i.type] || FileText;
              return (
                <div
                  key={i.id}
                  className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: primaryColor }} />
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      {TYPE_LABELS[i.type] ?? i.type}
                    </span>
                    {i.voice_score !== null && (
                      <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                        Voice {i.voice_score}/100
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(i.created_at).toLocaleDateString("sv-SE")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {i.body}
                  </p>
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => decide(i.id, "approved")}
                      disabled={busy === i.id}
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-50"
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
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Godkända ({approved.length})
          </h2>
          <div className="space-y-2">
            {approved.map((i) => {
              const Icon = TYPE_ICONS[i.type] || FileText;
              return (
                <div
                  key={i.id}
                  className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3"
                >
                  <Icon className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
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
