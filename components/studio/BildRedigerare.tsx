"use client";

// BILD-1 — interaktiv beskärningsvy för Skriv eget-läget. Spec: docs/studio/BILD-PAKET-SPEC.md.
// Hela originalet visas med beskärningsram i valt formats proportion; bortklippt yta tonas ned.
// Ramen dras med mus/finger, zoom via reglage + pinch. "Hela bilden"-läget lägger originalet
// intakt på autofyllnad (blurrad kopia eller klientens profilfärg). Ersätter fokuspunkt-reglaget.

import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Expand } from "lucide-react";
import {
  RATIO_DIMS, RATIO_LABELS, defaultCrop, matcharRatio,
  type ImageEdit, type ImageEditRatio, type ImageCrop,
} from "@/lib/studio/image-edit";

const RATIOS: ImageEditRatio[] = ["4:5", "1:1", "1.91:1", "9:16"];

export default function BildRedigerare({
  src, edit, onChange, primary, brandColor,
}: {
  src: string;
  edit: ImageEdit | null;
  onChange: (e: ImageEdit) => void;
  primary: string;
  brandColor: string; // klientens profilfärg → "Enfärgad"-fyllnaden
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; crop: ImageCrop } | null>(null);
  const pinch = useRef<{ avstand: number; zoom: number } | null>(null);
  const pekare = useRef(new Map<number, { x: number; y: number }>());

  // Läs originalets mått EXIF-korrekt (mobilfoton är ofta roterade i metadata).
  useEffect(() => {
    let aktiv = true;
    setDims(null);
    (async () => {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const bm = await createImageBitmap(blob, { imageOrientation: "from-image" });
        if (aktiv) setDims({ w: bm.width, h: bm.height });
        bm.close();
      } catch { /* bilden visas ändå, redigering inaktiv */ }
    })();
    return () => { aktiv = false; };
  }, [src]);

  // Första gången måtten är kända: sätt default. Liggande foto → 1:1 centrerad (spec).
  useEffect(() => {
    if (!dims || edit) return;
    const ratio: ImageEditRatio = dims.w > dims.h ? "1:1" : "4:5";
    onChange({ ratio, fit: "beskar", crop: defaultCrop(dims.w, dims.h, { ratio }), fill: "blur", fillColor: brandColor });
  }, [dims, edit, onChange, brandColor]);

  const e = edit;
  const crop = e?.crop ?? (dims && e ? defaultCrop(dims.w, dims.h, e) : null);
  const neutral = Boolean(dims && e && e.fit === "beskar" && matcharRatio(dims.w, dims.h, e));

  // Zoom härleds ur croppens storlek relativt största möjliga (1 = hela ytan, 3 = max inzoomat).
  const maxCrop = dims && e ? defaultCrop(dims.w, dims.h, e) : null;
  const zoom = crop && maxCrop ? Math.max(1, Math.min(3, (maxCrop.w < 1 ? maxCrop.w / crop.w : maxCrop.h / crop.h))) : 1;

  const sattZoom = useCallback((z: number, centrum?: { cx: number; cy: number }) => {
    if (!dims || !e || !maxCrop) return;
    const kl = Math.max(1, Math.min(3, z));
    const w = maxCrop.w / kl;
    const h = maxCrop.h / kl;
    const c = e.crop ?? maxCrop;
    const cx = centrum?.cx ?? c.x + c.w / 2;
    const cy = centrum?.cy ?? c.y + c.h / 2;
    onChange({ ...e, crop: {
      x: Math.max(0, Math.min(1 - w, cx - w / 2)),
      y: Math.max(0, Math.min(1 - h, cy - h / 2)),
      w, h,
    } });
  }, [dims, e, maxCrop, onChange]);

  const bytRatio = useCallback((ratio: ImageEditRatio) => {
    if (!dims || !e) return;
    const c = e.crop;
    const ny = defaultCrop(dims.w, dims.h, { ratio });
    // Behåll ungefär samma centrum när formatet byts.
    if (c) {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      ny.x = Math.max(0, Math.min(1 - ny.w, cx - ny.w / 2));
      ny.y = Math.max(0, Math.min(1 - ny.h, cy - ny.h / 2));
    }
    onChange({ ...e, ratio, crop: ny });
  }, [dims, e, onChange]);

  // ── Drag + pinch (pointer events = mus och finger) ──
  const onDown = (ev: React.PointerEvent) => {
    if (!e || e.fit !== "beskar" || !crop) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    pekare.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pekare.current.size === 2) {
      const [a, b] = [...pekare.current.values()];
      pinch.current = { avstand: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { px: ev.clientX, py: ev.clientY, crop };
    }
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!e || !dims) return;
    if (pekare.current.has(ev.pointerId)) pekare.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    if (pinch.current && pekare.current.size === 2) {
      const [a, b] = [...pekare.current.values()];
      const nytt = Math.hypot(a.x - b.x, a.y - b.y);
      sattZoom(pinch.current.zoom * (nytt / pinch.current.avstand));
      return;
    }
    const t = drag.current;
    if (!t) return;
    // Dra RAMEN över bilden: skärm-px → andel av originalet.
    const dx = (ev.clientX - t.px) / box.width;
    const dy = (ev.clientY - t.py) / box.height;
    onChange({ ...e, crop: {
      ...t.crop,
      x: Math.max(0, Math.min(1 - t.crop.w, t.crop.x + dx)),
      y: Math.max(0, Math.min(1 - t.crop.h, t.crop.y + dy)),
    } });
  };
  const onUp = (ev: React.PointerEvent) => {
    pekare.current.delete(ev.pointerId);
    if (pekare.current.size < 2) pinch.current = null;
    if (pekare.current.size === 0) drag.current = null;
  };

  if (!e) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700">Anpassa bilden till formatet</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button onClick={() => onChange({ ...e, fit: "beskar" })}
            className="px-2.5 py-1.5 inline-flex items-center gap-1"
            style={e.fit === "beskar" ? { background: primary, color: "#fff" } : { background: "#fff", color: "#374151" }}>
            <Crop className="w-3.5 h-3.5" /> Beskär
          </button>
          <button onClick={() => onChange({ ...e, fit: "hela" })}
            className="px-2.5 py-1.5 inline-flex items-center gap-1"
            style={e.fit === "hela" ? { background: primary, color: "#fff" } : { background: "#fff", color: "#374151" }}>
            <Expand className="w-3.5 h-3.5" /> Hela bilden
          </button>
        </div>
      </div>

      {/* Formatväljare med live-effekt */}
      <div className="flex flex-wrap gap-1.5">
        {RATIOS.map((r) => (
          <button key={r} onClick={() => bytRatio(r)}
            className="px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            style={e.ratio === r ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#4b5563", background: "#fff" }}>
            {RATIO_LABELS[r]}
          </button>
        ))}
      </div>

      {e.fit === "beskar" ? (
        <>
          {/* Beskärningsvyn: hela originalet + ram, bortklippt yta nedtonad */}
          <div className="relative select-none" style={{ touchAction: "none" }}>
            <div ref={boxRef} className="relative mx-auto overflow-hidden rounded-lg" style={{ maxHeight: 340, maxWidth: "100%", aspectRatio: dims ? `${dims.w} / ${dims.h}` : undefined }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
              {crop && (
                <div
                  className="absolute rounded-sm"
                  style={{
                    left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
                    border: `2px solid ${primary}`,
                    cursor: "move",
                  }}
                >
                  <span className="absolute -top-6 left-0 text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: primary, color: "#fff" }}>
                    {RATIO_LABELS[e.ratio]}
                  </span>
                </div>
              )}
            </div>
          </div>
          {neutral ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              Bilden matchar redan formatet — ingen beskärning behövs.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Zooma</label>
              <input type="range" min={100} max={300} value={Math.round(zoom * 100)}
                onChange={(ev) => sattZoom(Number(ev.target.value) / 100)}
                className="w-full" style={{ accentColor: primary }} />
            </div>
          )}
          <p className="text-xs text-gray-400">Dra i ramen för att välja vad som syns · nyp för att zooma. Det som publiceras är exakt det du ser i förhandsvisningen.</p>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-gray-600">Bakgrund:</span>
            <button onClick={() => onChange({ ...e, fill: "blur" })}
              className="px-2.5 py-1.5 rounded-lg border font-medium"
              style={e.fill === "blur" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#4b5563", background: "#fff" }}>
              Blurrad bild
            </button>
            <button onClick={() => onChange({ ...e, fill: "farg", fillColor: e.fillColor || brandColor })}
              className="px-2.5 py-1.5 rounded-lg border font-medium inline-flex items-center gap-1.5"
              style={e.fill === "farg" ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#4b5563", background: "#fff" }}>
              <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: e.fillColor || brandColor }} /> Din profilfärg
            </button>
          </div>
          <p className="text-xs text-gray-400">Hela fotot behålls intakt — ytan runt om fylls automatiskt. Perfekt när bilden inte tål beskärning.</p>
        </div>
      )}
    </div>
  );
}
