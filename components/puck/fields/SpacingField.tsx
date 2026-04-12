"use client";

import { useState } from "react";

const PRESETS = [
  { label: "Ingen", value: "0" },
  { label: "XS", value: "4px" },
  { label: "S", value: "8px" },
  { label: "M", value: "16px" },
  { label: "L", value: "24px" },
  { label: "XL", value: "40px" },
  { label: "2XL", value: "64px" },
];

interface SpacingValue {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

interface SpacingFieldProps {
  value: SpacingValue | string;
  onChange: (value: SpacingValue) => void;
  mode?: "padding" | "margin";
}

function parseValue(val: SpacingValue | string): SpacingValue {
  if (typeof val === "object" && val !== null) return val;
  return { top: "0", right: "0", bottom: "0", left: "0" };
}

export function SpacingField({ value, onChange, mode = "padding" }: SpacingFieldProps) {
  const [linked, setLinked] = useState(true);
  const spacing = parseValue(value);
  const label = mode === "padding" ? "Padding" : "Marginal";

  const update = (side: keyof SpacingValue, val: string) => {
    if (linked) {
      onChange({ top: val, right: val, bottom: val, left: val });
    } else {
      onChange({ ...spacing, [side]: val });
    }
  };

  const allSame = spacing.top === spacing.right && spacing.right === spacing.bottom && spacing.bottom === spacing.left;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        <button
          type="button"
          onClick={() => setLinked(!linked)}
          className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
            linked ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
          }`}
          title={linked ? "Alla sidor lika" : "Individuella sidor"}
        >
          {linked ? "🔗" : "⛓️‍💥"}
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange({ top: p.value, right: p.value, bottom: p.value, left: p.value })}
            className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
              allSame && spacing.top === p.value
                ? "bg-blue-100 text-blue-700 border-blue-300"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Individual inputs */}
      {linked ? (
        <input
          type="text"
          value={spacing.top}
          onChange={(e) => update("top", e.target.value)}
          placeholder="16px"
          className="w-full px-2 py-1 rounded border border-gray-200 text-xs font-mono focus:border-blue-400 focus:outline-none"
        />
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1">
              <span className="text-[9px] text-gray-400 w-3">
                {side === "top" ? "↑" : side === "right" ? "→" : side === "bottom" ? "↓" : "←"}
              </span>
              <input
                type="text"
                value={spacing[side]}
                onChange={(e) => update(side, e.target.value)}
                placeholder="0"
                className="flex-1 px-1.5 py-0.5 rounded border border-gray-200 text-[11px] font-mono focus:border-blue-400 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
