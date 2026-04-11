"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown, Phone } from "lucide-react";

const mainLinks = [
  { href: "/", label: "Hem" },
  { href: "/fordon?kategori=car", label: "Bilar" },
  { href: "/fordon?kategori=atv", label: "Fyrhjulingar" },
  { href: "/fordon?kategori=moped", label: "Mopeder" },
];

const moreLinks = [
  { href: "/fordon?kategori=slapvagn", label: "Släpvagnar" },
  { href: "/fordon?kategori=tradgard", label: "Trädgård" },
  { href: "/om-oss", label: "Om oss" },
  { href: "/blogg", label: "Blogg" },
  { href: "/kontakt", label: "Kontakt" },
];

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="max-w-[1140px] mx-auto px-4 flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/img/hm-motor-logo.png"
            alt="HM Motor Krokom"
            width={140}
            height={48}
            className="h-10 md:h-12 w-auto"
            priority
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-text-primary hover:text-brand-blue transition-colors rounded-md hover:bg-surface-light"
            >
              {link.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
              className="px-3 py-2 text-sm font-medium text-text-primary hover:text-brand-blue transition-colors rounded-md hover:bg-surface-light flex items-center gap-1"
            >
              Mer
              <ChevronDown
                className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              />
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-4 py-2.5 text-sm text-text-primary hover:bg-surface-light hover:text-brand-blue transition-colors"
                    onClick={() => setMoreOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-3">
          <a
            href="tel:+46640-10350"
            className="hidden md:flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <Phone className="w-4 h-4" />
            Ring Håkan
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-text-primary"
            aria-label="Meny"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {[...mainLinks, ...moreLinks].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-3 py-3 text-base font-medium text-text-primary hover:bg-surface-light rounded-md transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="tel:+46640-10350"
              className="flex items-center justify-center gap-2 bg-brand-blue text-white px-4 py-3 rounded-lg font-semibold mt-3"
            >
              <Phone className="w-5 h-5" />
              Ring Håkan — 0640-103 50
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
