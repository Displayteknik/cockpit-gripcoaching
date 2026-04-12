"use client";

export interface HeadingProps {
  text: string;
  level: "h1" | "h2" | "h3" | "h4";
  align: "left" | "center" | "right";
  color: string;
  size: "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeMap = {
  sm: "text-lg md:text-xl",
  md: "text-xl md:text-2xl",
  lg: "text-2xl md:text-3xl",
  xl: "text-3xl md:text-4xl",
  "2xl": "text-4xl md:text-5xl",
};

export function Heading({ text, level = "h2", align = "left", color = "", size = "lg" }: HeadingProps) {
  const Tag = level;
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <Tag
      className={`font-display font-bold ${sizeMap[size]} ${alignClass} leading-tight`}
      style={color ? { color } : undefined}
    >
      {text}
    </Tag>
  );
}
