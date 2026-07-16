// Delade deterministiska vektor-bitar för Studio-mallarna. Inga externa anrop.

// Penseldrags-ruta (bakgrund bakom brödtext). Ersätter den stretchade platta rutan.
// Riktig målad look: organisk kropp + grov kant via feTurbulence+displacement + två
// bristle-strimmor (ljus/mörk) för djup. Färg = prop → fri färgsättning per inlägg.
// Fyller föräldern (preserveAspectRatio="none"); basformen är insatt från kanterna så
// displacementen aldrig klipps av SVG-viewporten.
export function BrushBox({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 1000 300"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", inset: 0, display: "block" }}
    >
      <defs>
        <filter id="brushRough" x="-10%" y="-35%" width="120%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#brushRough)">
        {/* Penselkropp — vågig topp/botten + avsmalnande ändar */}
        <path
          fill={color}
          d="M46 80 C 210 54, 430 66, 620 58 C 780 52, 902 68, 958 62
             C 972 100, 966 138, 962 168 C 968 208, 974 232, 946 244
             C 770 250, 560 240, 380 246 C 240 250, 128 242, 56 248
             C 32 224, 40 186, 36 150 C 33 116, 30 98, 46 80 Z"
        />
        {/* Ljus torrpensel-strimma (djup, funkar på alla färger) */}
        <path d="M74 118 C 300 108, 620 114, 928 110" fill="none" stroke="rgba(255,255,255,0.17)" strokeWidth="9" strokeLinecap="round" />
        {/* Mörk torrpensel-strimma */}
        <path d="M82 198 C 320 206, 640 200, 918 204" fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth="11" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Väljer läsbar bläckfärg (mörk/ljus) mot en godtycklig penselfärg via luminans.
export function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// Fylld sol (mall 2) — cirkel + spetsiga strålar.
export function SunFilled({ color, size = 90 }: { color: string; size?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI / 6) * i;
    const x1 = 50 + Math.cos(a) * 27;
    const y1 = 50 + Math.sin(a) * 27;
    const x2 = 50 + Math.cos(a) * 46;
    const y2 = 50 + Math.sin(a) * 46;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="6" strokeLinecap="round" />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {rays}
      <circle cx="50" cy="50" r="19" fill={color} />
    </svg>
  );
}

// Kontur-sol (penselrutan) — tunn linje-sol.
export function SunOutline({ color, size = 60 }: { color: string; size?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i;
    const x1 = 50 + Math.cos(a) * 30;
    const y1 = 50 + Math.sin(a) * 30;
    const x2 = 50 + Math.cos(a) * 44;
    const y2 = 50 + Math.sin(a) * 44;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="5" strokeLinecap="round" />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r="17" fill="none" stroke={color} strokeWidth="5" />
      {rays}
    </svg>
  );
}

export function StarBadge({
  line1,
  line2,
  fill,
  textColor,
  strokeColor,
  size = 230,
}: {
  line1: string;
  line2: string;
  fill: string;
  textColor: string;
  strokeColor: string;
  size?: number;
}) {
  const path = burstPath(14, 50, 50, 49, 37);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <path d={path} fill={fill} stroke={strokeColor} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          color: textColor,
          textTransform: "uppercase",
          lineHeight: 0.9,
        }}
      >
        {line1 ? <span style={{ fontSize: size * 0.11, fontWeight: 700, letterSpacing: 1 }}>{line1}</span> : null}
        {line2 ? <span style={{ fontSize: size * 0.24, fontWeight: 800, marginTop: size * 0.01 }}>{line2}</span> : null}
      </div>
    </div>
  );
}

// Glasögon-ikon (foten).
export function GlassesIcon({ color, size = 54 }: { color: string; size?: number }) {
  const h = size * 0.52;
  return (
    <svg width={size} height={h} viewBox="0 0 54 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="13" cy="16" r="9" stroke={color} strokeWidth="2.4" />
      <circle cx="41" cy="16" r="9" stroke={color} strokeWidth="2.4" />
      <path d="M22 14.5c2-2 8-2 10 0" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4.5 13 2 8.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M49.5 13 52 8.5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// Deterministisk starburst-path (ingen slump). spikes*2 punkter, alternerande radie.
function burstPath(spikes: number, cx: number, cy: number, outer: number, inner: number): string {
  const total = spikes * 2;
  let d = "";
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + "Z";
}
