"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Car, Palette, Image as ImageIcon, FileText, LayoutDashboard, ExternalLink, Layers, Sparkles, BookOpen, Home, Target, HelpCircle, TrendingUp, Settings, Users, MessageSquare, FileBarChart, Calendar, Activity, Search, Menu, X, ChevronDown, Mail, Bot, Wrench, Rocket } from "lucide-react";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
import ClientPicker from "@/components/ClientPicker";

interface NavItem { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
interface NavSection { label: string; items: NavItem[] }

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
    {
      label: "Strategi",
      items: [
        { href: "/dashboard", label: "Översikt", icon: Home },
        { href: "/dashboard/profil", label: "Brand-profil", icon: Target },
        { href: "/dashboard/konkurrenter", label: "Konkurrenter", icon: Users },
        { href: "/dashboard/analysator", label: "Profil-analysator", icon: Search },
      ],
    },
    {
      label: "LinkedIn",
      items: [
        { href: "/dashboard/linkedin", label: "LinkedIn-motor", icon: LinkedinIcon },
      ],
    },
    {
      label: "Instagram & Social",
      items: [
        { href: "/dashboard/skapa", label: "Skapa inlägg", icon: Sparkles },
        { href: "/dashboard/veckoplan", label: "Veckoplan (7 inlägg)", icon: Calendar },
        { href: "/dashboard/dm", label: "DM & Pipeline", icon: MessageSquare },
        { href: "/dashboard/social", label: "Inlägg (klassisk)", icon: Sparkles },
        { href: "/dashboard/scheduler", label: "Schemalägga", icon: Calendar },
        { href: "/dashboard/analytics", label: "IG Analytics", icon: Activity },
      ],
    },
    {
      label: "Innehåll & SEO",
      items: [
        { href: "/dashboard/blogg-maskin", label: "Blogg-maskin", icon: BookOpen },
        { href: "/dashboard/blogg", label: "Blogg-arkiv", icon: FileText },
        { href: "/dashboard/seo", label: "SEO & AEO", icon: TrendingUp },
        { href: "/dashboard/sidor", label: "Sidor", icon: Layers },
        { href: "/dashboard/specialister", label: "AI-specialister", icon: Sparkles },
      ],
    },
    {
      label: "Mejl-motor",
      items: [
        { href: "/dashboard/mejl", label: "Mejl-motor", icon: Mail },
      ],
    },
    {
      label: "Agent-loop",
      items: [
        { href: "/dashboard/agents", label: "Idé-bank & trend", icon: Bot },
      ],
    },
    {
      label: "Kund-förvaltning",
      items: [
        { href: "/dashboard/godkannande", label: "Godkännanden", icon: MessageSquare },
        { href: "/dashboard/rapport", label: "Veckorapport", icon: FileBarChart },
        { href: "/dashboard/kund-access", label: "MySales Pro-access", icon: ExternalLink },
        ...resourceItems,
      ],
    },
    {
      label: "System",
      items: [
        { href: "/dashboard/setup/onboard", label: "Onboarding", icon: Rocket },
        { href: "/dashboard/setup", label: "Setup-agent", icon: Wrench },
        { href: "/dashboard/handbok", label: "Handbok", icon: HelpCircle },
        { href: "/dashboard/installningar", label: "Inställningar", icon: Settings },
      ],
    },
  ];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourceModule, setResourceModule] = useState<string>("automotive");

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => { if (c?.resource_module) setResourceModule(c.resource_module); })
      .catch(() => {});
  }, []);

  const navSections = buildNavSections(resourceModule);

  // Hitta aktiv sektion-label för mobile-titel
  const activeItem = navSections.flatMap((s) => s.items).find((i) => i.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(i.href));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} fixed lg:sticky top-0 left-0 z-40 w-64 h-screen bg-white border-r border-gray-200 transition-transform overflow-y-auto`}>
        <div className="px-4 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm text-gray-900">Cockpit</div>
              <div className="text-[10px] text-gray-500">GripCoaching</div>
            </div>
          </Link>
          <div className="mt-3">
            <ClientPicker />
          </div>
        </div>

        <nav className="px-2 py-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{section.label}</div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-4 mt-auto border-t border-gray-100 pt-3 space-y-1">
          <Link href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900">
            <ExternalLink className="w-3.5 h-3.5" />
            Sideditor (Puck)
          </Link>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900">
            <ExternalLink className="w-3.5 h-3.5" />
            Visa publik sajt
          </Link>
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
