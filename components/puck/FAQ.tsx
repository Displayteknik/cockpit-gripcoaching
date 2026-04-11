"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FAQProps {
  title: string;
  subtitle: string;
  items: { question: string; answer: string }[];
}

export function FAQ({ title, subtitle, items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-24 bg-surface-light">
      <div className="max-w-[800px] mx-auto px-4">
        {title && (
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-muted text-lg">{subtitle}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {items?.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-shadow hover:shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="font-display font-semibold text-text-primary pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-6 pb-5 text-text-muted leading-relaxed border-t border-gray-50 pt-4">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
