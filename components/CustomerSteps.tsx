import Link from "next/link";
import { Check, ArrowRight, Rocket } from "lucide-react";

// Pedagogiskt "kom igång"-flöde på kundens översikt: numrerade steg som visar
// exakt var kunden är och vad nästa steg är. Server-komponent (ren presentation) —
// stegens status räknas ut på översiktssidan ur klientens riktiga data.
export interface Step {
  title: string;
  desc: string;
  href: string;
  cta: string;
  done: boolean;
}

export default function CustomerSteps({ steps, primaryColor }: { steps: Step[]; primaryColor: string }) {
  if (!steps.length) return null;
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  // Första ej-klara steget = "gör detta nu".
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
            <Rocket className="w-[18px] h-[18px]" style={{ color: primaryColor }} />
          </span>
          <div>
            <h2 className="font-display font-bold text-gray-900 text-lg leading-tight">{allDone ? "Allt uppsatt — snyggt jobbat!" : "Kom igång"}</h2>
            <p className="text-xs text-gray-500">{allDone ? "Du har grunden på plats. Fortsätt skapa och följ resultatet." : "Följ stegen så är du igång på några minuter."}</p>
          </div>
        </div>
        <span className="text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap" style={{ background: `${primaryColor}14`, color: primaryColor }}>
          {doneCount} av {steps.length} klara
        </span>
      </div>

      <ol className="space-y-1">
        {steps.map((s, i) => {
          const isCurrent = i === currentIdx;
          return (
            <li key={i} className={`flex items-center gap-4 rounded-xl px-3 py-3 transition-colors ${isCurrent ? "" : "hover:bg-gray-50"}`}
                style={isCurrent ? { background: `${primaryColor}0d` } : undefined}>
              {/* Steg-markör: klar = grön bock, aktuell = klientfärg + nummer, kommande = grå nummer */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${s.done ? "bg-emerald-100 text-emerald-600" : isCurrent ? "text-white" : "bg-gray-100 text-gray-400"}`}
                    style={isCurrent && !s.done ? { background: primaryColor } : undefined}>
                {s.done ? <Check className="w-4 h-4" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${s.done ? "text-gray-400" : "text-gray-900"}`}>{s.title}</div>
                {!s.done && <div className="text-sm text-gray-500 mt-0.5 leading-snug">{s.desc}</div>}
              </div>

              {s.done ? (
                <span className="text-sm font-medium text-emerald-600 flex items-center gap-1 flex-shrink-0"><Check className="w-4 h-4" /> Klart</span>
              ) : isCurrent ? (
                <Link href={s.href} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 flex-shrink-0" style={{ background: primaryColor }}>
                  {s.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href={s.href} className="inline-flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-700 flex-shrink-0">
                  {s.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
