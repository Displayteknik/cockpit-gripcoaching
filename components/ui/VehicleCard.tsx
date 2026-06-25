"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { parseStock, stockFlag, STOCK_TONE_CLASSES } from "@/lib/stock";
import type { Vehicle } from "@/lib/supabase";

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const specs = vehicle.specs || {};
  const topSpecs = Object.entries(specs).slice(0, 3);
  const stock = parseStock(vehicle.badge_type);
  const flag = stock ? stockFlag(stock) : null;
  // Visa märkesplatshållaren om bilden saknas ELLER laddar trasigt (404) — annars
  // visar webbläsaren en grå ruta med alt-texten, vilket ser oproffsigt ut.
  const [imgBroken, setImgBroken] = useState(false);
  const showImage = !!vehicle.image_url && !imgBroken;

  return (
    <Link
      href={`/fordon/${vehicle.slug}`}
      className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px] flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-light">
        {showImage ? (
          <Image
            src={vehicle.image_url}
            alt={vehicle.title}
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <VehiclePlaceholder title={vehicle.title} />
        )}

        {/* Badge */}
        {vehicle.badge && (
          <span className="absolute top-3 left-3 bg-brand-gold text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {vehicle.badge}
          </span>
        )}

        {/* Lagerstatus-flagga (sätts av ägaren) */}
        {flag && !vehicle.is_sold && (
          <span className={`absolute top-3 right-3 flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-sm ${STOCK_TONE_CLASSES[flag.tone]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
            {flag.label}
          </span>
        )}

        {/* Sold overlay */}
        {vehicle.is_sold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
              Såld
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-display font-bold text-lg text-text-primary mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
          {vehicle.title}
        </h3>

        {/* Spec pills */}
        {topSpecs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {topSpecs.map(([key, value]) => (
              <span
                key={key}
                className="text-xs bg-surface-light text-text-muted px-2.5 py-1 rounded-md"
              >
                {value}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
          <div>
            {vehicle.price > 0 ? (
              <span className="font-display text-xl font-bold text-brand-blue">
                {formatPrice(vehicle.price)}
              </span>
            ) : (
              <span className="text-sm text-text-muted">
                {vehicle.price_label || "Kontakta oss"}
              </span>
            )}
          </div>
          <span className="text-sm text-brand-blue font-medium group-hover:translate-x-1 transition-transform">
            Visa &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}

// Premium platshållare när foto saknas/är trasigt — märkt och avsiktlig, aldrig en grå ruta.
function VehiclePlaceholder({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 via-white to-brand-blue/5">
      <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] [background-size:16px_16px] text-brand-blue" />
      <div className="relative w-16 h-16 rounded-2xl bg-white shadow-sm border border-brand-blue/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-brand-blue/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l2-5a2 2 0 011.9-1.4h10.2A2 2 0 0119 8l2 5m-18 0v4a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-4m-18 0h18M6.5 16.5h.01M17.5 16.5h.01" />
        </svg>
      </div>
      <span className="relative text-xs font-medium text-text-light tracking-wide">Foto kommer snart</span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
