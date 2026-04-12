"use client";

import { useState, useRef, useEffect } from "react";
import ColorPicker from "react-best-gradient-color-picker";

const BRAND_PRESETS = [
  "#1d5ca8",
  "#143d6e",
  "#e8a838",
  "#1a1a1a",
  "#6b7280",
  "#ffffff",
  "#dc2626",
  "#16a34a",
  "#0c1018",
  "#f5f5f3",
];

interface GradientColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function GradientColorField({ value, onChange }: GradientColorFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isGradient = value?.includes("gradient");
  const previewStyle: React.CSSProperties = value
    ? { background: value }
    : { backgroundColor: "#f3f4f6", backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0, 4px 4px" };

  return (
    <div ref={ref} className="relative">
      {/* Preview + toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-9 h-9 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all shadow-sm flex-shrink-0"
          style={previewStyle}
          title="Välj färg"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Färg eller gradient..."
          className="flex-1 px-2 py-1.5 rounded-md border border-gray-200 text-xs font-mono focus:border-blue-400 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-gray-400 hover:text-red-500 text-xs px-1"
            title="Rensa"
          >
            ✕
          </button>
        )}
      </div>

      {/* Color picker popup */}
      {open && (
        <div className="absolute z-50 top-12 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3" style={{ width: 280 }}>
          <div className="text-[11px] font-medium text-gray-500 mb-2 flex items-center justify-between">
            <span>{isGradient ? "Gradient" : "Enfärgad"}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <ColorPicker
            value={value || "rgba(29, 92, 168, 1)"}
            onChange={onChange}
            width={254}
            height={160}
            hideInputs={false}
            hideOpacity={false}
            hidePresets={false}
            hideEyeDrop={false}
            hideAdvancedSliders={false}
            hideColorGuide={false}
            presets={BRAND_PRESETS}
          />
        </div>
      )}
    </div>
  );
}
