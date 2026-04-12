"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DesignWrapper } from "./fields/DesignWrapper";

interface SpacingValue { top: string; right: string; bottom: string; left: string; }
interface SizeValue { width: string; height: string; minWidth: string; maxWidth: string; }

export interface FAQItemProps {
  question: string;
  answer: string;
  color: string;
  fontFamily: string;
  spacing: SpacingValue;
  componentSize: SizeValue;
  editMode?: boolean;
}

export function FAQItem({ question, answer, color = "", fontFamily = "", spacing, componentSize, editMode }: FAQItemProps) {
  const [open, setOpen] = useState(false);

  const textStyle: React.CSSProperties = {};
  if (color) textStyle.color = color;
  if (fontFamily) textStyle.fontFamily = fontFamily;

  return (
    <DesignWrapper spacing={spacing} componentSize={componentSize} editMode={editMode}>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-shadow hover:shadow-sm">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-6 py-5 text-left"
        >
          <span className={`${fontFamily ? "" : "font-display "}font-semibold text-text-primary pr-4`} style={textStyle}>{question}</span>
          <ChevronDown className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-6 pb-5 text-text-muted leading-relaxed border-t border-gray-50 pt-4" style={fontFamily ? { fontFamily } : undefined}>
            {answer}
          </div>
        </div>
      </div>
    </DesignWrapper>
  );
}
