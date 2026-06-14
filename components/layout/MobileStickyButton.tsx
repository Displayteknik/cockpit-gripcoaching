"use client";

import { Phone } from "lucide-react";
import { CONTACT } from "@/lib/contact";

export function MobileStickyButton() {
  return (
    <a
      href={CONTACT.phoneHref}
      className="fixed bottom-4 right-4 z-50 md:hidden bg-brand-blue hover:bg-brand-blue-dark text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      aria-label="Ring HM Motor"
    >
      <Phone className="w-6 h-6" />
    </a>
  );
}
