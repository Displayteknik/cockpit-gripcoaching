"use client";

// Snygg select för kundvänd UI: native <select> under huven (pålitlig på mobil +
// tangentbord + a11y) men med egen chevron istället för webbläsarens fula systempil.
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export default function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-block w-full">
      <select
        {...props}
        className={`appearance-none w-full rounded-lg border border-gray-200 bg-white pl-3 pr-9 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
