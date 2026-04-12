import { Shield, Heart, Wrench, Users, Star, MapPin } from "lucide-react";
import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface CardProps {
  title: string;
  text: string;
  icon: string;
  variant: "default" | "centered" | "horizontal";
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  shield: Shield, heart: Heart, wrench: Wrench,
  users: Users, star: Star, mappin: MapPin,
};

export function Card({ title, text, icon = "heart", variant = "default", spacing, componentSize, editMode }: CardProps) {
  const Icon = iconMap[icon] || Heart;
  const isCentered = variant === "centered";
  const isHorizontal = variant === "horizontal";

  if (isHorizontal) {
    return (
      <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
        <div className="flex gap-4 p-5 rounded-xl bg-surface-light hover:bg-surface-muted transition-colors">
          <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-brand-blue" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-text-primary mb-1">{title}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{text}</p>
          </div>
        </div>
      </DesignWrapper>
    );
  }

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className={`group p-8 rounded-2xl bg-surface-light hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 ${isCentered ? "text-center" : ""}`}>
        <div className={`w-16 h-16 mb-6 rounded-2xl bg-brand-blue/10 flex items-center justify-center group-hover:bg-brand-blue transition-all duration-300 ${isCentered ? "mx-auto" : ""}`}>
          <Icon className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
        </div>
        <h3 className="font-display text-xl font-bold text-text-primary mb-3">{title}</h3>
        <p className="text-text-muted leading-relaxed">{text}</p>
      </div>
    </DesignWrapper>
  );
}
