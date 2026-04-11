"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { Vehicle } from "@/lib/supabase";

interface VehicleCardProps {
  vehicle: Vehicle;
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const specs = vehicle.specs || {};
  const topSpecs = Object.entries(specs).slice(0, 3);

  return (
    <Link
      href={`/fordon/${vehicle.slug}`}
      className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px] flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-light">
        {vehicle.image_url ? (
          <Image
            src={vehicle.image_url}
            alt={vehicle.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-light">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge */}
        {vehicle.badge && (
          <span className="absolute top-3 left-3 bg-brand-gold text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
            {vehicle.badge}
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
