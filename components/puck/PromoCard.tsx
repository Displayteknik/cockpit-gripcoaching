import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface PromoCardProps {
  label: string;
  title: string;
  text: string;
  linkUrl: string;
  linkText: string;
  bgColor: string;
  textColor: string;
  fontFamily: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

export function PromoCard({ label, title, text, linkUrl, linkText, bgColor = "", textColor = "", fontFamily = "", spacing, componentSize, editMode }: PromoCardProps) {
  const cardStyle: React.CSSProperties = {};
  if (bgColor) cardStyle.background = bgColor;
  if (textColor) cardStyle.color = textColor;

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col" style={{ backgroundColor: bgColor || "white", ...cardStyle }}>
        {label && (
          <span className="inline-block bg-brand-gold/15 text-brand-gold px-3 py-1 rounded-full text-xs font-bold mb-4 self-start">
            {label}
          </span>
        )}
        <h3 className={`${fontFamily ? "" : "font-display "}text-xl font-bold mb-3`} style={{ color: textColor || undefined, fontFamily: fontFamily || undefined }}>{title}</h3>
        <p className="text-sm leading-relaxed mb-5 flex-1" style={{ color: textColor ? undefined : "#6b7280", fontFamily: fontFamily || undefined }}>{text}</p>
        {linkUrl && (
          <Link href={linkUrl} className="inline-flex items-center gap-1.5 text-brand-blue font-semibold text-sm hover:gap-3 transition-all">
            {linkText || "Läs mer"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </DesignWrapper>
  );
}
