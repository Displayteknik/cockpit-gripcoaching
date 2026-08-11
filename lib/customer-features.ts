import { Home, Target, Sparkles, Lightbulb, Calendar, Users, TrendingUp, Globe, FileText, Compass, Mail, BookOpen, CreditCard, Palette } from "lucide-react";
import { LinkedinIcon } from "./module-icons";

// Katalog över moduler en kund kan få access till i portalen (/k).
// EN källa: används av admin-väljaren (kund-access), portal-navet och serverside-spärren.
//
// "key" sparas i clients.customer_features (text[]). NULL i DB = alla moduler (bakåtkompat).
// Översikten (/k) är alltid tillgänglig och listas inte här.
export interface CustomerFeature {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  hideFromNav?: boolean; // modulen finns kvar (route + access) men visas inte i sidomenyn
  /**
   * Extra sidor som hör till SAMMA modul och visas direkt under den i sidomenyn.
   *
   * ★ VARFÖR INTE ETT EGET MODUL-ID: `normalizeFeatures` har ingen "impliceras av"-logik,
   *   så en ny nyckel hade varit AVSTÄNGD för varje befintlig kund tills den bockats för
   *   en och en i /dashboard/kund-access. Den grafiska profilen är inte en egen produkt —
   *   den som köpt Brand-profil äger sina färger. Alltså samma modul, egen sida.
   */
  syskon?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

export const CUSTOMER_FEATURES: CustomerFeature[] = [
  {
    key: "profil",
    label: "Brand-profil",
    href: "/k/profil",
    icon: Target,
    description: "Kunden ser och kompletterar sin egen röst, ICP, kund-citat och bilder. Inkluderar Färger & logga.",
    syskon: [{ href: "/k/brand-kit", label: "Färger & logga", icon: Palette }],
  },
  {
    key: "seo",
    label: "Sök-synlighet",
    href: "/k/seo",
    icon: TrendingUp,
    description: "Sid-audit (SEO + AEO-score), åtgärdslista och sökords-tracker för sin egen sajt.",
  },
  {
    key: "besokare",
    label: "Statistik",
    href: "/k/besokare",
    icon: Globe,
    description: "Komplett dashboard — besök, kanaler, AI-synlighet, Google-sök, sökord och trender. Fylls automatiskt från pixeln + Google-koppling.",
  },
  {
    key: "skapa",
    label: "Skapa inlägg",
    href: "/k/studio", // premium-Studion (utrullad); gamla /k/skapa kvar som fallback
    icon: Sparkles,
    description: "Skapa on-brand inlägg, bilder, karuseller och reels i din röst.",
  },
  {
    key: "blog",
    label: "Blogg",
    href: "/k/blogg",
    icon: BookOpen,
    description: "Skriv och publicera blogginlägg i din röst — längre texter som rankar i Google. Skrivhjälpen hjälper dig.",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "/k/linkedin",
    icon: LinkedinIcon,
    description: "Skriv och planera LinkedIn-innehåll i din röst.",
    hideFromNav: true, // inbakad i "Skapa inlägg" (per-kanal) — göms i menyn, routen kvar
  },
  {
    // ETAPP K2-2, omdöpt i BETAL-1. Nyckeln matchar modul-id:t `credits` i
    // platform_modules — kundvänt heter det TOKENS, internt fortsätter det heta credits.
    // Ingen omdöpning i datalagret: nyckeln är samma, bara etiketten är ny.
    key: "credits",
    label: "Tokens",
    href: "/k/credits",
    icon: Sparkles,
    description: "Tokens för bilder och video: hur många du använt, hur många som är kvar och hur du fyller på.",
  },
  {
    // BETAL-1 (B-3). Betalsidan är den ENDA sida en pausad kund når, därför får den
    // aldrig gömmas bakom en modulgrind som kan vara avbockad.
    key: "betalning",
    label: "Abonnemang",
    href: "/k/betalning",
    icon: CreditCard,
    description: "Nästa betalning, vad som ingår, kvitton och byte av betalkort.",
  },
  {
    key: "offert",
    label: "Offerter",
    href: "/k/offert",
    icon: FileText,
    description: "Dina B2B-offerter från MySales Coach, samlade.",
  },
  {
    key: "fokus",
    label: "Fokus idag",
    href: "/k/fokus",
    icon: Target,
    description: "Dina viktigaste affärer idag — prioriterade, med säljcoach och nästa drag.",
  },
  {
    key: "ikigai",
    label: "Ikigai",
    href: "/k/ikigai",
    icon: Compass,
    description: "Lead-magnet som fångar och kvalificerar intressenter.",
  },
  {
    key: "ideer",
    label: "Idé-bank",
    href: "/k/ideer",
    icon: Lightbulb,
    description: "Granska och godkänn utkast från Skrivhjälpen.",
  },
  {
    key: "veckoplan",
    label: "Veckoplan",
    href: "/k/veckoplan",
    icon: Calendar,
    description: "Sju färdiga inlägg enligt 4A-rytmen.",
  },
  {
    key: "compass",
    label: "Kalender",
    href: "/k/kalender",
    icon: Compass,
    description: "Din innehållskalender med Content Compass. Skapa hela veckans innehåll färdigprofilerat och se din balans.",
  },
  {
    key: "newsletter",
    label: "Nyhetsbrev",
    href: "/k/nyhetsbrev",
    icon: Mail,
    description: "Gör ett nyhetsbrev av din text eller ett blogginlägg, i din röst. Förhandsgranska, redigera och skicka ett testmejl.",
  },
  {
    key: "dm",
    label: "DM & Pipeline",
    href: "/k/dm",
    icon: Users,
    description: "Håll koll på DM-kontakter från kommentar till bokad kund.",
  },
];

export const ALL_FEATURE_KEYS = CUSTOMER_FEATURES.map((f) => f.key);

export const OVERVIEW_NAV = { key: "__overview", label: "Översikt", href: "/k", icon: Home };

export function featureByKey(key: string): CustomerFeature | undefined {
  return CUSTOMER_FEATURES.find((f) => f.key === key);
}

// Normalisera värdet från DB: NULL/tom = alla moduler (bakåtkompat med befintliga kunder
// som redan hade portal-access innan modul-styrning fanns).
export function normalizeFeatures(raw: string[] | null | undefined): string[] {
  if (!raw || raw.length === 0) return [...ALL_FEATURE_KEYS];
  return raw.filter((k) => ALL_FEATURE_KEYS.includes(k));
}
