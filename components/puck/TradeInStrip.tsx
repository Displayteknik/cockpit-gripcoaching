import Link from "next/link";
import { ArrowRight, RefreshCw } from "lucide-react";

export interface TradeInStripProps {
  text: string;
  ctaText: string;
  ctaUrl: string;
}

export function TradeInStrip({ text, ctaText, ctaUrl }: TradeInStripProps) {
  return (
    <section className="bg-brand-gold/10 border-y border-brand-gold/20">
      <div className="max-w-[1140px] mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-brand-gold" />
          <span className="font-display font-semibold text-text-primary">
            {text}
          </span>
        </div>
        {ctaText && (
          <Link
            href={ctaUrl || "/kontakt"}
            className="inline-flex items-center gap-1.5 text-brand-blue font-semibold text-sm hover:gap-3 transition-all"
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
