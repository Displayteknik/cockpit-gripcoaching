// lib/knowledge-links.ts
// Klickbara begrepp i AI-text → öppnar förklaring eller koppling till specialist/handbok.

export interface KnowledgeLink {
  keywords: string[];
  title: string;
  explanation: string;
  href?: string;
  specialist_id?: string;
}

export const KNOWLEDGE: KnowledgeLink[] = [
  // Hook-Mastery
  {
    keywords: ["3-sekunders", "3 sekunder", "3-sekundersregeln"],
    title: "3-sekundersregeln",
    explanation:
      "Inläggets tre första sekunder avgör allt. Visuellt ankare + disruptiv text + ljudskifte = scrollstop.",
    href: "/dashboard/handbok#hook",
  },
  {
    keywords: ["nyfikenhetsglapp", "curiosity gap", "kunskapsglapp"],
    title: "Nyfikenhetsglapp",
    explanation:
      "Hint om något läsaren vill veta utan att avslöja. Skapar friktion som tvingar fram klick eller paus.",
    href: "/dashboard/handbok#hook",
  },
  {
    keywords: ["fråge-hook", "question hook"],
    title: "Fråge-hook",
    explanation:
      "Börja med en specifik fråga målgruppen känner i magen. Triggar igenkänning på 1 sekund.",
  },
  {
    keywords: ["statistik-hook"],
    title: "Statistik-hook",
    explanation: "En siffra som chockerar eller motbevisar antaganden. '95% gör fel — så här gör de rätt.'",
  },

  // Innehållsarkitektur
  {
    keywords: ["4A", "4A Framework", "4a framework"],
    title: "4A Framework",
    explanation:
      "Veckorytm: Analytical (mån/tis), Aspirational (ons/tor), Actionable (fre/lör), Authentic (sön). Täcker alla DISC-personligheter.",
    href: "/dashboard/handbok#4a",
  },
  {
    keywords: ["TOFU", "top of funnel"],
    title: "TOFU",
    explanation: "Top of Funnel — bygg medvetenhet. Värde först, inget hårt sälj.",
  },
  {
    keywords: ["MOFU", "middle of funnel"],
    title: "MOFU",
    explanation: "Middle of Funnel — bygg förtroende. Visa att ni förstår problemet på djupet.",
  },
  {
    keywords: ["BOFU", "bottom of funnel"],
    title: "BOFU",
    explanation: "Bottom of Funnel — driv handling. Tydlig CTA, hjälp läsaren ta nästa steg.",
  },
  {
    keywords: ["Gold/Silver/Bronze", "GSB", "Gold-variant", "Silver-variant", "Bronze-variant"],
    title: "Gold / Silver / Bronze",
    explanation:
      "A/B-testning av samma idé i tre varianter med olika risk-nivå. Gold = säker, Silver = djärvare, Bronze = experimentell.",
  },

  // DISC
  {
    keywords: ["DISC", "Dominant", "Influence", "Steadiness", "Compliance"],
    title: "DISC-personlighet",
    explanation:
      "D=Dominant (resultat), I=Influence (känslor), S=Steadiness (trygghet), C=Compliance (data). Innehåll bör täcka alla fyra över veckan.",
  },

  // Profil & Konvertering
  {
    keywords: ["DM-strategi", "ACO", "Acknowledge, Connect, Offer"],
    title: "DM-strategi (ACO)",
    explanation:
      "Tre steg när någon DM:ar: 1) Acknowledge + ge värde, 2) Connect/fördjupa, 3) Mjuk övergång till erbjudande.",
    href: "/dashboard/handbok#dm",
  },
  {
    keywords: ["UGC", "user-generated content", "social proof", "vittnesmål"],
    title: "UGC & Social Proof",
    explanation:
      "Användargenererat innehåll och kundcitat med riktiga namn slår all egen marknadsföring i konvertering.",
  },

  // Format
  {
    keywords: ["Carousel", "carousel", "karusell"],
    title: "Carousel",
    explanation:
      "5–8 slides med samma visuella språk. Bra för listor, processer, före/efter. Sparar och delas mer än stillbilder.",
  },
  {
    keywords: ["Reel", "reel", "Reels"],
    title: "Reel",
    explanation:
      "15–30 sek video. Hook i de första 3 sek. Använd talad röst — skarpare än text-overlay för att fånga.",
  },
  {
    keywords: ["Story", "stories"],
    title: "Story",
    explanation:
      "9:16 vertikalt. Försvinner på 24h — använd för bakom-kulisserna och swipe-up-CTA. Bygger närhet.",
  },

  // Voice
  {
    keywords: ["voice fingerprint", "voice-fingerprint", "röst-fingeravtryck"],
    title: "Voice fingerprint",
    explanation:
      "Det unika språkliga avtryck AI:n bygger från kundens egna inlägg och inspelningar. Utan det blir innehållet generiskt.",
    href: "/dashboard/profil",
  },

  // Konkurrenter
  {
    keywords: ["anti-position", "anti-positionering"],
    title: "Anti-positionering",
    explanation:
      "Vad ni INTE är i förhållande till storkedjor eller standardalternativet. Tydligast differentiering.",
  },
];

interface InjectedSpan {
  start: number;
  end: number;
  link: KnowledgeLink;
  matchText: string;
}

export function findKnowledgeMatches(text: string): InjectedSpan[] {
  if (!text) return [];

  const all: InjectedSpan[] = [];
  for (const link of KNOWLEDGE) {
    for (const kw of link.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        all.push({
          start: m.index,
          end: m.index + m[1].length,
          link,
          matchText: m[1],
        });
      }
    }
  }

  // Deduplicera överlappande — behåll längst
  all.sort((a, b) => b.end - b.start - (a.end - a.start));
  const used = new Set<number>();
  const final: InjectedSpan[] = [];
  for (const span of all) {
    let conflict = false;
    for (let i = span.start; i < span.end; i++) {
      if (used.has(i)) {
        conflict = true;
        break;
      }
    }
    if (!conflict) {
      for (let i = span.start; i < span.end; i++) used.add(i);
      final.push(span);
    }
  }
  final.sort((a, b) => a.start - b.start);
  return final;
}
