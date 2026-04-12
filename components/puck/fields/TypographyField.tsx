"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ColorPicker from "react-best-gradient-color-picker";

export interface TypographyValue {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  color: string;
  textAlign: string;
}

const EMPTY: TypographyValue = {
  fontFamily: "",
  fontSize: "",
  fontWeight: "",
  fontStyle: "",
  color: "",
  textAlign: "",
};

const FONTS = [
  { label: "Standard", value: "" },
  { label: "Space Grotesk", value: "Space Grotesk" },
  { label: "Inter", value: "Inter" },
  { label: "Roboto", value: "Roboto" },
  { label: "Open Sans", value: "Open Sans" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Oswald", value: "Oswald" },
  { label: "Raleway", value: "Raleway" },
];

const SIZES = [
  { label: "XS", value: "12px" },
  { label: "S", value: "14px" },
  { label: "M", value: "16px" },
  { label: "L", value: "20px" },
  { label: "XL", value: "24px" },
  { label: "2XL", value: "32px" },
  { label: "3XL", value: "48px" },
  { label: "4XL", value: "64px" },
];

const BRAND_COLORS = [
  "#1d5ca8", "#143d6e", "#e8a838", "#1a1a1a", "#6b7280",
  "#ffffff", "#dc2626", "#16a34a", "#0c1018", "#f5f5f3",
];

interface Props {
  value: TypographyValue;
  onChange: (value: TypographyValue) => void;
}

export function TypographyField({ value, onChange }: Props) {
  const v = { ...EMPTY, ...value };
  const [showColor, setShowColor] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const set = useCallback((key: keyof TypographyValue, val: string) => {
    onChange({ ...v, [key]: val });
  }, [v, onChange]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColor) return;
    const handle = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColor(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showColor]);

  const btnBase = "px-1.5 py-1 text-[11px] rounded border transition-all ";
  const btnActive = "bg-blue-500 text-white border-blue-500 ";
  const btnInactive = "bg-white text-gray-600 border-gray-200 hover:border-gray-400 ";

  return (
    <div className="space-y-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      {/* Row 1: Font + Size */}
      <div className="flex gap-1.5">
        <select
          value={v.fontFamily}
          onChange={(e) => set("fontFamily", e.target.value)}
          className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-[11px] bg-white focus:border-blue-400 focus:outline-none"
          style={{ fontFamily: v.fontFamily || undefined }}
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={v.fontSize}
          onChange={(e) => set("fontSize", e.target.value)}
          className="w-[70px] px-2 py-1.5 rounded border border-gray-200 text-[11px] bg-white focus:border-blue-400 focus:outline-none"
        >
          <option value="">Auto</option>
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Bold + Italic + Color + Alignment */}
      <div className="flex items-center gap-1">
        {/* Bold */}
        <button
          type="button"
          onClick={() => set("fontWeight", v.fontWeight === "bold" ? "" : "bold")}
          className={btnBase + (v.fontWeight === "bold" ? btnActive : btnInactive)}
          style={{ fontWeight: "bold", minWidth: "28px" }}
        >
          B
        </button>
        {/* Italic */}
        <button
          type="button"
          onClick={() => set("fontStyle", v.fontStyle === "italic" ? "" : "italic")}
          className={btnBase + (v.fontStyle === "italic" ? btnActive : btnInactive)}
          style={{ fontStyle: "italic", minWidth: "28px" }}
        >
          I
        </button>

        {/* Color swatch */}
        <div className="relative" ref={colorRef}>
          <button
            type="button"
            onClick={() => setShowColor(!showColor)}
            className="w-7 h-7 rounded border border-gray-300 flex-shrink-0"
            style={{ background: v.color || "#1a1a1a" }}
            title="Textfärg"
          />
          {showColor && (
            <div className="absolute top-8 right-0 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3" style={{ width: "280px" }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-medium text-gray-700">Textfärg</span>
                <button type="button" onClick={() => setShowColor(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>
              {/* Brand presets */}
              <div className="flex gap-1 mb-2 flex-wrap">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { set("color", c); }}
                    className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <ColorPicker
                value={v.color || "#1a1a1a"}
                onChange={(c: string) => set("color", c)}
                width={252}
                height={120}
                hideControls={false}
                hideInputs={false}
                hidePresets
                hideOpacity
              />
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="w-px h-5 bg-gray-200 mx-0.5" />

        {/* Alignment */}
        {(["left", "center", "right"] as const).map((align) => (
          <button
            key={align}
            type="button"
            onClick={() => set("textAlign", v.textAlign === align ? "" : align)}
            className={btnBase + (v.textAlign === align ? btnActive : btnInactive)}
            style={{ minWidth: "28px" }}
            title={align === "left" ? "Vänster" : align === "center" ? "Center" : "Höger"}
          >
            {align === "left" ? "≡" : align === "center" ? "⫿" : "≡"}
          </button>
        ))}
      </div>
    </div>
  );
}
