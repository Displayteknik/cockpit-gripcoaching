"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, CalendarDays, Car, Clock, MessageSquare, BarChart3 } from "lucide-react";

const TABS = [
  { href: "/dashboard/skapa", label: "Skapa inlägg", icon: Sparkles },
  { href: "/dashboard/veckoplan", label: "Veckoplan", icon: CalendarDays },
  { href: "/dashboard/fordon-inlagg", label: "Fordonsinlägg", icon: Car, automotiveOnly: true },
  { href: "/dashboard/scheduler", label: "Schemalägg", icon: Clock },
  { href: "/dashboard/dm", label: "DM & Pipeline", icon: MessageSquare },
  { href: "/dashboard/analytics", label: "Analys", icon: BarChart3 },
];

export default function PostsTabs() {
  const pathname = usePathname();
  const [module, setModule] = useState<string>("");

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => setModule(c?.resource_module || ""))
      .catch(() => {});
  }, []);

  const tabs = TABS.filter((t) => !t.automotiveOnly || module === "automotive");

  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-3">Inlägg</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                active
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
