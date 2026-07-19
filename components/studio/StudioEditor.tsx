"use client";

import { useEffect, useRef } from "react";
import { STUDIO_TEMPLATES } from "@/components/studio/registry";
import type { StudioPayload } from "@/lib/studio/payload";
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
@font-face{font-family:"Playfair Display";src:url("/fonts/playfair-900.ttf");font-weight:900}
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

export default function StudioEditor({
  templateId, payload, brand, scale, onImagePatch, slideIndex,
  editMode = false, onEditField, onEditImage, editColor = "#6366f1",
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
}) {
  const Tpl = STUDIO_TEMPLATES[templateId]?.component;
  const { w, h } = FORMAT_DIMENSIONS[payload.format] ?? FORMAT_DIMENSIONS["1080x1350"];
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const canDragImage = Boolean(payload.imageUrl) && IMAGE_TEMPLATES.has(templateId) && !editMode;
  const canvasRef = useRef<HTMLDivElement>(null);

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
    </div>
  );
}
