"use client";

import { Phone, Mail } from "lucide-react";

export function TopBar() {
  return (
    <div className="bg-[#1a1f2e] text-gray-300 text-[13px]">
      <div className="max-w-[1320px] mx-auto px-6 py-2.5 flex items-center justify-between">
        <span className="text-gray-400">
          Mån–Tor 08–17 &middot; Fre 08–16
        </span>
        <div className="flex items-center gap-6">
          <a
            href="tel:+46703218232"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">070-321 82 32</span>
          </a>
          <a
            href="mailto:info@hmmotor.se"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">info@hmmotor.se</span>
          </a>
        </div>
      </div>
    </div>
  );
}
