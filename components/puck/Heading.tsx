"use client";

import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface HeadingProps {
  text: string;
  level: "h1" | "h2" | "h3" | "h4";
  align: "left" | "center" | "right";
  color: string;
  size: "sm" | "md" | "lg" | "xl" | "2xl";
  fontFamily: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

const sizeMap = {
  sm: "text-lg md:text-xl",
  md: "text-xl md:text-2xl",
  lg: "text-2xl md:text-3xl",
  xl: "text-3xl md:text-4xl",
  "2xl": "text-4xl md:text-5xl",
};

export function Heading({ text, level = "h2", align = "left", color = "", size = "lg", fontFamily = "", spacing, componentSize, editMode }: HeadingProps) {
  const Tag = level;
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const isGradient = color?.includes("gradient");

  const style: React.CSSProperties = {};
  if (color) {
    if (isGradient) {
      style.backgroundImage = color;
      style.WebkitBackgroundClip = "text";
      style.WebkitTextFillColor = "transparent";
      style.backgroundClip = "text";
    } else {
      style.color = color;
    }
  }
  if (fontFamily) style.fontFamily = fontFamily;

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="py-2">
        <Tag
          className={`${fontFamily ? "" : "font-display "}font-bold ${sizeMap[size]} ${alignClass} leading-tight`}
          style={Object.keys(style).length ? style : undefined}
        >
          {text}
        </Tag>
      </div>
    </DesignWrapper>
  );
}
