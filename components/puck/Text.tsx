"use client";

import { DesignWrapper } from "./fields/DesignWrapper";
import type { TypographyValue } from "./fields/TypographyField";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface TextProps {
  text: string;
  typography?: TypographyValue;
  // Legacy props (fallback)
  align?: "left" | "center" | "right";
  color?: string;
  size?: "sm" | "base" | "lg" | "xl";
  fontFamily?: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

export function Text({ text, typography, align, color, size, fontFamily, spacing, componentSize, editMode }: TextProps) {
  const t = (typography || {}) as Partial<TypographyValue>;
  const finalAlign = t.textAlign || align || "left";
  const finalColor = t.color || color || "#6b7280";
  const finalFont = t.fontFamily || fontFamily || "";
  const finalWeight = t.fontWeight || "";
  const finalStyle = t.fontStyle || "";
  const finalSize = t.fontSize || "";

  const alignClass = finalAlign === "center" ? "text-center" : finalAlign === "right" ? "text-right" : "text-left";

  const legacySizeMap: Record<string, string> = {
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };
  const sizeClass = finalSize ? "" : legacySizeMap[size || "base"];

  const style: React.CSSProperties = { color: finalColor };
  if (finalFont) style.fontFamily = finalFont;
  if (finalSize) style.fontSize = finalSize;
  if (finalWeight) style.fontWeight = finalWeight;
  if (finalStyle) style.fontStyle = finalStyle as React.CSSProperties["fontStyle"];

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="py-1">
        <p className={`${sizeClass} ${alignClass} leading-relaxed`} style={style}>
          {text}
        </p>
      </div>
    </DesignWrapper>
  );
}
