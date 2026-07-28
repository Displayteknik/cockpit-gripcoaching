// Reels Creator R2 — materialförsörjning. SERVER ONLY.
//
// ALLT material passerar härigenom, oavsett spår (uppladdat, Mina bilder, AI, stock),
// och kommer ut som exakt 1080x1920 JPEG i en publik bucket med en rad i studio_media.
//
// Varför beskärningen är obligatorisk: generateImagen() skickar ALDRIG bildformatet till
// API:t. lib/images.ts:244 klistrar bara in det i prompttexten ("Bildformat/komposition:
// 9:16."), så 9:16 är en förhoppning och inte en garanti. Utan det här steget hade scener
// tyst kunnat bli kvadratiska i en 9:16-film. Samma sak gäller stock och uppladdat.
//
// Varför publik bucket: Instagram Graph måste kunna HÄMTA filen vid publicering.
// client-assets är privat med signerade URL:er som går ut, alltså oanvändbar här.

import { supabaseService } from "@/lib/supabase-admin";
import { assertSafePublicUrl } from "@/lib/safe-url";
import { REEL_SIZE, type ReelMediaSource } from "@/lib/studio/reels";

const BUCKET = "studio-images";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export interface StoredReelMedia {
  id: string;
  url: string;
  path: string;
  width: number;
  height: number;
  source: ReelMediaSource;
}

// Beskär till exakt 1080x1920. "cover" = fyll ramen och kapa överskottet, aldrig
// förvräng och aldrig svarta kanter. attention-strategin behåller det visuellt
// viktigaste när ett liggande foto ska bli stående.
export async function fitToReel(input: Buffer): Promise<{ buf: Buffer; width: number; height: number }> {
  const sharp = (await import("sharp")).default; // native-modul, finns i runtime (som ensureJpegUrl)
  const buf = await sharp(input)
    .rotate() // respektera EXIF innan beskärning, annars hamnar mobilfoton fel
    .resize(REEL_SIZE.w, REEL_SIZE.h, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return { buf, width: REEL_SIZE.w, height: REEL_SIZE.h };
}

async function hamtaBild(url: string): Promise<Buffer> {
  // SSRF-skydd på ALLA externa hämtningar. Gäller även Pexels-URL:er och bilder
  // användaren pekar ut, aldrig bara det vi själva genererat.
  await assertSafePublicUrl(url);
  const res = await fetch(url);
  if (!res.ok) return Promise.reject(new Error(`Kunde inte hämta bilden (${res.status})`));
  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_SOURCE_BYTES) throw new Error("Bilden är för stor (max 25 MB)");
  return Buffer.from(ab);
}

async function saidaBucket(): Promise<void> {
  const sb = supabaseService();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
}

/**
 * Tar emot material från vilket spår som helst, normaliserar till 1080x1920 och
 * registrerar det i studio_media med sin källa. Returnerar den publika URL:en.
 *
 * dataUrl används av AI-spåret (modellen svarar med base64), url av stock, Mina bilder
 * och uppladdat. Exakt ett av dem ska anges.
 */
export async function adoptReelMedia(opts: {
  clientId: string;
  url?: string;
  dataUrl?: string;
  source: Exclude<ReelMediaSource, "">;
  sourceDetail?: string;
  dmContactId?: string | null;
}): Promise<StoredReelMedia> {
  let input: Buffer;
  if (opts.dataUrl) {
    const m = opts.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!m) throw new Error("Ogiltig bilddata");
    input = Buffer.from(m[2], "base64");
  } else if (opts.url) {
    input = await hamtaBild(opts.url);
  } else {
    throw new Error("Ingen bild angiven");
  }

  const { buf, width, height } = await fitToReel(input);

  await saidaBucket();
  const sb = supabaseService();
  const path = `${opts.clientId}/reel-${opts.source}-${Date.now()}.jpg`;
  const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (up.error) throw new Error(up.error.message);
  const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const { data, error } = await sb
    .from("studio_media")
    .insert({
      client_id: opts.clientId,
      kind: "image",
      bucket: BUCKET,
      path,
      url,
      source: opts.source,
      source_detail: opts.sourceDetail || null,
      mime: "image/jpeg",
      bytes: buf.byteLength,
      width,
      height,
      dm_contact_id: opts.dmContactId || null,
    })
    .select("id")
    .single();

  // Filen ligger uppe även om raden fallerar. Hellre en bild utan proveniens än en
  // trasig scen, men logga så det inte försvinner tyst.
  if (error) console.error("[reel-media] kunde inte skriva studio_media:", error.message);

  return { id: data?.id || "", url, path, width, height, source: opts.source };
}

/** Klientens reels-material, nyast först. Fallback till råa bucket-listningen finns i routen. */
export async function listReelMedia(clientId: string, limit = 60) {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("studio_media")
    .select("id, url, source, source_detail, width, height, created_at")
    .eq("client_id", clientId)
    .eq("kind", "image")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}
