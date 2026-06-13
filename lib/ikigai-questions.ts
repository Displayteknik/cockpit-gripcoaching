import { Heart, Wrench, Globe, Banknote } from "lucide-react";
import type { ComponentType } from "react";

export type QuadrantKey = "love" | "skill" | "need" | "pay";

export interface Quadrant {
  key: QuadrantKey;
  label: string;
  intro: string;
  example: string;
  placeholder: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

// Delad mellan admin-verktyget (/dashboard/ikigai) och den publika leadmagneten (/ikigai).
export const QUADRANTS: Quadrant[] = [
  {
    key: "love", label: "Vad du älskar",
    intro: "Det du gör utan att tröttna — ämnen du läser om frivilligt, sånt du saknar när du inte får göra det. Inte vad du borde älska, utan vad som faktiskt drar dig.",
    example: "Exempel: \"Jag älskar att se någon få en aha-upplevelse och börja tro på sig själv — och jag pillar gärna med teknik och system på fritiden.\"",
    placeholder: "Skriv fritt om vad du dras till...", icon: Heart, color: "text-rose-500",
  },
  {
    key: "skill", label: "Vad du är bra på",
    intro: "Dina färdigheter och erfarenheter — det folk ber dig om hjälp med, det du gör lättare än andra runt dig. Räkna även med sånt du tar för givet.",
    example: "Exempel: \"Jag är bra på att bygga säljflöden, förenkla krångliga processer och få folk att våga ta nästa steg.\"",
    placeholder: "Vad gör du bra, vad ber folk dig om hjälp med...", icon: Wrench, color: "text-amber-500",
  },
  {
    key: "need", label: "Vad världen behöver",
    intro: "Problem du ser hos andra — frågor folk ställer, sånt de kämpar med eller redan betalar någon för att lösa. Tänk på en konkret grupp människor.",
    example: "Exempel: \"Många soloföretagare är duktiga på sitt hantverk men saknar ett system för att få kunder — det blir ryckigt och stressigt.\"",
    placeholder: "Vilket problem ser du, hos vilka...", icon: Globe, color: "text-emerald-500",
  },
  {
    key: "pay", label: "Vad du kan få betalt för",
    intro: "Var det finns en köpare med plånbok och ett återkommande behov. Vad betalar folk redan för i din närhet — och vad skulle de betala dig för?",
    example: "Exempel: \"Företag betalar för färdiga säljsystem och löpande coaching som faktiskt ger fler kunder.\"",
    placeholder: "Vad skulle någon betala dig för...", icon: Banknote, color: "text-blue-500",
  },
];
