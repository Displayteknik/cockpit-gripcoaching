import { createElement } from "react";
import {
  Target, TrendingUp, Globe, Sparkles, Lightbulb, Calendar, Users,
  Mail, Compass, LayoutGrid,
} from "lucide-react";

// Ikon som accepterar både className och style (lucide-props).
type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

// LinkedIn saknas i denna lucide-version → egen brand-SVG (createElement, .ts-vänligt).
export function LinkedinIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", className, style, fill: "currentColor", "aria-hidden": true },
    createElement("path", { d: "M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.04c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" }),
  );
}

// Namn (sparat i platform_modules.icon) → lucide-komponent. Håller ikon-mappningen
// i TS (DB lagrar bara namnet). Okänt namn → neutral fallback.
// OBS: denna lucide-version exporterar INTE 'Linkedin' — 'linkedin'-modulen är
// ändå "kommande" (inaktiv) så dess namn faller till neutral fallback tills
// dess kundvy (och ikon) byggs.
const MODULE_ICON: Record<string, IconType> = {
  Target, TrendingUp, Globe, Sparkles, Lightbulb, Calendar, Users,
  Mail, Compass, Linkedin: LinkedinIcon,
};

export function moduleIcon(name: string | null | undefined): IconType {
  return (name && MODULE_ICON[name]) || LayoutGrid;
}
