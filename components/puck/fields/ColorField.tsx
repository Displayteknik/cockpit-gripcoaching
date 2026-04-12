"use client";

import { useState } from "react";

const BRAND_COLORS = [
  { label: "Standard", value: "" },
  { label: "Blå", value: "#1d5ca8" },
  { label: "Mörk blå", value: "#143d6e" },
  { label: "Guld", value: "#e8a838" },
  { label: "Svart", value: "#1a1a1a" },
  { label: "Grå", value: "#6b7280" },
  { label: "Vit", value: "#ffffff" },
  { label: "Röd", value: "#dc2626" },
  { label: "Grön", value: "#16a34a" },
];

interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ value, onChange }: ColorFieldProps) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="space-y-2">
      {/* Brand color swatches */}
      <div className="flex flex-wrap gap-1.5">
        {BRAND_COLORS.map((color) => (
          <button
            key={color.value}
            onClick={() => { onChange(color.value); setShowCustom(false); }}
            title={color.label}
            className={`w-7 h-7 rounded-md border-2 transition-all hover:scale-110 ${
              value === color.value ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
            }`}
            style={{
              backgroundColor: color.value || "#f3f4f6",
              backgroundImage: !color.value ? "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)" : undefined,
              backgroundSize: !color.value ? "8px 8px" : undefined,
              backgroundPosition: !color.value ? "0 0, 4px 4px" : undefined,
            }}
          />
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`w-7 h-7 rounded-md border-2 text-xs font-bold transition-all hover:scale-110 ${
            showCustom ? "border-blue-500 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-400"
          }`}
          title="Egen färg"
        >
          #
        </button>
      </div>

      {/* Custom color input */}
      {showCustom && (
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={value || "#1d5ca8"}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#1d5ca8"
            className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs font-mono"
          />
        </div>
      )}
    </div>
  );
}
