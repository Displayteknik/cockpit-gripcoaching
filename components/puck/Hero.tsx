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
    <section className="relative min-h-[600px] md:min-h-[700px] flex items-center overflow-hidden bg-surface-dark">
      {/* Background */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-surface-dark/95 via-surface-dark/80 to-surface-dark/40" />
        </div>
      )}
      {!backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-dark via-brand-blue-dark/30 to-surface-dark" />
      )}

      {/* Content */}
      <div className="relative z-10 max-w-[1140px] mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl">
          {badge && (
            <span className="inline-block bg-brand-gold/20 text-brand-gold-light border border-brand-gold/30 px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              {badge}
            </span>
          )}

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {title}
          </h1>

          {subtitle && (
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-8 max-w-xl">
              {subtitle}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-10">
            {cta1Text && (
              <Link
                href={cta1Url || "#"}
                className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-light text-white px-7 py-3.5 rounded-lg font-semibold text-base transition-all hover:translate-y-[-1px] hover:shadow-lg"
              >
                {cta1Text}
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}
            {cta2Text && (
              <Link
                href={cta2Url || "#"}
                className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white/60 text-white px-7 py-3.5 rounded-lg font-semibold text-base transition-all hover:bg-white/10"
              >
                {cta2Text}
              </Link>
            )}
          </div>

          {/* Trust items */}
          {trustItems && trustItems.length > 0 && (
            <div className="flex flex-wrap gap-6 md:gap-10">
              {trustItems.map((item, i) => (
                <div key={i} className="text-white">
                  <span className="font-display text-2xl md:text-3xl font-bold text-brand-gold">
                    {item.bold}
                  </span>
                  <span className="text-sm text-gray-400 ml-2">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
