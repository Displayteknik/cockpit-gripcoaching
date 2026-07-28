// Reels Creator R3 — renderaren. KÖRS ENBART I WEBBLÄSAREN.
//
// Varför client-side: Vercel Hobby har 250 MB bundle-tak och en statisk ffmpeg-binär är
// 70 till 100 MB. Remotion hade krävt AWS Lambda, alltså ny infrastruktur och ny kostnad.
// mediabunny kodar H.264 direkt från ett canvas-element via WebCodecs, utan server.
//
// TVÅ SAKER SOM MÅSTE VARA SÅ HÄR (verifierade, inte antagna):
// 1. Kodeksträngen pinnas till main-profilen. H.264 BASELINE (avc1.42001f) stöds INTE
//    i 1080x1920 i vare sig Chrome eller Chromium — profilen har för låga nivågränser.
//    Utan pinningen blir felet en kryptisk encoder-krasch långt senare.
// 2. WebCodecs kräver en SÄKER kontext (https eller localhost). På about:blank och
//    data:-URL:er är VideoEncoder helt odefinierad.
//
// Texten ritas som ett EGET lager ovanpå bilden. Rasteriseras hela scenen och zoomas,
// zoomar rubriken med, vilket ser amatörmässigt ut.

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from "mediabunny";
import { REEL_SIZE, SAFE_ZONE, type ReelScene, type ReelStoryboard } from "./reels";

export const FPS = 30;
const TRANSITION_MS = 400;
const CODEC_STRING = "avc1.4d0034"; // H.264 main 5.2
const BITRATE = 6_000_000;

export interface RenderBrand {
  headlineFont: string;
  bodyFont: string;
  accent: string;
  ink: string;
  paper: string;
}

export const NEUTRAL_BRAND: RenderBrand = {
  headlineFont: "Inter",
  bodyFont: "Inter",
  accent: "#ec4899",
  ink: "#111111",
  paper: "#ffffff",
};

/** Kan den här webbläsaren koda reels? Svaret styr om knappen ska visas. */
export async function kanRendera(): Promise<{ ok: boolean; skal?: string }> {
  if (typeof window === "undefined") return { ok: false, skal: "Körs bara i webbläsaren" };
  if (!window.isSecureContext) return { ok: false, skal: "Kräver https" };
  if (typeof VideoEncoder === "undefined") return { ok: false, skal: "Webbläsaren saknar WebCodecs. Använd Chrome eller Edge." };
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: CODEC_STRING,
      width: REEL_SIZE.w,
      height: REEL_SIZE.h,
      bitrate: BITRATE,
      framerate: FPS,
    });
    return r.supported ? { ok: true } : { ok: false, skal: "Webbläsaren kan inte koda H.264 i det här formatet." };
  } catch {
    return { ok: false, skal: "Kunde inte kontrollera videostödet." };
  }
}

function laddaBild(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Utan crossOrigin blir canvasen "tainted" och kodningen kastar SecurityError.
    // Supabase publika bucketar svarar med Access-Control-Allow-Origin.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Kunde inte ladda bilden: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

// Ken Burns: bilden är redan exakt 1080x1920, så zoom betyder att vi ritar den större
// än ramen och låter kanterna hamna utanför. Aldrig statiska bilder.
function ritaBild(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scene: ReelScene, p: number) {
  const kb = scene.kenBurns;
  const s = kb.from + (kb.to - kb.from) * p;
  const w = REEL_SIZE.w * s;
  const h = REEL_SIZE.h * s;
  const dx = (REEL_SIZE.w - w) / 2 + (kb.panX / 100) * REEL_SIZE.w * p;
  const dy = (REEL_SIZE.h - h) / 2 + (kb.panY / 100) * REEL_SIZE.h * p;
  ctx.drawImage(img, dx, dy, w, h);
}

function radbryt(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const ord = text.split(/\s+/).filter(Boolean);
  const rader: string[] = [];
  let rad = "";
  for (const o of ord) {
    const test = rad ? `${rad} ${o}` : o;
    if (ctx.measureText(test).width > maxW && rad) {
      rader.push(rad);
      rad = o;
    } else {
      rad = test;
    }
  }
  if (rad) rader.push(rad);
  return rader;
}

// Texten hålls innanför Instagrams säkra zoner: topp 220 px (profilbild, följ-indikator),
// botten 450 px (caption, användarnamn, ljudetikett), sidor 35 px (knapparna).
function ritaText(ctx: CanvasRenderingContext2D, scene: ReelScene, brand: RenderBrand) {
  const { line1, line2 } = scene.overlay;
  if (!line1 && !line2) return;

  const marginal = Math.max(SAFE_ZONE.side, 64);
  const maxW = REEL_SIZE.w - marginal * 2;
  const bandTop = SAFE_ZONE.top;
  const bandBottom = REEL_SIZE.h - SAFE_ZONE.bottom;

  // Krymp tills blocket ryms i den säkra bandbredden. Modellen håller åtta ord per rad,
  // men ett långt ord kan fortfarande spränga ramen.
  let h1 = 96;
  let rader1: string[] = [];
  for (; h1 >= 52; h1 -= 4) {
    ctx.font = `800 ${h1}px "${brand.headlineFont}", sans-serif`;
    rader1 = radbryt(ctx, line1, maxW);
    if (rader1.length <= 3) break;
  }
  const h2 = Math.round(h1 * 0.46);
  ctx.font = `500 ${h2}px "${brand.bodyFont}", sans-serif`;
  const rader2 = line2 ? radbryt(ctx, line2, maxW) : [];

  const radH1 = h1 * 1.12;
  const radH2 = h2 * 1.3;
  const barH = 8;
  const blockH = rader1.length * radH1 + (rader2.length ? 26 + rader2.length * radH2 : 0) + barH + 22;

  const mitt = (bandTop + bandBottom) / 2;
  let y = Math.max(bandTop + 40, mitt - blockH / 2);

  // Scrim: fotona varierar, texten måste vara läsbar på alla. Mjuk toning, ingen hård ruta.
  const scrimTop = Math.max(0, y - 90);
  const scrimH = Math.min(REEL_SIZE.h - scrimTop, blockH + 180);
  const grad = ctx.createLinearGradient(0, scrimTop, 0, scrimTop + scrimH);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.65, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, REEL_SIZE.w, scrimH);

  // Varumärkesstreck i kundens accentfärg.
  ctx.fillStyle = brand.accent;
  ctx.fillRect(marginal, y, 96, barH);
  y += barH + 22;

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;

  ctx.font = `800 ${h1}px "${brand.headlineFont}", sans-serif`;
  ctx.fillStyle = "#ffffff";
  for (const r of rader1) {
    ctx.fillText(r, marginal, y);
    y += radH1;
  }

  if (rader2.length) {
    y += 26;
    ctx.font = `500 ${h2}px "${brand.bodyFont}", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (const r of rader2) {
      ctx.fillText(r, marginal, y);
      y += radH2;
    }
  }
  ctx.shadowBlur = 0;
}

/**
 * Renderar hela reelen till en mp4-Blob. onProgress får 0 till 1.
 * Kastar om någon scen saknar bild — hellre ett tydligt fel än en svart scen.
 */
export async function renderReel(
  sb: ReelStoryboard,
  brand: RenderBrand = NEUTRAL_BRAND,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const scener = sb.scenes;
  if (!scener.length) throw new Error("Storyboardet saknar scener");
  const utan = scener.findIndex((s) => !s.mediaUrl);
  if (utan >= 0) throw new Error(`Scen ${utan + 1} saknar bild`);

  const stod = await kanRendera();
  if (!stod.ok) throw new Error(stod.skal || "Kan inte rendera här");

  // Typsnitten måste vara laddade INNAN första frame ritas, annars faller de första
  // scenerna tillbaka på systemfonten mitt i filmen.
  try {
    await Promise.all([
      document.fonts.load(`800 96px "${brand.headlineFont}"`),
      document.fonts.load(`500 44px "${brand.bodyFont}"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* fonter är en förbättring, inte ett krav */
  }

  const bilder = await Promise.all(scener.map((s) => laddaBild(s.mediaUrl)));

  const canvas = document.createElement("canvas");
  canvas.width = REEL_SIZE.w;
  canvas.height = REEL_SIZE.h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Kunde inte skapa canvas");

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: BITRATE,
    fullCodecString: CODEC_STRING,
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  await output.start();

  const starter: number[] = [];
  let ack = 0;
  for (const s of scener) {
    starter.push(ack);
    ack += s.durationMs;
  }
  const totalMs = ack;
  const totalFrames = Math.max(1, Math.round((totalMs / 1000) * FPS));

  for (let f = 0; f < totalFrames; f++) {
    const t = (f / FPS) * 1000;
    let i = scener.length - 1;
    while (i > 0 && t < starter[i]) i--;
    const lokal = t - starter[i];
    const p = Math.min(1, lokal / scener[i].durationMs);

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, REEL_SIZE.w, REEL_SIZE.h);

    const overgang = scener[i].transition;
    const iOvergang = i > 0 && lokal < TRANSITION_MS && overgang !== "ingen";

    if (iOvergang) {
      // Föregående scen ligger kvar i sitt slutläge medan den nya kommer in.
      ritaBild(ctx, bilder[i - 1], scener[i - 1], 1);
      ritaText(ctx, scener[i - 1], brand);
      const k = lokal / TRANSITION_MS;
      if (overgang === "overton") {
        ctx.globalAlpha = k;
        ritaBild(ctx, bilder[i], scener[i], p);
        ritaText(ctx, scener[i], brand);
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, REEL_SIZE.w * k, REEL_SIZE.h);
        ctx.clip();
        ritaBild(ctx, bilder[i], scener[i], p);
        ritaText(ctx, scener[i], brand);
        ctx.restore();
      }
    } else {
      ritaBild(ctx, bilder[i], scener[i], p);
      ritaText(ctx, scener[i], brand);
    }

    // MÅSTE inväntas. add() returnerar ett löfte som resolvar först när kodaren är redo
    // för fler frames. Utan await växer kodarkön obegränsat och renderingen stannar helt
    // (verifierat: 315 frames utan await hängde tills tidsgränsen slog till).
    await videoSource.add(f / FPS, 1 / FPS);
    if (onProgress && f % 10 === 0) onProgress(f / totalFrames);
  }

  await output.finalize();
  onProgress?.(1);

  const buf = output.target.buffer;
  if (!buf) throw new Error("Renderingen gav ingen fil");
  return new Blob([buf], { type: "video/mp4" });
}
