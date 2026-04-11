import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface SpotlightProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  backgroundImage: string;
  tags: string;
}

export function Spotlight({
  title,
  subtitle,
  ctaText,
  ctaUrl,
  backgroundImage,
  tags,
}: SpotlightProps) {
  const tagList = tags ? tags.split(",").map((t) => t.trim()) : [];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-blue-dark/90 to-brand-blue/70" />
        </div>
      )}
      {!backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark to-brand-blue" />
      )}

      <div className="relative z-10 max-w-[1140px] mx-auto px-4 text-center">
        {tagList.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {tagList.map((tag, i) => (
              <span
                key={i}
                className="bg-white/15 text-white/90 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-5 max-w-3xl mx-auto">
          {title}
        </h2>

        {subtitle && (
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}

        {ctaText && (
          <Link
            href={ctaUrl || "#"}
            className="inline-flex items-center gap-2 bg-white text-brand-blue px-8 py-4 rounded-lg font-bold text-base hover:bg-gray-100 transition-all hover:translate-y-[-1px] hover:shadow-lg"
          >
            {ctaText}
            <ArrowRight className="w-5 h-5" />
          </Link>
        )}
      </div>
    </section>
  );
}
