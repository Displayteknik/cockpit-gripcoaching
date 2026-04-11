import Link from "next/link";
import { Car, Bike, Tractor, Truck, Trees } from "lucide-react";

export interface QuickCategoriesProps {
  items: { label: string; url: string; icon: string; count: string }[];
}

const iconMap: Record<string, React.ElementType> = {
  car: Car,
  bike: Bike,
  tractor: Tractor,
  truck: Truck,
  trees: Trees,
};

export function QuickCategories({ items }: QuickCategoriesProps) {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-[1140px] mx-auto px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {items?.map((item, i) => {
            const Icon = iconMap[item.icon] || Car;
            return (
              <Link
                key={i}
                href={item.url || "#"}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-light hover:bg-brand-blue hover:text-white transition-all duration-300 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-brand-blue/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Icon className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <div>
                  <span className="font-display font-semibold text-sm block">
                    {item.label}
                  </span>
                  {item.count && (
                    <span className="text-xs text-text-light group-hover:text-white/70 transition-colors">
                      {item.count}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
