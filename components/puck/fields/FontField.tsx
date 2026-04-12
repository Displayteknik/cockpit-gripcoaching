"use client";

import { useState, useRef, useEffect } from "react";
import FontPicker from "react-fontpicker-ts-lite";
import "react-fontpicker-ts-lite/dist/index.css";

const BRAND_FONTS = [
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

interface FontFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function FontField({ value, onChange }: FontFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div ref={ref} className="space-y-2">
      {/* Quick brand font buttons */}
      <div className="flex flex-wrap gap-1">
        {BRAND_FONTS.map((font) => (
          <button
            key={font.value}
            type="button"
            onClick={() => { onChange(font.value); setShowPicker(false); }}
            className={`px-2 py-1 rounded text-[11px] transition-all ${
              value === font.value
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
            style={font.value ? { fontFamily: font.value } : undefined}
          >
            {font.label}
          </button>
        ))}
      </div>

      {/* Toggle full Google Fonts picker */}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className={`text-[11px] px-2 py-1 rounded transition-all ${
          showPicker ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-500 hover:text-gray-700 border border-gray-200"
        }`}
      >
        {showPicker ? "Stäng" : "Fler typsnitt..."}
      </button>

      {/* Full Google Fonts picker */}
      {showPicker && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <FontPicker
            defaultValue={value || "Inter"}
            autoLoad
            value={(fontName: string) => {
              onChange(fontName);
            }}
          />
        </div>
      )}

      {/* Current value display */}
      {value && (
        <div className="flex items-center justify-between">
          <span
            className="text-sm text-gray-700"
            style={{ fontFamily: value }}
          >
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-gray-400 hover:text-red-500 text-[11px]"
          >
            Återställ
          </button>
        </div>
      )}
    </div>
  );
}
