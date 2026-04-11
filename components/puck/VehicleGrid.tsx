"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { supabase, type Vehicle } from "@/lib/supabase";
import { VehicleCard } from "@/components/ui/VehicleCard";

export interface VehicleGridProps {
  category: string;
  title: string;
  subtitle: string;
  showSearch: boolean;
  showFilters: boolean;
  filterBrands: string;
  maxItems: number;
  featuredOnly: boolean;
}

export function VehicleGrid({
  category,
  title,
  subtitle,
  showSearch = true,
  showFilters = false,
  filterBrands = "",
  maxItems = 50,
  featuredOnly = false,
}: VehicleGridProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filtered, setFiltered] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [activeBrand, setActiveBrand] = useState("Alla");
  const [loading, setLoading] = useState(true);

  const brands = filterBrands
    ? filterBrands.split(",").map((b) => b.trim())
    : [];

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("hm_vehicles")
        .select("*")
        .eq("is_sold", false)
        .order("sort_order", { ascending: true });

      if (category && category !== "all") {
        if (category.includes(",")) {
          query = query.in(
            "category",
            category.split(",").map((c) => c.trim())
          );
        } else {
          query = query.eq("category", category);
        }
      }
      if (featuredOnly) query = query.eq("is_featured", true);
      if (maxItems) query = query.limit(maxItems);

      const { data } = await query;
      setVehicles(data || []);
      setFiltered(data || []);
      setLoading(false);
    }
    load();
  }, [category, featuredOnly, maxItems]);

  useEffect(() => {
    let result = vehicles;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(s) ||
          v.brand?.toLowerCase().includes(s) ||
          v.model?.toLowerCase().includes(s)
      );
    }
    if (activeBrand !== "Alla") {
      result = result.filter((v) => v.brand === activeBrand);
    }
    setFiltered(result);
  }, [search, activeBrand, vehicles]);

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-[1140px] mx-auto px-4">
        {/* Header */}
        {title && (
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-muted text-lg">{subtitle}</p>
            )}
          </div>
        )}

        {/* Search + filters */}
        {(showSearch || showFilters) && (
          <div className="mb-8 space-y-4">
            {showSearch && (
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-light" />
                <input
                  type="text"
                  placeholder="Sök fordon..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm"
                />
              </div>
            )}
            {showFilters && brands.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {["Alla", ...brands].map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setActiveBrand(brand)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeBrand === brand
                        ? "bg-brand-blue text-white"
                        : "bg-surface-light text-text-muted hover:bg-surface-muted"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-surface-light" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-surface-light rounded w-3/4" />
                  <div className="h-4 bg-surface-light rounded w-1/2" />
                  <div className="h-6 bg-surface-light rounded w-1/3 mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-muted py-12">
            Inga fordon hittades{search ? ` för "${search}"` : ""}.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
