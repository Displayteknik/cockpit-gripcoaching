"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

type SpecialistMeta = {
  id: string;
  name: string;
  category: string;
  target_app: string;
  version: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  copy: "Säljcopy",
  strategi: "Strategi",
  content: "Content",
  sales: "Försäljning",
  ops: "Operations",
  seo: "SEO/AEO/GEO",
  email: "Mejl-motor",
  outbound: "Outbound",
  general: "Övrigt",
};

const CATEGORY_COLOR: Record<string, string> = {
  copy: "bg-pink-50 text-pink-700 border-pink-200",
  strategi: "bg-purple-50 text-purple-700 border-purple-200",
  content: "bg-blue-50 text-blue-700 border-blue-200",
  sales: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ops: "bg-amber-50 text-amber-700 border-amber-200",
  seo: "bg-teal-50 text-teal-700 border-teal-200",
  email: "bg-orange-50 text-orange-700 border-orange-200",
  outbound: "bg-rose-50 text-rose-700 border-rose-200",
  general: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function SpecialisterPage() {
  const [list, setList] = useState<SpecialistMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/specialist")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setList(d);
        else setError(d?.error ?? "Kunde inte ladda specialister");
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          AI-specialister
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Skarpa systemprompts för säljcopy, ICP-tydliggörande och kundprojekt-kickoff. Drivs av Claude Sonnet.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!list && !error && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Laddar specialister...
        </div>
      )}

      {list && list.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Inga specialister hittades i <code>prompts/specialists/</code>.
        </div>
      )}

      {list && list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/specialister/${s.id}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        CATEGORY_COLOR[s.category] ?? CATEGORY_COLOR.general
                      }`}
                    >
                      {CATEGORY_LABEL[s.category] ?? s.category}
                    </span>
                    <span className="text-[10px] text-gray-400">v{s.version}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition">
                    {s.name}
                  </h3>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
