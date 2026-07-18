"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CUSTOMER_FEATURES, OVERVIEW_NAV } from "@/lib/customer-features";

// Kundportalens sidomeny med tydlig markering av vald sida (i kundens egen färg).
export default function CustomerNav({ features, primaryColor, onNavigate }: { features: string[]; primaryColor: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = [OVERVIEW_NAV, ...CUSTOMER_FEATURES.filter((f) => features.includes(f.key) && !f.hideFromNav)];

  return (
    <nav className="flex-1 py-4 space-y-1 px-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/k" ? pathname === "/k" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg font-medium transition-colors ${
              active ? "" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
            style={active ? { background: `${primaryColor}14`, color: primaryColor } : undefined}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: active ? primaryColor : "#9ca3af" }} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
