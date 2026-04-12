"use client";

import Link from "next/link";
import { ArrowRight, Phone, Mail } from "lucide-react";

export interface ButtonProps {
  text: string;
  url: string;
  variant: "blue" | "outline" | "white" | "ghost";
  size: "sm" | "md" | "lg";
  icon: "none" | "arrow" | "phone" | "mail";
  align: "left" | "center" | "right";
}

const iconMap = { none: null, arrow: ArrowRight, phone: Phone, mail: Mail };

const variantStyles = {
  blue: "bg-brand-blue hover:bg-brand-blue-dark text-white shadow-sm",
  outline: "border-2 border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white",
  white: "bg-white text-brand-blue hover:bg-gray-100 shadow-sm",
  ghost: "text-brand-blue hover:bg-brand-blue/10",
};

const sizeStyles = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-[15px]",
  lg: "px-8 py-4 text-base",
};

export function Button({ text, url = "#", variant = "blue", size = "md", icon = "none", align = "left" }: ButtonProps) {
  const Icon = iconMap[icon];
  const alignClass = align === "center" ? "flex justify-center" : align === "right" ? "flex justify-end" : "";

  return (
    <div className={`py-2 ${alignClass}`}>
      <Link
        href={url}
        className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-all hover:translate-y-[-1px] ${variantStyles[variant]} ${sizeStyles[size]}`}
      >
        {Icon && (icon === "phone" || icon === "mail") && <Icon className="w-4 h-4" />}
        {text}
        {Icon && icon === "arrow" && <Icon className="w-4 h-4" />}
      </Link>
    </div>
  );
}
