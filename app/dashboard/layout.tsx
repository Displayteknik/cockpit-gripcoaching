"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Car, Palette, Image as ImageIcon, FileText, LayoutDashboard, ExternalLink, Layers, Sparkles, BookOpen, Home, Target, HelpCircle, TrendingUp, Settings, Users, MessageSquare, FileBarChart, Calendar, Activity, Search, Menu, X, ChevronDown, Mail, Bot, Wrench, Rocket, Command, Compass, LogOut, Package, Film, Coins, Radio, CreditCard, BarChart3 } from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
import ClientPicker from "@/components/ClientPicker";

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

const ZONER: { id: ZonId; rubrik: string; forklaring: string }[] = [
  { id: "eget", rubrik: "Ditt eget", forklaring: "Bara du. Byter inte när du växlar kund." },
  { id: "byra", rubrik: "Om valda kunden", forklaring: "Ditt arbete med kunden. Kunden ser inte det här." },
  { id: "kundens", rubrik: "Kundens egna ytor", forklaring: "Samma innehåll som kunden når i sin portal." },
];

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
        { href: "/dashboard/hq/planering", label: "Planering", icon: Calendar },
        { href: "/dashboard/hq/uppstart", label: "Uppstart", icon: Rocket },
        { href: "/dashboard/hq/kontakt", label: "Vem har bollen", icon: Radio },
      ],
    },
    {
      zon: "eget",
      label: "Byrån",
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
        { href: "/dashboard/installningar", label: "Inställningar", icon: Settings },
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
        { href: "/dashboard/brand-kit", label: "Grafisk profil", icon: Palette },
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

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => {
        if (c?.resource_module) setResourceModule(c.resource_module);
        if (c?.name) setKlientNamn(String(c.name));
        setScoped(!!c?.scoped);
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

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section, si) => (
            <div key={section.label} className="mb-5">
              {/* MENY-1: zonrubriken skrivs EN gång, vid första sektionen i zonen. Den bär
                  förklaringen — utan den är "Ditt eget" bara ett ord, och det var just
                  otydligheten som fick Planering att läsas som kundens vecka. */}
              {section.zon && section.zon !== navSections[si - 1]?.zon && (
                <div className={si > 0 ? "mt-6 mb-3 pt-4 border-t border-gray-200" : "mb-3"}>
                  <div className="px-3 text-xs font-bold uppercase tracking-wider text-gray-900">
                    {ZONER.find((z) => z.id === section.zon)?.rubrik}
                    {section.zon === "byra" && klientNamn ? `: ${klientNamn}` : ""}
                  </div>
                  <div className="px-3 mt-0.5 text-xs leading-snug text-gray-400">
                    {ZONER.find((z) => z.id === section.zon)?.forklaring}
                  </div>
                </div>
              )}
              <div className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{section.label}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = item.href === activeHref;
                  // Extern genväg (t.ex. Lobbyn i MySales Coach) → ny flik, aldrig aktiv-markerad.
                  if (item.href.startsWith("http")) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <item.icon className="w-[18px] h-[18px] flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                        <span className="truncate">{item.label}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-300 group-hover:text-gray-400" />
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-semibold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
        <main className={`${bredSida ? "max-w-none" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 py-6`}>{children}</main>
      </div>
    </div>
  );
}
