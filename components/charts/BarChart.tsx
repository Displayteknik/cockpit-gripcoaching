"use client";

export default function BarChart({ data, height = 160, color = "#7c3aed" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  if (!data.length) return <div className="text-center text-sm text-gray-400 py-8">Ingen data</div>;
  const w = 600;
  const h = height;
  const padding = 24;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const bw = (w - padding * 2) / data.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const x = padding + i * bw + 2;
          const barH = (d.value / max) * (h - padding * 2);
          const y = h - padding - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw - 4} height={barH} fill={color} rx="3" opacity="0.85" />
              <text x={x + (bw - 4) / 2} y={y - 4} fontSize="10" fill="#374151" textAnchor="middle" fontWeight="600">{d.value.toLocaleString("sv-SE")}</text>
              <text x={x + (bw - 4) / 2} y={h - 6} fontSize="10" fill="#9ca3af" textAnchor="middle">{d.label.slice(0, 12)}</text>
              <title>{`${d.label}: ${d.value}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
