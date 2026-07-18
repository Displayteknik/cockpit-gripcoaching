import { Home, Target, Sparkles, Lightbulb, Calendar, Users, TrendingUp, Globe, FileText } from "lucide-react";
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
}

export const CUSTOMER_FEATURES: CustomerFeature[] = [
  {
    key: "profil",
    label: "Brand-profil",
    href: "/k/profil",
    icon: Target,
    description: "Kunden ser och kompletterar sin egen röst, ICP, kund-citat och bilder.",
  },
  {
    key: "seo",
    label: "SEO & AEO",
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
    key: "linkedin",
    label: "LinkedIn",
    href: "/k/linkedin",
    icon: LinkedinIcon,
    description: "Skriv och planera LinkedIn-innehåll i din röst.",
  },
  {
    key: "offert",
    label: "Offerter",
    href: "/k/offert",
    icon: FileText,
    description: "Dina B2B-offerter från MySales Coach, samlade.",
  },
  {
    key: "ideer",
    label: "Idé-bank",
    href: "/k/ideer",
    icon: Lightbulb,
    description: "Granska och godkänn AI-genererade utkast.",
  },
  {
    key: "veckoplan",
    label: "Veckoplan",
    href: "/k/veckoplan",
    icon: Calendar,
    description: "Sju färdiga inlägg enligt 4A-rytmen.",
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
