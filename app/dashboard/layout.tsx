"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, FileText, LayoutDashboard, ExternalLink, Layers, Sparkles, BookOpen, Home, Target, HelpCircle, TrendingUp, Settings, Users, MessageSquare, FileBarChart, Calendar, Activity, Search } from "lucide-react";
import ClientPicker from "@/components/ClientPicker";

const navItems = [
  { href: "/dashboard", label: "Översikt", icon: Home },
  { href: "/dashboard/profil", label: "Profil", icon: Target },
  { href: "/dashboard/fordon", label: "Fordon", icon: Car },
  { href: "/dashboard/blogg", label: "Blogg", icon: FileText },
  { href: "/dashboard/sidor", label: "Sidor", icon: Layers },
  { href: "/dashboard/social", label: "Social", icon: Sparkles },
  { href: "/dashboard/scheduler", label: "Schemaläggare", icon: Calendar },
  { href: "/dashboard/analytics", label: "Analytics", icon: Activity },
  { href: "/dashboard/analysator", label: "Analysator", icon: Search },
  { href: "/dashboard/blogg-maskin", label: "Blogg-maskin", icon: BookOpen },
  { href: "/dashboard/seo", label: "SEO", icon: TrendingUp },
  { href: "/dashboard/konkurrenter", label: "Konkurrenter", icon: Users },
  { href: "/dashboard/godkannande", label: "Godkännande", icon: MessageSquare },
  { href: "/dashboard/rapport", label: "Rapport", icon: FileBarChart },
  { href: "/dashboard/handbok", label: "Handbok", icon: HelpCircle },
  { href: "/dashboard/installningar", label: "Inställningar", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-brand-blue" />
              <span className="font-display font-bold text-base">Cockpit</span>
            </Link>
            <ClientPicker />
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-blue/10 text-brand-blue"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-brand-blue flex items-center gap-1"
            >
              Sideditor
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-brand-blue flex items-center gap-1"
            >
              Visa sajt
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
