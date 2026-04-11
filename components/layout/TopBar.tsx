"use client";

import { Phone, Mail, Clock } from "lucide-react";

export function TopBar() {
  return (
    <div className="bg-surface-dark text-text-on-dark text-sm">
      <div className="max-w-[1140px] mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-text-light">
          <Clock className="w-3.5 h-3.5" />
          <span>Mån–Fre 08–17 | Lör efter avtal</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="tel:+46640-10350"
            className="flex items-center gap-1.5 hover:text-brand-gold transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">0640-103 50</span>
          </a>
          <a
            href="mailto:info@krokomsporten.se"
            className="flex items-center gap-1.5 hover:text-brand-gold transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">info@krokomsporten.se</span>
          </a>
        </div>
      </div>
    </div>
  );
}
