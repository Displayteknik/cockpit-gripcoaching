export interface TimelineProps {
  title: string;
  items: { year: string; title: string; text: string }[];
}

export function Timeline({ title, items }: TimelineProps) {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[800px] mx-auto px-4">
        {title && (
          <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary text-center mb-14">
            {title}
          </h2>
        )}

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-blue via-brand-blue/50 to-transparent" />

          <div className="space-y-10">
            {items?.map((item, i) => (
              <div key={i} className="relative pl-16">
                {/* Dot */}
                <div className="absolute left-4 top-1 w-5 h-5 rounded-full bg-brand-blue border-4 border-white shadow-sm" />

                <span className="inline-block bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-sm font-bold mb-2">
                  {item.year}
                </span>
                <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-text-muted leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
