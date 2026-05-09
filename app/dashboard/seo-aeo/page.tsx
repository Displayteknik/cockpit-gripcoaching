"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, ArrowRight, Loader2, Sparkles, Code2, RefreshCw, Target, ShieldCheck } from "lucide-react";

type SpecialistMeta = {
  id: string;
  name: string;
  category: string;
  target_app: string;
  version: number;
};

const FLOW = [
  {
    step: "1",
    icon: Target,
    title: "Audit",
    desc: "Kör SEO Technical Audit på sidan. Få score 0-100 + topp-5 åtgärder.",
    specialistId: "seo-technical-audit",
  },
  {
    step: "2",
    icon: ShieldCheck,
    title: "E-E-A-T-grind",
    desc: "Kör innehållet genom kvalitetsgrind. Publicera bara om grön.",
    specialistId: "eeat-gate",
  },
  {
    step: "3",
    icon: Sparkles,
    title: "GEO/AEO-optimering",
    desc: "Skriv om för AI-sökmotorer (ChatGPT, Perplexity, Google AI Overviews).",
    specialistId: "geo-aeo-optimizer",
  },
  {
    step: "4",
    icon: Code2,
    title: "Schema-injektion",
    desc: "Generera JSON-LD strukturerad data per sidtyp.",
    specialistId: "schema-generator",
  },
  {
    step: "5",
    icon: RefreshCw,
    title: "Refresh-loop",
    desc: "Granska gammalt innehåll och få konkret åtgärdslista.",
    specialistId: "refresh-recommender",
  },
];

export default function SeoAeoPage() {
  const [list, setList] = useState<SpecialistMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/specialist")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setList(d.filter((s) => s.category === "seo"));
        else setError(d?.error ?? "Kunde inte ladda specialister");
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
            SEO / AEO / GEO
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="w-7 h-7 text-teal-600" />
          Sök-motorn
        </h1>
        <p className="text-gray-600 text-sm mt-2 max-w-2xl">
          Klassisk SEO för Google + AEO/GEO för AI-sökmotorer. Fem specialister i ett flöde — från
          audit till schema till refresh. Mätbart resultat per klient.
        </p>
      </div>

      {/* FLODE */}
      <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600" />
          Standard-flödet (kör i ordning)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {FLOW.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.step}
                href={`/dashboard/specialister/${f.specialistId}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-700">{f.step}</span>
                  <Icon className="w-4 h-4 text-teal-600" />
                </div>
                <div className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-teal-700">
                  {f.title}
                </div>
                <div className="text-xs text-gray-600 leading-snug">{f.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* SPECIALIST-LISTA */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Alla SEO/AEO/GEO-specialister</h2>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {!list && !error && (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Laddar...
          </div>
        )}
        {list && list.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-500 text-sm">
            Inga SEO-specialister hittades. Lägg till .md-filer i <code>prompts/specialists/</code> med
            <code> category: seo</code>.
          </div>
        )}
        {list && list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/specialister/${s.id}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-sm transition flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-teal-700">{s.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">v{s.version}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
