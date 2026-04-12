"use client";

import { DesignWrapper } from "./fields/DesignWrapper";
import type { TypographyValue } from "./fields/TypographyField";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface HeadingProps {
  text: string;
  level: "h1" | "h2" | "h3" | "h4";
  typography?: TypographyValue;
  // Legacy props (fallback)
  align?: "left" | "center" | "right";
  color?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  fontFamily?: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

export function Heading({ text, level = "h2", typography, align, color, size, fontFamily, spacing, componentSize, editMode }: HeadingProps) {
  // Typography values (unified field takes priority over legacy props)
  const t = (typography || {}) as Partial<TypographyValue>;
  const finalAlign = t.textAlign || align || "left";
  const finalColor = t.color || color || "";
  const finalFont = t.fontFamily || fontFamily || "";
  const finalWeight = t.fontWeight || "";
  const finalStyle = t.fontStyle || "";
  const finalSize = t.fontSize || "";

  const Tag = level;
  const alignClass = finalAlign === "center" ? "text-center" : finalAlign === "right" ? "text-right" : "text-left";
  const isGradient = finalColor?.includes("gradient");

  // Default size from legacy prop if no typography fontSize
  const legacySizeMap: Record<string, string> = {
    sm: "text-lg md:text-xl",
    md: "text-xl md:text-2xl",
    lg: "text-2xl md:text-3xl",
    xl: "text-3xl md:text-4xl",
    "2xl": "text-4xl md:text-5xl",
  };
  const sizeClass = finalSize ? "" : legacySizeMap[size || "lg"];

  const style: React.CSSProperties = {};
  if (finalColor) {
    if (isGradient) {
      style.backgroundImage = finalColor;
      style.WebkitBackgroundClip = "text";
      style.WebkitTextFillColor = "transparent";
      style.backgroundClip = "text";
    } else {
      style.color = finalColor;
    }
  }
  if (finalFont) style.fontFamily = finalFont;
  if (finalSize) style.fontSize = finalSize;
  if (finalWeight) style.fontWeight = finalWeight;
  if (finalStyle) style.fontStyle = finalStyle as React.CSSProperties["fontStyle"];

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="py-2">
        <Tag
          className={`${finalFont ? "" : "font-display "}font-bold ${sizeClass} ${alignClass} leading-tight`}
          style={Object.keys(style).length ? style : undefined}
        >
          {text}
        </Tag>
      </div>
    </DesignWrapper>
  );
}
