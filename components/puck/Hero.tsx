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
    <section className="relative min-h-[520px] md:min-h-[600px] flex items-center overflow-hidden bg-surface-dark">
      {/* Background image */}
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundPosition: "35% 35%",
            }}
          />
          {/* Gradient overlay — matches original exactly */}
          <div
            className="absolute inset-0"
            style={{
              background: [
                "linear-gradient(to right, rgba(10,14,20,0.93) 0%, rgba(10,14,20,0.85) 22%, rgba(10,14,20,0.3) 38%, transparent 52%)",
                "linear-gradient(to top, rgba(10,14,20,0.35) 0%, transparent 20%)",
              ].join(", "),
            }}
          />
        </>
      )}
      {!backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-dark via-brand-blue-dark/20 to-surface-dark" />
      )}

      {/* Content — max-width 400px like original */}
      <div
        className="relative z-10 w-full"
        style={{ padding: "0 0 0 clamp(24px, 5vw, 80px)" }}
      >
        <div className="max-w-[420px] py-10 md:py-12">
          {/* Badge — 12px uppercase with warm dot */}
          {badge && (
            <div className="flex items-center gap-1.5 mb-5">
              <span className="w-2 h-2 rounded-full bg-brand-gold flex-shrink-0" />
              <span className="text-brand-gold uppercase text-xs font-semibold tracking-[0.06em]">
                {badge}
              </span>
            </div>
          )}

          {/* Title — clamp(2.2rem, 4.5vw, 3rem), tracking -0.02em */}
          <h1
            className="font-display font-bold text-white mb-4"
            style={{
              fontSize: "clamp(2.2rem, 4.5vw, 3rem)",
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>

          {/* Subtitle — 1.05rem */}
          {subtitle && (
            <p className="text-[1.05rem] text-text-on-dark leading-relaxed mb-7">
              {subtitle}
            </p>
          )}

          {/* CTAs — gap 12px */}
          <div className="flex flex-wrap gap-3">
            {cta1Text && (
              <Link
                href={cta1Url || "#"}
                className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-light text-white px-6 py-3 rounded-lg font-semibold text-[15px] transition-all hover:translate-y-[-1px] hover:shadow-lg"
              >
                {cta1Text}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            {cta2Text && (
              <Link
                href={cta2Url || "#"}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 text-white px-6 py-3 rounded-lg font-semibold text-[15px] transition-all"
              >
                {cta2Text}
              </Link>
            )}
          </div>

          {/* Trust items — border-top, 13px, white bold */}
          {trustItems && trustItems.length > 0 && (
            <div className="flex items-center gap-6 mt-8 pt-5 border-t border-white/15 text-[13px] text-gray-400">
              {trustItems.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-white font-semibold">{item.bold}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
