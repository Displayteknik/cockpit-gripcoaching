"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Phone, Check, Sparkles } from "lucide-react";

export interface DeluxeHighlightProps {
  badge: string;
  title: string;
  condition: string;
  price: string;
  image: string;
  text: string;
  highlights: { text: string }[];
  blocketUrl: string;
  ctaText: string;
  phone: string;
}

// Premium enskild "highlight deluxe" — ett handplockat objekt lyft i ett mörkt,
// iögonfallande band: produkt på vitt till vänster, säljande innehåll till höger.
export function DeluxeHighlight({
  badge, title, condition, price, image, text, highlights, blocketUrl, ctaText, phone,
}: DeluxeHighlightProps) {
  const [imgBroken, setImgBroken] = useState(false);
  const showImage = !!image && !imgBroken;
  const external = /^https?:\/\//.test(blocketUrl || "");
  const tel = (phone || "").replace(/[^\d+]/g, "");

  return (
    <section className="py-14 md:py-20">
      <div className="max-w-[1140px] mx-auto px-4">
        {/* Premium gradient-ram runt hela highlighten */}
        <div className="rounded-[28px] p-[2px] bg-gradient-to-br from-brand-gold/70 via-brand-blue/50 to-brand-gold/70 shadow-2xl">
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 ring-1 ring-white/10">
          {/* mjuk färgglöd för djup */}
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-brand-blue/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-brand-gold/15 blur-3xl pointer-events-none" />

          <div className="relative grid md:grid-cols-2 items-stretch">
            {/* Produktbild på vitt */}
            <div className="relative bg-white flex items-center justify-center p-8 md:p-10 min-h-[280px] md:min-h-[420px]">
              {showImage ? (
                <Image
                  src={image}
                  alt={title}
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  onError={() => setImgBroken(true)}
                  priority
                />
              ) : (
                <svg className="w-20 h-20 text-brand-blue/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {condition && (
                <span className="absolute top-5 left-5 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                  {condition}
                </span>
              )}
            </div>

            {/* Innehåll */}
            <div className="p-8 md:p-12 flex flex-col justify-center text-white">
              {badge && (
                <span className="inline-flex items-center gap-1.5 self-start bg-brand-gold/20 text-brand-gold px-3 py-1 rounded-full text-xs font-bold mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> {badge}
                </span>
              )}
              <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-3">{title}</h2>
              {price && <div className="font-display text-3xl font-bold text-brand-gold mb-5">{price}</div>}
              {text && <p className="text-gray-300 leading-relaxed mb-6 max-w-prose">{text}</p>}

              {highlights && highlights.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-8">
                  {highlights.filter((h) => h && h.text).map((h, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-gray-200">
                      <span className="w-5 h-5 rounded-full bg-brand-blue/30 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-brand-blue-light" />
                      </span>
                      {h.text}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-3">
                <a
                  href={blocketUrl || "#"}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {ctaText || "Se annonsen på Blocket"}
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Phone className="w-4 h-4" /> Ring Håkan
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
