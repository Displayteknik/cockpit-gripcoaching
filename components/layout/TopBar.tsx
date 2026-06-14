"use client";

import { Phone, Mail } from "lucide-react";
import { CONTACT } from "@/lib/contact";

export function TopBar() {
  return (
    <div className="bg-[#1a1f2e] text-gray-300 text-[13px]">
      <div className="max-w-[1320px] mx-auto px-6 py-2.5 flex items-center justify-between">
        <span className="text-gray-400">{CONTACT.hoursShort}</span>
        <div className="flex items-center gap-6">
          <a
            href={CONTACT.phoneHref}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{CONTACT.phoneDisplay}</span>
          </a>
          <a
            href={CONTACT.emailHref}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{CONTACT.emailDisplay}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
