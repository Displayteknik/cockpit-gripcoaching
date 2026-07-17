import {
  Target, TrendingUp, Globe, Sparkles, Lightbulb, Calendar, Users,
  Mail, Compass, LayoutGrid,
} from "lucide-react";

// Ikon som accepterar både className och style (lucide-props).
type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

// Namn (sparat i platform_modules.icon) → lucide-komponent. Håller ikon-mappningen
// i TS (DB lagrar bara namnet). Okänt namn → neutral fallback.
// OBS: denna lucide-version exporterar INTE 'Linkedin' — 'linkedin'-modulen är
// ändå "kommande" (inaktiv) så dess namn faller till neutral fallback tills
// dess kundvy (och ikon) byggs.
const MODULE_ICON: Record<string, IconType> = {
  Target, TrendingUp, Globe, Sparkles, Lightbulb, Calendar, Users,
  Mail, Compass,
};

export function moduleIcon(name: string | null | undefined): IconType {
  return (name && MODULE_ICON[name]) || LayoutGrid;
}
