import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface PromoCardProps {
  label: string;
  title: string;
  text: string;
  linkUrl: string;
  linkText: string;
}

export function PromoCard({ label, title, text, linkUrl, linkText }: PromoCardProps) {
  return (
    <div className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col">
      {label && (
        <span className="inline-block bg-brand-gold/15 text-brand-gold px-3 py-1 rounded-full text-xs font-bold mb-4 self-start">
          {label}
        </span>
      )}
      <h3 className="font-display text-xl font-bold text-text-primary mb-3">{title}</h3>
      <p className="text-text-muted text-sm leading-relaxed mb-5 flex-1">{text}</p>
      {linkUrl && (
        <Link href={linkUrl} className="inline-flex items-center gap-1.5 text-brand-blue font-semibold text-sm hover:gap-3 transition-all">
          {linkText || "Läs mer"}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
