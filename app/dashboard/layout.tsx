"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Car, Palette, Image as ImageIcon, FileText, LayoutDashboard, ExternalLink, Layers, Sparkles, BookOpen, Home, Target, HelpCircle, TrendingUp, Settings, Users, MessageSquare, FileBarChart, Calendar, Activity, Search, Menu, X, Mail, Bot, Wrench, Rocket, Command, Compass, LogOut, Package, Film, Coins, Radio, CreditCard, BarChart3, Tag } from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
import ClientPicker from "@/components/ClientPicker";
import { DT_CLIENT_ID } from "@/lib/dt-client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
  /** Kundens motsvarande yta i portalen. Satt = kunden når samma innehåll själv. */
  kundHref?: string;
}
interface NavSection { label: string; items: NavItem[]; zon?: ZonId }

/**
 * MENY-1 (Håkans beslut 2026-08-10) — tre zoner efter VEM SOM KOMMER ÅT INNEHÅLLET.
 *
 * Bakgrunden: han öppnade Planering, bytte kund och såg samma ifyllda vecka i två konton.
 * Veckan var hans egen kalender (owner-grindad, ingen klientkolumn) — men sidan låg i samma
 * meny som kundsakerna, under klientväljaren, och lästes därför som kundens. Felet var inte
 * datat utan att menyn blandade tre olika slags sidor.
 *
 *   1. `eget`    — ditt, byter aldrig med kundväljaren. Ingen annan kommer åt det.
 *   2. `byra`    — om den VALDA kunden, men bara du ser det. Byter med väljaren.
 *   3. `kundens` — samma innehåll som kunden själv når i sin portal (/k/...).
 *
 * Zon 3 är bevisad, inte bedömd: varje post där har en `kundHref` som pekar på en sida som
 * faktiskt finns under `app/k/`. Saknas motsvarigheten hör posten i zon 2.
 */
type ZonId = "eget" | "byra" | "kundens";

// Zonerna lever kvar som METADATA på posterna (`zon`, `kundHref`) och styr prickmarkeringen
// i flikraden. De renderas inte längre som tre rubriker — se MENY-3 nedan.

/**
 * MENY-3 (Håkans beslut 2026-08-18) — SEX OMRÅDEN EFTER ARBETE, inte efter ägare.
 *
 * Bakgrunden: menyn visade 50 rader i 8 sektioner, alla alltid utfällda, och han hittade
 * inte det han sökte. Diagnosen (docs/MENY-KARTA.md) var inte att den var rörig utan att
 * den svarade på fel fråga. Zonerna ovan sorterar efter VEM SOM ÄGER sidan — men på
 * morgonen frågar man "vad ska jag göra?". Ett enda jobb, att sälja, låg utspritt på ÅTTA
 * menyrader i tre zoner och fyra sektioner, och alla åtta ledde till samma affärskort.
 *
 * Nu: sju ingångar i sidomenyn, och områdets sidor som FLIKAR över innehållet. Zonen är
 * inte borta — den har blivit en markering på fliken ("kunden ser det här") i stället för
 * tre rubriker man ska läsa och minnas.
 *
 * ⚠ Områdena pekar ut sidor med HREF, inte med kopior. Posterna byggs fortfarande i
 * buildNavSections (ikon, `match`, `kundHref` bor kvar där) och plockas ihop härifrån.
 * En sida som inte nämns nedan FÖRSVINNER INTE — den hamnar sist i Byrån. Att tappa en
 * sida ur menyn är samma sak som att ta bort den (MENY-2).
 */
const OMRADEN: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; hrefs: string[] }[] = [
  {
    id: "hq",
    label: "Founder HQ",
    icon: Command,
    hrefs: ["/dashboard/hq", "/dashboard/hq/planering", "/dashboard/hq/uppstart"],
  },
  {
    id: "salj",
    label: "Sälj",
    icon: TrendingUp,
    hrefs: [
      "/dashboard/pag",
      "/dashboard/fokus",
      "/dashboard/leads",
      "/dashboard/dm",
      "/dashboard/kunder",
      "/dashboard/offert",
      "/dashboard/hq/kontakt",
      "/dashboard/driv/stadning",
    ],
  },
  {
    id: "skapa",
    label: "Skapa",
    icon: ImageIcon,
    hrefs: [
      "/dashboard/studio",
      "/dashboard/studio/blogg",
      "/dashboard/studio/kalender",
      "/dashboard/linkedin",
      "/dashboard/nyhetsbrev",
      "/dashboard/agents",
      "/dashboard/veckoplan",
      "/dashboard/brand-kit",
    ],
  },
  {
    id: "kunden",
    label: "Kunden",
    icon: Users,
    hrefs: [
      "/dashboard",
      "/dashboard/profil",
      "/dashboard/konkurrenter",
      "/dashboard/analysator",
      "/dashboard/godkannande",
      "/dashboard/rapport",
      "/dashboard/paket",
      "/dashboard/kund-access",
      "/dashboard/ikigai",
    ],
  },
  {
    id: "sajt",
    label: "Sajt & SEO",
    icon: Layers,
    hrefs: [
      "/dashboard/sidor",
      "/dashboard/seo",
      "/dashboard/innehall",
      "/dashboard/blogg",
      "/dashboard/mejl",
      "/dashboard/fordon",
      "/dashboard/verk",
      "/dashboard/utstallningar",
    ],
  },
  {
    id: "priser",
    label: "Priser (DT)",
    icon: Tag,
    hrefs: [
      "/dashboard/prislistan/produkter",
      "/dashboard/prislistan",
      "/dashboard/prislistan/uppladdning",
      "/dashboard/prislistan/kalkylator",
      "/dashboard/prislistan/priscoach",
    ],
  },
  {
    id: "byran",
    label: "Byrån",
    icon: Settings,
    hrefs: [
      "/dashboard/mysales-kunder",
      "/dashboard/onboarding",
      "/dashboard/setup/onboard",
      "/dashboard/betalning",
      "/dashboard/kostnader",
      "/dashboard/kvalitet",
      "/dashboard/installningar",
      "/dashboard/setup",
      "/dashboard/specialister",
      "/dashboard/sms-paminnelse",
      "/dashboard/studio/reels",
      "/dashboard/webbdata-demo",
      "/dashboard/handbok",
    ],
  },
];

interface Omrade {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

/** Plockar ihop områdena ur de befintliga posterna. Allt som inte nämns hamnar i Byrån. */
function byggOmraden(sections: NavSection[]): Omrade[] {
  const alla = sections.flatMap((s) => s.items);
  const anvanda = new Set<string>();
  const omraden = OMRADEN.map((o) => {
    const items = o.hrefs
      .map((h) => alla.find((i) => i.href === h))
      .filter((i): i is NavItem => !!i);
    items.forEach((i) => anvanda.add(i.href));
    return { id: o.id, label: o.label, icon: o.icon, items };
  });
  const kvar = alla.filter((i) => !anvanda.has(i.href));
  if (kvar.length) {
    const byran = omraden.find((o) => o.id === "byran");
    if (byran) byran.items.push(...kvar);
  }
  return omraden.filter((o) => o.items.length > 0);
}

function buildNavSections(resourceModule: string): NavSection[] {
  const resourceItems: NavItem[] =
    resourceModule === "art"
      ? [
          { href: "/dashboard/verk", label: "Verk", icon: Palette },
          { href: "/dashboard/utstallningar", label: "Utställningar", icon: ImageIcon },
        ]
      : resourceModule === "automotive"
      ? [{ href: "/dashboard/fordon", label: "Fordon", icon: Car }]
      : [];

  return [
    // ── ZON 1: DITT EGET ────────────────────────────────────────────────────
    {
      zon: "eget",
      label: "Din vecka",
      items: [
        // Founder HQ = ägarens kommandobrygga. Den gamla länklistan bor på
        // /dashboard/genvagar och ligger med flit utanför menyn (REV-0).
        { href: "/dashboard/hq", label: "Founder HQ", icon: Command },
        // På G = affärerna i den ordning de behöver dig. Ligger före Planering:
        // det är den vy man öppnar först på morgonen.
        { href: "/dashboard/pag", label: "På G", icon: TrendingUp },
        { href: "/dashboard/hq/planering", label: "Planering", icon: Calendar },
        { href: "/dashboard/hq/uppstart", label: "Uppstart", icon: Rocket },
        { href: "/dashboard/hq/kontakt", label: "Vem har bollen", icon: Radio },
        { href: "/dashboard/driv/stadning", label: "Städa pipelinen", icon: Wrench },
      ],
    },
    {
      zon: "eget",
      label: "Agency",
      items: [
        { href: "/dashboard/mysales-kunder", label: "MySales pionjärer", icon: Users },
        // Automatisk provisionering från enbart en webbadress (ONBOARD-1). Skild från
        // "Onboarding-checklista", som är för en kund som redan finns.
        { href: "/dashboard/onboarding", label: "Ny kund från webbadress", icon: Sparkles },
        { href: "/dashboard/setup/onboard", label: "Onboarding-checklista", icon: Rocket },
        { href: "/dashboard/betalning", label: "Betalning och abonnemang", icon: CreditCard },
        { href: "/dashboard/kostnader", label: "Vad AI:n kostar", icon: Coins },
        // G-9: kvalitetssidan. Byråvy — vad varje regeluppsättning faktiskt producerade.
        // Ligger i menyn med flit: en sida som inte går att hitta finns inte.
        { href: "/dashboard/kvalitet", label: "Kvalitet", icon: BarChart3 },
        { href: "/dashboard/installningar", label: "Inställningar", icon: Settings },
      ],
    },
    {
      // Håkans beslut 16/8: samlat eget avsnitt för det som bara gäller Displayteknik idag
      // (fysiska produkter, inköp, prislistor) — till skillnad från DRIV/Fokus/etc som är
      // byggda generiskt och kan slås på för vilken kund som helst. Egen rubrik så det syns
      // tydligt att det här INTE är en standardmodul än.
      zon: "eget",
      label: "DT special",
      items: [
        { href: "/dashboard/prislistan/produkter", label: "Produkter", icon: Package },
        { href: "/dashboard/prislistan", label: "Prislistan (översikt)", icon: Tag },
        { href: "/dashboard/prislistan/uppladdning", label: "Läs in prislista", icon: FileText },
        { href: "/dashboard/prislistan/kalkylator", label: "Kabinettkalkylatorn", icon: BarChart3 },
        { href: "/dashboard/prislistan/priscoach", label: "Priscoachen", icon: Sparkles },
      ],
    },
    {
      zon: "eget",
      label: "Verktyg",
      items: [
        { href: "/dashboard/setup", label: "Setup-agent", icon: Wrench },
        { href: "/dashboard/specialister", label: "AI-specialister", icon: Sparkles },
        { href: "/dashboard/sms-paminnelse", label: "SMS-påminnelse", icon: MessageSquare },
        { href: "/dashboard/studio/reels", label: "Reels (test)", icon: Film },
        { href: "/dashboard/webbdata-demo", label: "Webbdata (demo)", icon: Activity },
        { href: "/dashboard/handbok", label: "Handbok", icon: HelpCircle },
      ],
    },

    // ── ZON 2: OM DEN VALDA KUNDEN, MEN BARA DU SER DET ─────────────────────
    {
      zon: "byra",
      label: "Läget",
      items: [
        { href: "/dashboard", label: "Översikt", icon: Home },
        { href: "/dashboard/leads", label: "Nya leads", icon: Users },
        { href: "/dashboard/godkannande", label: "Godkännanden", icon: MessageSquare },
        { href: "/dashboard/rapport", label: "Veckorapport", icon: FileBarChart },
        { href: "/dashboard/paket", label: "Paket & moduler", icon: Package },
        { href: "/dashboard/kund-access", label: "Kund-access (länk)", icon: ExternalLink },
      ],
    },
    {
      zon: "byra",
      label: "Underlag och sajt",
      items: [
        { href: "/dashboard/konkurrenter", label: "Konkurrenter", icon: Users },
        { href: "/dashboard/analysator", label: "Profil-analysator", icon: Search },
        { href: "/dashboard/innehall", label: "Navet", icon: Compass, match: ["/dashboard/innehall"] },
        { href: "/dashboard/mejl", label: "Mejl", icon: Mail },
        { href: "/dashboard/sidor", label: "Sidor", icon: Layers },
        { href: "/dashboard/blogg", label: "Blogg-arkiv", icon: BookOpen },
        ...resourceItems,
      ],
    },

    // ── ZON 3: KUNDENS EGNA YTOR ────────────────────────────────────────────
    // Varje post här har en motsvarighet under app/k/ — kunden når samma innehåll själv.
    // Ändrar du något här ser kunden det. Det är hela poängen med zonen.
    {
      zon: "kundens",
      label: "Skapa och publicera",
      items: [
        { href: "/dashboard/brand-kit", label: "Grafisk profil", icon: Palette, kundHref: "/k/brand-kit" },
        { href: "/dashboard/studio", label: "Studio", icon: ImageIcon, match: ["/dashboard/studio", "/dashboard/skapa"], kundHref: "/k/studio" },
        { href: "/dashboard/studio/blogg", label: "Blogg", icon: FileText, kundHref: "/k/blogg" },
        { href: "/dashboard/studio/kalender", label: "Kalender", icon: Calendar, kundHref: "/k/kalender" },
        { href: "/dashboard/linkedin", label: "LinkedIn", icon: LinkedinIcon, kundHref: "/k/linkedin" },
        { href: "/dashboard/nyhetsbrev", label: "Nyhetsbrev", icon: Mail, kundHref: "/k/nyhetsbrev" },
        { href: "/dashboard/agents", label: "Idé-bank", icon: Bot, kundHref: "/k/ideer" },
        // MENY-2 (Håkans krav 11/8): "inloggad som displayteknik i cockpit (admin) ser jag inte
        // dm pipelinen. vill ha den". DM och veckoplanen nåddes bara via flikraden i
        // components/dashboard/PostsTabs.tsx — alltså bara om man redan stod på en inläggssida.
        // Båda har en motsvarighet i kundportalen och hör därför i den här zonen.
        { href: "/dashboard/dm", label: "DM & pipeline", icon: MessageSquare, kundHref: "/k/dm" },
        // KUNDREGISTER-1: står bredvid DM med flit — det är samma människor, sedda från
        // två håll. Listan är alla kontakter i MySales, tavlan är de som har ett pågående
        // samtal. En sida som inte finns i menyn finns inte (MENY-2).
        { href: "/dashboard/kunder", label: "Kunder", icon: Users, kundHref: "/k/kunder" },
        { href: "/dashboard/veckoplan", label: "Veckoplan", icon: CalendarDays, kundHref: "/k/veckoplan" },
      ],
    },
    {
      zon: "kundens",
      label: "Kundens dag",
      items: [
        { href: "/dashboard/profil", label: "Brand-profil", icon: Target, kundHref: "/k/profil" },
        { href: "/dashboard/fokus", label: "Fokus idag", icon: Target, kundHref: "/k/fokus" },
        { href: "/dashboard/offert", label: "Offerter", icon: FileText, kundHref: "/k/offert" },
        { href: "/dashboard/seo", label: "SEO & AEO", icon: TrendingUp, kundHref: "/k/seo" },
        { href: "/dashboard/ikigai", label: "Ikigai-motor", icon: Compass, kundHref: "/k/ikigai" },
      ],
    },
  ];
}

// Bantat nav för en klient-scopad inloggning (t.ex. HM Motor sköter sina egna fordon).
function buildScopedNavSections(): NavSection[] {
  return [
    {
      label: "Min sajt",
      items: [
        { href: "/dashboard/fordon", label: "Fordon", icon: Car },
        { href: "/dashboard/sidor", label: "Sidor", icon: Layers },
        { href: "/dashboard/seo", label: "Statistik & SEO", icon: TrendingUp },
      ],
    },
  ];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourceModule, setResourceModule] = useState<string>("automotive");
  const [scoped, setScoped] = useState(false);
  // MENY-1: kundens namn skrivs i zonrubriken ("Om valda kunden: AluCon AB"), så det aldrig
  // går att tro att en sida hör till kunden när den i själva verket är din egen.
  const [klientNamn, setKlientNamn] = useState<string>("");
  // Läckage-fix 19/8: Founder HQ visar Håkans/DT:s egna siffror oavsett aktiv klient
  // (medvetet, "eget"-zonen) — men Håkan vill ändå att ingången göms när en annan
  // klient är vald, precis som Dagens drag. arDt styr om "hq"-området visas alls.
  const [arDt, setArDt] = useState(false);

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => {
        if (c?.resource_module) setResourceModule(c.resource_module);
        if (c?.name) setKlientNamn(String(c.name));
        setScoped(!!c?.scoped);
        setArDt(c?.id === DT_CLIENT_ID);
      })
      .catch(() => {});
  }, []);

  const navSections = scoped ? buildScopedNavSections() : buildNavSections(resourceModule);


  // Sidor som visar en TAVLA (kolumner sida vid sida) får hela fönstret. Listan är kort med
  // flit: varje sida här måste tåla 1600 px utan att bli glesa fält och lång radlängd.
  const BREDA_SIDOR = ["/dashboard/dm"];
  const bredSida = BREDA_SIDOR.some((h) => pathname === h || pathname.startsWith(h + "/"));

  const itemActive = (i: NavItem): boolean => {
    if (i.match) return i.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
    return i.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(i.href);
  };

  // Mest specifik vinner: bara den djupaste matchande posten markeras aktiv
  // (annars lyser t.ex. "Studio" samtidigt som "Blogg"/"Kalender").
  const allItems = navSections.flatMap((s) => s.items);
  const activeHref = allItems
    .filter(itemActive)
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const activeItem = allItems.find((i) => i.href === activeHref);

  // Läckage-fix 19/8: dessa sidor (utöver hela "hq"-området) är också hårdkodade mot
  // DT:s data, men ligger blandade i "Sälj" tillsammans med tenant-generella sidor —
  // så bara posterna, inte hela området, göms för andra klienter.
  const DT_ENDAST_HREFS = ["/dashboard/hq/kontakt", "/dashboard/driv/stadning", "/dashboard/pag"];

  // MENY-3: sidomenyn visar OMRÅDEN, flikraden visar områdets sidor.
  // "hq" (Founder HQ) göms för alla andra klienter än DT — se läckage-fix 19/8 ovan.
  const omraden = scoped
    ? []
    : byggOmraden(navSections)
        .filter((o) => arDt || o.id !== "hq")
        .map((o) => (arDt ? o : { ...o, items: o.items.filter((i) => !DT_ENDAST_HREFS.includes(i.href)) }));
  const aktivtOmrade = omraden.find((o) => o.items.some((i) => i.href === activeHref)) ?? null;
  const flikar = aktivtOmrade?.items ?? [];

  // Sätt browser-flikens titel (admin-yta ärver annars publika HM Motor-titeln)
  useEffect(() => {
    document.title = activeItem?.label
      ? `${activeItem.label} · Cockpit — GripCoaching`
      : "Cockpit — GripCoaching";
  }, [activeItem?.label]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-100 transition-transform flex flex-col`}>
        <div className="px-4 py-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <LayoutDashboard className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm text-gray-900">Cockpit</div>
              <div className="text-xs text-gray-400">GripCoaching</div>
            </div>
          </Link>
          <div className="mt-3">
            <ClientPicker />
          </div>
        </div>

        {/* MENY-3: sju ingångar efter ARBETE. Områdets sidor ligger som flikar över
            innehållet, inte som femtio rader här. Se docs/MENY-KARTA.md. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {scoped
            ? navSections.flatMap((s) => s.items).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={item.href === activeHref ? "page" : undefined}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    item.href === activeHref
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${item.href === activeHref ? "text-indigo-600" : "text-gray-400"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))
            : omraden.map((o) => {
                const aktiv = o.id === aktivtOmrade?.id;
                // Ingången leder till områdets FÖRSTA sida. Flikraden tar dig vidare.
                const href = o.items[0].href;
                return (
                  <Link
                    key={o.id}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={aktiv ? "page" : undefined}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      aktiv
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        aktiv ? "bg-indigo-100" : "bg-gray-100 group-hover:bg-gray-200"
                      }`}
                    >
                      <o.icon className={`w-[18px] h-[18px] ${aktiv ? "text-indigo-600" : "text-gray-500"}`} />
                    </span>
                    <span className="truncate">{o.label}</span>
                    <span className="ml-auto text-xs tabular-nums text-gray-300">{o.items.length}</span>
                  </Link>
                );
              })}
        </nav>

        {/* Sidfot: byrå-genvägar (döljs i låst klientvy) + utloggning (alltid synlig) */}
        <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
          {!scoped && (
            <>
              <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                <ExternalLink className="w-[18px] h-[18px] text-gray-400" />
                Sideditor (Puck)
              </Link>
              <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                <ExternalLink className="w-[18px] h-[18px] text-gray-400" />
                Visa publik sajt
              </Link>
            </>
          )}
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <LogOut className="w-[18px] h-[18px] text-gray-400" />
              Logga ut
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 h-14 flex items-center justify-between">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 -ml-2 text-gray-700">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="font-display font-bold text-sm text-gray-900">{activeItem?.label || "Cockpit"}</div>
            <div className="w-9" />
          </div>
        </header>

        {/* DM-4d (Håkans fynd 11/8): "det finns ju tom yta till både höger o vänster".
            Innehållet är kapat till 1280 px (max-w-7xl) medan skärmen är bredare — så en
            pipeline med sju fack trängdes ihop fastän utrymmet fanns. Tavelsidor får därför
            hela bredden. Resten av sidorna behåller kapet: en löptext som är 1600 px bred är
            svårläst, och det var inte det han klagade på. */}
        {/* MENY-3: områdets sidor som flikar. Ersätter fyrtio menyrader — och gör
            grannskapet synligt: står du på Fokus idag ser du att Offerter och Nya leads
            hör till samma jobb, vilket menyn aldrig visade. `kundHref` blir en prick:
            zonen är kvar som information, men inte längre som tre rubriker att minnas. */}
        {flikar.length > 1 && (
          <div className="bg-white border-b border-gray-100 sticky top-0 lg:top-0 z-20">
            <div className={`${bredSida ? "max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8`}>
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2">
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-gray-400 pr-3 flex-shrink-0">
                  {aktivtOmrade?.label}
                </span>
                {flikar.map((f) => {
                  const aktiv = f.href === activeHref;
                  return (
                    <Link
                      key={f.href}
                      href={f.href}
                      aria-current={aktiv ? "page" : undefined}
                      title={f.kundHref ? "Kunden ser den här sidan i sin egen portal" : undefined}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                        aktiv
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      {f.label}
                      {f.kundHref && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${aktiv ? "bg-indigo-400" : "bg-gray-300"}`}
                          aria-label="Kunden ser den här sidan"
                        />
                      )}
                    </Link>
                  );
                })}
                {/* MENY-1:s poäng får inte gå förlorad. Zonrubrikerna är borta, men den
                    upplysning som faktiskt behövdes — "ändrar jag här ser kunden det" —
                    står kvar, med kundens namn utskrivet så det inte går att missta. */}
                {flikar.some((f) => f.kundHref) && (
                  <span className="hidden md:inline-flex items-center gap-1.5 pl-4 text-xs text-gray-400 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    {klientNamn ? `${klientNamn} ser sidan i sin portal` : "kunden ser sidan i sin portal"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <main className={`${bredSida ? "max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 py-6`}>{children}</main>
      </div>
    </div>
  );
}
