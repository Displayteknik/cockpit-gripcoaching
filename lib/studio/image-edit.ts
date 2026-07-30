// BILD-1 — inbyggd bildredigering i Skriv eget-läget. Spec: docs/studio/BILD-PAKET-SPEC.md.
//
// EN ren renderfunktion (canvas) producerar publiceringsbilden; previewn visar SAMMA
// funktions output → det som syns ÄR publicerings-pixlarna (pixelparitet per konstruktion).
// Typerna är client-säkra; renderfunktionerna kör bara i webbläsaren (canvas/createImageBitmap).

export type ImageEditRatio = "4:5" | "1:1" | "1.91:1" | "9:16";
export type ImageEditFit = "beskar" | "hela";
export type ImageEditFill = "blur" | "farg";

export interface ImageCrop { x: number; y: number; w: number; h: number } // 0–1 av originalet

export interface ImageEdit {
  ratio: ImageEditRatio;
  fit: ImageEditFit;
  crop: ImageCrop | null; // null = centrerad default
  fill: ImageEditFill; // används bara vid fit "hela"
  fillColor: string; // hex vid fill "farg" (klientens profilfärg)
}

export const RATIO_DIMS: Record<ImageEditRatio, { w: number; h: number }> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "1.91:1": { w: 1080, h: 566 },
  "9:16": { w: 1080, h: 1920 },
};

export const RATIO_LABELS: Record<ImageEditRatio, string> = {
  "4:5": "Porträtt 4:5",
  "1:1": "Kvadrat 1:1",
  "1.91:1": "Liggande 1.91:1",
  "9:16": "Story 9:16",
};

// Matchar originalet redan valt format (±2 %)? Då behövs ingen beskärning (neutralläge).
export function matcharRatio(imgW: number, imgH: number, ratio: ImageEditRatio): boolean {
  const d = RATIO_DIMS[ratio];
  return Math.abs(imgW / imgH - d.w / d.h) / (d.w / d.h) < 0.02;
}

// Störst möjliga centrerade crop i rätt proportion. Liggande foto + 1:1 → centrerad (spec).
export function defaultCrop(imgW: number, imgH: number, ratio: ImageEditRatio): ImageCrop {
  const mal = RATIO_DIMS[ratio].w / RATIO_DIMS[ratio].h;
  const bild = imgW / imgH;
  if (bild > mal) {
    const w = mal / bild; // andel av bildbredden
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = bild / mal;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export function normalizeImageEdit(raw: unknown): ImageEdit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<ImageEdit>;
  const ratio: ImageEditRatio = o.ratio === "1:1" || o.ratio === "1.91:1" || o.ratio === "9:16" ? o.ratio : "4:5";
  const c = o.crop && typeof o.crop === "object" ? (o.crop as ImageCrop) : null;
  const kl = (n: unknown, def: number) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : def;
  };
  return {
    ratio,
    fit: o.fit === "hela" ? "hela" : "beskar",
    crop: c ? { x: kl(c.x, 0), y: kl(c.y, 0), w: kl(c.w, 1) || 1, h: kl(c.h, 1) || 1 } : null,
    fill: o.fill === "farg" ? "farg" : "blur",
    fillColor: typeof o.fillColor === "string" ? o.fillColor : "",
  };
}

// Ladda originalet EXIF-korrekt (mobilfoton är ofta roterade i metadata).
export async function laddaBitmap(src: string): Promise<ImageBitmap> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Kunde inte ladda bilden");
  const blob = await res.blob();
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/**
 * Rendera publiceringsbilden. Samma funktion driver previewn — WYSIWYG per konstruktion.
 * fit "beskar": croppen ritas till exakt formatmått.
 * fit "hela": hela originalet (contain) ovanpå autofyllnad — blurrad cover av samma bild,
 * eller enfärgad yta ur klientens profil. Standardknepet för liggande foto i 4:5.
 */
export async function renderImageEdit(bitmap: ImageBitmap, edit: ImageEdit): Promise<Blob> {
  const { w, h } = RATIO_DIMS[edit.ratio];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  if (edit.fit === "hela") {
    if (edit.fill === "farg" && edit.fillColor) {
      ctx.fillStyle = edit.fillColor;
      ctx.fillRect(0, 0, w, h);
    } else {
      // Blurrad cover-version av samma bild som bakgrund.
      const skala = Math.max(w / bitmap.width, h / bitmap.height) * 1.12; // lite extra så blur-kanten inte läcker
      const bw = bitmap.width * skala;
      const bh = bitmap.height * skala;
      ctx.filter = "blur(36px) brightness(0.92)";
      ctx.drawImage(bitmap, (w - bw) / 2, (h - bh) / 2, bw, bh);
      ctx.filter = "none";
    }
    // Originalet intakt, contain-placerat med liten marginal.
    const marg = 0.03;
    const skala = Math.min((w * (1 - marg * 2)) / bitmap.width, (h * (1 - marg * 2)) / bitmap.height);
    const iw = bitmap.width * skala;
    const ih = bitmap.height * skala;
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 30;
    ctx.drawImage(bitmap, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.shadowBlur = 0;
  } else {
    const c = edit.crop ?? defaultCrop(bitmap.width, bitmap.height, edit.ratio);
    ctx.drawImage(
      bitmap,
      c.x * bitmap.width, c.y * bitmap.height, c.w * bitmap.width, c.h * bitmap.height,
      0, 0, w, h,
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Kunde inte skapa bilden"))), "image/jpeg", 0.92);
  });
}
