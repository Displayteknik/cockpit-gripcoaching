"use client";

import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface TextProps {
  text: string;
  align: "left" | "center" | "right";
  color: string;
  size: "sm" | "base" | "lg" | "xl";
  fontFamily: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

const sizeMap = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function Text({ text, align = "left", color = "", size = "base", fontFamily = "", spacing, componentSize, editMode }: TextProps) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  const style: React.CSSProperties = color ? { color } : { color: "#6b7280" };
  if (fontFamily) style.fontFamily = fontFamily;

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="py-1">
        <p
          className={`${sizeMap[size]} ${alignClass} leading-relaxed`}
          style={style}
        >
          {text}
        </p>
      </div>
    </DesignWrapper>
  );
}
