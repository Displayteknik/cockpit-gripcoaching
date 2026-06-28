"use client";

import { useState } from "react";
import { BookOpen, X } from "lucide-react";

// Klickbar bok-ikon bredvid en funktion → öppnar en ruta som förklarar
// vad funktionen gör och hur den fungerar. Återanvänds i alla vyer.
export function FunctionGuide({
  title,
  what,
  how,
  tips,
  primaryColor = "#1d5ca8",
}: {
  title: string;
  what: string;
  how: string;
  tips?: string[];
  primaryColor?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Läs om funktionen"
        aria-label={`Läs om: ${title}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors align-middle flex-shrink-0"
      >
        <BookOpen className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-display font-bold text-gray-900 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${primaryColor}1a` }}>
                  <BookOpen className="w-4 h-4" style={{ color: primaryColor }} />
                </span>
                {title}
              </h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 p-1" aria-label="Stäng">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div>
                <div className="font-semibold text-gray-900 mb-1">Vad det gör</div>
                <p className="text-gray-600 leading-relaxed">{what}</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900 mb-1">Så funkar det</div>
                <p className="text-gray-600 leading-relaxed">{how}</p>
              </div>
              {tips && tips.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Tips</div>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1 leading-relaxed">
                    {tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
