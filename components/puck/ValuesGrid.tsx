import { Heart, Shield, Users } from "lucide-react";

export interface ValuesGridProps {
  items: { title: string; text: string; icon: string }[];
}

const iconMap: Record<string, React.ElementType> = {
  heart: Heart,
  shield: Shield,
  users: Users,
};

export function ValuesGrid({ items }: ValuesGridProps) {
  return (
    <section className="py-16 md:py-20 bg-surface-light">
      <div className="max-w-[1140px] mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items?.map((item, i) => {
            const Icon = iconMap[item.icon] || Heart;
            return (
              <div
                key={i}
                className="bg-white rounded-2xl p-8 text-center border border-gray-100 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-brand-blue" />
                </div>
                <h3 className="font-display text-lg font-bold text-text-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
