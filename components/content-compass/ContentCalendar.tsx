"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentItem } from "@/lib/content/overview";
import { funnelTintClass, FourALabel, FunnelLabel, DiscDots } from "@/components/content-compass/badges";

// Delad månadskalender: brickor per dag med Content Compass-färgkodning.
// Används av både admin-Kalendern, Innehålls-navet och kundvyn (/k/kalender).
// hrefFor låter kundvyn peka brickorna till /k istället för /dashboard (default = editHref).
// onSelect: när den finns öppnar brickan en detaljvy (redigera/radera) istället för att
// länka direkt till verkstaden. Utan den beter sig kalendern precis som förut.
export default function ContentCalendar({ items, primary = "#10B981", hrefFor, onSelect, onMove }: { items: ContentItem[]; primary?: string; hrefFor?: (it: ContentItem) => string; onSelect?: (it: ContentItem) => void; onMove?: (it: ContentItem, nyttDatum: Date) => void | Promise<void> }) {
  const linkOf = (it: ContentItem) => (hrefFor ? hrefFor(it) : it.editHref);

  // KALENDER-1 (Håkans krav 11/8): flytta ett inlägg genom att dra det till en annan dag.
  // Utan onMove beter kalendern sig exakt som förut — kundvyn och navet får dra-och-släpp
  // först när deras sida skickar in en flyttfunktion.
  //
  // Två saker får ALDRIG kunna dras, och det är samma två som API:t vägrar:
  //   · publicerat innehåll — texten är redan ute, ett nytt datum hade bara gjort vyn osann
  //   · bloggposter — deras datum ÄR publiceringstiden på sajten, inte ett schema
  const [dragen, setDragen] = useState<ContentItem | null>(null);
  const [overDag, setOverDag] = useState<string | null>(null);
  const gardra = (it: ContentItem) => Boolean(onMove) && it.status !== "published" && it.source !== "blog";
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

  // När innehållet laddats: om innevarande månad är tom men det finns innehåll i en annan
  // månad (t.ex. schemalagt framåt i tiden), hoppa en gång till närmaste månad med innehåll.
  // Så användaren ser sina schemalagda inlägg utan att bläddra manuellt.
  const didAutoJump = useRef(false);
  useEffect(() => {
    if (didAutoJump.current || items.length === 0) return;
    didAutoJump.current = true;
    const dated = items.map((it) => (it.when ? new Date(it.when).getTime() : NaN)).filter((t) => !Number.isNaN(t));
    if (!dated.length) return;
    const now = new Date();
    const hasThisMonth = dated.some((t) => { const d = new Date(t); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    if (hasThisMonth) return;
    const upcoming = dated.filter((t) => t >= now.getTime()).sort((a, b) => a - b);
    const target = new Date(upcoming.length ? upcoming[0] : Math.max(...dated));
    setCursor(new Date(target.getFullYear(), target.getMonth(), 1));
  }, [items]);

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
                <div
                  key={i}
                  onDragOver={(e) => {
                    if (!dragen) return;
                    e.preventDefault(); // utan detta vägrar webbläsaren släppa
                    e.dataTransfer.dropEffect = "move";
                    setOverDag(k);
                  }}
                  onDragLeave={() => setOverDag((v) => (v === k ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverDag(null);
                    const it = dragen;
                    setDragen(null);
                    if (!it || !onMove) return;
                    // Behåll klockslaget. Drar man en post från tisdag 20:00 till torsdag ska
                    // den ligga 20:00 där — inte midnatt, som ett rent datumbyte hade gett.
                    const gammal = it.when ? new Date(it.when) : null;
                    const nytt = new Date(d);
                    nytt.setHours(gammal && !isNaN(gammal.getTime()) ? gammal.getHours() : 9, gammal && !isNaN(gammal.getTime()) ? gammal.getMinutes() : 0, 0, 0);
                    void onMove(it, nytt);
                  }}
                  className={`min-h-[96px] rounded-lg border p-1.5 transition-colors ${
                    overDag === k && dragen ? "ring-2 ring-offset-1" : ""
                  } ${inMonth ? "bg-white border-gray-100" : "bg-gray-50/60 border-gray-50"}`}
                  style={overDag === k && dragen ? { boxShadow: `inset 0 0 0 2px ${primary}` } : {}}
                >
                  <div className={`text-xs mb-1 ${isToday ? "font-bold text-white inline-flex items-center justify-center w-5 h-5 rounded-full" : inMonth ? "text-gray-500" : "text-gray-300"}`} style={isToday ? { background: primary } : {}}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 4).map((it) => {
                      const innehall = (
                        <>
                          <div className="flex items-center gap-1"><FourALabel value={it.four_a} compact /><span className="truncate flex-1 text-gray-700">{it.title}</span></div>
                          {(it.funnel_level || (it.disc && it.disc.length)) && <div className="flex items-center gap-1 mt-0.5"><FunnelLabel level={it.funnel_level} /><DiscDots disc={it.disc} size={12} /></div>}
                        </>
                      );
                      // Misslyckad publicering ska synas direkt i kalendern, inte bara i kö-panelen.
                      const cls = it.status === "failed"
                        ? "block w-full text-left rounded px-1.5 py-1 text-xs leading-tight hover:opacity-80 border-l-4 border-l-red-500 bg-red-50"
                        : `block w-full text-left rounded px-1.5 py-1 text-xs leading-tight hover:opacity-80 ${funnelTintClass(it.funnel_level) || "border-l-4 border-l-gray-200 bg-gray-50"}`;
                      const dragProps = gardra(it)
                        ? {
                            draggable: true,
                            onDragStart: (e: React.DragEvent) => {
                              setDragen(it);
                              e.dataTransfer.effectAllowed = "move";
                              // setData är INTE valfritt: utan nyttolast startar Firefox aldrig
                              // dragningen, och en bricka som inte går att dra ser trasig ut.
                              // Chrome lägger själv in länkens href, Firefox gör det inte.
                              try { e.dataTransfer.setData("text/plain", `${it.source}:${it.id}`); } catch { /* äldre webbläsare */ }
                            },
                            onDragEnd: () => { setDragen(null); setOverDag(null); },
                            // Titeln säger varför en post går att dra, och den som inte går
                            // att dra säger varför den inte gör det (nedan).
                            title: `${it.title} — dra till en annan dag för att flytta`,
                          }
                        : {
                            title: onMove
                              ? `${it.title} — ${it.status === "published" ? "publicerat, kan inte flyttas" : "bloggdatum styrs av publiceringen"}`
                              : it.title,
                          };
                      const flyttas = dragen && dragen.id === it.id && dragen.source === it.source;
                      const dragCls = `${cls}${gardra(it) ? " cursor-grab active:cursor-grabbing" : ""}${flyttas ? " opacity-40" : ""}`;
                      return onSelect ? (
                        <button key={`${it.source}-${it.id}`} onClick={() => onSelect(it)} className={dragCls} {...dragProps}>{innehall}</button>
                      ) : (
                        <a key={`${it.source}-${it.id}`} href={linkOf(it)} className={dragCls} {...dragProps}>{innehall}</a>
                      );
                    })}
                    {dayItems.length > 4 && <div className="text-xs text-gray-400 pl-1">+{dayItems.length - 4} till</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="font-semibold">Steg i kundresan:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-slate-300 bg-slate-50" /> Väck intresse</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-amber-300 bg-amber-50" /> Bygg förtroende</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-3 rounded border-l-4 border-l-emerald-400 bg-emerald-50" /> Dags att sälja</span>
        <span className="font-semibold ml-2">Ton (hovra för förklaring):</span><DiscDots disc={["D", "I", "S", "C"]} size={14} />
        {onMove && <span className="ml-2">Dra ett inlägg till en annan dag för att flytta det. Publicerat och bloggposter sitter fast.</span>}
      </div>
    </div>
  );
}
