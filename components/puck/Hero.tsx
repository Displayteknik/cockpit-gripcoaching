"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface HeroProps {
  badge: string;
  title: string;
  subtitle: string;
  cta1Text: string;
  cta1Url: string;
  cta2Text: string;
  cta2Url: string;
  backgroundImage: string;
  trustItems: { bold: string; text: string }[];
}

export function Hero({
  badge,
  title,
  subtitle,
  cta1Text,
  cta1Url,
  cta2Text,
  cta2Url,
  backgroundImage,
  trustItems,
}: HeroProps) {
  return (
    <section className="relative min-h-[580px] md:min-h-[680px] flex items-center overflow-hidden bg-surface-dark">
      {/* Background image — visible, not hidden */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          {/* Gradient: strong on the left for text readability, transparent on right to show the image */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c1018]/90 via-[#0c1018]/60 to-transparent" />
        </div>
      )}
      {!backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-dark via-brand-blue-dark/20 to-surface-dark" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-[1320px] mx-auto px-6 md:px-10 py-16 md:py-24 w-full">
        <div className="max-w-[600px]">
          {/* Badge — green dot + uppercase gold like original */}
          {badge && (
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-brand-gold uppercase text-sm font-bold tracking-widest">
                {badge}
              </span>
            </div>
          )}

          {/* Title — large, bold, Space Grotesk */}
          <h1 className="font-display text-[2.5rem] md:text-[3.5rem] lg:text-[4rem] font-bold text-white leading-[1.08] mb-6 tracking-tight">
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-base md:text-lg text-gray-300/90 leading-relaxed mb-8 max-w-[480px]">
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-12">
            {cta1Text && (
              <Link
                href={cta1Url || "#"}
                className="inline-flex items-center gap-2.5 bg-brand-blue hover:bg-brand-blue-light text-white px-7 py-3.5 rounded-lg font-semibold text-[15px] transition-all hover:translate-y-[-1px] hover:shadow-xl shadow-brand-blue/30"
              >
                {cta1Text}
                <ArrowRight className="w-4.5 h-4.5" />
              </Link>
            )}
            {cta2Text && (
              <Link
                href={cta2Url || "#"}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white px-7 py-3.5 rounded-lg font-semibold text-[15px] transition-all"
              >
                {cta2Text}
              </Link>
            )}
          </div>

          {/* Trust items — inline row */}
          {trustItems && trustItems.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              {trustItems.map((item, i) => (
                <div key={i} className="flex items-baseline gap-1.5">
                  <span className="font-display text-xl md:text-2xl font-bold text-brand-gold">
                    {item.bold}
                  </span>
                  <span className="text-sm text-gray-400">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
