"use client";

import { useRef, useState, useEffect } from "react";
import Moveable from "react-moveable";

interface SpacingValue {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

interface SizeValue {
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
}

interface DesignWrapperProps {
  children?: React.ReactNode;
  spacing?: SpacingValue;
  componentSize?: SizeValue;
  color?: string;
  fontFamily?: string;
  editMode?: boolean;
  onSizeChange?: (size: SizeValue) => void;
}

function px(val: string | undefined): string {
  if (!val || val === "0") return "0px";
  // Already has a unit
  if (/[a-z%]/.test(val)) return val;
  return `${val}px`;
}

export function DesignWrapper({
  children,
  spacing,
  componentSize,
  color,
  fontFamily,
  editMode = false,
  onSizeChange,
}: DesignWrapperProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(false);

  const style: React.CSSProperties = {};

  // Apply spacing (padding)
  if (spacing) {
    if (spacing.top && spacing.top !== "0") style.paddingTop = px(spacing.top);
    if (spacing.right && spacing.right !== "0") style.paddingRight = px(spacing.right);
    if (spacing.bottom && spacing.bottom !== "0") style.paddingBottom = px(spacing.bottom);
    if (spacing.left && spacing.left !== "0") style.paddingLeft = px(spacing.left);
  }

  // Apply color (solid only — gradients need background-clip on individual elements)
  if (color && !color.includes("gradient")) style.color = color;
  // Apply font
  if (fontFamily) style.fontFamily = fontFamily;

  // Apply size
  if (componentSize) {
    if (componentSize.width && componentSize.width !== "auto") style.width = componentSize.width;
    if (componentSize.height && componentSize.height !== "auto") style.height = componentSize.height;
    if (componentSize.minWidth) style.minWidth = componentSize.minWidth;
    if (componentSize.maxWidth) style.maxWidth = componentSize.maxWidth;
  }

  // Click to select in edit mode
  useEffect(() => {
    if (!editMode) return;
    const handleClick = (e: MouseEvent) => {
      if (targetRef.current?.contains(e.target as Node)) {
        setSelected(true);
      } else {
        setSelected(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [editMode]);

  return (
    <div
      ref={targetRef}
      style={style}
      className={editMode && selected ? "outline outline-2 outline-blue-400 outline-offset-2 rounded" : ""}
    >
      {children}
      {editMode && selected && targetRef.current && (
        <Moveable
          target={targetRef.current}
          resizable={true}
          keepRatio={false}
          throttleResize={1}
          renderDirections={["e", "s", "se"]}
          edge={false}
          onResize={({ target, width, height }) => {
            target.style.width = `${width}px`;
            target.style.height = `${height}px`;
          }}
          onResizeEnd={({ target }) => {
            if (onSizeChange) {
              onSizeChange({
                width: target.style.width || "auto",
                height: target.style.height || "auto",
                minWidth: componentSize?.minWidth || "",
                maxWidth: componentSize?.maxWidth || "",
              });
            }
          }}
        />
      )}
    </div>
  );
}
