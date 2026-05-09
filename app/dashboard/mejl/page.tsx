"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, ArrowRight, Loader2, Users, FileText, ShieldAlert, Beaker, Reply, CalendarDays, Sparkles } from "lucide-react";

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
    icon: Users,
    title: "ICP-onboarding",
    desc: "Definiera Ideal Customer Profile en gång. Alla andra specialister läser den.",
    specialistId: "icp-onboarding-v2",
  },
  {
    step: "2",
    icon: FileText,
    title: "Sekvens",
    desc: "Skriv välkomstflöde, veckobrev, vinnkampanj eller lansering.",
    specialistId: "newsletter-sekvens",
  },
  {
    step: "3",
    icon: Beaker,
    title: "Ämnesrad",
    desc: "10 varianter, 5 vinklar, A/B-rekommendation.",
    specialistId: "subject-line-lab",
  },
  {
    step: "4",
    icon: ShieldAlert,
    title: "Spam-grind",
    desc: "Kör mejlet genom kvalitetscheck innan skick.",
    specialistId: "spam-gate",
  },
  {
    step: "5",
    icon: Reply,
    title: "Svar-klassning",
    desc: "Klassa inkommande svar + få utkast på svar.",
    specialistId: "positive-reply-scoring",
  },
  {
    step: "6",
    icon: CalendarDays,
    title: "Veckorytm",
    desc: "Måndagsplan + fredagsrapport för säljare.",
    specialistId: "cold-email-weekly-rhythm",
  },
];

export default function MejlMotorPage() {
  const [list, setList] = useState<SpecialistMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/specialist")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setList(d.filter((s) => s.category === "email" || s.category === "outbound" || s.category === "sales"));
        } else setError(d?.error ?? "Kunde inte ladda specialister");
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
            Mejl-motor
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="w-7 h-7 text-orange-600" />
          Mejl-motorn
        </h1>
        <p className="text-gray-600 text-sm mt-2 max-w-2xl">
          Cold outbound, nyhetsbrev och säljmejl med voice-fingerprint per klient. Sex specialister
          i ett flöde — från ICP till sekvens till spam-grind till svarsklassning.
        </p>
      </div>

      {/* FLODE */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-600" />
          Flödet (kör i ordning första gången)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {FLOW.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.step}
                href={`/dashboard/specialister/${f.specialistId}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-400 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-700">{f.step}</span>
                  <Icon className="w-4 h-4 text-orange-600" />
                </div>
                <div className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-orange-700">
                  {f.title}
                </div>
                <div className="text-xs text-gray-600 leading-snug">{f.desc}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* TIPS */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">Så får du mest ut av motorn</h3>
        <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
          <li>Kör <strong>ICP-onboarding</strong> först — den blir input till alla andra.</li>
          <li>Lägg in <strong>winning examples</strong> (Hakan-godkända mejl) i client_assets med category=&quot;winning_example&quot; — då scoras nya utkast mot dem.</li>
          <li>För cold-email: kör alltid spam-grind innan skick.</li>
          <li>Specialister med <code>iterate: true</code> genererar 3 varianter och returnerar bästa.</li>
        </ul>
      </div>

      {/* SPECIALIST-LISTA */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Alla mejl-specialister</h2>
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
        {list && list.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/specialister/${s.id}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-400 hover:shadow-sm transition flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-gray-900 group-hover:text-orange-700">{s.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.category} · v{s.version}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-600 group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
