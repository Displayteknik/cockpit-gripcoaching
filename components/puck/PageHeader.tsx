export interface PageHeaderProps {
  title: string;
  subtitle: string;
  variant: "light" | "dark";
}

export function PageHeader({ title, subtitle, variant = "light" }: PageHeaderProps) {
  const isDark = variant === "dark";

  return (
    <section
      className={`py-16 md:py-20 ${isDark ? "bg-surface-dark" : "bg-surface-light"}`}
    >
      <div className="max-w-[1140px] mx-auto px-4 text-center">
        <h1
          className={`font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 ${
            isDark ? "text-white" : "text-text-primary"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`text-lg max-w-2xl mx-auto ${
              isDark ? "text-gray-400" : "text-text-muted"
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
