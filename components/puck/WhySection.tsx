import { Shield, Heart, Wrench } from "lucide-react";

export interface WhySectionProps {
  title: string;
  subtitle: string;
  points: { title: string; description: string; icon: string }[];
}

const iconMap: Record<string, React.ElementType> = {
  shield: Shield,
  heart: Heart,
  wrench: Wrench,
};

export function WhySection({ title, subtitle, points }: WhySectionProps) {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[1140px] mx-auto px-4">
        {title && (
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-muted text-lg max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {points?.map((point, i) => {
            const Icon = iconMap[point.icon] || Shield;
            return (
              <div
                key={i}
                className="group text-center p-8 rounded-2xl bg-surface-light hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-blue/10 flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all duration-300">
                  <Icon className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display text-xl font-bold text-text-primary mb-3">
                  {point.title}
                </h3>
                <p className="text-text-muted leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
