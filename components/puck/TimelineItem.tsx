import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface TimelineItemProps {
  year: string;
  title: string;
  text: string;
  color: string;
  fontFamily: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

export function TimelineItem({ year, title, text, color = "", fontFamily = "", spacing, componentSize, editMode }: TimelineItemProps) {
  const textStyle: React.CSSProperties = {};
  if (color) textStyle.color = color;
  if (fontFamily) textStyle.fontFamily = fontFamily;

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="relative pl-16">
        <div className="absolute left-4 top-1 w-5 h-5 rounded-full bg-brand-blue border-4 border-white shadow-sm" />
        <span className="inline-block bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-sm font-bold mb-2">
          {year}
        </span>
        <h3 className={`${fontFamily ? "" : "font-display "}text-xl font-bold text-text-primary mb-2`} style={textStyle}>{title}</h3>
        <p className="text-text-muted leading-relaxed" style={fontFamily ? { fontFamily } : undefined}>{text}</p>
      </div>
    </DesignWrapper>
  );
}
