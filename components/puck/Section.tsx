"use client";

import { DropZone } from "@puckeditor/core";

export interface SectionProps {
  background: "white" | "light" | "muted" | "dark" | "blue";
  padding: "sm" | "md" | "lg" | "xl";
  maxWidth: "narrow" | "medium" | "wide" | "full";
  layout: "stack" | "two-col" | "three-col" | "four-col";
  gap: "sm" | "md" | "lg";
}

const bgMap = {
  white: "bg-white",
  light: "bg-surface-light",
  muted: "bg-surface-muted",
  dark: "bg-surface-dark text-white",
  blue: "bg-brand-blue text-white",
};

const paddingMap = {
  sm: "py-8 md:py-10",
  md: "py-12 md:py-16",
  lg: "py-16 md:py-24",
  xl: "py-20 md:py-32",
};

const widthMap = {
  narrow: "max-w-[640px]",
  medium: "max-w-[800px]",
  wide: "max-w-[1140px]",
  full: "max-w-[1320px]",
};

const layoutMap = {
  stack: "",
  "two-col": "grid grid-cols-1 md:grid-cols-2",
  "three-col": "grid grid-cols-1 md:grid-cols-3",
  "four-col": "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

const gapMap = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
};

export function Section({
  background = "white",
  padding = "lg",
  maxWidth = "wide",
  layout = "stack",
  gap = "md",
}: SectionProps) {
  return (
    <section className={`${bgMap[background]} ${paddingMap[padding]}`}>
      <div className={`${widthMap[maxWidth]} mx-auto px-4 md:px-6 ${layoutMap[layout]} ${layout !== "stack" ? gapMap[gap] : `space-y-${gap === "sm" ? "3" : gap === "md" ? "5" : "8"}`}`}>
        <DropZone zone="content" />
      </div>
    </section>
  );
}
