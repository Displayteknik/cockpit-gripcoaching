"use client";

import { useEffect, useRef, useState } from "react";
import { STUDIO_TEMPLATES } from "@/components/studio/registry";
import type { StudioPayload, StudioOverrides } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";

// Live-editor: renderar mall-komponenten DIREKT i sidan (inte iframe) → WYSIWYG med
// export + direkt-manipulation. Samma komponent som export-rendern använder.

// Självhostade typsnitt (speglar app/studio/render/studio-fonts.css) så live = export.
const FONT_CSS = `
@font-face{font-family:"Inter";src:url("/fonts/inter-500.ttf");font-weight:500}
@font-face{font-family:"Inter";src:url("/fonts/inter-600.ttf");font-weight:600}
@font-face{font-family:"Inter";src:url("/fonts/inter-700.ttf");font-weight:700}
@font-face{font-family:"Inter";src:url("/fonts/inter-800.ttf");font-weight:800}
@font-face{font-family:"Inter";src:url("/fonts/inter-900.ttf");font-weight:900}
@font-face{font-family:"Playfair Display";src:url("/fonts/playfair-900.ttf");font-weight:400 900}
@font-face{font-family:"Archivo";src:url("/fonts/archivo-700.ttf");font-weight:700}
@font-face{font-family:"Archivo";src:url("/fonts/archivo-800.ttf");font-weight:800}
@font-face{font-family:"Archivo";src:url("/fonts/archivo-900.ttf");font-weight:900}
@font-face{font-family:"Poppins";src:url("/fonts/poppins-600.ttf");font-weight:600}
@font-face{font-family:"Poppins";src:url("/fonts/poppins-700.ttf");font-weight:700}
@font-face{font-family:"Poppins";src:url("/fonts/poppins-800.ttf");font-weight:800}
@font-face{font-family:"Anton";src:url("/fonts/anton.ttf");font-weight:400}
`;

const IMAGE_TEMPLATES = new Set(["ark-overlay", "ark-foto-ruta", "ark-erbjudande", "opticur-foto-gul-ruta"]);

export interface ImagePatch { imageX?: number; imageFocusY?: number; imageScale?: number }
// B2: positions-patch för fritt placerade textrutor (h1X/h1Y/h2X/h2Y/bodyX/bodyY).
export type TextPatch = Partial<Pick<StudioOverrides, "h1X" | "h1Y" | "h2X" | "h2Y" | "bodyX" | "bodyY">>;

type DragRole = "h1" | "h2" | "body";
interface DragBox { role: DragRole; left: number; top: number; width: number; height: number }

// Snäpp-tröskel för stödlinjerna, i % av canvasmått.
const SNAP_PCT = 1.5;

export default function StudioEditor({
  templateId, payload, brand, scale, onImagePatch, slideIndex,
  editMode = false, onEditField, onEditImage, editColor = "#6366f1",
  onTextPatch,
}: {
  templateId: string;
  payload: StudioPayload;
  brand: StudioBrand | null;
  scale: number;
  onImagePatch: (p: ImagePatch) => void;
  slideIndex?: number;
  // Inline-redigering (Fas C): klicka text→skriv direkt (contentEditable, commit-on-blur),
  // klicka bild→byt. Mallen markerar noder med data-edit="<fält>" / data-edit-image.
  editMode?: boolean;
  onEditField?: (field: string, text: string) => void;
  onEditImage?: () => void;
  editColor?: string;
  // B2: när satt blir mallens [data-drag]-textrutor fritt draggbara (mus/finger),
  // med stödlinjer för centrering och varningszon för nedre 20 % (IG:s gränssnitt).
  onTextPatch?: (p: TextPatch) => void;
}) {
  const Tpl = STUDIO_TEMPLATES[templateId]?.component;
  const { w, h } = FORMAT_DIMENSIONS[payload.format] ?? FORMAT_DIMENSIONS["1080x1350"];
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const canDragImage = Boolean(payload.imageUrl) && IMAGE_TEMPLATES.has(templateId) && !editMode;
  const canvasRef = useRef<HTMLDivElement>(null);

  // B2 — mät mallens [data-drag]-noder (i canvas-koordinater) och håll handtag i synk.
  const [dragBoxes, setDragBoxes] = useState<DragBox[]>([]);
  const [activeDrag, setActiveDrag] = useState<DragRole | null>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const textDrag = useRef<{ role: DragRole; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const canDragText = Boolean(onTextPatch) && !editMode;

  useEffect(() => {
    if (!canDragText) { setDragBoxes([]); return; }
    const root = canvasRef.current;
    if (!root) return;
    // Mät efter layout (raf) — payload-ändringar under drag ritar om mallen först.
    const raf = requestAnimationFrame(() => {
      const rootRect = root.getBoundingClientRect();
      const boxes: DragBox[] = [];
      root.querySelectorAll<HTMLElement>("[data-drag]").forEach((el) => {
        const role = el.getAttribute("data-drag") as DragRole | null;
        if (role !== "h1" && role !== "h2" && role !== "body") return;
        const r = el.getBoundingClientRect();
        // getBoundingClientRect är i skärm-px (redan skalad) → tillbaka till canvas-px.
        boxes.push({
          role,
          left: (r.left - rootRect.left) / scale,
          top: (r.top - rootRect.top) / scale,
          width: r.width / scale,
          height: r.height / scale,
        });
      });
      setDragBoxes(boxes);
    });
    return () => cancelAnimationFrame(raf);
  }, [canDragText, payload, templateId, slideIndex, scale]);

  // Gör data-edit-noderna redigerbara: contentEditable + commit-on-blur (ingen setState
  // under skrivning → ingen cursor-hopp). Bild-noder blir klickbara → byt bild.
  useEffect(() => {
    const root = canvasRef.current;
    if (!root || !editMode) return;
    const cleanups: (() => void)[] = [];
    if (onEditField) {
      root.querySelectorAll<HTMLElement>("[data-edit]").forEach((el) => {
        const field = el.getAttribute("data-edit");
        if (!field) return;
        el.contentEditable = "true";
        el.spellcheck = false;
        (el.style as CSSStyleDeclaration).outline = "none";
        el.style.cursor = "text";
        const commit = () => onEditField(field, el.innerText.replace(/\n{2,}/g, "\n").trim());
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey && field !== "body") { e.preventDefault(); el.blur(); }
          if (e.key === "Escape") el.blur();
        };
        el.addEventListener("blur", commit);
        el.addEventListener("keydown", onKey);
        cleanups.push(() => { el.contentEditable = "false"; el.removeEventListener("blur", commit); el.removeEventListener("keydown", onKey); });
      });
    }
    if (onEditImage) {
      root.querySelectorAll<HTMLElement>("[data-edit-image]").forEach((el) => {
        el.style.cursor = "pointer";
        const onClick = () => onEditImage();
        el.addEventListener("click", onClick);
        cleanups.push(() => el.removeEventListener("click", onClick));
      });
    }
    return () => cleanups.forEach((c) => c());
  }, [editMode, onEditField, onEditImage, payload, templateId, slideIndex]);

  if (!Tpl || !brand) {
    return <div style={{ width: w * scale, height: h * scale }} className="bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">Laddar…</div>;
  }

  const onDown = (e: React.MouseEvent) => {
    if (!canDragImage) return;
    drag.current = { x: e.clientX, y: e.clientY, fx: payload.overrides?.imageX || 0, fy: payload.imageFocusY };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const dxPct = ((e.clientX - drag.current.x) / (w * scale)) * 100;
    const dyPct = ((e.clientY - drag.current.y) / (h * scale)) * 100;
    onImagePatch({
      imageX: Math.max(-50, Math.min(50, drag.current.fx - dxPct)),
      imageFocusY: Math.max(0, Math.min(100, drag.current.fy - dyPct)),
    });
  };
  const onUp = () => { drag.current = null; };
  const onWheel = (e: React.WheelEvent) => {
    if (!canDragImage) return;
    const next = Math.max(1, Math.min(3, (payload.overrides?.imageScale || 1) - e.deltaY * 0.0012));
    onImagePatch({ imageScale: Math.round(next * 100) / 100 });
  };

  // ── B2: textruta-drag (pointer events = mus + finger) ──
  const ovXY = (role: DragRole): { x: number; y: number } => {
    const o = payload.overrides;
    return role === "h1" ? { x: o?.h1X || 0, y: o?.h1Y || 0 }
      : role === "h2" ? { x: o?.h2X || 0, y: o?.h2Y || 0 }
      : { x: o?.bodyX || 0, y: o?.bodyY || 0 };
  };
  const patchFor = (role: DragRole, x: number, y: number): TextPatch =>
    role === "h1" ? { h1X: x, h1Y: y } : role === "h2" ? { h2X: x, h2Y: y } : { bodyX: x, bodyY: y };

  const onTextDown = (role: DragRole) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const base = ovXY(role);
    textDrag.current = { role, startX: e.clientX, startY: e.clientY, baseX: base.x, baseY: base.y };
    setActiveDrag(role);
  };
  const onTextMove = (e: React.PointerEvent) => {
    const t = textDrag.current;
    if (!t || !onTextPatch) return;
    let x = t.baseX + ((e.clientX - t.startX) / (w * scale)) * 100;
    let y = t.baseY + ((e.clientY - t.startY) / (h * scale)) * 100;
    // Stödlinjer + snäpp: när BLOCKETS CENTRUM hamnar nära canvasens mittlinjer.
    const box = dragBoxes.find((b) => b.role === t.role);
    let vGuide = false, hGuide = false;
    if (box) {
      const base = ovXY(t.role); // boxens uppmätta läge inkluderar nuvarande offset
      const cx = ((box.left + box.width / 2 + ((x - base.x) / 100) * w) / w) * 100;
      const cy = ((box.top + box.height / 2 + ((y - base.y) / 100) * h) / h) * 100;
      if (Math.abs(cx - 50) < SNAP_PCT) { x += 50 - cx; vGuide = true; }
      if (Math.abs(cy - 50) < SNAP_PCT) { y += 50 - cy; hGuide = true; }
    }
    setGuides({ v: vGuide, h: hGuide });
    onTextPatch(patchFor(t.role, Math.max(-100, Math.min(100, Math.round(x * 10) / 10)), Math.max(-100, Math.min(100, Math.round(y * 10) / 10))));
  };
  const onTextUp = () => { textDrag.current = null; setActiveDrag(null); setGuides({ v: false, h: false }); };

  // Varningszon: blocket räknas som "i zonen" när dess nederkant når ned i nedre 20 %.
  const zoneTop = h * 0.8;
  const inWarnZone = activeDrag ? dragBoxes.some((b) => b.role === activeDrag && b.top + b.height > zoneTop) : false;

  return (
    <div style={{ position: "relative", width: w * scale, height: h * scale }}>
      <style>{FONT_CSS}</style>
      {editMode && (
        <style>{`[data-edit]:hover{outline:2px dashed ${editColor}88;outline-offset:3px;border-radius:2px}[data-edit]:focus{outline:2px solid ${editColor};outline-offset:3px}[data-edit-image]:hover{outline:3px dashed ${editColor}88;outline-offset:-3px}`}</style>
      )}
      <div ref={canvasRef} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Tpl payload={payload} brand={brand} slideIndex={slideIndex} />
      </div>
      {canDragImage && (
        <div
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}
          title="Dra för att flytta bilden · scrolla för att zooma"
          style={{ position: "absolute", inset: 0, cursor: drag.current ? "grabbing" : "grab" }}
        />
      )}
      {/* B2: dragghandtag per textruta — ligger ÖVER bild-dragytan så texten vinner. */}
      {canDragText && dragBoxes.map((b) => (
        <div
          key={b.role}
          onPointerDown={onTextDown(b.role)} onPointerMove={onTextMove} onPointerUp={onTextUp} onPointerCancel={onTextUp}
          title="Dra för att flytta texten"
          style={{
            position: "absolute",
            left: b.left * scale, top: b.top * scale, width: b.width * scale, height: b.height * scale,
            cursor: activeDrag === b.role ? "grabbing" : "move",
            touchAction: "none",
            outline: activeDrag === b.role ? `2px solid ${editColor}` : undefined,
            outlineOffset: 2,
            borderRadius: 3,
            zIndex: 5,
          }}
          className="studio-text-drag"
        />
      ))}
      {/* Diskret hover-markering på handtagen (utan att störa exporten — ligger utanför canvasRef). */}
      {canDragText && <style>{`.studio-text-drag:hover{outline:2px dashed ${editColor}66;outline-offset:2px}`}</style>}
      {/* Stödlinjer vid centrering */}
      {activeDrag && guides.v && <div style={{ position: "absolute", left: (w * scale) / 2 - 1, top: 0, bottom: 0, width: 2, background: "#22c55e", zIndex: 6, pointerEvents: "none" }} />}
      {activeDrag && guides.h && <div style={{ position: "absolute", top: (h * scale) / 2 - 1, left: 0, right: 0, height: 2, background: "#22c55e", zIndex: 6, pointerEvents: "none" }} />}
      {/* Varningszon: nedre 20 % täcks ofta av Instagrams gränssnitt */}
      {activeDrag && (
        <div style={{ position: "absolute", left: 0, right: 0, top: zoneTop * scale, bottom: 0, background: inWarnZone ? "rgba(239,68,68,0.22)" : "rgba(239,68,68,0.10)", borderTop: "2px dashed rgba(239,68,68,0.7)", zIndex: 4, pointerEvents: "none", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#b91c1c", background: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 6, marginTop: 4 }}>
            {inWarnZone ? "Texten täcks ofta av Instagrams gränssnitt här" : "Nedre 20 % täcks ofta av Instagram"}
          </span>
        </div>
      )}
    </div>
  );
}
