"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { findKnowledgeMatches, type KnowledgeLink } from "@/lib/knowledge-links";

interface Props {
  text: string;
  className?: string;
  preserveLineBreaks?: boolean;
}

export default function KnowledgeText({ text, className, preserveLineBreaks = true }: Props) {
  const [active, setActive] = useState<{ link: KnowledgeLink; x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (active && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [active]);

  if (!text) return null;
  const spans = findKnowledgeMatches(text);

  if (spans.length === 0) {
    return (
      <span className={className} style={preserveLineBreaks ? { whiteSpace: "pre-wrap" } : undefined}>
        {text}
      </span>
    );
  }

  // Bygg fragment
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, i) => {
    if (span.start > cursor) {
      parts.push(text.slice(cursor, span.start));
    }
    parts.push(
      <button
        key={`kw-${i}`}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setActive({
            link: span.link,
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 6,
          });
        }}
        className="inline text-purple-700 hover:text-purple-900 underline decoration-dotted decoration-purple-400 underline-offset-2 cursor-pointer bg-transparent border-0 p-0 m-0 font-inherit"
      >
        {text.slice(span.start, span.end)}
      </button>
    );
    cursor = span.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <>
      <span className={className} style={preserveLineBreaks ? { whiteSpace: "pre-wrap" } : undefined}>
        {parts}
      </span>

      {active && (
        <div
          ref={popoverRef}
          className="fixed z-50 max-w-sm bg-white border border-gray-200 rounded-xl shadow-2xl p-4"
          style={{
            left: Math.min(active.x, window.innerWidth - 380),
            top: active.y,
          }}
        >
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-display font-semibold text-sm text-gray-900 mb-1">
                {active.link.title}
              </div>
              <div className="text-sm text-gray-700 leading-relaxed">
                {active.link.explanation}
              </div>
              {active.link.href && (
                <a
                  href={active.link.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 font-medium"
                  onClick={() => setActive(null)}
                >
                  Läs mer i handboken
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={() => setActive(null)}
              className="text-gray-400 hover:text-gray-700 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
