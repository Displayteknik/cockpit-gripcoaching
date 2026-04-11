import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface JustNuCardsProps {
  title: string;
  cards: { label: string; title: string; text: string; linkUrl: string; linkText: string }[];
}

export function JustNuCards({ title, cards }: JustNuCardsProps) {
  return (
    <section className="py-16 md:py-20 bg-surface-muted">
      <div className="max-w-[1140px] mx-auto px-4">
        {title && (
          <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary text-center mb-12">
            {title}
          </h2>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards?.map((card, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col"
            >
              {card.label && (
                <span className="inline-block bg-brand-gold/15 text-brand-gold px-3 py-1 rounded-full text-xs font-bold mb-4 self-start">
                  {card.label}
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-text-primary mb-3">
                {card.title}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed mb-5 flex-1">
                {card.text}
              </p>
              {card.linkUrl && (
                <Link
                  href={card.linkUrl}
                  className="inline-flex items-center gap-1.5 text-brand-blue font-semibold text-sm hover:gap-3 transition-all"
                >
                  {card.linkText || "Läs mer"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
