"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentItem } from "@/lib/content/overview";
import { funnelTintClass, FourALabel, FunnelLabel, DiscDots } from "@/components/content-compass/badges";

// Delad månadskalender: brickor per dag med Content Compass-färgkodning.
// Används av både Kalender-sidan och Innehålls-navet (håll i synk).
export default function ContentCalendar({ items, primary = "#10B981" }: { items: ContentItem[]; primary?: string }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const itemsByDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    for (const it of items) {
      if (!it.when) continue;
      const d = new Date(it.when);
      if (isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }, [items]);
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);
  const monthLabel = cursor.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  const todayKey = dayKey(new Date());

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold text-gray-800 capitalize min-w-[130px] text-center">{monthLabel}</span>
        <button onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="ml-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Idag</button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"].map((d) => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const k = dayKey(d);
              const dayItems = itemsByDay.get(k) || [];
              const isToday = k === todayKey;
              return (
                <div key={i} className={`min-h-[96px] rounded-lg border p-1.5 ${inMonth ? "bg-white border-gray-100" : "bg-gray-50/60 border-gray-50"}`}>
                  <div className={`text-xs mb-1 ${isToday ? "font-bold text-white inline-flex items-center justify-center w-5 h-5 rounded-full" : inMonth ? "text-gray-500" : "text-gray-300"}`} style={isToday ? { background: primary } : {}}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 4).map((it) => (
                      <a key={`${it.source}-${it.id}`} href={it.editHref} title={it.title} className={`block rounded px-1.5 py-1 text-[11px] leading-tight hover:opacity-80 ${funnelTintClass(it.funnel_level) || "border-l-4 border-l-gray-200 bg-gray-50"}`}>
                        <div className="flex items-center gap-1"><FourALabel value={it.four_a} compact /><span className="truncate flex-1 text-gray-700">{it.title}</span></div>
                        {(it.funnel_level || (it.disc && it.disc.length)) && <div className="flex items-center gap-1 mt-0.5"><FunnelLabel level={it.funnel_level} /><DiscDots disc={it.disc} size={12} /></div>}
                      </a>
                    ))}
                    {dayItems.length > 4 && <div className="text-[10px] text-gray-400 pl-1">+{dayItems.length - 4} till</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        <span className="font-semibold">Funnel:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-slate-300 bg-slate-50" /> TOFU</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-amber-300 bg-amber-50" /> MOFU</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-emerald-400 bg-emerald-50" /> BOFU</span>
        <span className="font-semibold ml-2">DISC:</span><DiscDots disc={["D", "I", "S", "C"]} size={14} />
      </div>
    </div>
  );
}
