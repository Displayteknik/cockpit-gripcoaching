"use client";

// Ikigai-Venn som SVG: fyra mjuka gradient-cirklar, de fyra korsningarna och
// nischen som guldmarkerad mittpunkt. html2canvas-vänligt (gradienter + enkel
// drop-shadow, inga mix-blend-modes) så det blir skarpt även i PDF.

export interface IkigaiDiagramData {
  love?: string; skill?: string; need?: string; pay?: string;
  passion?: string; mission?: string; profession?: string; vocation?: string;
  ikigai?: string;
}

function wrap(text: string, max: number, maxLines: number): string[] {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,]*$/, "") + "…";
  }
  return lines.length ? lines : [""];
}

function MultiText({ x, y, text, max, maxLines, size, weight, fill, lh, spacing }: {
  x: number; y: number; text: string; max: number; maxLines: number; size: number; weight: number; fill: string; lh: number; spacing?: number;
}) {
  const lines = wrap(text, max, maxLines);
  const startY = y - ((lines.length - 1) * lh) / 2;
  return (
    <text x={x} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: spacing ?? 0 }}>
      {lines.map((l, i) => <tspan key={i} x={x} y={startY + i * lh}>{l}</tspan>)}
    </text>
  );
}

const C = {
  love: { hue: "#e11d48", dark: "#9f1239" },   // rosa — älskar
  need: { hue: "#059669", dark: "#065f46" },   // grön — behövs
  skill: { hue: "#d97706", dark: "#92400e" },  // amber — bra på
  pay: { hue: "#2563eb", dark: "#1e3a8a" },    // blå — betalt
  gold: "#b45309",
};

export default function IkigaiDiagram({ data }: { data: IkigaiDiagramData }) {
  const r = 172, cx = 360, cy = 340, o = 94;
  const love = { x: cx - o, y: cy - o };
  const need = { x: cx + o, y: cy - o };
  const skill = { x: cx - o, y: cy + o };
  const pay = { x: cx + o, y: cy + o };

  const grad = (id: string, color: string) => (
    <radialGradient id={id} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor={color} stopOpacity={0.05} />
      <stop offset="70%" stopColor={color} stopOpacity={0.14} />
      <stop offset="100%" stopColor={color} stopOpacity={0.26} />
    </radialGradient>
  );

  return (
    <svg viewBox="0 0 720 720" className="w-full h-auto" role="img" aria-label="Ikigai-diagram">
      <defs>
        {grad("g-love", C.love.hue)}
        {grad("g-need", C.need.hue)}
        {grad("g-skill", C.skill.hue)}
        {grad("g-pay", C.pay.hue)}
        <filter id="softshadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
        </filter>
      </defs>

      <g>
        <circle cx={love.x} cy={love.y} r={r} fill="url(#g-love)" stroke={C.love.hue} strokeOpacity={0.5} strokeWidth={1.25} />
        <circle cx={need.x} cy={need.y} r={r} fill="url(#g-need)" stroke={C.need.hue} strokeOpacity={0.5} strokeWidth={1.25} />
        <circle cx={skill.x} cy={skill.y} r={r} fill="url(#g-skill)" stroke={C.skill.hue} strokeOpacity={0.5} strokeWidth={1.25} />
        <circle cx={pay.x} cy={pay.y} r={r} fill="url(#g-pay)" stroke={C.pay.hue} strokeOpacity={0.5} strokeWidth={1.25} />
      </g>

      {/* Yttre etiketter — personens kärna i varje cirkel */}
      <Outer x={cx - o - 70} y={cy - o - 96} title="VAD DU ÄLSKAR" value={data.love} color={C.love.dark} />
      <Outer x={cx + o + 70} y={cy - o - 96} title="VÄRLDEN BEHÖVER" value={data.need} color={C.need.dark} />
      <Outer x={cx - o - 70} y={cy + o + 64} title="DU ÄR BRA PÅ" value={data.skill} color={C.skill.dark} />
      <Outer x={cx + o + 70} y={cy + o + 64} title="FÅR BETALT FÖR" value={data.pay} color={C.pay.dark} />

      {/* Korsningar */}
      <Inter x={cx - o - 38} y={cy} name="PASSION" value={data.passion} max={13} />
      <Inter x={cx} y={cy - o - 10} name="MISSION" value={data.mission} max={22} />
      <Inter x={cx} y={cy + o + 10} name="YRKE" value={data.profession} max={22} />
      <Inter x={cx + o + 38} y={cy} name="KALL" value={data.vocation} max={13} />

      {/* Mitten = nischen (guldmarkerad fokuspunkt) */}
      <g filter="url(#softshadow)">
        <circle cx={cx} cy={cy} r={70} fill="#ffffff" stroke={C.gold} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={63} fill="none" stroke={C.gold} strokeOpacity={0.25} strokeWidth={1} />
      </g>
      <text x={cx} y={cy - 24} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.gold} style={{ fontFamily: "system-ui, sans-serif", letterSpacing: 1.5 }}>DIN IKIGAI</text>
      <MultiText x={cx} y={cy + 6} text={data.ikigai || "—"} max={16} maxLines={3} size={15.5} weight={700} fill="#0f172a" lh={18} />
    </svg>
  );
}

function Outer({ x, y, title, value, color }: { x: number; y: number; title: string; value?: string; color: string }) {
  return (
    <g>
      <text x={x} y={y} textAnchor="middle" fontSize={13} fontWeight={800} fill={color} style={{ fontFamily: "system-ui, sans-serif", letterSpacing: 0.5 }}>{title}</text>
      <MultiText x={x} y={y + 22} text={value || ""} max={20} maxLines={2} size={14.5} weight={500} fill="#1e293b" lh={17} />
    </g>
  );
}

function Inter({ x, y, name, value, max }: { x: number; y: number; name: string; value?: string; max: number }) {
  return (
    <g>
      <text x={x} y={y - 9} textAnchor="middle" fontSize={11} fontWeight={800} fill="#475569" style={{ fontFamily: "system-ui, sans-serif", letterSpacing: 0.8 }}>{name}</text>
      <MultiText x={x} y={y + 9} text={value || ""} max={max} maxLines={2} size={12.5} weight={600} fill="#1e293b" lh={15} />
    </g>
  );
}
