import { Phone, Mail } from "lucide-react";

export interface CTASectionProps {
  title: string;
  subtitle: string;
  showPhone: boolean;
  showEmail: boolean;
  variant: "blue" | "dark" | "light";
}

export function CTASection({
  title,
  subtitle,
  showPhone = true,
  showEmail = true,
  variant = "blue",
}: CTASectionProps) {
  const bg =
    variant === "blue"
      ? "bg-brand-blue"
      : variant === "dark"
      ? "bg-surface-dark"
      : "bg-surface-light";

  const textColor = variant === "light" ? "text-text-primary" : "text-white";
  const subtitleColor = variant === "light" ? "text-text-muted" : "text-white/80";

  return (
    <section className={`py-16 md:py-20 ${bg}`}>
      <div className="max-w-[800px] mx-auto px-4 text-center">
        <h2
          className={`font-display text-2xl md:text-3xl font-bold mb-3 ${textColor}`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className={`text-lg mb-8 ${subtitleColor}`}>{subtitle}</p>
        )}
        <div className="flex flex-wrap justify-center gap-4">
          {showPhone && (
            <a
              href="tel:+46640-10350"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:translate-y-[-1px] ${
                variant === "light"
                  ? "bg-brand-blue text-white hover:bg-brand-blue-dark"
                  : "bg-white text-brand-blue hover:bg-gray-100"
              }`}
            >
              <Phone className="w-5 h-5" />
              Ring 0640-103 50
            </a>
          )}
          {showEmail && (
            <a
              href="mailto:info@krokomsporten.se"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:translate-y-[-1px] ${
                variant === "light"
                  ? "border-2 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                  : "border-2 border-white/40 text-white hover:bg-white/10"
              }`}
            >
              <Mail className="w-5 h-5" />
              Skicka e-post
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
