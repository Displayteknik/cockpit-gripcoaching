"use client";

export interface TextProps {
  text: string;
  align: "left" | "center" | "right";
  color: string;
  size: "sm" | "base" | "lg" | "xl";
}

const sizeMap = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function Text({ text, align = "left", color = "", size = "base" }: TextProps) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <p
      className={`${sizeMap[size]} ${alignClass} leading-relaxed`}
      style={color ? { color } : { color: "#6b7280" }}
    >
      {text}
    </p>
  );
}
