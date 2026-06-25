"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, Tag } from "lucide-react";

export interface FeaturedDealItem {
  image: string;
  title: string;
  price: string;
  condition: string;
  text: string;
  blocketUrl: string;
}

export interface FeaturedDealsProps {
  title: string;
  subtitle: string;
  items: FeaturedDealItem[];
}

// Premium "Fynd just nu"-avsnitt — handplockade objekt (t.ex. begagnade trädgårdsmaskiner)
// som säljs via Blocket. Korten länkar ut till respektive annons.
export function FeaturedDeals({ title, subtitle, items }: FeaturedDealsProps) {
  const list = (items || []).filter((i) => i && (i.title || i.image));
  if (list.length === 0) return null;

  // Snyggt rutnät oavsett antal: 1→1 kol, 2→2, 3→3, 4→4.
  const cols = list.length >= 4 ? "lg:grid-cols-4" : list.length === 3 ? "lg:grid-cols-3" : list.length === 2 ? "md:grid-cols-2" : "max-w-md mx-auto";

  return (
    <section className="py-16 md:py-20 bg-surface-muted">
      <div className="max-w-[1140px] mx-auto px-4">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 bg-brand-gold/15 text-brand-gold px-3 py-1 rounded-full text-xs font-bold mb-4">
            <Tag className="w-3.5 h-3.5" /> Fynd just nu
          </span>
          {title && (
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">{title}</h2>
          )}
          {subtitle && <p className="text-text-muted text-lg max-w-2xl mx-auto">{subtitle}</p>}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-6`}>
          {list.map((item, i) => (
            <DealCard key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DealCard({ item }: { item: FeaturedDealItem }) {
  const [imgBroken, setImgBroken] = useState(false);
  const showImage = !!item.image && !imgBroken;
  const href = item.blocketUrl || "#";
  const external = /^https?:\/\//.test(href);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white">
        {showImage ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-brand-blue/5">
            <svg className="w-12 h-12 text-brand-blue/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {item.condition && (
          <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {item.condition}
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-display font-bold text-lg text-text-primary mb-1.5 line-clamp-2 group-hover:text-brand-blue transition-colors">
          {item.title}
        </h3>
        {item.price && (
          <div className="font-display text-2xl font-bold text-brand-blue mb-3">{item.price}</div>
        )}
        {item.text && (
          <p className="text-text-muted text-sm leading-relaxed mb-5 line-clamp-3 flex-1">{item.text}</p>
        )}
        <span className="mt-auto inline-flex items-center justify-center gap-1.5 bg-brand-blue text-white text-sm font-semibold px-4 py-2.5 rounded-xl group-hover:bg-brand-blue-dark transition-colors">
          Se annonsen på Blocket
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </span>
      </div>
    </a>
  );
}
