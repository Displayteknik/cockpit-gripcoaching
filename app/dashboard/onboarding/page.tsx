"use client";

// ONBOARD-7 — onboardingen som stegverktyg.
//
// Sidan har två lägen:
//   • Processvyn (default): alla pågående onboardingar med stegstatus, och en kund i taget
//     med elva steg. Detta är vardagsvyn — "var står Carina, och vad gör jag nu?".
//   • Analysvyn: den befintliga granskningen, alltså steg 1 och 2. Öppnas när en ny kund
//     ska analyseras eller ett förslag ska rättas.
//
// Sidan ligger bakom admin-grinden i proxy.ts (allt under /dashboard kräver signerad
// session), så ingen egen grind behövs här.

import { useEffect, useState } from "react";
import { ListChecks, Sparkles } from "lucide-react";
import OnboardingGranska from "@/components/OnboardingGranska";
import OnboardingSteg from "@/components/OnboardingSteg";

export default function OnboardingPage() {
  const [primary, setPrimary] = useState<string | undefined>(undefined);
  const [vy, setVy] = useState<"process" | "analys">("process");

  // ★ ?id=… ÖPPNAR GRANSKNINGEN. OnboardingGranska läser parametern själv och hämtar
  //   körningen, men den koden nåddes aldrig: sidan startade alltid i processvyn, så
  //   länken visade listan och det såg ut som att granskningen försvunnit. Läses i en
  //   effekt och inte med useSearchParams — den kräver Suspense och har hängt här förut.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("id")) setVy("analys");
  }, []);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.primary_color) setPrimary(c.primary_color); })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">
          Från webbadress till färdig kund. Elva steg, och verktyget håller reda på vilket som står på tur.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setVy("process")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            vy === "process" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <ListChecks className="h-4 w-4" /> Process
        </button>
        <button
          onClick={() => setVy("analys")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            vy === "analys" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Sparkles className="h-4 w-4" /> Ny analys
        </button>
      </div>

      {vy === "process" ? <OnboardingSteg /> : <OnboardingGranska primaryColor={primary} />}
    </div>
  );
}
