"use client";

const WIDTH_PRESETS = [
  { label: "Auto", value: "auto" },
  { label: "25%", value: "25%" },
  { label: "33%", value: "33.33%" },
  { label: "50%", value: "50%" },
  { label: "66%", value: "66.66%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
  { label: "Fit", value: "fit-content" },
];

const HEIGHT_PRESETS = [
  { label: "Auto", value: "auto" },
  { label: "200px", value: "200px" },
  { label: "300px", value: "300px" },
  { label: "400px", value: "400px" },
  { label: "50vh", value: "50vh" },
  { label: "100vh", value: "100vh" },
];

interface SizeValue {
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
}

interface SizeFieldProps {
  value: SizeValue | string;
  onChange: (value: SizeValue) => void;
}

function parseValue(val: SizeValue | string): SizeValue {
  if (typeof val === "object" && val !== null) return val;
  return { width: "auto", height: "auto", minWidth: "", maxWidth: "" };
}

export function SizeField({ value, onChange }: SizeFieldProps) {
  const size = parseValue(value);

  const update = (key: keyof SizeValue, val: string) => {
    onChange({ ...size, [key]: val });
  };

  return (
    <div className="space-y-2.5">
      {/* Width */}
      <div>
        <span className="text-[11px] font-medium text-gray-500 block mb-1">Bredd</span>
        <div className="flex flex-wrap gap-1 mb-1">
          {WIDTH_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update("width", p.value)}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                size.width === p.value
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={size.width}
          onChange={(e) => update("width", e.target.value)}
          placeholder="auto"
          className="w-full px-2 py-1 rounded border border-gray-200 text-xs font-mono focus:border-blue-400 focus:outline-none"
        />
      </div>

      {/* Height */}
      <div>
        <span className="text-[11px] font-medium text-gray-500 block mb-1">Höjd</span>
        <div className="flex flex-wrap gap-1 mb-1">
          {HEIGHT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update("height", p.value)}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                size.height === p.value
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={size.height}
          onChange={(e) => update("height", e.target.value)}
          placeholder="auto"
          className="w-full px-2 py-1 rounded border border-gray-200 text-xs font-mono focus:border-blue-400 focus:outline-none"
        />
      </div>

      {/* Min/Max width */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-gray-400 block mb-0.5">Min bredd</span>
          <input
            type="text"
            value={size.minWidth}
            onChange={(e) => update("minWidth", e.target.value)}
            placeholder="—"
            className="w-full px-1.5 py-0.5 rounded border border-gray-200 text-[11px] font-mono focus:border-blue-400 focus:outline-none"
          />
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block mb-0.5">Max bredd</span>
          <input
            type="text"
            value={size.maxWidth}
            onChange={(e) => update("maxWidth", e.target.value)}
            placeholder="—"
            className="w-full px-1.5 py-0.5 rounded border border-gray-200 text-[11px] font-mono focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
