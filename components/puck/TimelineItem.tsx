export interface TimelineItemProps {
  year: string;
  title: string;
  text: string;
}

export function TimelineItem({ year, title, text }: TimelineItemProps) {
  return (
    <div className="relative pl-16">
      <div className="absolute left-4 top-1 w-5 h-5 rounded-full bg-brand-blue border-4 border-white shadow-sm" />
      <span className="inline-block bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-sm font-bold mb-2">
        {year}
      </span>
      <h3 className="font-display text-xl font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-muted leading-relaxed">{text}</p>
    </div>
  );
}
