"use client";

import { MessageSquareWarning, PhoneCall, Radio } from "lucide-react";
import { DashHero, HeroChip, LivePill } from "@/components/ui/dash";
import Tystnadslistan, { useTystnad } from "./Tystnadslistan";

// KONTAKT-1 — egen vy för tystnadslistan. Samma komponent som HQ:s sektion, så de två
// aldrig kan säga emot varandra om samma affär.

export default function KontaktPage() {
  const { data, fel, laddar, hamta, setFel } = useTystnad();

  return (
    <div className="space-y-6">
      <DashHero
        title="Vem har bollen"
        subtitle="Vilka affärer som håller på att tystna, och framför allt vem som är skyldig den andra ett svar. En kund som väntar på dig går alltid före en uppföljning som råkar vara gammal."
        icon={Radio}
        eyebrow={<LivePill label="pipelinen" />}
        chips={
          data ? (
            <>
              <HeroChip icon={PhoneCall} label={`${data.antal.bollenHosOss} väntar på svar från dig`} />
              <HeroChip icon={MessageSquareWarning} label={`${data.antal.matbara} av ${data.antal.totalt} går att mäta`} />
            </>
          ) : undefined
        }
      />

      {fel && <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{fel}</div>}

      {data && <Tystnadslistan data={data} laddar={laddar} onUppdatera={() => hamta(true)} onFel={setFel} />}

      <p className="pb-2 text-center text-xs text-gray-400">
        <a href="/dashboard/hq" className="font-medium text-gray-500 underline">Tillbaka till Founder HQ</a>
      </p>
    </div>
  );
}
