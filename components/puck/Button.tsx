"use client";

import Link from "next/link";
import { ArrowRight, Phone, Mail } from "lucide-react";

import { DesignWrapper } from "./fields/DesignWrapper";
import type { TypographyValue } from "./fields/TypographyField";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface ButtonProps {
  text: string;
  url: string;
  variant: "blue" | "outline" | "white" | "ghost" | "custom";
  size: "sm" | "md" | "lg";
  icon: "none" | "arrow" | "phone" | "mail";
  typography?: TypographyValue;
  // Legacy props (fallback)
  align?: "left" | "center" | "right";
  bgColor?: string;
  textColor?: string;
  fontFamily?: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

const iconMap = { none: null, arrow: ArrowRight, phone: Phone, mail: Mail };

const variantStyles = {
  blue: "bg-brand-blue hover:bg-brand-blue-dark text-white shadow-sm",
  outline: "border-2 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white",
  white: "bg-white text-brand-blue hover:bg-gray-100 shadow-sm",
  ghost: "text-brand-blue hover:bg-brand-blue/10",
  custom: "",
};

const sizeStyles = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-[15px]",
  lg: "px-8 py-4 text-base",
};

export function Button({ text, url = "#", variant = "blue", size = "md", icon = "none", typography, align, bgColor = "", textColor = "", fontFamily = "", spacing, componentSize, editMode }: ButtonProps) {
  const t = (typography || {}) as Partial<TypographyValue>;
  const finalAlign = t.textAlign || align || "left";
  const finalColor = t.color || textColor || "";
  const finalFont = t.fontFamily || fontFamily || "";
  const finalWeight = t.fontWeight || "";
  const finalStyle = t.fontStyle || "";
  const finalSize = t.fontSize || "";

  const Icon = iconMap[icon];
  const alignClass = finalAlign === "center" ? "flex justify-center" : finalAlign === "right" ? "flex justify-end" : "";

  const customStyle: React.CSSProperties = {};
  if (variant === "custom" || bgColor) {
    if (bgColor) customStyle.background = bgColor;
  }
  if (finalColor) customStyle.color = finalColor;
  if (finalFont) customStyle.fontFamily = finalFont;
  if (finalSize) customStyle.fontSize = finalSize;
  if (finalWeight) customStyle.fontWeight = finalWeight;
  if (finalStyle) customStyle.fontStyle = finalStyle as React.CSSProperties["fontStyle"];

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className={`py-2 ${alignClass}`}>
        <Link
          href={url}
          className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-all hover:translate-y-[-1px] hover:opacity-90 ${variantStyles[variant]} ${sizeStyles[size]}`}
          style={Object.keys(customStyle).length ? customStyle : undefined}
        >
          {Icon && (icon === "phone" || icon === "mail") && <Icon className="w-4 h-4" />}
          {text}
          {Icon && icon === "arrow" && <Icon className="w-4 h-4" />}
        </Link>
      </div>
    </DesignWrapper>
  );
}
