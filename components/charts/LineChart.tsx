"use client";

interface Point { x: string | number; y: number }

export default function LineChart({ data, height = 160, color = "#2563eb", label = "Värde" }: { data: Point[]; height?: number; color?: string; label?: string }) {
  if (!data.length) return <div className="text-center text-sm text-gray-400 py-8">Ingen data</div>;
  const w = 600;
  const h = height;
  const padding = 24;
  const ys = data.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const stepX = (w - padding * 2) / Math.max(1, data.length - 1);

  const points = data.map((p, i) => {
    const x = padding + i * stepX;
    const y = h - padding - ((p.y - minY) / rangeY) * (h - padding * 2);
    return { x, y, raw: p };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${h - padding} L ${padding} ${h - padding} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
        <path d={path} stroke={color} strokeWidth="2" fill="none" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} />
            <title>{`${p.raw.x}: ${p.raw.y.toLocaleString("sv-SE")} ${label}`}</title>
          </g>
        ))}
        <text x={padding} y={h - 6} fontSize="10" fill="#9ca3af">{data[0].x}</text>
        <text x={w - padding} y={h - 6} fontSize="10" fill="#9ca3af" textAnchor="end">{data[data.length - 1].x}</text>
        <text x={padding - 4} y={padding + 4} fontSize="10" fill="#9ca3af" textAnchor="end">{maxY.toLocaleString("sv-SE")}</text>
        <text x={padding - 4} y={h - padding} fontSize="10" fill="#9ca3af" textAnchor="end">{minY.toLocaleString("sv-SE")}</text>
      </svg>
    </div>
  );
}
